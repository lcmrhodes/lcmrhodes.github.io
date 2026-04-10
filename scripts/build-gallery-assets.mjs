/**
 * build-gallery-assets.mjs
 * ========================
 * Generates the static assets needed by the projects gallery:
 *
 *  1. Preview PDFs (first 3 pages) for the two large papers.
 *  2. First-page WebP cover images for all paper tiles, via:
 *       a) qlmanage  (macOS Quick Look — renders the first page to a high-res PNG)
 *       b) sharp     (resizes + converts to WebP)
 *
 * Run with:   node scripts/build-gallery-assets.mjs
 *
 * Requirements:
 *   - macOS (uses `qlmanage`)
 *   - pdf-lib and sharp installed as devDependencies (`npm install`)
 */

import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PAPERS_DIR = join(ROOT, 'public', 'papers');
const COVERS_OUT = join(ROOT, 'public', 'images', 'projects', 'papers');

mkdirSync(COVERS_OUT, { recursive: true });

// ─── 1. Generate 3-page preview PDFs ─────────────────────────────────────────

async function buildPreviewPdf(inputName, outputName, pageCount = 3) {
  const inputPath = join(PAPERS_DIR, inputName);
  const outputPath = join(PAPERS_DIR, outputName);
  console.log(`📄 Creating preview PDF: ${outputName} (first ${pageCount} pages)…`);
  const srcBytes = readFileSync(inputPath);
  const srcDoc = await PDFDocument.load(srcBytes);
  const total = srcDoc.getPageCount();
  const pages = Math.min(pageCount, total);
  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(srcDoc, [...Array(pages).keys()]);
  copied.forEach(p => newDoc.addPage(p));
  const outBytes = await newDoc.save();
  writeFileSync(outputPath, outBytes);
  console.log(`   ✓ Saved ${outputPath}`);
  return outputPath;
}

// ─── 2. Render first page of a PDF to WebP via qlmanage ──────────────────────

async function pdfToWebpCover(pdfPath, outputName, targetWidth = 1400) {
  const outPath = join(COVERS_OUT, outputName);
  console.log(`🖼  Rasterising cover: ${basename(pdfPath)} → ${outputName}…`);

  // qlmanage writes a file named <input>.qlpreview or <input>.png into the
  // output dir. The exact name depends on macOS version — we glob for it.
  const tmpDir = join(tmpdir(), `qlm-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    const result = spawnSync(
      'qlmanage',
      ['-t', '-s', '2000', '-o', tmpDir, pdfPath],
      { encoding: 'utf8', timeout: 30_000 },
    );

    if (result.status !== 0) {
      console.warn(`   ⚠ qlmanage exited with ${result.status}: ${result.stderr}`);
    }

    // Find the generated file (qlmanage appends .png or similar)
    const files = readdirSync(tmpDir);
    if (files.length === 0) throw new Error('qlmanage produced no output files');

    // Pick the largest file (qlmanage sometimes also emits a .ico)
    const pngFile = files
      .map(f => ({ name: f, path: join(tmpDir, f) }))
      .filter(f => f.name.endsWith('.png') || f.name.endsWith('.jpg'))
      .sort((a, b) => readFileSync(b.path).length - readFileSync(a.path).length)[0];

    if (!pngFile) throw new Error(`No PNG/JPG found among qlmanage outputs: ${files.join(', ')}`);

    await sharp(pngFile.path)
      .resize({ width: targetWidth, withoutEnlargement: true })
      .webp({ quality: 88, effort: 5 })
      .toFile(outPath);

    console.log(`   ✓ Saved ${outPath}`);
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// ─── 3. Main ─────────────────────────────────────────────────────────────────

const previewPdfs = [
  {
    input: 'gambling_spatial_analysis_luke.pdf',
    output: 'gambling_spatial_analysis_preview.pdf',
    cover: 'gambling_spatial_cover.webp',
  },
  {
    input: 'luke_rhodes_translational_review.pdf',
    output: 'luke_rhodes_translational_review_preview.pdf',
    cover: 'translational_review_cover.webp',
  },
];

const fullPdfCovers = [
  { input: 'oxford_dissertation_preview.pdf', cover: 'oxford_dissertation_cover.webp' },
  { input: 'ucl_dissertation_preview.pdf',    cover: 'ucl_dissertation_cover.webp' },
  { input: 'genetics_essay.pdf',           cover: 'genetics_essay_cover.webp' },
  { input: 'social_network_assignment.pdf', cover: 'social_network_cover.webp' },
  { input: 'invitation_template.pdf',       cover: 'invitation_template_cover.webp' },
  { input: 'oregon_dunes.pdf',             cover: 'oregon_dunes_cover.webp' },
];

// Step 1 + covers from preview PDFs
for (const { input, output, cover } of previewPdfs) {
  const previewPath = await buildPreviewPdf(input, output, 3);
  await pdfToWebpCover(previewPath, cover);
}

// Covers from full PDFs
for (const { input, cover } of fullPdfCovers) {
  await pdfToWebpCover(join(PAPERS_DIR, input), cover);
}

// ─── 4. Emit a dimensions JSON sidecar for gallery.ts ────────────────────────

console.log('\n📐 Reading dimensions of generated covers…');
const dims = {};
for (const { cover } of [...previewPdfs, ...fullPdfCovers]) {
  const meta = await sharp(join(COVERS_OUT, cover)).metadata();
  dims[cover] = { width: meta.width, height: meta.height };
  console.log(`   ${cover}: ${meta.width}×${meta.height}`);
}

const sidecarPath = join(COVERS_OUT, '_dims.json');
writeFileSync(sidecarPath, JSON.stringify(dims, null, 2));
console.log(`\n✅ Dimensions written to ${sidecarPath}`);
console.log('\nDone! Next step: capture site screenshots via the MCP preview tool.\n');
