import { RADII, SHEET_ORDER, calculate, emptyMeasurement, resizeMeasurement, radiusMm, num, deviationPct } from './calc.js';
import { jobs, photos, settings, uid, shrinkImage } from './db.js';
import { buildReport } from './pdf.js';

const $app = document.getElementById('app');

// ---------- Vaste lijsten ----------
export const STATUSES = {
  ontvangen: 'Ontvangen',
  gemeten: 'Gemeten',
  herstelling: 'In herstelling',
  klaar: 'Klaar',
};
export const DAMAGE = [
  ['vervormd', 'Vervormd'],
  ['uitgebroken', 'Uitgebroken randen'],
  ['scheur', 'Scheuren'],
  ['cavitatie', 'Cavitatie'],
  ['corrosie', 'Corrosie'],
  ['ontbreekt', 'Stuk ontbreekt'],
];
export const WORKS = [
  ['gericht', 'Vervormingen gericht'],
  ['gelast', 'Uitgebroken delen gelast'],
  ['geslepen', 'Machinaal bijgewerkt / geslepen'],
  ['spoed', 'Spoed gecorrigeerd'],
  ['gepolijst', 'Gepolijst'],
  ['gebalanceerd', 'Gebalanceerd'],
];
export const PLACES = [
  ['Midden', 'Midden (middenschroef)'],
  ['SB', 'SB (stuurboord)'],
  ['BB', 'BB (bakboord)'],
  ['Boeg', 'Boeg (boegschroef)'],
  ['Boeg SB', 'Boeg SB'],
  ['Boeg BB', 'Boeg BB'],
];
const MATERIALS = ['Brons', 'Mangaanbrons', 'NiAl-brons', 'Inox', 'Staal', 'Aluminium'];
const DEFAULT_SETTINGS = {
  bedrijf: 'Moordgat Scheepsherstellingen',
  adres: '',
  emailAdmin: '',
  meetstanden: 'A,B,C',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 0) => (n === null || n === undefined || !Number.isFinite(n) ? '–' : n.toLocaleString('nl-BE', { maximumFractionDigits: d, minimumFractionDigits: d, useGrouping: false }));
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => (iso ? new Date(iso + 'T00:00').toLocaleDateString('nl-BE') : '');

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...((await settings.get('app')) ?? {}) };
}

function newJob() {
  return {
    id: uid(),
    createdAt: Date.now(),
    status: 'ontvangen',
    datum: today(),
    klant: '', schip: '', schroefNr: '', diameter: '', bladen: 4, draairichting: 'R',
    model: '', materiaal: 'Brons', plaats: '', spoedNominaal: '', meetstand: '', gemetenDoor: '',
    opmerkingen: '',
    schade: { perBlad: {}, tekst: '' },
    meting: { voor: emptyMeasurement(4), na: emptyMeasurement(4) },
    werken: {}, werkTekst: '',
    rapportTaal: 'nl',
  };
}

// ---------- Pad-helpers voor formulierbinding ----------
function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]] ??= {};
  o[keys.at(-1)] = value;
}

// ---------- Router ----------
let current = null; // { job, photos }
let saveTimer;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => current && jobs.put(current.job), 300);
}
async function flushSave() {
  clearTimeout(saveTimer);
  if (current) await jobs.put(current.job);
}

async function route() {
  await flushSave();
  const [, view, id, tab] = location.hash.split('/');
  window.scrollTo(0, 0);
  if (view === 'job' && id) return renderJob(id, tab || 'ontvangst');
  if (view === 'instellingen') return renderSettings();
  current = null;
  return renderList();
}
window.addEventListener('hashchange', route);
window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => document.hidden && flushSave());

// ---------- Lijst ----------
async function renderList() {
  const all = (await jobs.all()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const filter = sessionStorage.getItem('filter') ?? 'open';
  const q = sessionStorage.getItem('q') ?? '';
  $app.innerHTML = `
    <div class="toolbar">
      <button class="btn primary" id="new">＋ Nieuwe schroef</button>
      <input type="search" id="q" placeholder="Zoek op schip, klant of schroefnr…" value="${esc(q)}">
      <div class="seg" id="filter">
        <button data-f="open" class="${filter === 'open' ? 'on' : ''}">Lopend</button>
        <button data-f="klaar" class="${filter === 'klaar' ? 'on' : ''}">Klaar</button>
        <button data-f="alle" class="${filter === 'alle' ? 'on' : ''}">Alle</button>
      </div>
    </div>
    <div class="jobs" id="list"></div>`;

  const draw = () => {
    const f = sessionStorage.getItem('filter') ?? 'open';
    const term = document.getElementById('q').value.trim().toLowerCase();
    const shown = all.filter((j) => {
      if (f === 'open' && j.status === 'klaar') return false;
      if (f === 'klaar' && j.status !== 'klaar') return false;
      if (!term) return true;
      return [j.schip, j.klant, j.schroefNr].some((v) => String(v ?? '').toLowerCase().includes(term));
    });
    document.getElementById('list').innerHTML = shown.length
      ? shown.map((j) => `
        <a class="job" href="#/job/${j.id}">
          <div><strong>${esc(j.schip || '(geen naam)')}</strong>
            <div class="muted small">${esc([j.klant, j.schroefNr && 'Nr ' + j.schroefNr, j.diameter && 'Ø ' + j.diameter + ' mm', j.bladen + ' bladen'].filter(Boolean).join(' · '))}</div></div>
          <div style="text-align:right"><span class="badge ${j.status}">${STATUSES[j.status]}</span>
            <div class="muted small">${fmtDate(j.datum)}</div></div>
        </a>`).join('')
      : `<div class="empty">${all.length ? 'Niets gevonden.' : 'Nog geen schroeven. Tik op <b>Nieuwe schroef</b> om te beginnen.'}</div>`;
  };
  draw();

  document.getElementById('new').onclick = async () => {
    const j = newJob();
    const s = await getSettings();
    j.meetstand = s.laatsteMeetstand ?? '';
    j.gemetenDoor = s.laatsteNaam ?? '';
    await jobs.put(j);
    location.hash = `#/job/${j.id}/ontvangst`;
  };
  document.getElementById('q').oninput = (e) => { sessionStorage.setItem('q', e.target.value); draw(); };
  document.getElementById('filter').onclick = (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    sessionStorage.setItem('filter', f);
    document.querySelectorAll('#filter button').forEach((b) => b.classList.toggle('on', b.dataset.f === f));
    draw();
  };
}

// ---------- Fiche ----------
const TABS = [
  ['ontvangst', 'Ontvangst'],
  ['meting', 'Meting'],
  ['herstelling', 'Herstelling'],
  ['rapport', 'Rapport'],
];

async function renderJob(id, tab) {
  const job = await jobs.get(id);
  if (!job) { location.hash = '#/'; return; }
  current = { job, photos: await photos.forJob(id) };

  $app.innerHTML = `
    <div class="jobhead">
      <a href="#/" class="btn" aria-label="Terug">←</a>
      <h1 id="title">${esc(job.schip || 'Nieuwe schroef')}</h1>
      <span class="badge ${job.status}" id="status">${STATUSES[job.status]}</span>
    </div>
    <nav class="tabs">${TABS.map(([k, l], i) => `<a href="#/job/${id}/${k}" class="${k === tab ? 'active' : ''}"><span class="n">${i + 1}</span>${l}</a>`).join('')}</nav>
    <section id="tab"></section>`;

  const el = document.getElementById('tab');
  ({ ontvangst: tabOntvangst, meting: tabMeting, herstelling: tabHerstelling, rapport: tabRapport }[tab] ?? tabOntvangst)(el);

  // Generieke binding: elk veld met data-path schrijft naar de fiche
  el.addEventListener('input', onFieldInput);
  el.addEventListener('change', onFieldInput);
}

function onFieldInput(e) {
  const t = e.target;
  const path = t.dataset.path;
  if (!path || !current) return;
  let value = t.type === 'checkbox' ? t.checked : t.value;
  setPath(current.job, path, value);
  if (path === 'schip') document.getElementById('title').textContent = value || 'Nieuwe schroef';
  if (path === 'bladen') {
    const n = Math.max(2, Math.min(7, parseInt(value, 10) || 4));
    current.job.bladen = n;
    current.job.meting.voor = resizeMeasurement(current.job.meting.voor, n);
    current.job.meting.na = resizeMeasurement(current.job.meting.na, n);
    if (t.closest('#tab') && document.getElementById('bladeDamage')) drawBladeDamage();
  }
  if (path === 'gemetenDoor' || path === 'meetstand') {
    getSettings().then((s) => settings.set('app', { ...s, [path === 'meetstand' ? 'laatsteMeetstand' : 'laatsteNaam']: value }));
  }
  if (path.startsWith('meting.') || path === 'diameter' || path === 'spoedNominaal') updateResults?.();
  scheduleSave();
}
let updateResults = null;

function field(label, path, value, attrs = '') {
  return `<div><label for="f-${path}">${label}</label><input id="f-${path}" data-path="${path}" value="${esc(value)}" ${attrs}></div>`;
}

// ----- 1. Ontvangst -----
async function tabOntvangst(el) {
  const j = current.job;
  const s = await getSettings();
  const stands = s.meetstanden.split(',').map((x) => x.trim()).filter(Boolean);
  el.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0">Gegevens</h2>
      <div class="grid">
        ${field('Naam schip', 'schip', j.schip, 'autocomplete="off"')}
        ${field('Klant', 'klant', j.klant, 'list="klanten" autocomplete="off"')}
        ${field('Datum', 'datum', j.datum, 'type="date"')}
        ${field('Schroef nr.', 'schroefNr', j.schroefNr)}
        ${field('Diameter (mm)', 'diameter', j.diameter, 'inputmode="decimal"')}
        <div><label for="f-bladen">Aantal bladen</label>
          <select id="f-bladen" data-path="bladen">${[2, 3, 4, 5, 6, 7].map((n) => `<option ${+j.bladen === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div><label for="f-draai">Draairichting</label>
          <select id="f-draai" data-path="draairichting">
            <option value="R" ${j.draairichting === 'R' ? 'selected' : ''}>Rechts (R)</option>
            <option value="L" ${j.draairichting === 'L' ? 'selected' : ''}>Links (L)</option></select></div>
        ${field('Model', 'model', j.model)}
        <div><label for="f-mat">Materiaal</label>
          <input id="f-mat" data-path="materiaal" list="materialen" value="${esc(j.materiaal)}"></div>
        <div><label for="f-plaats">Plaats</label>
          <select id="f-plaats" data-path="plaats"><option value=""></option>${PLACES.map(([v, l]) => `<option value="${v}" ${j.plaats === v ? 'selected' : ''}>${l}</option>`).join('')}${j.plaats && !PLACES.some(([v]) => v === j.plaats) ? `<option selected>${esc(j.plaats)}</option>` : ''}</select></div>
        ${field('Spoed (nominaal, mm)', 'spoedNominaal', j.spoedNominaal, 'inputmode="decimal"')}
        <div><label for="f-ms">Meetstand</label>
          <select id="f-ms" data-path="meetstand"><option value=""></option>${stands.map((x) => `<option ${j.meetstand === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
        ${field('Gemeten door', 'gemetenDoor', j.gemetenDoor)}
        <div class="wide"><label for="f-opm">Opmerkingen</label><textarea id="f-opm" data-path="opmerkingen">${esc(j.opmerkingen)}</textarea></div>
      </div>
      <datalist id="materialen">${MATERIALS.map((m) => `<option value="${m}">`).join('')}</datalist>
      <datalist id="klanten"></datalist>
    </div>

    <div class="card">
      <h2 style="margin-top:0">Schade bij ontvangst</h2>
      <div id="bladeDamage"></div>
      <label for="f-schade" style="margin-top:12px">Beschrijving</label>
      <textarea id="f-schade" data-path="schade.tekst" placeholder="Wat zie je bij ontvangst?">${esc(j.schade.tekst)}</textarea>
    </div>

    <div class="card">
      <h2 style="margin-top:0">Foto's bij ontvangst</h2>
      ${photoGrid('ontvangst')}
    </div>

    <div class="row"><span class="spacer"></span>
      <a class="btn dark" href="#/job/${j.id}/meting">Verder naar meting →</a></div>`;

  drawBladeDamage();
  bindPhotos(el);
  const klanten = [...new Set((await jobs.all()).map((x) => x.klant).filter(Boolean))].sort();
  document.getElementById('klanten').innerHTML = klanten.map((k) => `<option value="${esc(k)}">`).join('');
}

function drawBladeDamage() {
  const j = current.job;
  const box = document.getElementById('bladeDamage');
  box.innerHTML = Array.from({ length: j.bladen }, (_, b) => {
    const sel = j.schade.perBlad[b + 1] ?? {};
    return `<div class="blade-damage"><b>Blad ${b + 1}</b><div class="chips">
      ${DAMAGE.map(([k, l]) => `<label class="chip"><input type="checkbox" data-path="schade.perBlad.${b + 1}.${k}" ${sel[k] ? 'checked' : ''}><span>${l}</span></label>`).join('')}
    </div></div>`;
  }).join('');
}

// ----- Foto's -----
function photoGrid(fase) {
  const list = current.photos.filter((p) => p.fase === fase).sort((a, b) => a.createdAt - b.createdAt);
  return `<div class="photos" data-fase="${fase}">
    ${list.map((p) => `<div class="photo"><img src="${p.dataUrl}" alt=""><button data-del="${p.id}" aria-label="Foto verwijderen">×</button></div>`).join('')}
    <label class="addphoto"><input type="file" accept="image/*" capture="environment" multiple data-add="${fase}"><div>📷<br>Foto toevoegen</div></label>
  </div>`;
}

function bindPhotos(el) {
  el.addEventListener('change', async (e) => {
    const fase = e.target.dataset.add;
    if (!fase) return;
    e.stopPropagation();
    const files = [...e.target.files];
    toast(`${files.length} foto('s) verwerken…`);
    for (const f of files) {
      const img = await shrinkImage(f);
      const p = { id: uid(), jobId: current.job.id, fase, createdAt: Date.now(), ...img };
      await photos.put(p);
      current.photos.push(p);
    }
    el.querySelector(`.photos[data-fase="${fase}"]`).outerHTML = photoGrid(fase);
    toast('Foto\'s opgeslagen');
  }, true);
  el.addEventListener('click', async (e) => {
    const id = e.target.dataset.del;
    if (!id || !confirm('Deze foto verwijderen?')) return;
    const fase = current.photos.find((p) => p.id === id)?.fase;
    await photos.remove(id);
    current.photos = current.photos.filter((p) => p.id !== id);
    el.querySelector(`.photos[data-fase="${fase}"]`).outerHTML = photoGrid(fase);
  });
}

// ----- 2. Meting -----
function tabMeting(el) {
  const j = current.job;
  const set = sessionStorage.getItem('meetset') ?? 'voor';
  const m = (j.meting[set] = resizeMeasurement(j.meting[set], j.bladen));
  const cols = SHEET_ORDER.map((k) => RADII.find((r) => r.key === k));
  const noZero = (k) => k === 'r50' || k === 'r30'; // zoals in het Excel-blad: geen nulmeting op 50% en 30%

  const inp = (path, val, extra = '') => `<input data-path="${path}" value="${esc(val)}" inputmode="decimal" autocomplete="off" ${extra}>`;

  let rows = '';
  rows += `<tr><th class="lbl" colspan="2"></th>${cols.map((r) => `<th class="rad">${r.label}<div class="muted small">${r.pct}%</div></th>`).join('')}</tr>`;
  rows += `<tr><td class="lbl" colspan="2">Straal (mm)</td>${cols.map((r) => `<td class="out" data-out="R-${r.key}">${fmt(radiusMm(j.diameter, r.pct), 1)}</td>`).join('')}</tr>`;
  rows += `<tr class="angle"><td class="lbl" colspan="2">Hoek boven (°)</td>${cols.map((r) => `<td>${inp(`meting.${set}.angles.${r.key}.up`, m.angles[r.key].up)}</td>`).join('')}</tr>`;
  rows += `<tr class="angle"><td class="lbl" colspan="2">Hoek onder (°)</td>${cols.map((r) => `<td>${inp(`meting.${set}.angles.${r.key}.down`, m.angles[r.key].down)}</td>`).join('')}</tr>`;

  m.blades.forEach((b, i) => {
    [['up', 'Boven'], ['zero', 'Nul'], ['down', 'Onder']].forEach(([pos, lbl], pi) => {
      rows += `<tr class="${pi === 0 ? 'bladesep' : ''}">
        ${pi === 0 ? `<td class="blade" rowspan="4">${i + 1}</td>` : ''}
        <td class="lbl sub">${lbl}</td>
        ${cols.map((r) => `<td>${pos === 'zero' && noZero(r.key) ? inp(`meting.${set}.blades.${i}.${r.key}.${pos}`, b[r.key][pos], 'class="na" title="Niet nodig voor de berekening"') : inp(`meting.${set}.blades.${i}.${r.key}.${pos}`, b[r.key][pos])}</td>`).join('')}
      </tr>`;
    });
    rows += `<tr class="result"><td class="lbl sub">Spoed</td>${cols.map((r) => `<td class="out" data-out="bp-${i}-${r.key}">–</td>`).join('')}</tr>`;
  });
  rows += `<tr class="total bladesep"><td class="lbl" colspan="2">Gemiddelde spoed</td>${cols.map((r) => `<td class="out" data-out="p-${r.key}">–</td>`).join('')}</tr>`;

  el.innerHTML = `
    <div class="row" style="margin-bottom:12px">
      <div class="seg" id="setsel">
        <button data-s="voor" class="${set === 'voor' ? 'on' : ''}">Vóór herstelling</button>
        <button data-s="na" class="${set === 'na' ? 'on' : ''}">Na herstelling</button>
      </div>
      <span class="spacer"></span>
      ${set === 'na' ? '<button class="btn" id="copyAngles">Hoeken overnemen van vóór</button>' : ''}
    </div>
    ${!num(j.diameter) ? `<div class="card" style="border-color:var(--accent)">Vul eerst de <b>diameter</b> in bij <a href="#/job/${j.id}/ontvangst">Ontvangst</a>, dan worden de stralen berekend.</div>` : ''}
    <div class="summary">
      <div class="stat"><div class="k">Spoed (gemeten)</div><div class="v" data-out="total">–</div></div>
      <div class="stat"><div class="k">Spoed (nominaal)</div><div class="v">${fmt(num(j.spoedNominaal))}</div></div>
      <div class="stat"><div class="k">Afwijking</div><div class="v" data-out="dev">–</div></div>
      <div class="stat"><div class="k">Diameter · bladen</div><div class="v" style="font-size:1.2rem">Ø ${esc(j.diameter || '–')} · ${j.bladen}</div></div>
    </div>
    <div class="meetwrap"><table class="meet">${rows}</table></div>
    <p class="muted small">Spoed = gemiddelde (onder − boven) × 360 / (hoek boven + hoek onder). Totaal = gewogen naar straal, zoals in het Excel-blad.</p>
    <div class="row"><a class="btn" href="#/job/${j.id}/ontvangst">← Ontvangst</a><span class="spacer"></span>
      <a class="btn dark" href="#/job/${j.id}/herstelling">Verder naar herstelling →</a></div>`;

  updateResults = () => {
    const res = calculate(j.diameter, j.meting[set]);
    const nominal = num(j.spoedNominaal);
    const devClass = (v) => {
      const d = deviationPct(v, nominal);
      if (d === null) return '';
      const a = Math.abs(d);
      return a <= 1 ? 'dev-ok' : a <= 3 ? 'dev-warn' : 'dev-bad';
    };
    const put = (k, v, cls = '') => {
      const c = el.querySelector(`[data-out="${k}"]`);
      if (c) { c.textContent = v; c.className = c.className.replace(/\bdev-\w+/g, '').trim() + (cls ? ' ' + cls : ''); }
    };
    for (const r of RADII) {
      const pr = res.perRadius[r.key];
      put(`R-${r.key}`, fmt(pr.R, 1));
      put(`p-${r.key}`, fmt(pr.pitch), devClass(pr.pitch));
      pr.bladePitch.forEach((p, i) => put(`bp-${i}-${r.key}`, fmt(p), devClass(p)));
    }
    put('total', fmt(res.total), devClass(res.total));
    const d = deviationPct(res.total, nominal);
    put('dev', d === null ? '–' : (d > 0 ? '+' : '') + fmt(d, 1) + ' %', devClass(res.total));
    if (res.total !== null && j.status === 'ontvangen') {
      j.status = 'gemeten';
      const b = document.getElementById('status');
      b.textContent = STATUSES.gemeten; b.className = 'badge gemeten';
    }
  };
  updateResults();

  el.querySelector('#setsel').onclick = (e) => {
    const s = e.target.dataset.s;
    if (!s) return;
    sessionStorage.setItem('meetset', s);
    el.replaceChildren();
    tabMeting(el);
  };
  el.querySelector('#copyAngles')?.addEventListener('click', () => {
    j.meting.na.angles = structuredClone(j.meting.voor.angles);
    scheduleSave();
    tabMeting(el);
    toast('Hoeken overgenomen');
  });

  // Enter = volgende cel naar beneden (zoals op papier, kolom per kolom)
  el.querySelector('table.meet').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const inputs = [...el.querySelectorAll('table.meet input')];
    const td = e.target.closest('td');
    const colIdx = [...td.parentElement.children].filter((c) => c.querySelector('input')).indexOf(td);
    const sameCol = inputs.filter((i) => {
      const t = i.closest('td');
      return [...t.parentElement.children].filter((c) => c.querySelector('input')).indexOf(t) === colIdx;
    });
    const next = sameCol[sameCol.indexOf(e.target) + 1] ?? inputs[inputs.indexOf(e.target) + 1];
    next?.focus();
    next?.select();
  });
}

// ----- 3. Herstelling -----
function tabHerstelling(el) {
  const j = current.job;
  el.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0">Uitgevoerde werken</h2>
      <div class="chips">
        ${WORKS.map(([k, l]) => `<label class="chip"><input type="checkbox" data-path="werken.${k}" ${j.werken[k] ? 'checked' : ''}><span>${l}</span></label>`).join('')}
      </div>
      <label for="f-werk" style="margin-top:14px">Beschrijving van de herstelling</label>
      <textarea id="f-werk" data-path="werkTekst" placeholder="Bv. blad 2 en 3 gericht, uitgebroken randen gelast en machinaal bijgewerkt, schroef gebalanceerd.">${esc(j.werkTekst)}</textarea>
    </div>
    <div class="card">
      <h2 style="margin-top:0">Foto's na herstelling</h2>
      ${photoGrid('herstelling')}
    </div>
    <div class="row"><a class="btn" href="#/job/${j.id}/meting">← Meting</a><span class="spacer"></span>
      <a class="btn dark" href="#/job/${j.id}/rapport">Verder naar rapport →</a></div>`;
  bindPhotos(el);
  if (j.status === 'ontvangen' || j.status === 'gemeten') {
    el.addEventListener('change', () => {
      if (j.status === 'klaar') return;
      j.status = 'herstelling';
      const b = document.getElementById('status');
      b.textContent = STATUSES.herstelling; b.className = 'badge herstelling';
    }, { once: true });
  }
}

// ----- 4. Rapport -----
async function tabRapport(el) {
  const j = current.job;
  const s = await getSettings();
  const resV = calculate(j.diameter, j.meting.voor);
  const resN = calculate(j.diameter, j.meting.na);
  const missing = [
    !j.schip && 'naam schip',
    !num(j.diameter) && 'diameter',
    resV.total === null && 'meting vóór herstelling',
  ].filter(Boolean);

  el.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0">Herstelrapport (PDF)</h2>
      <div class="summary" style="margin-top:0">
        <div class="stat"><div class="k">Spoed vóór</div><div class="v">${fmt(resV.total)}</div></div>
        <div class="stat"><div class="k">Spoed na</div><div class="v">${fmt(resN.total)}</div></div>
        <div class="stat"><div class="k">Nominaal</div><div class="v">${fmt(num(j.spoedNominaal))}</div></div>
        <div class="stat"><div class="k">Foto's</div><div class="v">${current.photos.length}</div></div>
      </div>
      ${missing.length ? `<p class="dev-warn"><b>Nog niet ingevuld:</b> ${missing.join(', ')}.</p>` : ''}
      <label>Taal van het rapport</label>
      <div class="seg" id="lang" style="margin-bottom:14px">
        <button data-l="nl" class="${j.rapportTaal !== 'fr' ? 'on' : ''}">Nederlands</button>
        <button data-l="fr" class="${j.rapportTaal === 'fr' ? 'on' : ''}">Français</button>
      </div>
      <p class="muted small" id="frnote" ${j.rapportTaal === 'fr' ? '' : 'hidden'}>Vaste teksten, schade en werken worden in het Frans gezet. Vrije tekst (beschrijvingen) blijft zoals je hem typte.</p>
      <div class="row">
        <button class="btn" id="preview">Bekijk PDF</button>
        <button class="btn primary" id="send">✉ Verstuur rapport</button>
      </div>
      <p class="muted small" style="margin-top:10px">${s.emailAdmin ? `Wordt verstuurd naar <b>${esc(s.emailAdmin)}</b> (of kies zelf bij delen).` : `Tip: stel het e-mailadres van de administratie in bij <a href="#/instellingen">Instellingen</a>.`}</p>
    </div>
    <div class="card">
      <div class="row">
        <div><b>Status</b><div class="muted small">Zet op Klaar wanneer de schroef afgewerkt is.</div></div>
        <span class="spacer"></span>
        <button class="btn ${j.status === 'klaar' ? '' : 'dark'}" id="done">${j.status === 'klaar' ? 'Terug openzetten' : '✓ Herstelling klaar'}</button>
      </div>
    </div>
    <div class="row"><a class="btn" href="#/job/${j.id}/herstelling">← Herstelling</a><span class="spacer"></span>
      <button class="btn danger" id="del">Fiche verwijderen</button></div>`;

  el.querySelector('#lang').onclick = (e) => {
    const l = e.target.dataset.l;
    if (!l) return;
    j.rapportTaal = l;
    scheduleSave();
    el.querySelectorAll('#lang button').forEach((b) => b.classList.toggle('on', b.dataset.l === l));
    el.querySelector('#frnote').hidden = l !== 'fr';
  };

  const make = async () => {
    await flushSave();
    return buildReport(j, current.photos, await getSettings(), { DAMAGE, WORKS });
  };
  el.querySelector('#preview').onclick = async () => {
    const { blob } = await make();
    window.open(URL.createObjectURL(blob), '_blank');
  };
  el.querySelector('#send').onclick = async () => {
    const { blob, filename, subject } = await make();
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: subject, text: subject });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
    // Terugval (bv. op een pc): PDF downloaden en e-mail openen
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
    a.click();
    const to = s.emailAdmin ? encodeURIComponent(s.emailAdmin) : '';
    location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent('In bijlage het herstelrapport (' + filename + ').')}`;
    toast('PDF gedownload — voeg hem toe als bijlage');
  };
  el.querySelector('#done').onclick = async () => {
    j.status = j.status === 'klaar' ? (resN.total !== null || Object.values(j.werken).some(Boolean) ? 'herstelling' : 'gemeten') : 'klaar';
    await flushSave();
    renderJob(j.id, 'rapport');
    toast(j.status === 'klaar' ? 'Op Klaar gezet' : 'Terug open');
  };
  el.querySelector('#del').onclick = async () => {
    if (!confirm(`Fiche "${j.schip || 'zonder naam'}" en alle foto's definitief verwijderen?`)) return;
    current = null;
    await jobs.remove(j.id);
    location.hash = '#/';
  };
}

// ---------- Instellingen ----------
async function renderSettings() {
  current = null;
  const s = await getSettings();
  $app.innerHTML = `
    <div class="jobhead"><a href="#/" class="btn" aria-label="Terug">←</a><h1>Instellingen</h1></div>
    <div class="card" style="margin-top:14px">
      <div class="grid">
        <div class="wide"><label for="s-b">Bedrijfsnaam (bovenaan het rapport)</label><input id="s-b" data-k="bedrijf" value="${esc(s.bedrijf)}"></div>
        <div class="wide"><label for="s-a">Adres</label><input id="s-a" data-k="adres" value="${esc(s.adres)}"></div>
        <div class="wide"><label for="s-e">E-mail administratie</label><input id="s-e" data-k="emailAdmin" type="email" value="${esc(s.emailAdmin)}"></div>
        <div class="wide"><label for="s-m">Meetstanden (gescheiden door komma's)</label><input id="s-m" data-k="meetstanden" value="${esc(s.meetstanden)}"></div>
      </div>
    </div>
    <div class="card">
      <h2 style="margin-top:0">Gegevens</h2>
      <p class="muted small">Alle fiches en foto's staan enkel op dit toestel. Maak regelmatig een back-up.</p>
      <div class="row">
        <button class="btn" id="exp">Back-up downloaden</button>
        <label class="btn">Back-up terugzetten<input type="file" accept="application/json" id="imp" hidden></label>
      </div>
    </div>`;
  $app.oninput = async (e) => {
    if (!e.target.dataset?.k) return;
    const cur = await getSettings();
    await settings.set('app', { ...cur, [e.target.dataset.k]: e.target.value });
  };
  document.getElementById('exp').onclick = async () => {
    const all = await jobs.all();
    const data = { versie: 1, gemaakt: new Date().toISOString(), jobs: all, photos: (await Promise.all(all.map((j) => photos.forJob(j.id)))).flat() };
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })),
      download: `schroeven-backup-${today()}.json`,
    });
    a.click();
  };
  document.getElementById('imp').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      for (const j of data.jobs ?? []) await jobs.put(j);
      for (const p of data.photos ?? []) await photos.put(p);
      toast(`${data.jobs?.length ?? 0} fiches teruggezet`);
    } catch {
      toast('Dit is geen geldig back-upbestand');
    }
  };
}

// ---------- Start ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
route();
