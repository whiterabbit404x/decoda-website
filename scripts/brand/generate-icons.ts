/**
 * Render the raster favicons from the canonical public/favicon.svg.
 *
 *   npm run brand:icons
 *
 * Writes, next to the SVG in public/:
 *   favicon.ico           16, 32 and 48 px frames (PNG-encoded), transparent
 *   icon.png              32 × 32, transparent
 *   apple-touch-icon.png  180 × 180 on white (iOS fills transparency with black)
 *
 * Every frame is rasterized by Chromium directly at its final size from the
 * same SVG a browser tab shows, so the icons cannot drift from the mark.
 * Requires Playwright with a Chromium build; it is not a project dependency
 * (`npm i -g playwright` and run with NODE_PATH="$(npm root -g)" if needed).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PUBLIC = path.resolve(__dirname, '..', '..', 'public');
const ICO_SIZES = [16, 32, 48];
const APPLE_SIZE = 180;
/** The shield's share of the apple-touch-icon, leaving room for the iOS corner mask. */
const APPLE_MARK = 128;

type Page = {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  setContent(html: string): Promise<void>;
  screenshot(options: { omitBackground: boolean; type: 'png' }): Promise<Buffer>;
};

function loadChromium(): { launch(): Promise<{ newPage(): Promise<Page>; close(): Promise<void> }> } {
  try {
    return require('playwright').chromium;
  } catch {
    throw new Error('Playwright is not installed. Install it (npm i -g playwright) and run with NODE_PATH="$(npm root -g)".');
  }
}

async function render(page: Page, svg: string, canvas: number, mark: number, background: string): Promise<Buffer> {
  await page.setViewportSize({ width: canvas, height: canvas });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  await page.setContent(
    `<html><body style="margin:0;width:${canvas}px;height:${canvas}px;display:grid;place-items:center;background:${background}">` +
      `<img src="${src}" width="${mark}" height="${mark}" style="display:block"></body></html>`,
  );
  return page.screenshot({ omitBackground: background === 'transparent', type: 'png' });
}

/** An ICO container holding PNG frames (supported by every current browser and OS). */
function packIco(frames: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...frames.map((frame) => frame.png)]);
}

async function main(): Promise<void> {
  const svg = readFileSync(path.join(PUBLIC, 'favicon.svg'), 'utf8');
  const browser = await loadChromium().launch();
  try {
    const page = await browser.newPage();
    const frames: { size: number; png: Buffer }[] = [];
    for (const size of ICO_SIZES) frames.push({ size, png: await render(page, svg, size, size, 'transparent') });

    writeFileSync(path.join(PUBLIC, 'favicon.ico'), packIco(frames));
    writeFileSync(path.join(PUBLIC, 'icon.png'), frames.find((frame) => frame.size === 32)!.png);
    writeFileSync(path.join(PUBLIC, 'apple-touch-icon.png'), await render(page, svg, APPLE_SIZE, APPLE_MARK, '#ffffff'));
  } finally {
    await browser.close();
  }
  console.log(`Wrote favicon.ico (${ICO_SIZES.join(', ')} px), icon.png and apple-touch-icon.png to ${PUBLIC}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
