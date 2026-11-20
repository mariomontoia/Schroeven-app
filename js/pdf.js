// Herstelrapport als PDF (jsPDF) — Nederlands of Frans
import { RADII, calculate, num } from './calc.js';

const T = {
  nl: {
    title: 'Herstelrapport schroef',
    data: 'Gegevens', ship: 'Schip', client: 'Klant', date: 'Datum', propNr: 'Schroef nr.',
    diameter: 'Diameter', blades: 'Aantal bladen', rotation: 'Draairichting', model: 'Model',
    material: 'Materiaal', place: 'Plaats', nominal: 'Spoed (nominaal)', remarks: 'Opmerkingen',
    R: 'Rechts', L: 'Links',
    damage: 'Schade bij ontvangst', blade: 'Blad', noDamage: 'Geen schade aangeduid.',
    measure: 'Spoedmeting', radius: 'Straal', before: 'Vóór', after: 'Na', avg: 'Gemiddelde spoed (gewogen)',
    perBlade: 'Spoed per blad', works: 'Uitgevoerde werken', noWorks: 'Geen werken aangeduid.',
    photosIn: "Foto's bij ontvangst", photosOut: "Foto's na herstelling",
    measuredBy: 'Gemeten door', stand: 'Meetstand', page: 'Pagina', of: 'van',
    subject: 'Herstelrapport schroef', file: 'Herstelrapport',
    damageL: { vervormd: 'Vervormd', uitgebroken: 'Uitgebroken randen', scheur: 'Scheuren', cavitatie: 'Cavitatie', corrosie: 'Corrosie', ontbreekt: 'Stuk ontbreekt' },
    worksL: { gericht: 'Vervormingen gericht', gelast: 'Uitgebroken delen gelast', geslepen: 'Machinaal bijgewerkt / geslepen', spoed: 'Spoed gecorrigeerd', gepolijst: 'Gepolijst', gebalanceerd: 'Gebalanceerd' },
    mat: {},
  },
  fr: {
    title: "Rapport de réparation d'hélice",
    data: 'Données', ship: 'Navire', client: 'Client', date: 'Date', propNr: "N° d'hélice",
    diameter: 'Diamètre', blades: 'Nombre de pales', rotation: 'Sens de rotation', model: 'Modèle',
    material: 'Matériau', place: 'Emplacement', nominal: 'Pas (nominal)', remarks: 'Remarques',
    R: 'Droite', L: 'Gauche',
    damage: 'Dommages à la réception', blade: 'Pale', noDamage: 'Aucun dommage indiqué.',
    measure: 'Mesure du pas', radius: 'Rayon', before: 'Avant', after: 'Après', avg: 'Pas moyen (pondéré)',
    perBlade: 'Pas par pale', works: 'Travaux effectués', noWorks: 'Aucun travail indiqué.',
    photosIn: 'Photos à la réception', photosOut: 'Photos après réparation',
    measuredBy: 'Mesuré par', stand: 'Poste de mesure', page: 'Page', of: 'de',
    subject: "Rapport de réparation d'hélice", file: 'Rapport-reparation',
    damageL: { vervormd: 'Déformée', uitgebroken: 'Bords ébréchés', scheur: 'Fissures', cavitatie: 'Cavitation', corrosie: 'Corrosion', ontbreekt: 'Morceau manquant' },
    worksL: { gericht: 'Déformations redressées', gelast: 'Parties ébréchées soudées', geslepen: 'Usinage / meulage', spoed: 'Pas corrigé', gepolijst: 'Polie', gebalanceerd: 'Équilibrée' },
    mat: { Brons: 'Bronze', Mangaanbrons: 'Bronze au manganèse', 'NiAl-brons': 'Bronze nickel-aluminium', Staal: 'Acier' },
  },
};

const BRAND = [22, 50, 79];
const ACCENT = [224, 122, 31];
const fmt = (n, d = 0) => (n === null || !Number.isFinite(n) ? '–' : n.toLocaleString('nl-BE', { maximumFractionDigits: d, minimumFractionDigits: d, useGrouping: false }));

export function buildReport(job, photos, settings) {
  const t = T[job.rapportTaal] ?? T.nl;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 15, CW = W - 2 * M, BOTTOM = 280;
  let y = 0;

  const dateStr = job.datum ? new Date(job.datum + 'T00:00').toLocaleDateString(job.rapportTaal === 'fr' ? 'fr-BE' : 'nl-BE') : '';

  const header = () => {
    doc.setFillColor(...BRAND).rect(0, 0, W, 24, 'F');
    doc.setTextColor(255).setFont('helvetica', 'bold').setFontSize(14).text(settings.bedrijf || '', M, 11);
    doc.setFont('helvetica', 'normal').setFontSize(9).text(settings.adres || '', M, 17);
    doc.setFont('helvetica', 'bold').setFontSize(11).text(t.title, W - M, 11, { align: 'right' });
    doc.setFont('helvetica', 'normal').setFontSize(9).text(`${job.schip || ''}  ·  ${dateStr}`, W - M, 17, { align: 'right' });
    doc.setTextColor(27, 36, 48);
    y = 32;
  };
  const ensure = (h) => { if (y + h > BOTTOM) { doc.addPage(); header(); } };
  const h2 = (txt) => {
    ensure(14);
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...BRAND).text(txt, M, y);
    doc.setDrawColor(...ACCENT).setLineWidth(0.6).line(M, y + 1.8, M + 30, y + 1.8);
    doc.setTextColor(27, 36, 48);
    y += 8;
  };
  const para = (txt, size = 10) => {
    if (!txt) return;
    doc.setFont('helvetica', 'normal').setFontSize(size);
    for (const line of doc.splitTextToSize(String(txt), CW)) {
      ensure(5);
      doc.text(line, M, y);
      y += 5;
    }
    y += 1;
  };
  // Eenvoudige tabel
  const table = (head, rows, widths, opts = {}) => {
    const rh = 7;
    const drawRow = (cells, style) => {
      ensure(rh);
      let x = M;
      if (style === 'head') doc.setFillColor(240, 243, 247).rect(M, y - 5, CW, rh, 'F');
      if (style === 'total') doc.setFillColor(253, 241, 227).rect(M, y - 5, CW, rh, 'F');
      doc.setFont('helvetica', style ? 'bold' : 'normal').setFontSize(9.5);
      cells.forEach((c, i) => {
        const w = widths[i] * CW;
        const align = i === 0 ? 'left' : opts.align ?? 'right';
        doc.text(String(c ?? ''), align === 'left' ? x + 2 : x + w - 2, y, { align });
        x += w;
      });
      doc.setDrawColor(215, 221, 228).setLineWidth(0.2).line(M, y + 2, M + CW, y + 2);
      y += rh;
    };
    if (head) drawRow(head, 'head');
    rows.forEach((r) => drawRow(r.cells ?? r, r.total ? 'total' : null));
    y += 3;
  };

  header();

  // Gegevens (twee kolommen)
  h2(t.data);
  const mat = t.mat[job.materiaal] ?? job.materiaal;
  const info = [
    [t.ship, job.schip], [t.client, job.klant], [t.propNr, job.schroefNr], [t.date, dateStr],
    [t.diameter, job.diameter ? `${job.diameter} mm` : ''], [t.blades, job.bladen],
    [t.rotation, t[job.draairichting] ?? job.draairichting], [t.material, mat],
    [t.model, job.model], [t.place, job.plaats],
    [t.nominal, job.spoedNominaal ? `${job.spoedNominaal} mm` : ''],
  ].filter(([, v]) => v !== '' && v !== undefined && v !== null);
  const half = Math.ceil(info.length / 2);
  doc.setFontSize(10);
  for (let i = 0; i < half; i++) {
    ensure(6);
    [info[i], info[i + half]].forEach((pair, col) => {
      if (!pair) return;
      const x = M + col * (CW / 2);
      doc.setFont('helvetica', 'normal').setTextColor(93, 107, 122).text(pair[0], x, y);
      doc.setFont('helvetica', 'bold').setTextColor(27, 36, 48).text(String(pair[1]), x + 34, y);
    });
    y += 6;
  }
  y += 2;
  if (job.opmerkingen) { doc.setFont('helvetica', 'bold').setFontSize(10).text(t.remarks, M, y); y += 5; para(job.opmerkingen); }

  // Schade
  h2(t.damage);
  const dmgLines = [];
  for (let b = 1; b <= job.bladen; b++) {
    const sel = Object.entries(job.schade?.perBlad?.[b] ?? {}).filter(([, v]) => v).map(([k]) => t.damageL[k] ?? k);
    if (sel.length) dmgLines.push(`${t.blade} ${b}: ${sel.join(', ')}`);
  }
  if (!dmgLines.length && !job.schade?.tekst) para(t.noDamage);
  dmgLines.forEach((l) => para('•  ' + l));
  para(job.schade?.tekst);

  // Meting
  const rv = calculate(job.diameter, job.meting?.voor);
  const rn = calculate(job.diameter, job.meting?.na);
  const hasNa = rn.total !== null;
  if (rv.total !== null || hasNa) {
    h2(t.measure);
    const nominal = num(job.spoedNominaal);
    const rows = RADII.filter((r) => rv.perRadius[r.key].pitch !== null || rn.perRadius[r.key].pitch !== null).map((r) => [
      `${r.label} (${r.pct}%)`, fmt(rv.perRadius[r.key].R, 1) + ' mm', fmt(rv.perRadius[r.key].pitch), ...(hasNa ? [fmt(rn.perRadius[r.key].pitch)] : []),
    ]);
    rows.push({ total: true, cells: [t.avg, '', fmt(rv.total), ...(hasNa ? [fmt(rn.total)] : [])] });
    if (nominal) rows.push([t.nominal, '', fmt(nominal), ...(hasNa ? [fmt(nominal)] : [])]);
    table([t.radius, 'mm', t.before, ...(hasNa ? [t.after] : [])], rows, hasNa ? [0.4, 0.2, 0.2, 0.2] : [0.5, 0.25, 0.25]);

    // Per blad
    const bladeRows = rv.perBlade.map((p, i) => [`${t.blade} ${i + 1}`, fmt(p), ...(hasNa ? [fmt(rn.perBlade[i])] : [])]);
    if (bladeRows.some((r) => r[1] !== '–')) {
      ensure(10);
      doc.setFont('helvetica', 'bold').setFontSize(10).text(t.perBlade, M, y);
      y += 6;
      table([t.blade, t.before, ...(hasNa ? [t.after] : [])], bladeRows, hasNa ? [0.5, 0.25, 0.25] : [0.6, 0.4]);
    }
  }

  // Werken
  h2(t.works);
  const done = Object.entries(job.werken ?? {}).filter(([, v]) => v).map(([k]) => t.worksL[k] ?? k);
  if (!done.length && !job.werkTekst) para(t.noWorks);
  done.forEach((l) => para('•  ' + l));
  para(job.werkTekst);

  // Ondertekening
  ensure(16);
  y += 4;
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(93, 107, 122);
  doc.text(`${t.measuredBy}: `, M, y);
  doc.setTextColor(27, 36, 48).setFont('helvetica', 'bold').text(job.gemetenDoor || '—', M + 28, y);
  if (job.meetstand) {
    doc.setFont('helvetica', 'normal').setTextColor(93, 107, 122).text(`${t.stand}: `, M + CW / 2, y);
    doc.setTextColor(27, 36, 48).setFont('helvetica', 'bold').text(job.meetstand, M + CW / 2 + 30, y);
  }
  y += 8;

  // Foto's (2 per rij)
  const photoSection = (fase, title) => {
    const list = photos.filter((p) => p.fase === fase).sort((a, b) => a.createdAt - b.createdAt);
    if (!list.length) return;
    doc.addPage(); header();
    h2(title);
    const gap = 6, w = (CW - gap) / 2;
    const boxH = 70; // vaste vakhoogte per rij
    let col = 0;
    for (const p of list) {
      let iw = w, h = w * (p.height / p.width);
      if (h > boxH) { h = boxH; iw = h * (p.width / p.height); }
      if (col === 0) ensure(boxH + gap);
      const x = M + col * (w + gap) + (w - iw) / 2;
      doc.addImage(p.dataUrl, 'JPEG', x, y + (boxH - h) / 2, iw, h, undefined, 'FAST');
      if (col === 1) { y += boxH + gap; col = 0; } else col = 1;
    }
    if (col === 1) y += boxH + gap;
  };
  photoSection('ontvangst', t.photosIn);
  photoSection('herstelling', t.photosOut);

  // Paginanummers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(93, 107, 122);
    doc.text(`${t.page} ${i} ${t.of} ${pages}`, W - M, 290, { align: 'right' });
    doc.text(`${settings.bedrijf || ''} · ${job.schip || ''} · ${job.schroefNr || ''}`, M, 290);
  }

  const safe = (s) => String(s || '').replace(/[^\w\-]+/g, '_').replace(/^_|_$/g, '');
  const filename = `${t.file}_${safe(job.schip) || 'schroef'}_${job.datum || ''}.pdf`;
  const subject = `${t.subject} – ${job.schip || ''}${job.schroefNr ? ' (' + job.schroefNr + ')' : ''} – ${dateStr}`;
  return { blob: doc.output('blob'), filename, subject };
}
