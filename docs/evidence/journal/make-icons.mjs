// Draws the journal's app icon from the SVG below and writes the five PNG files
// the manifest and the iPad need into journal/. Run once; the PNGs are committed.
//   node docs/evidence/journal/make-icons.mjs
// Full bleed orange with three journal bullets (a dot, a circle, a dash), each
// with a line. Everything sits inside the central 80 percent that a maskable
// icon keeps. Ink #1a1918 on #ec6917 is 5.52:1.
import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#ec6917"/>
  <circle cx="160" cy="176" r="22" fill="#1a1918"/>
  <circle cx="160" cy="256" r="18" fill="none" stroke="#1a1918" stroke-width="8"/>
  <path d="M142 336h36" fill="none" stroke="#1a1918" stroke-width="8" stroke-linecap="round"/>
  <path d="M224 176h128M224 256h128M224 336h128" fill="none" stroke="#1a1918" stroke-width="12" stroke-linecap="round"/>
</svg>`;

const out = new URL('../../../journal/', import.meta.url).pathname;
const files = { 'icon-192.png': 192, 'icon-512.png': 512, 'icon-512-maskable.png': 512, 'apple-touch-icon.png': 180, 'icon-32.png': 32 };
const browser = await chromium.launch();
for (const [name, size] of Object.entries(files)) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: out + name, clip: { x: 0, y: 0, width: size, height: size }, omitBackground: false });
  await page.close();
  console.log('wrote', name, size);
}
await browser.close();
