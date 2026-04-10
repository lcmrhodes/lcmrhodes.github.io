/**
 * gallery.ts
 * ----------
 * Data source for the Projects tab gallery.
 * Tiles are ordered to create visual variety across the masonry columns —
 * websites, images, and papers interleave so the rhythm stays varied at 3, 2,
 * and 1 column breakpoints.
 *
 * To regenerate cover images + preview PDFs:
 *   node scripts/build-gallery-assets.mjs
 *
 * To refresh site screenshots:
 *   run the browser-capture flow described in public/images/projects/README.md
 */

export type SiteTile = {
  kind: 'site';
  id: string;
  title: string;
  eyebrow: string;
  caption: string;
  cover: string;
  coverWidth: number;
  coverHeight: number;
  href: string;
};

export type PaperTile = {
  kind: 'paper';
  id: string;
  title: string;
  eyebrow: string;
  caption: string;
  cover: string;
  coverWidth: number;
  coverHeight: number;
  href: string;
};

export type ImageTile = {
  kind: 'image';
  id: string;
  title: string;
  eyebrow: string;
  caption: string;
  cover: string;
  coverWidth: number;
  coverHeight: number;
  full: string;
  fullWidth: number;
  fullHeight: number;
};

export type GalleryTile = SiteTile | PaperTile | ImageTile;

export const galleryTiles: GalleryTile[] = [
  // ── 1: WeddingNetwork — site (landscape screenshot)
  {
    kind: 'site',
    id: 'wedding-network',
    title: 'WeddingNetwork',
    eyebrow: 'Website · 2026',
    caption: 'Interactive invitation site that turns anonymised guest-network analysis into a constellation-style wedding experience.',
    cover: '/images/projects/sites/wedding-network.webp',
    coverWidth: 1440,
    coverHeight: 900,
    href: 'https://wedding-network.vercel.app',
  },

  // ── 2: Tolkien map — image (landscape, lightbox opens 4960×3507 full)
  {
    kind: 'image',
    id: 'tolkien',
    title: 'Tolkien World Map',
    eyebrow: 'Illustration',
    caption: 'Hand-crafted cartographic illustration of Tolkien\'s world.',
    cover: '/images/gallery/tolkien_thumb.jpg',
    coverWidth: 800,
    coverHeight: 565,
    full: '/images/gallery/tolkien_full.png',
    fullWidth: 4960,
    fullHeight: 3507,
  },

  // ── 3: ScentSense — site
  {
    kind: 'site',
    id: 'scentsense',
    title: 'ScentSense',
    eyebrow: 'Website · 2026',
    caption: 'Editorial fragrance profiler built around taste-profile inference and recommendation logic from user-selected reference scents.',
    cover: '/images/projects/sites/scentsense.webp',
    coverWidth: 1440,
    coverHeight: 900,
    href: 'https://myscenttaste.vercel.app',
  },

  // ── 4: Gambling spatial analysis — preview paper (portrait)
  {
    kind: 'paper',
    id: 'gambling-spatial',
    title: 'Reassessing Gambling Related Health Outcomes',
    eyebrow: 'Paper · 3-page preview',
    caption: '3-page preview of an Oxford paper on how spatial analysis can strengthen public-health evaluations of gambling harm.',
    cover: '/images/projects/papers/gambling_spatial_cover.webp',
    coverWidth: 1400,
    coverHeight: 1982,
    href: '/papers/gambling_spatial_analysis_preview.pdf',
  },

  // ── 5: Moran's map — image (square)
  {
    kind: 'image',
    id: 'morans-map',
    title: "Moran's I Spatial Map",
    eyebrow: 'Visualisation · 2024',
    caption: "Spatial autocorrelation map produced during the gambling harm analysis.",
    cover: '/images/gallery/morans_map.jpg',
    coverWidth: 1200,
    coverHeight: 1200,
    full: '/images/gallery/morans_map.jpg',
    fullWidth: 1200,
    fullHeight: 1200,
  },

  // ── 6: Sepsis Flow — site
  {
    kind: 'site',
    id: 'sepsis-flow',
    title: 'Sepsis Flow',
    eyebrow: 'Website · 2026',
    caption: 'Hosted research prototype for two-day paediatric treatment-intensity prediction across linked clinical prediction services.',
    cover: '/images/projects/sites/sepsis-flow.webp',
    coverWidth: 1440,
    coverHeight: 900,
    href: 'https://sepsis-flow-web-app.onrender.com',
  },

  // ── 7: Translational review — preview paper (portrait)
  {
    kind: 'paper',
    id: 'translational-review',
    title: 'Phenotypes of UK Immunisation Modelling',
    eyebrow: 'Paper · 3-page preview',
    caption: '3-page preview of an Oxford policy review on vaccine-modelling transparency, public engagement, and outbreak response.',
    cover: '/images/projects/papers/translational_review_cover.webp',
    coverWidth: 1400,
    coverHeight: 1982,
    href: '/papers/luke_rhodes_translational_review_preview.pdf',
  },

  // ── 8: Bookmaker map — image (landscape)
  {
    kind: 'image',
    id: 'bookmaker-map',
    title: 'Bookmaker Density Map',
    eyebrow: 'Visualisation · 2024',
    caption: 'Geographic distribution of licensed bookmakers against deprivation indices.',
    cover: '/images/gallery/bookmaker_map.jpg',
    coverWidth: 1200,
    coverHeight: 658,
    full: '/images/gallery/bookmaker_map.jpg',
    fullWidth: 1200,
    fullHeight: 658,
  },

  // ── 9: Social network assignment — full paper (portrait)
  {
    kind: 'paper',
    id: 'social-network',
    title: 'Structure and Influence within a Social Network',
    eyebrow: 'Paper · MSc coursework',
    caption: 'Coursework paper analysing connectivity, clustering, and role differentiation in an Instagram network.',
    cover: '/images/projects/papers/social_network_cover.webp',
    coverWidth: 1400,
    coverHeight: 1979,
    href: '/papers/social_network_assignment.pdf',
  },

  // ── 10: Neighbour map — image (square)
  {
    kind: 'image',
    id: 'neighbour-map',
    title: 'Neighbourhood Map',
    eyebrow: 'Visualisation · 2024',
    caption: 'Spatial neighbours and adjacency structures for the gambling harm regression models.',
    cover: '/images/gallery/neighbour_map.jpg',
    coverWidth: 1200,
    coverHeight: 1200,
    full: '/images/gallery/neighbour_map.jpg',
    fullWidth: 1200,
    fullHeight: 1200,
  },

  // ── 11: Genetics essay — full paper (portrait)
  {
    kind: 'paper',
    id: 'genetics-essay',
    title: 'On Genetic Factors Influencing Educational Attainment',
    eyebrow: 'Paper · BSc coursework',
    caption: 'Critical essay on heritability, polygenic scores, and epigenetic mechanisms in educational attainment.',
    cover: '/images/projects/papers/genetics_essay_cover.webp',
    coverWidth: 1400,
    coverHeight: 1979,
    href: '/papers/genetics_essay.pdf',
  },

  // ── 12: Design principles map — image (landscape)
  {
    kind: 'image',
    id: 'design-principles-map',
    title: 'Top Tripadvisor Locations in Japan',
    eyebrow: 'Visualisation · 2024',
    caption: 'Illustrated map of Japan designed to highlight a curated set of top Tripadvisor destinations across the country.',
    cover: '/images/gallery/design_principles_map.jpg',
    coverWidth: 1200,
    coverHeight: 848,
    full: '/images/gallery/design_principles_map.jpg',
    fullWidth: 1200,
    fullHeight: 848,
  },

  // ── 13: Oregon Dunes — full paper (portrait)
  {
    kind: 'paper',
    id: 'oregon-dunes',
    title: "Frank Herbert's Oregon Dunes",
    eyebrow: 'Paper · Field study',
    caption: 'Atlas-style visual essay linking the Oregon Dunes landscape to ecology, species, and Frank Herbert’s fiction.',
    cover: '/images/projects/papers/oregon_dunes_cover.webp',
    coverWidth: 1400,
    coverHeight: 1980,
    href: '/papers/oregon_dunes.pdf',
  },

  // ── 14: Invitation template — full paper (landscape)
  {
    kind: 'paper',
    id: 'invitation-template',
    title: 'Luke & Krizia Invitation',
    eyebrow: 'Design · 2026',
    caption: 'Print invitation layout pairing wedding typography with a custom social-network visual motif.',
    cover: '/images/projects/papers/invitation_template_cover.webp',
    coverWidth: 1400,
    coverHeight: 1009,
    href: '/papers/invitation_template.pdf',
  },
];
