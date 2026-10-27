import { AppError } from "../../utils/app-error";

/**
 * Reads the PDF that LinkedIn makes from  Profile > Resources > Save to PDF  and pulls out the sections the
 * Profile Optimizer needs. It works on text the person gave us, so nothing is fetched from LinkedIn.
 *
 * Needs the `pdf-parse` package on the server:  npm i pdf-parse  (v1 and v2 are both supported)
 */
export interface PdfProfileSections {
  headline: string;
  about: string;
  experience: string;
  skills: string;
}

const HEADINGS = [
  "contact", "top skills", "skills", "languages", "certifications", "honors-awards", "honors & awards",
  "publications", "patents", "summary", "about", "experience", "education", "courses", "projects",
  "volunteer experience", "recommendations", "interests", "test scores", "organizations",
];

const isHeading = (line: string) => HEADINGS.includes(line.trim().toLowerCase());

export async function extractPdfText(buffer: Buffer): Promise<string> {
  if (buffer.byteLength < 5 || buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new AppError("That file isn't a PDF. Use LinkedIn’s “Save to PDF” on your profile.", 400);
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const load = (id: string) => require(id);
  let mod: any;
  try {
    mod = load("pdf-parse");
  } catch (err) {
    console.error("[linkedin-pdf] could not load pdf-parse:", err);
    throw new AppError(
      "PDF reading isn't installed on the server yet. Paste your profile text for now, or ask your developer to run: npm i pdf-parse",
      501,
    );
  }

  try {
    // pdf-parse v2: class API  ->  new PDFParse({ data }).getText()
    if (typeof mod?.PDFParse === "function") {
      const parser = new mod.PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        return result?.text ?? "";
      } finally {
        await parser.destroy?.().catch?.(() => undefined);
      }
    }

    // pdf-parse v1: function API  ->  pdfParse(buffer)
    const fn = typeof mod === "function" ? mod : typeof mod?.default === "function" ? mod.default : null;
    if (fn) {
      try {
        const parsed = await fn(buffer);
        return parsed?.text ?? "";
      } catch (firstErr) {
        // v1's index.js can misbehave when bundled; the inner file avoids that.
        try {
          const inner = load("pdf-parse/lib/pdf-parse.js");
          const parsed = await (inner.default ?? inner)(buffer);
          return parsed?.text ?? "";
        } catch {
          throw firstErr;
        }
      }
    }

    throw new Error("Unsupported pdf-parse export shape: " + Object.keys(mod ?? {}).join(","));
  } catch (err) {
    console.error("[linkedin-pdf] failed to parse PDF:", err);
    const detail = process.env.NODE_ENV !== "production" && err instanceof Error ? ` (${err.message})` : "";
    throw new AppError(
      `We couldn't read that PDF. Try saving it from LinkedIn again, or paste the text instead.${detail}`,
      400,
    );
  }
}

/** Best-effort split of LinkedIn's PDF text into the sections we use. The person reviews the result before using it. */
export function parseLinkedInPdfText(text: string): PdfProfileSections {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^page \d+ of \d+$/i.test(l));

  const sections = new Map<string, string[]>();
  let current = "_start";
  sections.set(current, []);
  for (const line of lines) {
    if (isHeading(line)) {
      current = line.toLowerCase();
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    sections.get(current)!.push(line);
  }

  const take = (...names: string[]) => {
    for (const n of names) {
      const v = sections.get(n);
      if (v && v.length) return v;
    }
    return [] as string[];
  };

  const skills = take("top skills", "skills");
  const aboutLines = take("summary", "about");

  // The name, headline and location sit just before the Summary heading. In the extracted text they end up at
  // the end of whatever section came before it, so they are lifted off that section here.
  let headline = "";
  const before = lines.findIndex((l) => ["summary", "about", "experience"].includes(l.toLowerCase()));
  if (before > 0) {
    const block: string[] = [];
    for (let i = before - 1; i >= 0 && block.length < 4; i--) {
      if (isHeading(lines[i])) break;
      block.unshift(lines[i]);
    }
    // drop the location line ("City, Country") at the end, then the name at the start
    if (block.length && /,/.test(block[block.length - 1]) && block[block.length - 1].length < 60) block.pop();
    if (block.length > 1) block.shift();
    headline = block.join(" ").trim();
    for (const name of ["top skills", "skills"]) {
      const arr = sections.get(name);
      if (arr && headline) {
        const idx = arr.findIndex((l) => headline.includes(l) && l.length > 12);
        if (idx !== -1) arr.splice(idx, arr.length - idx);
      }
    }
  }

  return {
    headline,
    about: aboutLines.join("\n").trim(),
    experience: take("experience").join("\n").trim(),
    skills: (sections.get("top skills") ?? sections.get("skills") ?? skills).join(", ").trim(),
  };
}
