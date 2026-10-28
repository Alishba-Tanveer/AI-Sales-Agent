import { env } from "../config/env";
import { AppError } from "../utils/app-error";

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
};

/** Shared Gemini API boundary. Provider credentials stay on the API server. */
export async function generateGeminiJson<T>(input: {
  system: string;
  prompt: string;
  temperature?: number;
}): Promise<T> {
  if (!env.GEMINI_API_KEY) throw new AppError("Content drafting needs Gemini. Add GEMINI_API_KEY to the project .env file, then restart the API.", 503, { code: "GEMINI_NOT_CONFIGURED" });

  const endpoint = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`,
  );
  endpoint.searchParams.set("key", env.GEMINI_API_KEY);
  let response: Response | null = null;
  const isGemini3 = /^gemini-3\./.test(env.GEMINI_MODEL);
  const body = JSON.stringify({
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

  // Gemini can temporarily return 503 during demand spikes. Retry with bounded backoff.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(45_000),
        body,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new AppError("Gemini took longer than 45 seconds to draft this. Please try again.", 504, { code: "GEMINI_TIMEOUT" });
      }
      throw new AppError("The API server could not connect to Gemini. Check its network connection and try again.", 502, { code: "GEMINI_UNAVAILABLE" });
    }
    if (response.status !== 503 || attempt === 2) break;
    await new Promise((resolve) => setTimeout(resolve, 1_000 * (attempt + 1)));
  }
  if (!response) throw new AppError("Gemini did not return a response. Please try again.", 502);

  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? "Gemini rejected the API key. Check GEMINI_API_KEY in .env."
      : response.status === 429
        ? "Gemini free-tier quota is temporarily exhausted. Wait and retry, or check your Google AI Studio quota."
        : response.status === 503
          ? "Gemini is temporarily overloaded. Please wait a few minutes and try again."
          : `Gemini could not draft this content (HTTP ${response.status}). Check the configured model and try again.`;
    throw new AppError(message, response.status === 429 || response.status === 503 ? response.status : 502, { code: "GEMINI_REQUEST_FAILED" });
  }
  const payload = (await response.json()) as GeminiResponse;
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new AppError("Gemini returned an empty response. Please retry.", 502);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AppError("Gemini returned an unreadable draft. Please retry.", 502);
  }
}
