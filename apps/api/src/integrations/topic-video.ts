import { createHash, randomUUID } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "../config/env";
import { generateGeminiJson } from "./ai";

type PixabayRendition = { url: string; width: number; height: number; size?: number };
type PixabayVideo = {
  id: number;
  pageURL: string;
  duration?: number;
  user: string;
  user_id: number;
  tags?: string;
  videos: Record<string, PixabayRendition>;
};
type Credit = { name: string; profileUrl: string; videoUrl: string };
type StoryboardScene = { heading: string; labels: [string, string, string] };

const API_BASE = "https://pixabay.com/api/videos/";
const SEARCH_CACHE_MS = 24 * 60 * 60 * 1000;
const OUTPUT_WIDTH = 1280;
const OUTPUT_HEIGHT = 720;
const STOP_WORDS = new Set(["about", "after", "also", "and", "are", "for", "from", "into", "just", "more", "that", "the", "their", "this", "with", "your", "you", "how", "what", "when", "will", "using", "use", "can", "new", "latest", "unlock", "idea", "ideas", "client", "clients", "platform", "tools", "tool", "turn", "create", "launch", "launched", "helps", "help", "best", "make", "makes", "today", "next", "need", "needs", "business", "company", "companies", "work", "working", "world", "digital", "project", "projects", "ready", "boost", "hot", "latest", "innovations", "imagine", "launching", "describing", "plain", "english", "just", "anyone", "functional", "sites", "without", "programming", "experience", "designed", "real", "solving", "across", "team"]);
const TOPIC_SYNONYMS: Record<string, string[]> = {
  ecommerce: ["e-commerce", "shopping", "retail", "store", "online"],
  "e-commerce": ["ecommerce", "shopping", "retail", "store", "online"],
  "low-code": ["lowcode", "software", "coding", "programming", "development"],
  lowcode: ["low-code", "software", "coding", "programming", "development"],
  ai: ["artificial intelligence", "automation", "machine learning", "robot"],
  rag: ["retrieval augmented generation", "artificial intelligence", "machine learning"],
  crm: ["customer relationship management", "sales", "customer", "database"],
  saas: ["software", "cloud", "technology"],
  website: ["web", "internet", "computer", "coding", "software"],
  app: ["application", "mobile", "software", "phone"],
  cybersecurity: ["security", "hacking", "computer", "data"],
  marketing: ["advertising", "social media", "business"],
};

function topicTerms(text: string) {
  return [...new Set(text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((word) => (word.length > 2 || ["ai", "ml", "ux", "api", "rag", "crm"].includes(word)) && !STOP_WORDS.has(word)))];
}

function getScenes(script: { title: string; hook: string; points: string[]; cta: string }) {
  const lines = [script.hook, ...script.points, script.cta].filter((line): line is string => Boolean(line?.trim()));
  const titleTerms = topicTerms(script.title);
  const topic = topicTerms(`${script.title} ${script.hook} ${script.points.join(" ")}`).slice(0, 10);
  return lines.map((narration, index) => {
    const specific = topicTerms(narration).filter((word) => !titleTerms.includes(word));
    const query = [...titleTerms.slice(0, 3), ...specific.slice(0, 2)].join(" ").slice(0, 100).trim();
    return { narration: narration.trim(), query: query || topic.slice(0, 3).join(" "), topicTerms: topic };
  });
}

function cleanVisualText(text: unknown, fallback: string, maxLength = 72) {
  if (typeof text !== "string") return fallback;
  return text.replace(/[<>\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength) || fallback;
}

async function buildStoryboard(script: { title: string; hook: string; points: string[]; cta: string }, scenes: Array<{ narration: string; query: string }>): Promise<StoryboardScene[]> {
  const fallback = scenes.map((scene, index) => {
    const words = topicTerms(scene.narration).filter((word) => !STOP_WORDS.has(word));
    const labels = [words.slice(0, 2).join(" "), words.slice(2, 4).join(" "), words.slice(4, 6).join(" ")].map((label, i) => cleanVisualText(label, ["Key idea", "How it works", "Next step"][i], 28)) as [string, string, string];
    return { heading: cleanVisualText(index === scenes.length - 1 ? "Your next step" : words.slice(0, 2).join(" "), `Scene ${index + 1}`, 34), labels };
  });
  try {
    const result = await generateGeminiJson<{ scenes: Array<{ heading?: string; labels?: string[] }> }>({
      system: "You are a visual storyboard designer for short narrated business videos. Return JSON only: {scenes:[{heading:string,labels:[string,string,string]}]}. Create exactly one entry per input scene. Use only facts and ideas stated in the provided script; do not invent statistics, promises, company details, or steps. Headings must be concise, and each of the three diagram labels must be concrete, topic-specific, and no longer than 28 characters. For calls to action, preserve the action the script asks viewers to take. Make labels form a simple visual explanation or process when the script supports one.",
      prompt: JSON.stringify({ topic: script.title, scenes: scenes.map((scene, index) => ({ index, spokenText: scene.narration })) }),
      temperature: 0.2,
    });
    if (!Array.isArray(result.scenes) || result.scenes.length !== scenes.length) return fallback;
    return result.scenes.map((scene, index) => {
      const labels = Array.isArray(scene.labels) ? scene.labels.slice(0, 3).map((label, labelIndex) => cleanVisualText(label, fallback[index].labels[labelIndex], 28)) : fallback[index].labels;
      while (labels.length < 3) labels.push(fallback[index].labels[labels.length]);
      return { heading: cleanVisualText(scene.heading, fallback[index].heading, 34), labels: labels as [string, string, string] };
    });
  } catch {
    return fallback;
  }
}

function relevanceScore(video: PixabayVideo, terms: string[]) {
  const tags = (video.tags || "").toLowerCase().split(",").map((tag) => tag.trim());
  if (!tags.length) return 0;
  const expanded = new Set(terms.flatMap((term) => [term, ...(TOPIC_SYNONYMS[term] || [])].map((word) => word.toLowerCase())));
  return [...expanded].reduce((score, term) => score + (tags.some((tag) => tag === term) ? 3 : tags.some((tag) => tag.includes(term) || term.includes(tag)) ? 1 : 0), 0);
}

async function pixabaySearch(query: string): Promise<PixabayVideo[]> {
  if (!env.PIXABAY_API_KEY?.trim()) throw new Error("Pixabay video search is not configured. Add PIXABAY_API_KEY to the API .env file.");
  const storageDir = path.resolve(env.VIDEO_STORAGE_DIR || path.join(process.cwd(), "uploads", "linkedin-videos"));
  const cacheDir = path.join(path.dirname(storageDir), "pixabay-search-cache");
  const cacheFile = path.join(cacheDir, `${createHash("sha256").update(query.toLowerCase()).digest("hex")}.json`);
  try {
    const cached = JSON.parse(await readFile(cacheFile, "utf8")) as { cachedAt: number; videos: PixabayVideo[] };
    if (Date.now() - cached.cachedAt < SEARCH_CACHE_MS) return cached.videos;
  } catch { /* no valid cache; request Pixabay */ }
  await mkdir(cacheDir, { recursive: true });
  let response: Response;
  try {
    response = await fetch(`${API_BASE}?${new URLSearchParams({ key: env.PIXABAY_API_KEY.trim(), q: query, lang: "en", video_type: "film", safesearch: "true", min_width: "640", min_height: "360", order: "popular", per_page: "30" })}`, {
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    throw new Error(`Could not contact Pixabay video search. ${error instanceof Error ? error.message : ""}`.trim());
  }
  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    if (response.status === 429) throw new Error("Pixabay API limit reached. Wait for its 60-second rate limit to reset.");
    throw new Error(`Pixabay video search failed (${response.status}): ${details || response.statusText}`);
  }
  const videos = ((await response.json()) as { hits?: PixabayVideo[] }).hits || [];
  await writeFile(cacheFile, JSON.stringify({ cachedAt: Date.now(), videos }), "utf8");
  return videos;
}

function chooseVideoFile(video: PixabayVideo) {
  const renditions = Object.values(video.videos || {}).filter((file) => file.url && file.width >= 640 && file.height >= 360);
  const exact720 = renditions.find((file) => file.width >= OUTPUT_WIDTH && file.height >= OUTPUT_HEIGHT && file.width <= 1920);
  return exact720 || renditions.sort((a, b) => a.width - b.width)[0];
}

async function fetchSceneVideo(scene: { query: string; topicTerms: string[] }, usedIds: Set<number>) {
  const videos = await pixabaySearch(scene.query);
  const video = videos
    .filter((candidate) => !usedIds.has(candidate.id) && chooseVideoFile(candidate))
    .map((candidate) => ({ candidate, score: relevanceScore(candidate, scene.topicTerms) }))
    .filter(({ score }) => score >= 3)
    .sort((a, b) => b.score - a.score)[0]?.candidate;
  if (!video) throw new Error(`Pixabay did not return a clip tagged closely enough to this topic (“${scene.query}”). Try editing the script to include more specific topic words.`);
  const file = chooseVideoFile(video)!;
  usedIds.add(video.id);
  const response = await fetch(file.url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body) throw new Error(`Could not download Pixabay clip ${video.id}.`);
  const safeName = `source-${video.id}.mp4`;
  return { video, file, response, safeName };
}

function runFfmpeg(args: string[], timeoutMs = 4 * 60_000) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(env.FFMPEG_PATH, args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("FFmpeg took too long to render the montage. Try again.")); }, timeoutMs);
    child.stderr.on("data", (part: Buffer) => { stderr = (stderr + part.toString()).slice(-5000); });
    child.once("error", (error) => {
      clearTimeout(timer);
      if ((error as NodeJS.ErrnoException).code === "ENOENT") reject(new Error("FFmpeg is not installed or FFMPEG_PATH is incorrect. Install FFmpeg and make sure its executable is on PATH."));
      else reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg could not render this video (exit ${code}). ${stderr.slice(-1600)}`));
    });
  });
}

function escapeFilterPath(filePath: string) {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/,/g, "\\,").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function wrapForOverlay(text: string, maxChars: number, maxLines: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, maxChars - 1).trimEnd()}…`;
  return lines.slice(0, maxLines).join("\n");
}

function progressiveWordSrt(srt: string) {
  const sourceCues = [...srt.matchAll(/\d+\s*\r?\n(\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})\s*\r?\n([\s\S]*?)(?=\r?\n\s*\r?\n|$)/g)]
    .map((match) => ({ start: match[1], end: match[2], word: match[3].trim().replace(/\s+/g, " ") }))
    .filter((cue) => cue.word);
  const result: Array<{ start: string; end: string; text: string }> = [];
  let phrase: string[] = [];
  let phraseStart = "";
  for (const cue of sourceCues) {
    if (!phrase.length) phraseStart = cue.start;
    phrase.push(cue.word);
    result.push({ start: phraseStart, end: cue.end, text: phrase.join(" ") });
    if (phrase.length >= 3 || /[.!?,;:]$/.test(cue.word)) phrase = [];
  }
  return result.map((cue, index) => `${index + 1}\n${cue.start} --> ${cue.end}\n${cue.text}`).join("\n\n");
}

function visualOverlayFilters(input: { titlePath: string; labelPaths: [string, string, string] }) {
  const fontPath = getFontPath();
  const font = fontPath ? `fontfile='${escapeFilterPath(fontPath)}':` : "";
  const filters = [
    `drawtext=${font}textfile='${escapeFilterPath(input.titlePath)}':fontcolor=white:fontsize=30:line_spacing=2:borderw=2:bordercolor=black@0.82:shadowx=2:shadowy=2:shadowcolor=black@0.6:x=52:y=38`,
  ];
  const xs = [90, 490, 890];
  const colors = ["0x9a7cff", "0x31c4ef", "0x38d996"];
  for (let i = 0; i < 3; i++) {
    filters.push(`drawbox=x=${xs[i]}:y=610:w=300:h=52:color=0x111827@0.68:t=fill`);
    filters.push(`drawbox=x=${xs[i]}:y=610:w=300:h=52:color=${colors[i]}@0.95:t=2`);
    filters.push(`drawtext=${font}textfile='${escapeFilterPath(input.labelPaths[i])}':fontcolor=white:fontsize=15:line_spacing=1:borderw=1:bordercolor=black@0.75:x=${xs[i] + 14}:y=628`);
  }
  filters.push(`drawbox=x=390:y=634:w=100:h=3:color=white@0.9:t=fill`);
  filters.push(`drawbox=x=790:y=634:w=100:h=3:color=white@0.9:t=fill`);
  return filters.join(",");
}

function getFontPath() {
  if (env.VIDEO_FONT_PATH) return path.resolve(env.VIDEO_FONT_PATH);
  const platformFonts = process.platform === "win32"
    ? ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf"]
    : ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"];
  return platformFonts.find((font) => existsSync(font));
}

export async function assertTopicVideoConfigured() {
  if (!env.PIXABAY_API_KEY?.trim()) throw new Error("Add a free Pixabay API key as PIXABAY_API_KEY in the API .env file to create topic videos.");
  await runFfmpeg(["-version"], 10_000);
  await runExternal(env.VIDEO_TTS_PYTHON, getPythonArgs(["-c", "import edge_tts"]), "Python or Edge TTS is missing. Install with `py -m pip install edge-tts` and set VIDEO_TTS_PYTHON if needed.", 15_000);
}

function runExternal(command: string, args: string[], missingMessage: string, timeoutMs = 4 * 60_000) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Speech generation took too long. Try again.")); }, timeoutMs);
    child.stderr.on("data", (part: Buffer) => { stderr = (stderr + part.toString()).slice(-3000); });
    child.once("error", (error) => {
      clearTimeout(timer);
      if ((error as NodeJS.ErrnoException).code === "ENOENT") reject(new Error(missingMessage));
      else reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Speech generation failed. ${stderr.slice(-1200)}`));
    });
  });
}

function getPythonArgs(args: string[]) {
  return /(^|[\\/])py(?:\.exe)?$/i.test(env.VIDEO_TTS_PYTHON.trim()) ? ["-3", ...args] : args;
}

function generateNarration(text: string, audioPath: string, subtitlesPath: string) {
  const script = [
    "import asyncio, sys, edge_tts",
    "async def main():",
    " text, audio_path, subtitle_path, voice = sys.argv[1:]",
    " communicate = edge_tts.Communicate(text, voice, boundary='WordBoundary')",
    " submaker = edge_tts.SubMaker()",
    " with open(audio_path, 'wb') as audio:",
    "  async for chunk in communicate.stream():",
    "   if chunk['type'] == 'audio': audio.write(chunk['data'])",
    "   elif chunk['type'] == 'WordBoundary': submaker.feed(chunk)",
    " with open(subtitle_path, 'w', encoding='utf-8') as subtitles: subtitles.write(submaker.get_srt())",
    "asyncio.run(main())",
  ].join("\n");
  return runExternal(env.VIDEO_TTS_PYTHON, getPythonArgs(["-c", script, text, audioPath, subtitlesPath, env.VIDEO_TTS_VOICE]), "Python or Edge TTS is missing. Install with `py -m pip install edge-tts` and set VIDEO_TTS_PYTHON if needed.");
}

async function getMediaDuration(filePath: string) {
  const ffmpegPath = env.FFMPEG_PATH;
  const ffprobePath = /[\\/]/.test(ffmpegPath)
    ? path.join(path.dirname(ffmpegPath), process.platform === "win32" ? "ffprobe.exe" : "ffprobe")
    : "ffprobe";
  return new Promise<number>((resolve, reject) => {
    const child = spawn(ffprobePath, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (part: Buffer) => { stdout += part.toString(); });
    child.stderr.on("data", (part: Buffer) => { stderr = (stderr + part.toString()).slice(-1500); });
    child.once("error", () => reject(new Error("Could not find ffprobe next to FFmpeg. Use the complete FFmpeg essentials folder, including ffprobe.exe.")));
    child.once("close", (code) => {
      const duration = Number(stdout.trim());
      if (code === 0 && Number.isFinite(duration) && duration > 0) resolve(duration);
      else reject(new Error(`Could not read narration duration with ffprobe. ${stderr}`));
    });
  });
}

export async function createTopicVideo(script: { title: string; hook: string; points: string[]; cta: string }) {
  await assertTopicVideoConfigured();
  const scenes = getScenes(script);
  if (scenes.length < 2) throw new Error("The script needs at least two main points before a topic video can be created.");
  const storyboard = await buildStoryboard(script, scenes);

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ai-sales-topic-video-"));
  const storageDir = path.resolve(env.VIDEO_STORAGE_DIR || path.join(process.cwd(), "uploads", "linkedin-videos"));
  const filename = `${randomUUID()}.mp4`;
  const outputPath = path.join(storageDir, filename);
  const narrationPath = path.join(tempDir, "narration.m4a");
  const montagePath = path.join(tempDir, "montage.mp4");
  let outputSaved = false;
  const credits: Credit[] = [];
  const usedIds = new Set<number>();
  const segments: string[] = [];
  const audioSegments: string[] = [];
  try {
    await mkdir(storageDir, { recursive: true });
    for (let index = 0; index < scenes.length; index++) {
      const scene = scenes[index];
      const audioPath = path.join(tempDir, `narration-${index}.mp3`);
      const rawSubtitlesPath = path.join(tempDir, `word-times-${index}.srt`);
      const subtitlesPath = path.join(tempDir, `progressive-words-${index}.srt`);
      const spokenText = (index === 0 ? `${script.title}. ` : "") + scene.narration;
      await generateNarration(spokenText, audioPath, rawSubtitlesPath);
      const timedSubtitles = progressiveWordSrt(await readFile(rawSubtitlesPath, "utf8"));
      if (!timedSubtitles) throw new Error("The voice service did not return word timings. Please retry video creation.");
      await writeFile(subtitlesPath, timedSubtitles, "utf8");
      const segmentSeconds = (await getMediaDuration(audioPath)) + 0.2;

      const chosen = await fetchSceneVideo(scene, usedIds);
      const sourcePath = path.join(tempDir, chosen.safeName);
      await pipeline(Readable.fromWeb(chosen.response.body as import("node:stream/web").ReadableStream), createWriteStream(sourcePath));
      const creditName = chosen.video.user || "Pixabay contributor";
      const profileUrl = `https://pixabay.com/users/${encodeURIComponent(creditName)}-${chosen.video.user_id}/`;
      credits.push({ name: creditName, profileUrl, videoUrl: chosen.video.pageURL });

      const segmentPath = path.join(tempDir, `segment-${index}.mp4`);
      const titlePath = path.join(tempDir, `title-${index}.txt`);
      const labelPaths = [0, 1, 2].map((labelIndex) => path.join(tempDir, `label-${index}-${labelIndex}.txt`)) as [string, string, string];
      await Promise.all([
        writeFile(titlePath, wrapForOverlay(script.title, 58, 2), "utf8"),
        ...storyboard[index].labels.map((label, labelIndex) => writeFile(labelPaths[labelIndex], wrapForOverlay(label, 32, 1), "utf8")),
      ]);
      const style = "FontName=Arial,FontSize=20,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&HCC06101A,Outline=2,Shadow=1,Alignment=8,MarginV=430";
      const filter = `scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=increase,crop=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT},fps=30,${visualOverlayFilters({ titlePath, labelPaths })},subtitles='${escapeFilterPath(subtitlesPath)}':force_style='${style}'`;
      await runFfmpeg(["-y", "-stream_loop", "-1", "-i", sourcePath, "-t", segmentSeconds.toFixed(2), "-vf", filter, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", segmentPath]);
      segments.push(segmentPath);
      audioSegments.push(audioPath);
    }

    const listPath = path.join(tempDir, "segments.txt");
    await writeFile(listPath, segments.map((part) => `file '${part.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"), "utf8");
    await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", montagePath]);
    const audioListPath = path.join(tempDir, "audio-segments.txt");
    await writeFile(audioListPath, audioSegments.map((part) => `file '${part.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"), "utf8");
    await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", audioListPath, "-c:a", "aac", "-b:a", "160k", narrationPath]);
    await runFfmpeg(["-y", "-i", montagePath, "-i", narrationPath, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", outputPath]);
    outputSaved = true;

    const publicBase = (env.API_PUBLIC_URL || `http://localhost:${env.API_PORT}`).replace(/\/+$/, "");
    const videoUrl = new URL(`/media/${filename}`, publicBase);
    videoUrl.searchParams.set("credits", JSON.stringify(credits));
    return { videoUrl: videoUrl.toString(), filename, credits };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
    if (!outputSaved) await rm(outputPath, { force: true });
  }
}
