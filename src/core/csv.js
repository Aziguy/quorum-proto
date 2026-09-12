/**
 * csv.js — lecture et écriture de CSV, sans dépendance.
 *
 * Le format d'import du corps électoral est délibérément tolérant : un
 * trésorier bénévole exporte depuis un tableur, pas depuis une API. On accepte
 * la virgule, le point-virgule et la tabulation comme séparateurs, les
 * guillemets, les BOM Excel, et des en-têtes accentués ou non.
 */

/** Devine le séparateur d'après la première ligne non vide. */
function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || '';
  const counts = [';', ',', '\t'].map((d) => [d, firstLine.split(d).length]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ';';
}

/** Analyse un CSV en tableau de tableaux, en respectant les guillemets. */
export function parseRows(text, delimiter) {
  const clean = text.replace(/^﻿/, '');
  const sep = delimiter || detectDelimiter(clean);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += char;
      continue;
    }
    if (char === '"') { inQuotes = true; continue; }
    if (char === sep) { row.push(field); field = ''; continue; }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  return rows;
}

/** Normalise un en-tête : minuscules, sans accent ni ponctuation. */
export function normalizeHeader(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Analyse un CSV avec en-têtes en tableau d'objets à clés normalisées. */
export function parseTable(text) {
  const rows = parseRows(text);
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((cell) => cell.trim());
  const keys = headers.map(normalizeHeader);
  const records = rows.slice(1).map((cells) => {
    const record = {};
    keys.forEach((key, i) => { record[key] = (cells[i] ?? '').trim(); });
    return record;
  });
  return { headers, records };
}

function escapeCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Construit un CSV. Le BOM en tête est volontaire : sans lui, Excel sous
 * Windows affiche « Bénédicte » comme « BÃ©nÃ©dicte ».
 */
export function toCsv(rows, { delimiter = ';', bom = true } = {}) {
  const body = rows.map((row) => row.map(escapeCell).join(delimiter)).join('\r\n');
  return (bom ? '﻿' : '') + body;
}
