/**
 * Browser-only post assets. A script is transformed into a varied, topic-aware 4:5
 * graphic using SVG artwork, then rasterized to PNG for LinkedIn downloads.
 */
import type { ContentScript } from "./types";
import { scriptCaption } from "./links";

type ScriptLike = Pick<ContentScript, "title" | "hook" | "points" | "cta"> & Partial<Pick<ContentScript, "source" | "seconds">>;

const fileSafe = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "linkedin-post";
const escapeXml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

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

const palettes = [
  { bg: "#101528", bg2: "#30266f", accent: "#a78bfa", pop: "#38bdf8", card: "#ffffff", ink: "#f8fafc", muted: "#d6d8f4", dark: "#17162e" },
  { bg: "#082d31", bg2: "#11635e", accent: "#5eead4", pop: "#fbbf24", card: "#ffffff", ink: "#f0fdfa", muted: "#c5f5e9", dark: "#092b2c" },
  { bg: "#fff7e9", bg2: "#f4d8c5", accent: "#7c3aed", pop: "#ea580c", card: "#ffffff", ink: "#20172f", muted: "#584767", dark: "#321e48" },
  { bg: "#1c2538", bg2: "#5b294b", accent: "#fb7185", pop: "#facc15", card: "#ffffff", ink: "#fff7f4", muted: "#f6d8e2", dark: "#302238" },
  { bg: "#102b4c", bg2: "#1d5b88", accent: "#67e8f9", pop: "#c4b5fd", card: "#ffffff", ink: "#f0f9ff", muted: "#d4eaf5", dark: "#10263b" },
];

function hash(value: string) {
  let n = 2166136261;
  for (const c of value) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}

function wrap(text: string, maxChars: number, maxLines: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.,;:]?$/, "")}…`;
    return kept;
  }
  return lines;
}

function textBlock(text: string, x: number, y: number, widthChars: number, maxLines: number, size: number, color: string, weight = 500, lineHeight = Math.round(size * 1.22)) {
  const lines = wrap(text, widthChars, maxLines);
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="${size}" font-weight="${weight}">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? lineHeight : 0}">${escapeXml(line)}</tspan>`).join("")}</text>`;
}

function topicArt(s: ScriptLike, p: typeof palettes[number], variant: number) {
  const words = `${s.title} ${s.hook} ${s.points.join(" ")}`.toLowerCase();
  const stroke = p.ink;
  if (/workflow|automation|process|system|integrat|pipeline/.test(words)) return `<g fill="none" stroke="${stroke}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M360 170h120v100H360zM600 350h120v100H600zM360 530h120v100H360z" fill="${p.dark}"/><path d="M480 220h70q50 0 50 50v80M600 450v30q0 50-50 50h-70"/><circle cx="420" cy="220" r="22" fill="${p.accent}" stroke="none"/><circle cx="660" cy="400" r="22" fill="${p.pop}" stroke="none"/><circle cx="420" cy="580" r="22" fill="${p.accent}" stroke="none"/><path d="m660 350 0-26m0 26 26-1"/></g>`;
  if (/ai|agent|machine|model|data|digital/.test(words)) return `<g fill="none" stroke="${stroke}" stroke-width="8"><path d="M540 220 390 340m150-120 190 120m-340 0 130 190m210-190-130 190M390 340l-30 170m370-170 30 170m-400-170 190 80m180-80-180 80"/><circle cx="540" cy="220" r="65" fill="${p.dark}"/><circle cx="390" cy="340" r="48" fill="${p.accent}" stroke="none"/><circle cx="730" cy="340" r="48" fill="${p.pop}" stroke="none"/><circle cx="360" cy="510" r="42" fill="${p.dark}"/><circle cx="760" cy="510" r="42" fill="${p.dark}"/><circle cx="540" cy="530" r="62" fill="${p.accent}" stroke="none"/><path d="M520 220h40m-20-20v40M520 530h40m-20-20v40"/></g>`;
  if (/growth|grow|revenue|sales|customer|conversion|market/.test(words)) return `<g><path d="M330 590V380h125v210m35 0V300h125v290m35 0V200h125v390" fill="${p.dark}" stroke="${stroke}" stroke-width="8"/><path d="m330 330 150-95 120 35 160-145" fill="none" stroke="${p.accent}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/><path d="m720 125 40-5-10 40" fill="none" stroke="${p.pop}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><circle cx="480" cy="235" r="18" fill="${p.pop}"/><circle cx="600" cy="270" r="18" fill="${p.accent}"/><circle cx="760" cy="125" r="22" fill="${p.pop}"/></g>`;
  if (/design|creative|brand|content|visual|story/.test(words)) return `<g><rect x="360" y="180" width="390" height="430" rx="42" fill="${p.dark}" stroke="${stroke}" stroke-width="8"/><rect x="410" y="235" width="290" height="185" rx="26" fill="${p.accent}"/><circle cx="640" cy="300" r="42" fill="${p.pop}"/><path d="m430 390 94-98 65 68 42-43 55 73z" fill="${stroke}"/><rect x="410" y="465" width="200" height="18" rx="9" fill="${stroke}" opacity=".9"/><rect x="410" y="505" width="290" height="12" rx="6" fill="${stroke}" opacity=".5"/><rect x="410" y="540" width="245" height="12" rx="6" fill="${stroke}" opacity=".5"/><path d="M320 185 340 145l20 40 40 20-40 20-20 40-20-40-40-20zM780 510l14-28 14 28 28 14-28 14-14 28-14-28-28-14z" fill="${p.pop}"/></g>`;
  return variant % 2 === 0
    ? `<g><circle cx="540" cy="390" r="230" fill="${p.dark}" stroke="${stroke}" stroke-width="8"/><circle cx="540" cy="390" r="160" fill="none" stroke="${p.accent}" stroke-width="20" stroke-dasharray="35 22"/><circle cx="540" cy="390" r="85" fill="${p.pop}"/><path d="m505 400 28 28 62-76" fill="none" stroke="${p.dark}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/><path d="m315 170 18-35 18 35 35 18-35 18-18 35-18-35-35-18zM720 570l14-28 14 28 28 14-28 14-14 28-14-28-28-14z" fill="${p.accent}"/></g>`
    : `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="335" y="170" width="410" height="440" rx="54" fill="${p.dark}" stroke="${stroke}" stroke-width="8"/><path d="M445 390h190m-95-95v190" stroke="${p.accent}" stroke-width="32"/><circle cx="540" cy="390" r="145" stroke="${p.pop}" stroke-width="12" stroke-dasharray="3 28"/><path d="M340 210 305 175m435 35 35-35M340 570l-35 35m435-35 35 35" stroke="${stroke}" stroke-width="16"/></g>`;
}

/** A complete, topic-aware LinkedIn image. Deterministic variation makes each title use a distinct art direction. */
export function postImageSvg(s: ScriptLike) {
  const seed = hash(`${s.title}:${s.hook}`);
  const variant = seed % palettes.length;
  const p = palettes[variant];
  const titleLines = wrap(s.title || s.hook, 31, 2);
  const titleY = 178;
  const titleSize = titleLines.length > 1 ? 67 : 76;
  const title = `<text x="82" y="${titleY}" fill="${p.ink}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="${titleSize}" font-weight="760" letter-spacing="-2">${titleLines.map((line, i) => `<tspan x="82" dy="${i ? 78 : 0}">${escapeXml(line)}</tspan>`).join("")}</text>`;
  const hookY = titleY + titleLines.length * 78 + 34;
  const hook = textBlock(s.hook, 86, hookY, 55, 2, 29, p.muted, 520, 37);
  const points = s.points.slice(0, 4);
  const pointRows = points.map((point, i) => {
    const spanRow = points.length % 2 === 1 && i === points.length - 1;
    const col = spanRow ? 0 : i % 2;
    const row = Math.floor(i / 2);
    const x = 78 + col * 475;
    const y = 865 + row * 142;
    const cardWidth = spanRow ? 924 : 444;
    const color = i % 2 ? p.pop : p.accent;
    const wrapped = wrap(point, spanRow ? 62 : 27, 3);
    return `<g><rect x="${x}" y="${y}" width="${cardWidth}" height="128" rx="24" fill="${p.dark}" opacity=".74" stroke="${color}" stroke-width="3"/><circle cx="${x + 36}" cy="${y + 35}" r="18" fill="${color}"/><text x="${x + 36}" y="${y + 43}" fill="${p.dark}" text-anchor="middle" font-family="Arial,sans-serif" font-size="23" font-weight="800">${i + 1}</text><text x="${x + 68}" y="${y + 41}" fill="${p.ink}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="25" font-weight="540">${wrapped.map((line, lineIndex) => `<tspan x="${x + 68}" dy="${lineIndex ? 31 : 0}">${escapeXml(line)}</tspan>`).join("")}</text></g>`;
  }).join("");
  const cta = textBlock(s.cta, 84, 1228, 58, 2, 28, p.dark, 700, 34);
  const tag = s.source && s.source !== "Your topic" ? s.source : "IDEAS TO PUT INTO ACTION";
  const tagText = escapeXml(tag.toUpperCase().slice(0, 32));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${p.bg}"/><stop offset="1" stop-color="${p.bg2}"/></linearGradient><linearGradient id="footer" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${p.accent}"/><stop offset="1" stop-color="${p.pop}"/></linearGradient><pattern id="dots" width="42" height="42" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="2" fill="${p.ink}" opacity=".13"/></pattern><clipPath id="posterBounds"><rect width="1080" height="1350"/></clipPath></defs><g clip-path="url(#posterBounds)"><rect width="1080" height="1350" fill="url(#bg)"/><rect width="1080" height="1350" fill="url(#dots)"/><circle cx="1010" cy="65" r="235" fill="${p.accent}" opacity=".16"/><circle cx="60" cy="980" r="290" fill="${p.pop}" opacity=".09"/><rect x="78" y="68" width="470" height="50" rx="25" fill="${p.dark}" opacity=".72"/><circle cx="107" cy="93" r="9" fill="${p.pop}"/><text x="130" y="102" fill="${p.ink}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="20" font-weight="700" letter-spacing="2">${tagText}</text>${title}${hook}<g transform="translate(200 350) scale(.68)">${topicArt(s, p, variant)}</g><path d="M78 850H1002" stroke="${p.ink}" opacity=".2" stroke-width="2"/>${pointRows}<rect x="62" y="1150" width="956" height="148" rx="34" fill="url(#footer)"/><text x="86" y="1190" fill="${p.dark}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="16" font-weight="800" letter-spacing="2">YOUR NEXT STEP</text>${cta}<text x="1000" y="1325" text-anchor="end" fill="${p.ink}" opacity=".55" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="15" font-weight="600">LINKEDIN POST</text></g></svg>`;
}

export function postImageDataUrl(s: ScriptLike) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(postImageSvg(s))}`;
}

/** Render the SVG artwork to a universally uploadable PNG. */
export async function downloadPostImage(s: ScriptLike) {
  const svg = postImageSvg(s);
  const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The post image could not be rendered."));
      image.src = source;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not create the image.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("The PNG could not be created.")), "image/png"));
    saveBlob(blob, `${fileSafe(s.title)}-post.png`);
  } finally {
    URL.revokeObjectURL(source);
  }
}
