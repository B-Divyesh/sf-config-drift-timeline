import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import test from 'node:test';

const dist = resolve(new URL('../..', import.meta.url).pathname, 'dist/site');
const root = resolve(new URL('../..', import.meta.url).pathname);
const html = (route) => readFileSync(resolve(dist, route), 'utf8');
const staticConfig = JSON.parse(readFileSync(resolve(dist, 'staticwebapp.config.json'), 'utf8'));

function staticResponse(pathname) {
  const configuredRoute = staticConfig.routes?.find((route) =>
    route.route === pathname || (route.route.endsWith('/*') && pathname.startsWith(route.route.slice(0, -1)))
  );
  let requested = configuredRoute?.rewrite ?? pathname;
  if (requested === '/') requested = '/index.html';
  if (requested.endsWith('/')) requested += 'index.html';
  const candidate = resolve(dist, `.${requested}`);
  if (candidate.startsWith(dist) && (() => {
    try { return statSync(candidate).isFile(); } catch { return false; }
  })()) return { file: candidate, status: 200, route: configuredRoute };

  const override = staticConfig.responseOverrides?.['404'];
  assert.ok(override, 'the static host needs a 404 response override');
  return { file: resolve(dist, `.${override.rewrite}`), status: override.statusCode, route: undefined };
}

async function withStaticHost(run) {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://static.test').pathname;
    const served = staticResponse(pathname);
    const headers = { 'content-type': extname(served.file) === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream' };
    const cacheControl = served.route?.headers?.['Cache-Control'];
    if (cacheControl) headers['cache-control'] = cacheControl;
    response.writeHead(served.status, headers);
    response.end(readFileSync(served.file));
  });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve()));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('static routes return their own titled documents and an unknown URL returns the designed 404', async () => {
  await withStaticHost(async (baseUrl) => {
    for (const route of ['/', '/demo', '/demo/', '/privacy/', '/terms/']) {
      const response = await fetch(`${baseUrl}${route}`);
      assert.equal(response.status, 200, `${route} should be a real public route`);
      const page = await response.text();
      assert.match(page, /<html lang="en">/);
      assert.match(page, /<title>[^<]{1,60}<\/title>/);
      assert.equal((page.match(/<h1\b/g) ?? []).length, 1, `${route} needs exactly one page heading`);
      assert.match(page, /<main\b/);
      assert.match(page, /rel="canonical" href="https:\/\/config-drift-timeline\.sociobot\.in\//);
      assert.match(page, /property="og:image" content="https:\/\/config-drift-timeline\.sociobot\.in\/art\/social-preview\.jpg"/);
      assert.match(page, /name="twitter:card" content="summary_large_image"/);
    }

    const unknown = await fetch(`${baseUrl}/not-a-real-page`);
    assert.equal(unknown.status, 404);
    const unknownPage = await unknown.text();
    assert.match(unknownPage, /<title>Page not found — Config Drift Timeline<\/title>/);
    assert.match(unknownPage, /<h1>This page was not found\.<\/h1>/);
    assert.match(unknownPage, /href="\/">Go to the home page<\/a>/);
  });
});

test('built public documents have a title, one main heading, canonical URL, and social card metadata', () => {
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

test('static host sends immutable caching for built hashed application assets', async () => {
  await withStaticHost(async (baseUrl) => {
    const root = html('index.html');
    const rootJs = root.match(/\/assets\/main-[^"]+\.js/)?.[0];
    assert.ok(rootJs, 'the built landing page links its application script');
    const response = await fetch(`${baseUrl}${rootJs}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  });
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
