#!/usr/bin/env node
/**
 * i18n-report.mjs — état des traductions.
 *
 *   node tools/i18n-report.mjs        rapport pour l'anglais
 *   node tools/i18n-report.mjs en     rapport pour une langue donnée
 *
 * Relève les appels t('clé', 'texte français') dans src/, puis les compare au
 * fichier de langue. Le français est la langue source : ses textes vivent dans
 * le code, il n'a donc pas de rapport.
 *
 * Limite connue : les clés passées par variable — t(entry.key, entry.label) —
 * échappent à l'extraction. Elles apparaissent donc comme « obsolètes » alors
 * qu'elles sont bien utilisées. Les fichiers concernés les listent en
 * commentaire ; la section ci-dessous est indicative, pas normative.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

// Deux motifs plutôt qu'un seul avec alternance : le texte français peut être
// écrit entre apostrophes ou entre guillemets selon qu'il en contient.
const CALL_SINGLE = /\bt\(\s*'([^']+)'\s*,\s*'([^']*)'/g;
const CALL_DOUBLE = /\bt\(\s*'([^']+)'\s*,\s*"([^"]*)"/g;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else if (extname(entry.name) === '.js') out.push(path);
  }
  return out;
}

const files = await walk('src');
const used = new Map();

for (const file of files) {
  const source = await readFile(file, 'utf8');
  for (const pattern of [CALL_SINGLE, CALL_DOUBLE]) {
    for (const [, key, text] of source.matchAll(pattern)) {
      if (!used.has(key)) used.set(key, { text, file });
    }
  }
}

const code = process.argv[2] || 'en';
const module = await import(`../src/i18n/${code}.js`);
const dict = module[code] || {};

const missing = [...used.keys()].filter((key) => !(key in dict));
const stale = Object.keys(dict).filter((key) => !used.has(key));
const done = used.size - missing.length;
const pct = used.size ? Math.round((done / used.size) * 100) : 100;

console.log(`${used.size} clés relevées dans ${files.length} fichiers.`);
console.log(`${code} : ${done}/${used.size} clés traduites (${pct} %)\n`);

if (missing.length) {
  console.log(`Clés manquantes — à coller dans src/i18n/${code}.js :\n`);
  for (const key of missing) {
    console.log(`  '${key}': ${JSON.stringify(used.get(key).text)},`);
  }
  console.log();
}

if (stale.length) {
  console.log('Clés sans appel direct — vérifier avant de supprimer :\n');
  for (const key of stale) console.log(`  ${key}`);
  console.log();
}

if (!missing.length && !stale.length) console.log('Rien à signaler.');
