import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const staticWebAppConfig = JSON.parse(readFileSync(new URL('../public/staticwebapp.config.json', import.meta.url), 'utf8'));

test('main page ships required semantic landmarks and exactly one h1', () => {
  assert.match(index, /<html lang="en">/);
  assert.match(index, /<title>[^<]+<\/title>/);
  assert.equal((index.match(/<h1\b/g) ?? []).length, 1);
  assert.match(index, /<main id="main">/);
  assert.match(index, /alt="[^"]+"/);
  assert.match(index, /class="skip-link"/);
});

test('paid unlock follows the Sociobot token and daily verification contract', () => {
  assert.match(main, /sb_license:\$\{PRODUCT\}/);
  assert.match(main, /history\.replaceState/);
  assert.match(main, /\/verify\?license=/);
  assert.match(main, /86_400_000/);
});

test('unregistered checkout is fail-closed until an explicit release setting enables it', () => {
  assert.match(index, /<button[^>]*id="purchase-button"[^>]*disabled/);
  assert.doesNotMatch(index, /href="https:\/\/api\.sociobot\.in\/api\/v1\/products\/config-drift-timeline\/checkout"/);
  assert.match(main, /VITE_PRO_CHECKOUT_ENABLED === 'true'/);
  assert.match(main, /window\.location\.assign\(CHECKOUT_URL\)/);
  assert.match(main, /purchaseButton\.disabled = false/);
});

test('visual system includes designed focus and reduced-motion handling', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /min-height: 44px/);
});

test('demo models unsafe, absent, overridden, and resolved states', () => {
  for (const state of ['INTRODUCED / UNSAFE', 'absent', 'overridden', 'RESOLVED']) assert.match(main, new RegExp(state));
});

test('deployment caches only content-hashed application assets immutably', () => {
  const assetsRoute = staticWebAppConfig.routes?.find(({ route }) => route === '/assets/*');
  assert.ok(assetsRoute, 'static host config must define an /assets/* route');
  assert.equal(
    assetsRoute.headers?.['Cache-Control'],
    'public, max-age=31536000, immutable',
    'Vite content-hashed JS and CSS must not fall back to the host 30-second cache policy'
  );
  assert.equal(staticWebAppConfig.globalHeaders?.['Cache-Control'], undefined, 'HTML and sw.js must remain revalidatable');
});
