/**
 * Everything a person needs to publish by hand, because LinkedIn does not let apps post for them:
 * a caption file, a teleprompter script file and a ready-to-upload post image.
 * All of it is made in the browser from the approved script. Nothing is uploaded anywhere.
 */
import type { ContentScript } from "./types";
import { scriptCaption } from "./links";

type ScriptLike = Pick<ContentScript, "title" | "hook" | "points" | "cta"> & Partial<Pick<ContentScript, "source" | "seconds">>;

const fileSafe = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "linkedin-post";

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** The text to paste under the post. */
export function downloadCaption(s: ScriptLike) {
  saveBlob(new Blob([scriptCaption(s)], { type: "text/plain;charset=utf-8" }), `${fileSafe(s.title)}-caption.txt`);
}

/** The words to read out loud while recording. */
export function downloadScript(s: ScriptLike) {
  const text = [s.title, "", "HOOK", s.hook, "", "MAIN POINTS", ...s.points.map((p, i) => `${i + 1}. ${p}`), "", "CALL TO ACTION", s.cta, "", s.source && s.source !== "Your topic" ? `Source: ${s.source}` : ""].join("\n").trim();
  saveBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `${fileSafe(s.title)}-script.txt`);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** A 1080x1350 (4:5) text card for a photo/image post: the hook large, the points below, the call to action at the bottom. */
export function downloadPostImage(s: ScriptLike) {
  const W = 1080, H = 1350, pad = 90;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not create the image.");
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0f172a"); bg.addColorStop(1, "#312e81");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#818cf8"; ctx.fillRect(pad, pad, 90, 8);
  const font = (size: number, weight = 600) => `${weight} ${size}px Inter, "Segoe UI", Helvetica, Arial, sans-serif`;
  ctx.textBaseline = "top";

  let y = pad + 50;
  ctx.fillStyle = "#ffffff"; ctx.font = font(62, 700);
  const hookLines = wrap(ctx, s.hook, W - pad * 2).slice(0, 6);
  for (const l of hookLines) { ctx.fillText(l, pad, y); y += 78; }

  y += 40;
  ctx.font = font(40, 500);
  for (const p of s.points.slice(0, 4)) {
    const lines = wrap(ctx, p, W - pad * 2 - 50).slice(0, 3);
    ctx.fillStyle = "#818cf8"; ctx.fillText("•", pad, y);
    ctx.fillStyle = "#e2e8f0";
    for (const l of lines) { ctx.fillText(l, pad + 50, y); y += 54; }
    y += 22;
  }

  ctx.font = font(40, 700); ctx.fillStyle = "#a5b4fc";
  const ctaLines = wrap(ctx, s.cta, W - pad * 2).slice(0, 3);
  let cy = H - pad - ctaLines.length * 54;
  for (const l of ctaLines) { ctx.fillText(l, pad, cy); cy += 54; }

  canvas.toBlob((blob) => { if (blob) saveBlob(blob, `${fileSafe(s.title)}-post.png`); }, "image/png");
}
