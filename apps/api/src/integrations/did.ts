const DID_API_BASE = "https://api.d-id.com";
const DEFAULT_PRESENTER_IMAGE = "https://clips-presenters.d-id.com/v2/Adam/0GLJgELXjc/j0HIbyxjap/image.png";
const DEFAULT_VOICE = "en-US-JennyNeural";

export function isDIdConfigured(): boolean {
  return Boolean(process.env.D_DI_KEY_AVATAR && process.env.D_DI_KEY_AVATAR.trim().length > 0);
}

function getAuthHeader(): string {
  const key = (process.env.D_DI_KEY_AVATAR || "").trim();
  if (!key) {
    throw new Error("D_DI_KEY_AVATAR is not configured in environment variables.");
  }
  return "Basic " + Buffer.from(key).toString("base64");
}

/** Thrown when the D-ID account has no credits left (HTTP 402). */
export class DIdCreditsError extends Error {
  constructor() {
    super("Video generation is unavailable: the D-ID account has run out of credits. Please top up your D-ID plan and try again.");
    this.name = "DIdCreditsError";
  }
}

export interface CreateTalkOptions {
  text: string;
  sourceUrl?: string;
  voiceId?: string;
}

export interface TalkResponse {
  id: string;
  status: "created" | "started" | "done" | "error";
  resultUrl?: string;
  error?: string;
}

/**
 * Creates a talking avatar video job on D-ID Talks API.
 */
export async function createAvatarTalk(options: CreateTalkOptions): Promise<TalkResponse> {
  const authHeader = getAuthHeader();

  // D-ID has optimal results with concise text without excessive punctuation or markup
  const cleanText = options.text
    .replace(/[#*`_]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500);

  const payload = {
    source_url: options.sourceUrl || DEFAULT_PRESENTER_IMAGE,
    script: {
      type: "text",
      input: cleanText,
      provider: {
        type: "microsoft",
        voice_id: options.voiceId || DEFAULT_VOICE,
      },
    },
    config: {
      fluent: true,
      pad_audio: 0.0,
    },
  };

  const res = await fetch(`${DID_API_BASE}/talks`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    if (res.status === 402 || /InsufficientCredits/i.test(errorBody)) {
      throw new DIdCreditsError();
    }
    throw new Error(`D-ID talk creation failed (${res.status}): ${errorBody}`);
  }

  const data = (await res.json()) as { id: string; status: "created" | "started" | "done" | "error" };
  return {
    id: data.id,
    status: data.status,
  };
}

/**
 * Checks the status of an existing D-ID talk job.
 */
export async function getAvatarTalk(id: string): Promise<TalkResponse> {
  const authHeader = getAuthHeader();

  const res = await fetch(`${DID_API_BASE}/talks/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`D-ID talk status check failed (${res.status}): ${errorBody}`);
  }

  const data = (await res.json()) as {
    id: string;
    status: "created" | "started" | "done" | "error";
    result_url?: string;
    error?: { description?: string; message?: string };
  };

  return {
    id: data.id,
    status: data.status,
    resultUrl: data.result_url,
    error: data.error?.description || data.error?.message,
  };
}

/**
 * Polls D-ID until the video is rendered or reaches maximum wait timeout.
 */
export async function pollAvatarTalkUntilDone(id: string, maxWaitMs = 45000): Promise<TalkResponse> {
  const startTime = Date.now();
  const intervalMs = 2500;

  while (Date.now() - startTime < maxWaitMs) {
    const talk = await getAvatarTalk(id);
    if (talk.status === "done" && talk.resultUrl) {
      return talk;
    }
    if (talk.status === "error") {
      throw new Error(`D-ID video render error: ${talk.error || "Unknown render error"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  // If still processing after timeout, return current status so caller can poll asynchronously
  return await getAvatarTalk(id);
}
