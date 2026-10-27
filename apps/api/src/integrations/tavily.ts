import { env } from "../config/env";
import { AppError } from "../utils/app-error";

export type ResearchResult = {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
};

type TavilyResponse = {
  results?: Array<{ title?: string; url?: string; content?: string; score?: number; published_date?: string }>;
};

export async function tavilySearch(input: {
  query: string;
  topic?: "general" | "news";
  maxResults?: number;
  timeRange?: "day" | "week" | "month" | "year";
}): Promise<ResearchResult[]> {
  if (!env.TAVILY_API_KEY) throw new AppError("News search needs Tavily. Add TAVILY_API_KEY to the project .env file, then restart the API.", 503, { code: "TAVILY_NOT_CONFIGURED" });
  let response: Response;
  try {
    response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.TAVILY_API_KEY}`,
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      query: input.query,
      topic: input.topic ?? "general",
      search_depth: "basic",
      max_results: Math.min(Math.max(input.maxResults ?? 5, 1), 8),
      ...(input.timeRange ? { time_range: input.timeRange } : {}),
      include_answer: false,
      include_raw_content: false,
    }),
    });
  } catch {
    throw new AppError("Could not reach Tavily. Check the API server's internet connection and try again.", 502, { code: "TAVILY_UNAVAILABLE" });
  }
  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? "Tavily rejected the API key. Check TAVILY_API_KEY in .env."
      : response.status === 429
        ? "Tavily free-tier quota is temporarily exhausted. Wait and retry, or check your Tavily usage."
        : `Tavily news search failed (HTTP ${response.status}). Try again shortly.`;
    throw new AppError(message, response.status === 429 ? 429 : 502, { code: "TAVILY_REQUEST_FAILED" });
  }
  const payload = (await response.json()) as TavilyResponse;
  return (payload.results ?? [])
    .filter((result): result is Required<Pick<ResearchResult, "title" | "url" | "content" | "score">> & { published_date?: string } =>
      typeof result.title === "string" && typeof result.url === "string" && /^https?:\/\//i.test(result.url) &&
      typeof result.content === "string" && typeof result.score === "number")
    .map((result) => ({
      title: result.title.slice(0, 300),
      url: result.url,
      content: result.content.slice(0, 5_000),
      score: result.score,
      ...(result.published_date ? { publishedDate: result.published_date } : {}),
    }));
}
