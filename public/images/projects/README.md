# Projects Gallery Assets

This folder holds generated cover art and captured screenshots for the homepage projects masonry gallery.

## Regenerate paper covers

1. Install dependencies:
   `npm install`
2. Run:
   `npm run build:gallery-assets`

That script will:

- generate paper covers from the public PDFs already in `public/papers/`
- use preview PDFs as the source for unpublished or research-only work
- rasterise the first page of each paper PDF with `qlmanage`
- resize and encode the paper cover images into `public/images/projects/papers/*.webp`

Requirements:

- macOS, because the script uses `qlmanage`
- `sharp` installed from `package.json`

## Refresh live-site screenshots

These screenshots are captured separately from the Node script:

- `public/images/projects/sites/scentsense.webp`
- `public/images/projects/sites/sepsis-flow.webp`
- `public/images/projects/sites/wedding-network.webp`

Capture flow:

1. Open each live URL in a real browser automation tool such as the Playwright CLI wrapper in this Codex environment.
2. Resize the viewport to `1440x900`.
3. Wait for the page to finish its landing-state render.
4. Capture a viewport screenshot.
5. Re-encode it as a WebP and replace the matching file in `public/images/projects/sites/`.

Current live URLs:

- `https://myscenttaste.vercel.app`
- `https://sepsis-flow-web-app.onrender.com`
- `https://wedding-network.vercel.app`

## Gallery source of truth

- Tile metadata lives in `src/data/gallery.ts`.
- The homepage markup lives in `src/pages/index.astro`.
- The masonry and lightbox styling lives in `src/styles/global.css`.
