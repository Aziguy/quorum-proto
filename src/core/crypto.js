/**
 * crypto.js — empreintes, jetons et chaînage du journal d'audit.
 *
 * Ce que ce module garantit : l'intégrité *détectable*. Si une ligne du
 * journal est modifiée après coup, la vérification de la chaîne échoue.
 * Ce qu'il ne garantit pas : l'impossibilité de reconstruire la chaîne
 * entière — le prototype n'a ni serveur ni tiers de confiance pour l'ancrer.
 * La distinction est documentée dans docs/SECURITY-MODEL.md.
 */

const subtle = globalThis.crypto?.subtle;

/** Empreinte SHA-256 d'une chaîne, en hexadécimal minuscule. */
export async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Forme lisible d'une empreinte : 4f2a-c917-8b31 */
export function fingerprint(hash, groups = 3) {
  return Array.from({ length: groups }, (_, i) => hash.slice(i * 4, i * 4 + 4)).join('-');
}

/**
 * Alphabet Crockford base32 : ni I, ni L, ni O, ni U.
 * On élimine les confusions à la lecture (1/I/L, 0/O) et le risque de
 * produire un mot malencontreux — ces codes sont dictés au téléphone.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Chaîne aléatoire issue du générateur cryptographique du navigateur. */
export function randomCode(length = 10) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** Jeton de vote à usage unique. */
export function voteToken() {
  return randomCode(16);
}

/** Reçu de dépôt, groupé pour la lecture : BUL-7F3A-91C4 */
export function receiptCode() {
  const raw = randomCode(8);
  return `BUL-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

/** Identifiant interne, trié chronologiquement par construction. */
export function newId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${randomCode(6).toLowerCase()}`;
}

/**
 * Sérialisation stable : les clés sont triées, donc l'empreinte d'un même
 * contenu ne dépend pas de l'ordre d'insertion des propriétés.
 */
export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

/** Empreinte d'une entrée de journal, chaînée à la précédente. */
export async function chainHash(previousHash, entry) {
  return sha256(`${previousHash || 'genesis'}|${canonical(entry)}`);
}

/** Mélange de Fisher-Yates, alimenté par le générateur cryptographique. */
export function shuffle(items) {
  const out = items.slice();
  const randoms = new Uint32Array(out.length);
  globalThis.crypto.getRandomValues(randoms);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randoms[i] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
