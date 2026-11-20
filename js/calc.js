// Spoedberekening — zelfde formules als SCHROEFBLADEN.xlsx
//
//  R      = diameter × pct / 2
//  D      = meting onder − meting boven            (Excel: I − G)
//  Gemid  = gemiddelde D over alle bladen
//  Spoed  = Gemid × 360 / (hoek boven + hoek onder)
//  Totaal = Σ(spoed × R) / Σ R                     (Excel: S9 = SUM(S11:S15)/B17)

export const RADII = [
  { key: 'r98', pct: 98, label: '98%' },
  { key: 'r90', pct: 90, label: 'RAD1' },
  { key: 'r70', pct: 70, label: 'RAD2' },
  { key: 'r50', pct: 50, label: 'RAD3' },
  { key: 'r30', pct: 30, label: 'RAD4' },
];

// Volgorde zoals op het papieren meetblad (links → rechts)
export const SHEET_ORDER = ['r30', 'r50', 'r70', 'r90', 'r98'];

export const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export function radiusMm(diameter, pct) {
  const d = num(diameter);
  return d === null ? null : (d * pct) / 200;
}

export function emptyMeasurement(blades) {
  const m = { angles: {}, blades: [] };
  for (const r of RADII) m.angles[r.key] = { up: '', down: '' };
  for (let b = 0; b < blades; b++) {
    const row = {};
    for (const r of RADII) row[r.key] = { up: '', zero: '', down: '' };
    m.blades.push(row);
  }
  return m;
}

// Past het aantal bladen aan zonder bestaande metingen te verliezen
export function resizeMeasurement(m, blades) {
  const out = m ? structuredClone(m) : emptyMeasurement(blades);
  while (out.blades.length < blades) {
    const row = {};
    for (const r of RADII) row[r.key] = { up: '', zero: '', down: '' };
    out.blades.push(row);
  }
  out.blades.length = blades;
  return out;
}

function bladeDelta(cell) {
  const up = num(cell?.up);
  const down = num(cell?.down);
  return up === null || down === null ? null : down - up;
}

export function calculate(diameter, m) {
  const perRadius = {};
  let sumPR = 0;
  let sumR = 0;
  const bladeCount = m?.blades?.length ?? 0;
  const bladeSums = Array.from({ length: bladeCount }, () => ({ pr: 0, r: 0 }));

  for (const r of RADII) {
    const R = radiusMm(diameter, r.pct);
    const a = m?.angles?.[r.key] ?? {};
    const angleSum = (num(a.up) ?? 0) + (num(a.down) ?? 0);
    const deltas = (m?.blades ?? []).map((b) => bladeDelta(b[r.key]));
    const valid = deltas.filter((d) => d !== null);
    const mean = valid.length ? valid.reduce((s, d) => s + d, 0) / valid.length : null;
    const pitch = mean !== null && angleSum > 0 ? (mean * 360) / angleSum : null;
    const bladePitch = deltas.map((d) => (d !== null && angleSum > 0 ? (d * 360) / angleSum : null));

    perRadius[r.key] = { R, angleSum, deltas, mean, pitch, bladePitch };
    if (pitch !== null && R) {
      sumPR += pitch * R;
      sumR += R;
    }
    bladePitch.forEach((p, i) => {
      if (p !== null && R) {
        bladeSums[i].pr += p * R;
        bladeSums[i].r += R;
      }
    });
  }

  return {
    perRadius,
    total: sumR > 0 ? sumPR / sumR : null,
    perBlade: bladeSums.map((s) => (s.r > 0 ? s.pr / s.r : null)),
  };
}

export function deviationPct(value, nominal) {
  const v = num(value);
  const n = num(nominal);
  if (v === null || n === null || n === 0) return null;
  return ((v - n) / n) * 100;
}
