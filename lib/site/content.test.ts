/**
 * Guards for what the public website claims.
 *
 * Prices, plan names and product statuses have one source each
 * (lib/site/pricing.ts, lib/site/products.ts). These tests keep every page
 * reading from them and keep retired or unsupported claims from creeping back.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { COMPARISON, PLANS, PRICING_SUMMARY, SCALE_STARTING_PRICE_USD } from './pricing';
import { ASSETS, GUARD, LIFECYCLE_ORDER, SITE_PRODUCTS, VAULT } from './products';

const ROOT = path.resolve(__dirname, '..', '..');

/** Authenticated platform surfaces (launcher, account, admin, APIs) are not marketing copy. */
const PLATFORM = /^(app\/(account|admin|launcher|api|auth|sign-in)\/|components\/platform\/)/;

/** Every public-site source file (pages, components, site data). */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(tsx?|css)$/.test(entry) && !entry.endsWith('.test.ts')) out.push(full);
    }
  };
  for (const dir of ['app', 'components', 'lib/site']) walk(path.join(ROOT, dir));
  return out;
}

const SOURCES = sourceFiles()
  .map((file) => ({ file: path.relative(ROOT, file), text: readFileSync(file, 'utf8') }))
  .filter(({ file }) => !PLATFORM.test(file));

describe('pricing', () => {
  it('offers exactly Pilot, Scale and Enterprise, recommending the Pilot', () => {
    assert.deepEqual(
      PLANS.map((plan) => plan.name),
      ['Pilot', 'Scale', 'Enterprise'],
    );
    assert.deepEqual(
      PLANS.filter((plan) => plan.recommended).map((plan) => plan.key),
      ['pilot'],
    );
  });

  it('publishes the Scale starting price, and only that price', () => {
    const scale = PLANS.find((plan) => plan.key === 'scale')!;
    if (SCALE_STARTING_PRICE_USD === null) {
      assert.equal(scale.price, 'Contact sales');
    } else {
      assert.equal(scale.price, `From $${SCALE_STARTING_PRICE_USD.toLocaleString('en-US')}`);
      assert.equal(scale.priceSuffix, '/ month');
      assert.match(PRICING_SUMMARY, new RegExp(`\\$${SCALE_STARTING_PRICE_USD}`));
    }
    // No dollar amount is hard-coded anywhere else on the site.
    for (const { file, text } of SOURCES) {
      if (file === 'lib/site/pricing.ts') continue;
      assert.doesNotMatch(text, /\$\d{2,}|\$\d,\d{3}/, `${file} hard-codes a price; read it from lib/site/pricing.ts`);
    }
  });

  it('never calls the pilot free and never promises an SLA, certification or unlimited coverage', () => {
    const planText = JSON.stringify([PLANS, COMPARISON, PRICING_SUMMARY]);
    assert.doesNotMatch(planText, /\bfree\b|complimentary|no cost/i);
    assert.doesNotMatch(planText, /\bSLA\b|SOC ?2|ISO ?27001|unlimited (users|coverage|monitoring)/i);
  });

  it('keeps comparison rows aligned with the plans', () => {
    for (const row of COMPARISON) assert.equal(row.values.length, PLANS.length, row.label);
  });
});

describe('products', () => {
  it('leads with Guard and states each status consistently', () => {
    assert.equal(SITE_PRODUCTS[0], GUARD);
    assert.equal(GUARD.status.label, 'Available for pilot evaluation');
    assert.match(VAULT.status.label, /In development/);
    assert.match(VAULT.status.label, /Testnet/);
    assert.match(ASSETS.status.label, /Sandbox prototype/);
    assert.match(ASSETS.status.label, /Testnet/);
  });

  it('orders the lifecycle Tokenize → Operate → Monitor and secure', () => {
    assert.deepEqual(
      LIFECYCLE_ORDER.map((product) => product.key),
      ['assets', 'vault', 'rwa_guard'],
    );
  });

  it('never describes Vault or Assets as custody, live funds or a securities offering', () => {
    for (const product of [VAULT, ASSETS]) {
      const text = `${product.summary} ${product.status.detail}`;
      assert.doesNotMatch(text, /\bcustody (service|provider)\b|mainnet|live (funds|customer)/i, product.name);
    }
  });
});

describe('site copy', () => {
  it('has no retired prices, internal notes or placeholders', () => {
    const forbidden = [
      /\$2,500|\$6,500|\bStarter\b/, // retired plans
      /Founder placeholder/i,
      /Insert [^'"]*screenshot/i,
      /Reserve these modules/i,
      /communicate direction without overcommitting/i,
      /lorem ipsum/i,
      /\bTODO\b|\bTBD\b/,
    ];
    for (const { file, text } of SOURCES) {
      for (const pattern of forbidden) assert.doesNotMatch(text, pattern, `${file} matches ${pattern}`);
    }
  });

  it('does not claim customers, partners, certifications or funding', () => {
    const claims = /trusted by|our customers|\bpartnered with\b|backed by|SOC ?2 (certified|compliant)|ISO ?27001 certified|\bARR\b|assets protected/i;
    for (const { file, text } of SOURCES) assert.doesNotMatch(text, claims, file);
  });

  it('labels every product visualization as illustrative', () => {
    const visuals = SOURCES.filter(({ file }) => /components\/home\/(guard-console|guard-story)\.tsx$/.test(file));
    assert.equal(visuals.length, 2);
    for (const { file, text } of visuals) assert.match(text, /[Ii]llustrati/, file);
  });
});
