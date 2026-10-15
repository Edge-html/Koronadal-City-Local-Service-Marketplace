/**
 * Copies the pdf.js worker into public/ so it is served from our own origin.
 *
 * pdf.js loads its worker as a separate script. Pointing it at a CDN would
 * make the resume parser depend on an external host being reachable, and this
 * app has already run into requests being blocked by extensions. Self-hosting
 * removes that failure mode.
 *
 * Runs on postinstall; safe to run manually with: node scripts/copy-pdf-worker.mjs
 */

import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(
  ROOT,
  "node_modules",
  "pdfjs-dist",
  "build",
  "pdf.worker.min.mjs",
);
const TARGET_DIR = join(ROOT, "public");
const TARGET = join(TARGET_DIR, "pdf.worker.min.mjs");

if (!existsSync(SOURCE)) {
  console.error(
    "[copy-pdf-worker] pdfjs-dist is not installed. Run `npm install` first.",
  );
  process.exit(1);
}

mkdirSync(TARGET_DIR, { recursive: true });
copyFileSync(SOURCE, TARGET);

const kb = Math.round(statSync(TARGET).size / 1024);
console.log(`[copy-pdf-worker] public/pdf.worker.min.mjs (${kb} kB)`);