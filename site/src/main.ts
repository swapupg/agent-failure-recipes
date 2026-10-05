import './style.css';
import { recipes, isRecipeId, runRecipe, type RecipeId, type RecipeResult } from '../../src/index.js';
import duplicateCode from '../../examples/duplicate-action.test.ts?raw';
import reportCode from '../../examples/premature-done.test.ts?raw';
import retryCode from '../../examples/retry-storm.test.ts?raw';

const code: Record<RecipeId, string> = { 'duplicate-action': duplicateCode, 'premature-done': reportCode, 'retry-storm': retryCode };
type View = 'ready' | 'broken' | 'repaired';
let selected: RecipeId = 'duplicate-action';
let view: View = 'ready';
let generation = 0;
let active: RecipeResult | undefined;
const bench = document.querySelector<HTMLDivElement>('#workbench')!;
const picker = document.querySelector<HTMLDivElement>('#recipe-picker')!;
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const path = (id: RecipeId, state: View) => `#/recipe/${id}/1/${state}`;

function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copy(text: string, fallback: HTMLInputElement | HTMLTextAreaElement, status: HTMLElement) {
  try { await navigator.clipboard.writeText(text); status.textContent = 'Copied.'; }
  catch { fallback.hidden = false; fallback.value = text; fallback.focus(); fallback.select(); status.textContent = 'Clipboard unavailable. The text is selected; copy it manually.'; }
}

function selectEvent(index: number) {
  const event = active?.events[index]; if (!event) return;
  bench.querySelectorAll<HTMLButtonElement>('[data-event]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.event) === index)));
  bench.querySelector('#state-label')!.textContent = `State after step ${event.step}`;
  bench.querySelector('#state-json')!.textContent = JSON.stringify(event.state, null, 2);
}

async function render() {
  const restoreRunFocus = document.activeElement?.id === 'run';
  const token = ++generation;
  const info = recipes.find(recipe => recipe.id === selected)!;
  const id = selected; const currentView = view;
  const shareUrl = `${location.origin}${import.meta.env.BASE_URL}${path(id, currentView)}`;
  bench.setAttribute('aria-busy', 'true');
  const results = currentView === 'ready' ? [] : await Promise.all([runRecipe(id, 'broken'), ...(currentView === 'repaired' ? [runRecipe(id, 'repaired')] : [])]);
  if (token !== generation) return;
  active = results.at(-1);
  picker.innerHTML = recipes.map(recipe => `<a href="${path(recipe.id, 'ready')}" class="recipe-card" ${recipe.id === id ? 'aria-current="true"' : ''}><span class="recipe-number">${recipe.number}</span><span><strong>${escape(recipe.title)}</strong><small>${escape(recipe.tagline)}</small></span><span aria-hidden="true">↗</span></a>`).join('');
  bench.innerHTML = `
    <div class="bench-head"><div><p class="eyebrow">RECIPE ${info.number} / REVISION 1</p><h3>${escape(info.question)}</h3></div><span class="badge">${currentView === 'ready' ? 'Ready to run' : currentView === 'broken' ? 'Failure reproduced' : 'Repair verified in fixture'}</span></div>
    <div class="flow" role="img" aria-label="The agent calls a tool. We inspect the tool’s actual state, independently of what the agent claims."><span><small>01 / CALLER</small><strong>Agent</strong></span><b aria-hidden="true">→</b><span><small>02 / DEPENDENCY</small><strong>Tool + injected fault</strong></span><b aria-hidden="true">→</b><span><small>03 / EVIDENCE</small><strong>Actual state</strong></span></div>
    <div class="run-toolbar"><button class="primary" id="run">${currentView === 'ready' ? 'Run the failure' : currentView === 'broken' ? 'Apply repair & compare' : 'Run repaired again'} <span aria-hidden="true">↗</span></button><button class="secondary" id="restart" ${currentView === 'ready' ? 'disabled' : ''}>Restart</button><span class="fine">Deterministic fixtures · virtual time</span><button class="text-button" id="show-code">Get the test ↓</button></div>
    <div class="result-area" aria-live="polite" aria-atomic="true">${active ? `<div class="outcomes">${results.map(result => `<div class="outcome ${result.check.passed ? 'pass' : 'fail'}"><span class="eyebrow">${result.variant === 'broken' ? 'BROKEN IMPLEMENTATION' : 'REPAIRED IMPLEMENTATION'}</span><strong>${result.check.passed ? '✓ PASS' : '× FAIL'}</strong><p>${escape(result.check.evidence)}</p></div>`).join('')}</div>` : `<div class="ready-state"><span class="test-icon" aria-hidden="true">{ }</span><div><strong>The test is ready. The failure is intentional.</strong><p>${escape(info.failure)}</p></div></div>`}</div>
    <div class="trace-grid"><section><div class="panel-heading"><h4>Execution trace</h4><span class="fine">${active ? `${active.variant} · ${active.events.length} events` : 'Waiting for a run'}</span></div><ol class="events">${active ? active.events.map((event, index) => `<li><button data-event="${index}" aria-pressed="false"><span class="step">${String(event.step).padStart(2, '0')}</span><span><small>${event.actor} · ${event.atMs} ms</small>${escape(event.detail)}</span><span aria-hidden="true">↗</span></button></li>`).join('') : '<li class="empty-state">Run the recipe to inspect each call, response and state change.</li>'}</ol></section><section class="state-panel"><div class="panel-heading"><h4 id="state-label">Authoritative state</h4><span class="fine">JSON</span></div><pre id="state-json">No run yet.</pre><div class="invariant"><span class="eyebrow">WHAT THE TEST CHECKS</span><p>${escape(info.invariant)}</p></div>${active ? '<button class="secondary" id="download-evidence">Download run evidence</button>' : ''}</section></div>
    <div class="explanation"><div><span class="eyebrow">WHY THE REPAIR WORKS</span><p>${escape(info.repair)}</p></div><details><summary>Adapt it to your system</summary><p>${escape(info.adaptation)}</p><p>${escape(info.limitation)}</p><p>Source: ${info.sources.map(source => `<a href="${source.url}">${escape(source.title)} ↗</a>`).join(', ')}</p></details></div>
    <details class="code-panel" id="code-panel"><summary>Copyable Vitest example <span class="fine">${id}.test.ts</span></summary><div class="code-actions"><button class="secondary" id="copy-code">Copy test</button><button class="secondary" id="download-code">Download test</button><a href="https://github.com/swapupg/agent-failure-recipes/blob/main/examples/${id}.test.ts">View source ↗</a></div><p class="fine">Runs from the repository’s examples/ folder. Install the package locally or adjust the import when moving it to your project.</p><pre><code id="test-code"></code></pre><textarea id="code-fallback" aria-label="Test code to copy manually" readonly hidden rows="8"></textarea><p id="code-status" class="fine" role="status"></p></details>
    <details class="share-panel"><summary>Share this recipe</summary><label for="share-url">Reproducible link · recipe + revision + view</label><div><input id="share-url" readonly value="${escape(shareUrl)}" /><button class="secondary" id="copy-link">Copy link</button></div><p id="share-status" class="fine" role="status">Links contain no user data. Opening one reconstructs this fixture run.</p></details>`;
  bench.querySelector('#test-code')!.textContent = code[id];
  bench.querySelector<HTMLButtonElement>('#run')!.onclick = () => {
    if (view === 'repaired') void render(); else location.hash = path(id, view === 'ready' ? 'broken' : 'repaired');
  };
  bench.querySelector<HTMLButtonElement>('#restart')!.onclick = () => { location.hash = path(id, 'ready'); };
  bench.querySelector<HTMLButtonElement>('#show-code')!.onclick = () => {
    const panel = bench.querySelector<HTMLDetailsElement>('#code-panel')!; panel.open = true; panel.querySelector('summary')!.focus(); panel.scrollIntoView({ block: 'start' });
  };
  bench.querySelectorAll<HTMLButtonElement>('[data-event]').forEach(button => { button.onclick = () => selectEvent(Number(button.dataset.event)); });
  bench.querySelector<HTMLButtonElement>('#copy-code')!.onclick = () => { void copy(code[id], bench.querySelector('#code-fallback')!, bench.querySelector('#code-status')!); };
  bench.querySelector<HTMLButtonElement>('#download-code')!.onclick = () => download(code[id], `${id}.test.ts`, 'text/plain');
  const evidence = bench.querySelector<HTMLButtonElement>('#download-evidence'); if (evidence) evidence.onclick = () => download(JSON.stringify(active, null, 2), `${id}-${currentView}.json`, 'application/json');
  bench.querySelector<HTMLButtonElement>('#copy-link')!.onclick = () => { void copy(shareUrl, bench.querySelector('#share-url')!, bench.querySelector('#share-status')!); };
  if (active) selectEvent(active.events.length - 1);
  bench.setAttribute('aria-busy', 'false');
  if (restoreRunFocus) bench.querySelector<HTMLButtonElement>('#run')!.focus({ preventScroll: true });
}

function route() {
  const hash = location.hash === '#workbench' ? '' : location.hash;
  const match = /^#\/recipe\/([^/]+)\/1\/(ready|broken|repaired)$/.exec(hash);
  const valid = match && isRecipeId(match[1]!);
  selected = valid ? match[1] as RecipeId : 'duplicate-action';
  view = valid ? match[2] as View : 'ready';
  const error = document.querySelector<HTMLParagraphElement>('#route-error')!;
  error.hidden = !hash || Boolean(valid);
  error.textContent = 'This recipe link is invalid or uses an unsupported revision. The first recipe is ready below. Choose a recipe to create a valid link.';
  void render().catch(() => { bench.setAttribute('aria-busy', 'false'); bench.innerHTML = '<p class="notice">The recipe could not run. <a href="./">Restart the lab</a> or use the local quick start below.</p>'; });
}
window.addEventListener('hashchange', route);
document.querySelector<HTMLAnchorElement>('.skip')!.onclick = event => {
  event.preventDefault();
  bench.focus();
  bench.scrollIntoView({ block: 'start' });
};
const theme = document.querySelector<HTMLButtonElement>('#theme')!;
theme.hidden = false;
try { const saved = localStorage.getItem('afr-theme'); if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved; } catch { /* Preferences are optional. */ }
theme.onclick = () => {
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const next = dark ? 'light' : 'dark'; document.documentElement.dataset.theme = next;
  try { localStorage.setItem('afr-theme', next); } catch { /* The active theme still works. */ }
};
route();
