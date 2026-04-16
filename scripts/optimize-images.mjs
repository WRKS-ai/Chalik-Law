import sharp from 'sharp';
import { readFileSync, statSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const img = (p) => resolve(root, 'public', 'img', p);
const pub = (p) => resolve(root, 'public', p);

function kb(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

function sizeOf(filePath) {
  if (!existsSync(filePath)) return 'N/A';
  return kb(statSync(filePath).size);
}

// ─── 1. WebP conversions ──────────────────────────────────────────────────────

const conversions = [
  {
    src: img('hero-walmart.jpg'),
    dest: img('hero-walmart.webp'),
    opts: { quality: 82 },
    resize: { width: 1920, withoutEnlargement: true },
  },
  {
    src: img('about-team.jpg'),
    dest: img('about-team.webp'),
    opts: { quality: 82 },
  },
  {
    src: img('about-team-cutout.png'),
    dest: img('about-team-cutout.webp'),
    opts: { quality: 82 },
  },
  {
    src: img('att-jason.jpg'),
    dest: img('att-jason.webp'),
    opts: { quality: 82 },
  },
  {
    src: img('att-debi.jpg'),
    dest: img('att-debi.webp'),
    opts: { quality: 82 },
  },
  {
    src: img('att-lorgia.jpg'),
    dest: img('att-lorgia.webp'),
    opts: { quality: 82 },
  },
  {
    src: img('att-suzy.jpg'),
    dest: img('att-suzy.webp'),
    opts: { quality: 82 },
  },
  {
    src: img('store-aisle.jpg'),
    dest: img('store-aisle.webp'),
    opts: { quality: 82 },
    resize: { width: 1600, withoutEnlargement: true },
  },
];

console.log('\n── WebP Conversions ──────────────────────────────────────────');

for (const c of conversions) {
  const before = sizeOf(c.src);
  let pipeline = sharp(c.src);
  if (c.resize) pipeline = pipeline.resize(c.resize);
  pipeline = pipeline.webp(c.opts);
  await pipeline.toFile(c.dest);
  const after = sizeOf(c.dest);
  const srcName = c.src.split(/[/\\]/).slice(-1)[0];
  const destName = c.dest.split(/[/\\]/).slice(-1)[0];
  console.log(`  ${srcName} (${before}) → ${destName} (${after})`);
}

// ─── 2. OG Image ─────────────────────────────────────────────────────────────

console.log('\n── OG Image ──────────────────────────────────────────────────');

const OG_W = 1200;
const OG_H = 630;
const NAVY = { r: 0, g: 56, b: 97, alpha: 1 };

// Resize cutout to fit right 60% of the OG image, bottom-aligned
// Right 60% = 720px wide. Keep aspect ratio, height max 630.
const cutoutRaw = readFileSync(img('about-team-cutout.png'));
const cutoutMeta = await sharp(cutoutRaw).metadata();
const cutoutTargetW = Math.round(OG_W * 0.60);
const cutoutTargetH = OG_H;
// Resize to PNG buffer so channel count is reliable for compositing
const cutoutResized = await sharp(cutoutRaw)
  .resize(cutoutTargetW, cutoutTargetH, { fit: 'inside', withoutEnlargement: false })
  .png()
  .toBuffer({ resolveWithObject: true });

const cutoutW = cutoutResized.info.width;
const cutoutH = cutoutResized.info.height;
// Position: right edge of image, bottom-aligned
const cutoutLeft = OG_W - cutoutW;
const cutoutTop = OG_H - cutoutH;

// Left-side gradient overlay: navy → transparent, spanning left 55% of image
const gradW = Math.round(OG_W * 0.55);
const gradH = OG_H;
const gradientSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${gradW}" height="${gradH}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#003861" stop-opacity="1"/>
      <stop offset="75%" stop-color="#003861" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#003861" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${gradW}" height="${gradH}" fill="url(#g)"/>
</svg>`;

// SVG text layer (full OG size, positioned left side)
const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}">
  <!-- CHALIK & CHALIK -->
  <text
    x="60" y="140"
    font-family="Georgia, 'Times New Roman', serif"
    font-weight="bold"
    font-size="52"
    fill="white"
    letter-spacing="1"
  >CHALIK &amp; CHALIK</text>

  <!-- Tagline line 1 -->
  <text
    x="60" y="208"
    font-family="Arial, Helvetica, sans-serif"
    font-weight="normal"
    font-size="28"
    fill="#60a5fa"
  >Florida Walmart Slip and Fall Attorneys</text>

  <!-- Tagline line 2 -->
  <text
    x="60" y="258"
    font-family="Arial, Helvetica, sans-serif"
    font-weight="normal"
    font-size="22"
    fill="white"
    opacity="0.9"
  >No Fee Unless We Win · Available 24/7</text>
</svg>`;

const ogDest = pub('og-walmart-slip-and-fall.jpg');
const ogBefore = sizeOf(ogDest);

await sharp({
  create: {
    width: OG_W,
    height: OG_H,
    channels: 4,
    background: NAVY,
  },
})
  .composite([
    // Cutout image — right side, bottom-aligned (input as PNG buffer)
    {
      input: cutoutResized.data,
      left: cutoutLeft,
      top: cutoutTop,
    },
    // Left gradient overlay
    {
      input: Buffer.from(gradientSvg),
      left: 0,
      top: 0,
    },
    // SVG text layer
    {
      input: Buffer.from(textSvg),
      left: 0,
      top: 0,
    },
  ])
  .jpeg({ quality: 88 })
  .toFile(ogDest);

const ogAfter = sizeOf(ogDest);
console.log(`  og-walmart-slip-and-fall.jpg created: ${ogAfter} (was: ${ogBefore})`);

// ─── 3. Favicon SVG ───────────────────────────────────────────────────────────

console.log('\n── Favicon ───────────────────────────────────────────────────');

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" rx="18" ry="18" fill="#003861"/>
  <text
    x="50"
    y="72"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-weight="bold"
    font-size="68"
    fill="white"
  >&amp;</text>
</svg>`;

const faviconDest = pub('favicon.svg');
const faviconBefore = sizeOf(faviconDest);
import { writeFileSync } from 'fs';
writeFileSync(faviconDest, faviconSvg, 'utf8');
const faviconAfter = sizeOf(faviconDest);
console.log(`  favicon.svg written: ${faviconAfter} (was: ${faviconBefore})`);

console.log('\n✓ All done.\n');
