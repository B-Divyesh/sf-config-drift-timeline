import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const dist = resolve(new URL('../..', import.meta.url).pathname, 'dist/site');
const root = resolve(new URL('../..', import.meta.url).pathname);
const html = (route) => readFileSync(resolve(dist, route), 'utf8');
const staticConfig = JSON.parse(readFileSync(resolve(dist, 'staticwebapp.config.json'), 'utf8'));

test('built public routes have a title, one main heading, canonical URL, and social card metadata', () => {
  for (const route of ['index.html', 'demo/index.html', 'privacy/index.html', 'terms/index.html', '404.html']) {
    const page = html(route);
    assert.match(page, /<html lang="en">/);
    assert.match(page, /<title>[^<]{1,60}<\/title>/);
    assert.equal((page.match(/<h1\b/g) ?? []).length, 1, `${route} needs exactly one page heading`);
    assert.match(page, /<main\b/);
    assert.match(page, /rel="canonical" href="https:\/\/config-drift-timeline\.sociobot\.in\//);
    assert.match(page, /property="og:image" content="https:\/\/config-drift-timeline\.sociobot\.in\/art\/social-preview\.jpg"/);
    assert.match(page, /name="twitter:card" content="summary_large_image"/);
  }
});

test('built landing page leads straight to the isolated sample route', () => {
  const page = html('index.html');
  assert.match(page, /href="\/demo\/">Try it with sample data<\/a>/);
  assert.match(page, /driftline demo/);
});

test('built static-host policy gives unknown URLs a real 404 response and keeps hashed assets immutable', () => {
  assert.deepEqual(staticConfig.responseOverrides?.['404'], { rewrite: '/404.html', statusCode: 404 });
  const assetsRoute = staticConfig.routes?.find(({ route }) => route === '/assets/*');
  assert.equal(assetsRoute?.headers?.['Cache-Control'], 'public, max-age=31536000, immutable');
  const notFound = html('404.html');
  assert.match(notFound, /This page was not found\./);
  assert.match(notFound, /href="\/">Go to the home page<\/a>/);
});

test('built public assets meet the static-product transfer budgets', () => {
  const assets = resolve(dist, 'assets');
  const assetNames = readdirSync(assets);
  const root = html('index.html');
  const rootJs = root.match(/\/assets\/main-[^"]+\.js/)?.[0];
  const rootCss = root.match(/\/assets\/style-[^"]+\.css/)?.[0];
  assert.ok(rootJs, 'the built landing page links its application script');
  assert.ok(rootCss, 'the built landing page links its stylesheet');
  assert.ok(statSync(resolve(dist, rootJs.slice(1))).size < 200 * 1024);
  assert.ok(statSync(resolve(dist, rootCss.slice(1))).size < 50 * 1024);
  assert.ok(assetNames.some((name) => name.startsWith('demo-') && name.endsWith('.js')));
  assert.equal(statSync(resolve(dist, 'art/social-preview.jpg')).size > 0, true);
});

test('every declared public claim has one runnable tagged sandbox test', () => {
  const claims = JSON.parse(readFileSync(resolve(root, '.factory/claims.json'), 'utf8'));
  const claimTests = readFileSync(resolve(root, 'site/tests/claims.mjs'), 'utf8');
  assert.equal(claims.length, 15);
  for (const claim of claims) {
    const tag = `@claim:${claim.id}`;
    assert.equal(claimTests.split(tag).length - 1, 1, `${claim.id} must have exactly one tagged test`);
    assert.match(claim.test, new RegExp(`--grep=${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  }
});
