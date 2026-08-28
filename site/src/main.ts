type DemoStep = {
  state: string;
  stateClass: string;
  time: string;
  datetime: string;
  key: string;
  summary: string;
  staging: string;
  stagingSource: string;
  production: string;
  productionSource: string;
  provenance: string;
};

const steps: DemoStep[] = [
  {
    state: 'ALIGNED', stateClass: 'clean', time: '09:00:00 UTC', datetime: '2026-08-28T09:00:00Z',
    key: 'No active drift', summary: 'Staging and production fingerprints match across 18 normalized keys.',
    staging: '18 / 18 aligned', stagingSource: 'release-184.yaml', production: '18 / 18 aligned',
    productionSource: 'release-184.yaml', provenance: 'deploy-bot captured production'
  },
  {
    state: 'INTRODUCED / UNSAFE', stateClass: 'unsafe', time: '10:42:00 UTC', datetime: '2026-08-28T10:42:00Z',
    key: 'DATABASE.REPLICA_COUNT', summary: 'The first unsafe difference appears 42 minutes after the baseline.',
    staging: 'number · sha256:93f0…', stagingSource: 'staging.yaml', production: 'number · sha256:4a71… · overridden',
    productionSource: 'production.yaml (layer 2)', provenance: 'priya@platform captured production'
  },
  {
    state: 'INTRODUCED / UNSAFE', stateClass: 'unsafe', time: '10:47:00 UTC', datetime: '2026-08-28T10:47:00Z',
    key: 'PAYMENTS_WEBHOOK_SECRET', summary: 'A secret-like key is present in staging but absent from production. No value is shown.',
    staging: 'secret · sha256:f1be…', stagingSource: 'staging.secrets.env', production: 'absent · —',
    productionSource: 'production.yaml', provenance: 'incident-bot compared both environments'
  },
  {
    state: 'RESOLVED', stateClass: 'resolved', time: '11:18:00 UTC', datetime: '2026-08-28T11:18:00Z',
    key: 'DATABASE.REPLICA_COUNT', summary: 'Production now matches staging. The original introduction remains in the timeline.',
    staging: 'number · sha256:93f0…', stagingSource: 'staging.yaml', production: 'number · sha256:93f0…',
    productionSource: 'production.yaml', provenance: 'priya@platform captured production'
  }
];

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const timeline = byId<HTMLInputElement>('timeline');
let currentStep = 0;

function renderStep(index: number) {
  currentStep = Math.max(0, Math.min(steps.length - 1, index));
  const step = steps[currentStep];
  timeline.value = String(currentStep);
  byId('step-count').textContent = `Capture ${currentStep + 1} of ${steps.length}`;
  const stamp = byId('event-state');
  stamp.textContent = step.state;
  stamp.className = `state-stamp ${step.stateClass}`;
  const time = byId<HTMLTimeElement>('event-time');
  time.textContent = step.time;
  time.dateTime = step.datetime;
  byId('event-key').textContent = step.key;
  byId('event-summary').textContent = step.summary;
  byId('staging-value').textContent = step.staging;
  byId('staging-source').textContent = step.stagingSource;
  byId('production-value').textContent = step.production;
  byId('production-source').textContent = step.productionSource;
  byId('event-provenance').innerHTML = `<strong>Observed after:</strong> ${step.provenance}`;
  document.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((button, buttonIndex) => {
    if (buttonIndex === currentStep) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  byId<HTMLButtonElement>('prev-step').disabled = currentStep === 0;
  byId<HTMLButtonElement>('next-step').disabled = currentStep === steps.length - 1;
}

timeline.addEventListener('input', () => renderStep(Number(timeline.value)));
byId('prev-step').addEventListener('click', () => renderStep(currentStep - 1));
byId('next-step').addEventListener('click', () => renderStep(currentStep + 1));
document.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((button) => {
  button.addEventListener('click', () => renderStep(Number(button.dataset.step)));
});

const toast = byId('toast');
function showToast(message: string) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.setTimeout(() => toast.classList.remove('visible'), 2200);
}

document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy ?? '');
      showToast('Copied to clipboard.');
    } catch {
      showToast('Clipboard unavailable. Select the command to copy it.');
    }
  });
});

const offlineBar = byId('offline-bar');
function syncNetworkState() { offlineBar.hidden = navigator.onLine; }
window.addEventListener('online', syncNetworkState);
window.addEventListener('offline', syncNetworkState);
syncNetworkState();

const PRODUCT = 'config-drift-timeline';
const API_BASE = 'https://api.sociobot.in/api/v1';
const LICENSE_KEY = `sb_license:${PRODUCT}`;
const VERDICT_KEY = `sb_license_verdict:${PRODUCT}`;
const ONE_DAY = 86_400_000;
const licenseStatus = byId('license-status');
const downloadButton = byId<HTMLButtonElement>('download-pack');

type Verdict = { token: string; valid: boolean; checkedAt: number; reason: string };

function safeGet(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

function cachedVerdict(): Verdict | null {
  try { return JSON.parse(safeGet(VERDICT_KEY) ?? 'null') as Verdict | null; } catch { return null; }
}

function setUnlocked(unlocked: boolean, message: string) {
  downloadButton.hidden = !unlocked;
  licenseStatus.className = `license-status ${unlocked ? 'verified' : ''}`;
  licenseStatus.textContent = message;
}

async function verifyLicense(token: string, force = false) {
  const cached = cachedVerdict();
  if (cached?.token === token && cached.valid) {
    setUnlocked(true, navigator.onLine ? 'Pro unlocked from your saved license.' : 'Pro unlocked offline using the last verified license.');
  } else {
    setUnlocked(false, navigator.onLine ? 'Checking license…' : 'Offline. Reconnect once to verify this license.');
  }
  if (!navigator.onLine) return;
  if (!force && cached?.token === token && Date.now() - cached.checkedAt < ONE_DAY) return;
  try {
    const response = await fetch(`${API_BASE}/products/${PRODUCT}/verify?license=${encodeURIComponent(token)}`, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`verification returned ${response.status}`);
    const result = await response.json() as { valid: boolean; reason: string };
    safeSet(VERDICT_KEY, JSON.stringify({ token, valid: result.valid, reason: result.reason, checkedAt: Date.now() }));
    if (result.valid) setUnlocked(true, 'License verified. Your Pro incident pack is ready.');
    else setUnlocked(false, `License no longer active (${result.reason.replace('_', ' ')}). You can purchase a new license below.`);
  } catch {
    if (cached?.token === token && cached.valid) setUnlocked(true, 'Could not refresh the license. Pro remains available from the last successful check.');
    else setUnlocked(false, 'Could not verify right now. Check your connection and try again; the free CLI is unaffected.');
  }
}

const query = new URLSearchParams(location.search);
const returnedLicense = query.get('license');
if (returnedLicense) {
  safeSet(LICENSE_KEY, returnedLicense);
  query.delete('license');
  const cleanQuery = query.toString();
  history.replaceState({}, '', `${location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${location.hash}`);
}
const savedLicense = returnedLicense ?? safeGet(LICENSE_KEY);
if (savedLicense) void verifyLicense(savedLicense);

byId<HTMLFormElement>('license-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const token = byId<HTMLInputElement>('license-token').value.trim();
  if (!token) return;
  if (!safeSet(LICENSE_KEY, token)) {
    setUnlocked(false, 'This browser blocked local storage. Allow site storage, then try again.');
    return;
  }
  void verifyLicense(token, true);
});

downloadButton.addEventListener('click', () => {
  const pack = `# Driftline Pro incident pack\n\n## Release gate\n\n\`\`\`sh\ndriftline report --ledger .drift/timeline.json --compare staging,production --allowlist drift-allow.yaml --format json --fail-on-drift > drift-report.json\n\`\`\`\n\n## Review checklist\n\n- [ ] Every allowlist rule names an owner and reason.\n- [ ] New absent/null changes were reviewed.\n- [ ] The first observed actor and source match the deployment record.\n- [ ] The JSON report is attached to the release evidence.\n\n## Incident dossier\n\n- First observed at:\n- Introduced by / environment:\n- Key and semantic states:\n- Last known aligned capture:\n- Resolution capture:\n`;
  const url = URL.createObjectURL(new Blob([pack], { type: 'text/markdown' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'driftline-pro-incident-pack.md';
  link.click();
  URL.revokeObjectURL(url);
  showToast('Pro incident pack downloaded.');
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}

renderStep(0);
