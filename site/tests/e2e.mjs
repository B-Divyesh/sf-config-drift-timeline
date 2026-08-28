import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const reservePort = () => new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    if (!address || typeof address === 'string') {
      probe.close();
      reject(new Error('could not reserve a loopback port for the preview server'));
      return;
    }
    probe.close((error) => error ? reject(error) : resolve(address.port));
  });
});

const port = await reservePort();
const server = spawn(process.execPath, ['./node_modules/vite/bin/vite.js', 'preview', '--config', 'site/vite.config.ts', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'inherit' });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  await wait(1200);
  const browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await page.locator('#next-step').click();
    await page.getByText('DATABASE.REPLICA_COUNT').waitFor();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
    if (serious.length) throw new Error(`axe violations at ${viewport.width}px: ${serious.map((v) => v.id).join(', ')}`);
    if (errors.length) throw new Error(`console errors at ${viewport.width}px: ${errors.join('; ')}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) throw new Error(`horizontal overflow at ${viewport.width}px`);
    await context.close();
  }
  await browser.close();
  console.log('E2E: desktop/mobile, demo, console, overflow, and axe checks passed');
} finally {
  server.kill('SIGTERM');
}
