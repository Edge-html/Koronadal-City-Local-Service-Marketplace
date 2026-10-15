/**
 * Resume reading and field extraction.
 *
 * PDFs are parsed in the browser: pdf.js pulls the embedded text layer out of
 * the file and we run heuristics over it. Nothing is uploaded anywhere for the
 * parse to happen, and no third-party service is involved.
 *
 * Images are accepted and stored but carry no text layer, so there is nothing
 * to parse. That is a deliberate limit: real OCR needs Cloud Vision, which
 * requires putting the Firebase project on a billing plan. Rather than ship a
 * half-working extractor, image resumes go up with the fields typed in.
 *
 * Everything produced here is a suggestion. The worker confirms or corrects
 * each field before anything is saved to their profile, because a parser that
 * guesses is only trustworthy if a human checks it.
 */

export interface ParsedResume {
  fullName?: string;
  email?: string;
  phone?: string;
  /** Distinct skills detected, normalised and de-duplicated. */
  skills: string[];
  /** Years of experience implied by dated ranges or an explicit statement. */
  yearsExperience?: number;
  /** Credential, licence or certification names found in the text. */
  certifications: string[];
  /** Employment, education or project headings. */
  sections: string[];
  /** How much usable text was found; below the floor, parsing is not offered. */
  confidence: "none" | "low" | "medium" | "high";
  /** Raw text, kept so the worker can check what was actually read. */
  rawText: string;
}

export const MIN_EXTRACTABLE_CHARS = 120;

const SKILL_DICTIONARY = [
  // the ten marketplace trades plus common adjacents
  "carpentry", "cabinet making", "furniture repair", "plumbing", "welding",
  "masonry", "tiling", "plastering", "painting", "roofing", "sheet metal",
  "air conditioning", "aircon", "refrigeration", "appliance repair",
  "electrical wiring", "electrical installation", "automotive repair",
  "motorcycle repair", "small engine", "landscaping", "lawn care",
  "tree trimming", "house painting", "waterproofing", "gutter",
  "demolition", "steel fabrication", "glass and aluminum", "solar",
  "plumbing and water services", "general yard maintenance",
];

const CERTIFICATION_PATTERN =
  /\b(tesda|nc\s*(?:ii|iii|iv|v)|nc-?\s*(?:ii|iii)|certified|certificate|certification|licen[cs]e|accredited|diploma|coursera|polytechnic|tesda[- ]certified)\b/gi;

const SECTION_PATTERN =
  /\b(work experience|employment|professional experience|career history|education|academic|training|certifications?|skills?|projects?|summary|profile|objective|achievements?|affiliations?)\b/gi;

/** Skills map onto marketplace categories so a parsed skill can suggest one. */
const SKILL_TO_CATEGORY: Record<string, string> = {
  carpentry: "carpentry",
  "cabinet making": "carpentry",
  "furniture repair": "carpentry",
  plumbing: "plumbing",
  "plumbing and water services": "plumbing",
  welding: "welding",
  "steel fabrication": "welding",
  "sheet metal": "welding",
  masonry: "masonry",
  tiling: "masonry",
  plastering: "masonry",
  painting: "painting",
  "house painting": "painting",
  roofing: "roofing",
  waterproofing: "roofing",
  gutter: "roofing",
  "air conditioning": "aircon-appliance",
  aircon: "aircon-appliance",
  refrigeration: "aircon-appliance",
  "appliance repair": "aircon-appliance",
  "electrical wiring": "electrical",
  "electrical installation": "electrical",
  "automotive repair": "mechanical",
  "motorcycle repair": "mechanical",
  "small engine": "mechanical",
  landscaping: "groundskeeping",
  "lawn care": "groundskeeping",
  "tree trimming": "groundskeeping",
  "general yard maintenance": "groundskeeping",
};

/**
 * Read the text layer out of a PDF. Dynamically imported so the ~1.2 MB parser
 * only loads when someone actually opens a resume, never on first paint.
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Absolute URL in the browser so the worker resolves regardless of the path
  // the app is served from. Outside a browser (tests, SSR) pdf.js falls back
  // to resolving the worker out of node_modules, which a root-relative path
  // cannot satisfy.
  pdfjs.GlobalWorkerOptions.workerSrc =
    typeof window !== "undefined" && window.location
      ? `${window.location.origin}/pdf.worker.min.mjs`
      : "pdfjs-dist/legacy/build/pdf.worker.mjs";

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;

  try {
    const pages: string[] = [];
    // Cap at 8 pages: a resume is short, and a 200-page PDF should not hang
    // the tab.
    const limit = Math.min(doc.numPages, 8);

    for (let i = 1; i <= limit; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();

      // Reconstruct lines from item positions. Flattening to a single string
      // throws away the line structure that keeps a name on its own line.
      const lines: string[] = [];
      let current = "";
      let lastY: number | null = null;

      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = Math.round(item.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 2) {
          lines.push(current.trim());
          current = "";
        }
        current += item.str;
        if ("hasEOL" in item && item.hasEOL) {
          lines.push(current.trim());
          current = "";
        }
        lastY = y;
      }
      if (current.trim()) lines.push(current.trim());

      pages.push(lines.filter(Boolean).join("\n"));
    }

    return pages.join("\n\n");
  } finally {
    // The worker holds the document open otherwise; release it explicitly.
    await doc.cleanup();
    (doc as { destroy?: () => Promise<void> }).destroy?.();
  }
}

function normalise(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
}

export function parseResumeText(raw: string): ParsedResume {
  const text = normalise(raw ?? "");
  const usable = text.trim();

  if (usable.length < MIN_EXTRACTABLE_CHARS) {
    return {
      skills: [],
      certifications: [],
      sections: [],
      confidence: "none",
      rawText: usable,
    };
  }

  const email = usable.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0];

  // Philippine mobile formats first, then a looser international fallback so
  // a resume written for an overseas employer still yields something.
  const phone =
    usable.match(/(\+?63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}/)?.[0] ??
    usable.match(/\+?\d[\d\s-]{8,14}\d/)?.[0];

  const fullName = guessName(usable);

  const lower = usable.toLowerCase();
  const skills = SKILL_DICTIONARY.filter((skill) => lower.includes(skill)).filter(
    (skill, i, all) => all.indexOf(skill) === i,
  );

  const certifications = uniq(
    (usable.match(CERTIFICATION_PATTERN) ?? []).map((c) => c.trim()),
  ).slice(0, 10);

  const sections = uniq(
    (usable.match(SECTION_PATTERN) ?? []).map((s) => s.trim().toLowerCase()),
  );

  const yearsExperience = guessYears(usable);

  return {
    fullName,
    email,
    phone,
    skills,
    yearsExperience,
    certifications,
    sections,
    confidence: scoreConfidence(usable, skills.length),
    rawText: usable.slice(0, 8000),
  };
}

/**
 * A resume almost always opens with the name. Skip the first few lines when
 * they look like contact details or a job title rather than a name.
 */
function guessName(text: string): string | undefined {
  const skip = /^(curriculum|resume|résumé|cv|personal|information|profile|summary|contact)/i;

  for (const line of text.split("\n").slice(0, 6)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 4 || trimmed.length > 48) continue;
    if (skip.test(trimmed)) continue;
    if (/[\d@:/]/.test(trimmed)) continue;

    const words = trimmed.split(/\s+/);
    const looksLikeName =
      words.length >= 2 &&
      words.length <= 4 &&
      words.every((w) => /^[A-Za-z.'-]+$/.test(w));

    if (looksLikeName) {
      return trimmed
        .split(/\s+/)
        .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    }
  }
  return undefined;
}

/**
 * Look for an explicit statement first ("12 years of experience"), then fall
 * back to the span between the earliest and latest year in the document.
 */
function guessYears(text: string): number | undefined {
  const explicit = text.match(
    /(\d{1,2})\s*\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp\b|working|hands-on)/i,
  );
  if (explicit) {
    const value = Number(explicit[1]);
    if (value >= 0 && value <= 60) return value;
  }

  const years = [...text.matchAll(/\b(19[89]\d|20[0-4]\d)\b/g)]
    .map((m) => Number(m[1]))
    .filter((y) => y >= 1980 && y <= 2035);

  if (years.length < 2) return undefined;

  const earliest = Math.min(...years);
  const latest = Math.max(...years);
  const span = latest - earliest;

  // A range wider than 35 years is almost certainly dates of birth or
  // unrelated references rather than a career.
  return span > 0 && span <= 35 ? span : undefined;
}

function scoreConfidence(text: string, skillCount: number): ParsedResume["confidence"] {
  const length = text.trim().length;
  if (length > 1400 && skillCount >= 2) return "high";
  if (length > 600) return "medium";
  return "low";
}

function uniq(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = v.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Suggest a marketplace category from the parsed skills. */
export function suggestCategory(skills: string[]): string | undefined {
  for (const skill of skills) {
    const hit = SKILL_TO_CATEGORY[skill.toLowerCase()];
    if (hit) return hit;
  }
  return undefined;
}

export function describeConfidence(confidence: ParsedResume["confidence"]): string {
  switch (confidence) {
    case "high":
      return "Strong text layer found. Check the fields below before saving.";
    case "medium":
      return "Some text was readable. Some fields may be missing.";
    case "low":
      return "Only a little text was readable. Fill in what is missing yourself.";
    default:
      return "No readable text found in this file.";
  }
}