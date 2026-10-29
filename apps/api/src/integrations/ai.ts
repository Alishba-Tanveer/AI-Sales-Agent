import { env } from "../config/env";
import { AppError } from "../utils/app-error";

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; status?: string; message?: string };
};

/**
 * How long one HTTP call to Gemini may take, and how long ALL attempts together may take.
 * The total budget is what keeps a failing request (e.g. "Research buyers") from hanging for minutes:
 * the person gets an answer within ~TOTAL_BUDGET_MS even when every attempt times out
 * (Research buyers also waits on Tavily first, so its worst case is the Tavily timeout plus this budget).
 */
const DEFAULT_ATTEMPT_TIMEOUT_MS = 18_000;
const DEFAULT_TOTAL_BUDGET_MS = 45_000;
/** Each step of the chain is tried at most this many times. Attempts rotate through the chain (step 1, step 2, step 3, step 1, ...). */
const ROUNDS = 2;
const RETRY_DELAY_MS = 800;

/** Time limits. AI_ATTEMPT_TIMEOUT_MS / AI_TOTAL_BUDGET_MS in .env override the defaults. */
function limits() {
  const attempt = env.AI_ATTEMPT_TIMEOUT_MS ?? DEFAULT_ATTEMPT_TIMEOUT_MS;
  const total = env.AI_TOTAL_BUDGET_MS ?? DEFAULT_TOTAL_BUDGET_MS;
  // An attempt with less time than this left in the budget is not worth starting.
  const minUseful = Math.min(8_000, Math.max(1_000, Math.floor(attempt / 2)));
  return { attempt, total, minUseful };
}

/** True when at least one provider has an API key. */
export function isAiConfigured(): boolean {
  return Boolean(env.GROQ_API_KEY || env.GEMINI_API_KEY);
}

/** HTTP statuses that are about Google's side being busy, not about our request. Worth retrying. */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/** What went wrong in one attempt. `retry` says whether another attempt (or the fallback model) could succeed. */
type AttemptFailure = { error: AppError; retry: boolean };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Provider = "gemini" | "groq";
type Step = { provider: Provider; model: string };
const stepKey = (step: Step) => `${step.provider}:${step.model}`;
const stepLabel = (step: Step) => `${step.provider === "groq" ? "Groq" : "Gemini"} ${step.model}`;

/**
 * The services to try, in order. The provider in AI_PROVIDER goes first, and the other provider follows as a backup
 * when it has an API key. Each provider can also have a second model, which has its own rate-limit allowance.
 */
function chain(): Step[] {
  const gemini: Step[] = [];
  if (env.GEMINI_API_KEY) {
    gemini.push({ provider: "gemini", model: env.GEMINI_MODEL });
    const fallback = env.GEMINI_FALLBACK_MODEL?.trim();
    if (fallback && fallback !== env.GEMINI_MODEL) gemini.push({ provider: "gemini", model: fallback });
  }
  const groq: Step[] = [];
  if (env.GROQ_API_KEY) {
    groq.push({ provider: "groq", model: env.GROQ_MODEL });
    const fallback = env.GROQ_FALLBACK_MODEL?.trim();
    if (fallback && fallback !== env.GROQ_MODEL) groq.push({ provider: "groq", model: fallback });
  }
  return env.AI_PROVIDER === "groq" ? [...groq, ...gemini] : [...gemini, ...groq];
}

/** Models sometimes wrap JSON in a ```json fence even when told not to. */
function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  return JSON.parse(cleaned) as T;
}

function buildBody(model: string, input: { system: string; prompt: string; temperature?: number }) {
  const isGemini3 = /^gemini-3\./.test(model);
  return JSON.stringify({
    systemInstruction: { parts: [{ text: input.system }] },
    contents: [{ role: "user", parts: [{ text: input.prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      // Gemini 3 models default to medium thinking, which adds latency to these
      // short drafting tasks. Gemini 3.6+ also ignores temperature settings.
      ...(isGemini3
        ? { thinkingConfig: { thinkingLevel: "LOW" } }
        : { temperature: input.temperature ?? 0.25 }),
    },
  });
}

/** Google's own explanation of a failed call, e.g. "The model is overloaded. Please try again later." */
async function googleMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as GeminiResponse;
    return payload.error?.message?.trim() ?? "";
  } catch {
    return "";
  }
}

/** Network-level failures (DNS, reset, TLS). The underlying cause is the useful part, so it is shown. */
function networkReason(error: unknown): string {
  if (!(error instanceof Error)) return "unknown network error";
  const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause;
  return [cause?.code, cause?.message ?? error.message].filter(Boolean).join(": ") || "unknown network error";
}

async function attemptOnce(
  model: string,
  body: string,
  timeoutMs: number,
): Promise<{ ok: true; text: string } | ({ ok: false } & AttemptFailure)> {
  const endpoint = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
  );

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      // The key goes in a header, not the URL, so it never ends up in logs or error text.
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY! },
      signal: AbortSignal.timeout(timeoutMs),
      body,
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return {
        ok: false,
        retry: true,
        error: new AppError(`Gemini (${model}) did not answer within ${Math.round(timeoutMs / 1000)} seconds.`, 504, { code: "GEMINI_TIMEOUT" }),
      };
    }
    return {
      ok: false,
      retry: true,
      error: new AppError(`Could not connect to Gemini (${model}): ${networkReason(error)}.`, 502, { code: "GEMINI_UNAVAILABLE" }),
    };
  }

  if (!response.ok) {
    const google = await googleMessage(response);
    const status = response.status;
    // A bad key fails every model the same way, so there is no point retrying or switching.
    if (status === 401 || status === 403) {
      return {
        ok: false,
        retry: false,
        error: new AppError(`Gemini rejected the API key${google ? `: ${google}` : "."} Check GEMINI_API_KEY in .env.`, 502, { code: "GEMINI_AUTH" }),
      };
    }
    // A model name Google does not know: this model is skipped and the fallback may still work.
    if (status === 404) {
      return {
        ok: false,
        retry: false,
        error: new AppError(`Gemini model "${model}" was not found${google ? `: ${google}` : "."}`, 502, { code: "GEMINI_MODEL_NOT_FOUND" }),
      };
    }
    const retry = RETRYABLE_STATUS.has(status);
    const label = status === 429 ? "Gemini quota or rate limit reached" : `Gemini (${model}) returned HTTP ${status}`;
    return {
      ok: false,
      retry,
      error: new AppError(`${label}${google ? `: ${google}` : "."}`, status === 429 || status === 503 ? status : 502, { code: "GEMINI_REQUEST_FAILED", upstreamStatus: status }),
    };
  }

  let payload: GeminiResponse;
  try {
    payload = (await response.json()) as GeminiResponse;
  } catch {
    return { ok: false, retry: true, error: new AppError(`Gemini (${model}) sent a response that could not be read.`, 502, { code: "GEMINI_BAD_RESPONSE" }) };
  }
  if (payload.promptFeedback?.blockReason) {
    return {
      ok: false,
      retry: false,
      error: new AppError(`Gemini declined this request (${payload.promptFeedback.blockReason}).`, 502, { code: "GEMINI_BLOCKED" }),
    };
  }
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) {
    const reason = payload.candidates?.[0]?.finishReason;
    return { ok: false, retry: true, error: new AppError(`Gemini (${model}) returned an empty response${reason ? ` (${reason})` : ""}.`, 502, { code: "GEMINI_EMPTY" }) };
  }
  return { ok: true, text };
}

/** One attempt against Groq's OpenAI-compatible API. Same result shape as attemptOnce(), so the retry loop treats both alike. */
async function attemptGroq(
  model: string,
  input: { system: string; prompt: string; temperature?: number },
  timeoutMs: number,
): Promise<{ ok: true; text: string } | ({ ok: false } & AttemptFailure)> {
  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.GROQ_API_KEY}` },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.25,
        // GPT-OSS models reason before answering; "low" keeps short drafts fast.
        ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
        // JSON mode needs the word "JSON" in the messages, so the instruction is added here.
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${input.system}\n\nRespond with one valid JSON object only. No markdown, no commentary.` },
          { role: "user", content: input.prompt },
        ],
      }),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return { ok: false, retry: true, error: new AppError(`Groq (${model}) did not answer within ${Math.round(timeoutMs / 1000)} seconds.`, 504, { code: "GROQ_TIMEOUT" }) };
    }
    return { ok: false, retry: true, error: new AppError(`Could not connect to Groq (${model}): ${networkReason(error)}.`, 502, { code: "GROQ_UNAVAILABLE" }) };
  }

  if (!response.ok) {
    let detail = "";
    try {
      detail = String(((await response.json()) as { error?: { message?: string } }).error?.message ?? "").trim();
    } catch {
      /* no readable body */
    }
    const status = response.status;
    if (status === 401 || status === 403) {
      return { ok: false, retry: false, error: new AppError(`Groq rejected the API key${detail ? `: ${detail}` : "."} Check GROQ_API_KEY in .env.`, 502, { code: "GROQ_AUTH" }) };
    }
    if (status === 400 || status === 404) {
      return { ok: false, retry: false, error: new AppError(`Groq could not use the model "${model}"${detail ? `: ${detail}` : "."} Groq changes which models are available, so pick a current one from console.groq.com/docs/models and set GROQ_MODEL in .env.`, 502, { code: "GROQ_MODEL_REJECTED" }) };
    }
    const label = status === 429 ? "Groq quota or rate limit reached" : `Groq (${model}) returned HTTP ${status}`;
    return {
      ok: false,
      retry: RETRYABLE_STATUS.has(status),
      error: new AppError(`${label}${detail ? `: ${detail}` : "."}`, status === 429 || status === 503 ? status : 502, { code: "GROQ_REQUEST_FAILED", upstreamStatus: status }),
    };
  }

  let payload: { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return { ok: false, retry: true, error: new AppError(`Groq (${model}) sent a response that could not be read.`, 502, { code: "GROQ_BAD_RESPONSE" }) };
  }
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) return { ok: false, retry: true, error: new AppError(`Groq (${model}) returned an empty response.`, 502, { code: "GROQ_EMPTY" }) };
  return { ok: true, text };
}

/**
 * Shared AI boundary: Groq and/or Gemini, in the order set by AI_PROVIDER. The name is kept so callers do not change. Provider credentials stay on the API server.
 *
 * Failure handling:
 *  - Timeouts, network errors, 429 and 5xx are retried with a short backoff.
 *  - Attempts alternate between the primary model and the fallback (GEMINI_FALLBACK_MODEL), so one model being
 *    overloaded or hanging does not break every AI feature.
 *  - Everything is bounded by TOTAL_BUDGET_MS, so a failure reaches the person in under a minute, not several.
 *  - The error shown is Google's own message (or the real network reason), never a guess about the person's internet.
 */
export async function generateGeminiJson<T>(input: {
  system: string;
  prompt: string;
  temperature?: number;
}): Promise<T> {
  if (!isAiConfigured()) throw new AppError("Content drafting needs an AI provider. Add GROQ_API_KEY or GEMINI_API_KEY to the project .env file, then restart the API.", 503, { code: "GEMINI_NOT_CONFIGURED" });

  const { attempt: attemptLimit, total, minUseful } = limits();
  const deadline = Date.now() + total;
  const steps = chain();
  const geminiBodies = new Map(steps.filter((step) => step.provider === "gemini").map((step) => [step.model, buildBody(step.model, input)]));
  // Steps (or whole providers) that will not work for this request, so later rounds skip them.
  const skip = new Set<string>();
  const skipProviders = new Set<Provider>();
  let lastError: AppError | null = null;
  // What each service last said, so the final error shows every reason, not only the last one.
  const failures = new Map<string, string>();
  const note = (step: Step, error: AppError) => {
    failures.set(stepKey(step), error.message.replace(/\s+/g, " ").slice(0, 220));
    console.warn(`[ai] ${stepLabel(step)} failed: ${error.message}`);
  };
  let madeAttempt = false;

  // Rotate through the chain so one service that is down, rate-limited or hanging cannot use up the whole time budget.
  for (let round = 0; round < ROUNDS; round += 1) {
    for (const step of steps) {
      if (skip.has(stepKey(step)) || skipProviders.has(step.provider)) continue;
      const remaining = deadline - Date.now();
      if (remaining < minUseful) break;
      if (madeAttempt) await sleep(Math.min(RETRY_DELAY_MS + Math.random() * 300, Math.max(0, remaining - minUseful)));
      madeAttempt = true;

      const timeoutMs = Math.min(attemptLimit, deadline - Date.now());
      const result =
        step.provider === "groq"
          ? await attemptGroq(step.model, input, timeoutMs)
          : await attemptOnce(step.model, geminiBodies.get(step.model)!, timeoutMs);
      if (result.ok) {
        try {
          return parseJson<T>(result.text);
        } catch {
          lastError = new AppError(`${stepLabel(step)} returned text that is not valid JSON.`, 502, { code: "GEMINI_BAD_JSON" });
          note(step, lastError);
          continue; // an unreadable draft is usually a one-off; the next attempt may be fine
        }
      }

      lastError = result.error;
      note(step, result.error);
      const code = result.error.details?.code;
      // A bad key fails every model of that provider the same way, so that provider is dropped. The other one may still work.
      if (code === "GEMINI_AUTH") skipProviders.add("gemini");
      else if (code === "GROQ_AUTH") skipProviders.add("groq");
      // A blocked prompt is about the request itself, so another provider will not help.
      else if (code === "GEMINI_BLOCKED") throw result.error;
      else if (!result.retry) skip.add(stepKey(step));
    }
  }

  // Everything failed. Say what each service (or the network) last said.
  if (failures.size > 1 && lastError) {
    throw new AppError(`No AI service could answer. ${[...failures.values()].join(" | ")} Please try again in a moment.`, lastError.statusCode, lastError.details);
  }
  if (lastError) {
    throw new AppError(`${lastError.message} Please try again in a moment.`, lastError.statusCode, lastError.details);
  }
  throw new AppError("The AI provider did not return a response. Please try again.", 502, { code: "GEMINI_UNAVAILABLE" });
}
