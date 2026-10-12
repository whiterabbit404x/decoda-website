/**
 * The browser-tab icons are the Decoda shield from the site header, and only it.
 *
 * public/favicon.svg is a static copy of the mark in ./logo.tsx; the raster
 * icons are rendered from that SVG by `npm run brand:icons`. These tests keep
 * the copy in step with the component and keep a second, conflicting icon set
 * (Next.js app/ icon files) from coming back.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { CHECK_PATH, SHIELD_COLORS, SHIELD_PATH } from './logo';

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');

function pngSize(file: string): { width: number; height: number } {
  const png = readFileSync(path.join(PUBLIC, file));
  assert.equal(png.subarray(1, 4).toString('latin1'), 'PNG', `${file} is a PNG`);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe('favicon set', () => {
  it('favicon.svg is the header shield: same geometry and brand colours', () => {
    const svg = readFileSync(path.join(PUBLIC, 'favicon.svg'), 'utf8');
    assert.ok(svg.includes(`d="${SHIELD_PATH}"`), 'shield outline matches logo.tsx');
    assert.ok(svg.includes(`d="${CHECK_PATH}"`), 'check mark matches logo.tsx');
    for (const colour of [...SHIELD_COLORS.stroke, ...SHIELD_COLORS.fillStrong, SHIELD_COLORS.checkStrong]) {
      assert.ok(svg.includes(`"${colour}"`), `uses ${colour}`);
    }
  });

  it('ships the ICO, PNG and Apple touch icon at their expected sizes', () => {
    assert.deepEqual(pngSize('icon.png'), { width: 32, height: 32 });
    assert.deepEqual(pngSize('apple-touch-icon.png'), { width: 180, height: 180 });

    const ico = readFileSync(path.join(PUBLIC, 'favicon.ico'));
    assert.equal(ico.readUInt16LE(2), 1, 'favicon.ico is an icon resource');
    const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico.readUInt8(6 + 16 * i));
    assert.deepEqual(sizes, [16, 32, 48]);
  });

  it('declares one icon set in the root metadata, pointing at files that exist', () => {
    const layout = readFileSync(path.join(ROOT, 'app', 'layout.tsx'), 'utf8');
    for (const file of ['favicon.ico', 'favicon.svg', 'icon.png', 'apple-touch-icon.png']) {
      assert.ok(layout.includes(`url: '/${file}'`), `layout declares /${file}`);
      assert.ok(existsSync(path.join(PUBLIC, file)), `public/${file} exists`);
    }
    // Next.js turns these app/ files into extra <link rel="icon"> tags (and app/favicon.ico
    // clashes with public/favicon.ico), so a stale mark there would shadow the real one.
    const appIcons = readdirSync(path.join(ROOT, 'app')).filter((entry) => /^(favicon|icon\d*|apple-icon\d*)\./.test(entry));
    assert.deepEqual(appIcons, []);
  });
});
