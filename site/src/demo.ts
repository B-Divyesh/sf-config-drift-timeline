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
  { state: 'ALIGNED', stateClass: 'clean', time: '09:00:00 UTC', datetime: '2026-08-28T09:00:00Z', key: 'No active drift', summary: 'Staging and production fingerprints match across 18 normalized keys.', staging: '18 / 18 aligned', stagingSource: 'release-184.yaml', production: '18 / 18 aligned', productionSource: 'release-184.yaml', provenance: 'deploy-bot captured production' },
  { state: 'INTRODUCED / UNSAFE', stateClass: 'unsafe', time: '10:42:00 UTC', datetime: '2026-08-28T10:42:00Z', key: 'DATABASE.REPLICA_COUNT', summary: 'The first unsafe difference appears 42 minutes after the baseline.', staging: 'number · sha256:93f0…', stagingSource: 'staging.yaml', production: 'number · sha256:4a71… · overridden', productionSource: 'production.yaml (layer 2)', provenance: 'priya@platform captured production' },
  { state: 'INTRODUCED / UNSAFE', stateClass: 'unsafe', time: '10:47:00 UTC', datetime: '2026-08-28T10:47:00Z', key: 'PAYMENTS_WEBHOOK_SECRET', summary: 'A secret-like key is present in staging but absent from production. No value is shown.', staging: 'secret · sha256:f1be…', stagingSource: 'staging.secrets.env', production: 'absent · —', productionSource: 'production.yaml', provenance: 'incident-bot compared both environments' },
  { state: 'RESOLVED', stateClass: 'resolved', time: '11:18:00 UTC', datetime: '2026-08-28T11:18:00Z', key: 'DATABASE.REPLICA_COUNT', summary: 'Production now matches staging. The original introduction remains in the timeline.', staging: 'number · sha256:93f0…', stagingSource: 'staging.yaml', production: 'number · sha256:93f0…', productionSource: 'production.yaml', provenance: 'priya@platform captured production' }
];

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const storageKey = 'demo:config-drift-timeline:step';
const timeline = byId<HTMLInputElement>('timeline');

function savedStep() {
  try {
    const value = Number(localStorage.getItem(storageKey));
    return Number.isInteger(value) ? value : 0;
  } catch {
    return 0;
  }
}

function saveStep(step: number) {
  try { localStorage.setItem(storageKey, String(step)); } catch { /* The sample remains usable without storage. */ }
}

function renderStep(index: number, save = true) {
  const currentStep = Math.max(0, Math.min(steps.length - 1, index));
  const step = steps[currentStep];
  if (save) saveStep(currentStep);
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
    button.toggleAttribute('aria-current', buttonIndex === currentStep);
  });
  byId<HTMLButtonElement>('prev-step').disabled = currentStep === 0;
  byId<HTMLButtonElement>('next-step').disabled = currentStep === steps.length - 1;
}

timeline.addEventListener('input', () => renderStep(Number(timeline.value)));
byId('prev-step').addEventListener('click', () => renderStep(Number(timeline.value) - 1));
byId('next-step').addEventListener('click', () => renderStep(Number(timeline.value) + 1));
document.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((button) => button.addEventListener('click', () => renderStep(Number(button.dataset.step))));
byId('reset-demo').addEventListener('click', () => {
  try { localStorage.removeItem(storageKey); } catch { /* The view is reset below even if storage is blocked. */ }
  renderStep(0, false);
  byId('reset-demo').textContent = 'Demo reset';
  window.setTimeout(() => { byId('reset-demo').textContent = 'Reset demo'; }, 1800);
});
byId<HTMLAnchorElement>('start-real').addEventListener('click', () => {
  try { localStorage.removeItem(storageKey); } catch { /* There is no real data to clean up. */ }
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}

renderStep(savedStep(), false);
