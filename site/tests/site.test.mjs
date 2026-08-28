import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

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
  assert.match(index, /\/products\/config-drift-timeline\/checkout/);
});

test('visual system includes designed focus and reduced-motion handling', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /min-height: 44px/);
});

test('demo models unsafe, absent, overridden, and resolved states', () => {
  for (const state of ['INTRODUCED / UNSAFE', 'absent', 'overridden', 'RESOLVED']) assert.match(main, new RegExp(state));
});
