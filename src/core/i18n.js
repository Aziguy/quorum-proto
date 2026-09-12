/**
 * i18n.js — internationalisation par clé, avec le français comme source.
 *
 * Convention : t(clé, texte français de référence)
 *   par exemple  t("wizard.step1.title", "Objet du vote")
 *   - le second argument est le texte français, écrit là où il sert ;
 *   - une langue additionnelle est un simple objet { clé: traduction }.
 *
 * Conséquence pratique : le code reste lisible sans consulter un fichier de
 * langue, et traduire consiste à copier src/i18n/en.js puis à le remplir.
 * `tools/i18n-report.mjs` liste les clés manquantes d'une langue.
 */

import { fr } from '../i18n/fr.js';
import { en } from '../i18n/en.js';

export const LOCALES = {
  fr: { label: 'Français', intl: 'fr-FR', dict: fr },
  en: { label: 'English', intl: 'en-GB', dict: en },
};

let current = 'fr';
let dict = LOCALES.fr.dict;
const missing = new Set();

export function setLocale(code) {
  if (!LOCALES[code]) return current;
  current = code;
  dict = LOCALES[code].dict;
  document.documentElement.lang = code;
  return current;
}

export function getLocale() { return current; }
export function getIntlLocale() { return LOCALES[current].intl; }

/**
 * Traduit une clé. `fallback` est le texte français de référence :
 * il sert de valeur par défaut ET de documentation en ligne.
 */
export function t(key, fallback, vars) {
  let text = dict[key];
  if (text === undefined) {
    if (current !== 'fr') missing.add(key);
    text = fallback !== undefined ? fallback : key;
  }
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  ));
}

/** Pluriel simple : plural(n, 'scrutin', 'scrutins') */
export function plural(count, singular, pluralForm) {
  return count > 1 ? (pluralForm ?? `${singular}s`) : singular;
}

/** Clés vues à l'exécution et absentes de la langue active. */
export function missingKeys() { return [...missing]; }
