/**
 * audit.js — journal d'audit chaîné.
 *
 * Chaque entrée porte l'empreinte de la précédente. Modifier une ligne après
 * coup invalide toutes les suivantes, et `verifyChain` le détecte. C'est une
 * garantie de *détection*, pas d'impossibilité : voir docs/SECURITY-MODEL.md.
 */

import { chainHash } from '../core/crypto.js';

/**
 * Catalogue des actions. Le journal enregistre un code et des paramètres,
 * jamais une phrase : la même ligne reste lisible après un changement de
 * langue ou de formulation.
 */
export const AUDIT_ACTIONS = {
  'election.created': { severity: 'info', text: (p) => `Scrutin créé : « ${p.title} »` },
  'election.updated': { severity: 'notice', text: (p) => `Configuration modifiée : ${p.field}` },
  'election.opened': { severity: 'info', text: (p) => `Ouverture du scrutin · corps électoral figé à ${p.voters} électeurs` },
  'election.closed': { severity: 'critical', text: (p) => `Clôture et scellement de l'urne · empreinte ${p.fingerprint}` },
  'election.reopened': { severity: 'critical', text: () => 'Réouverture du scrutin après clôture' },
  'electorate.imported': { severity: 'info', text: (p) => `Import du corps électoral · ${p.added} lignes, ${p.merged} doublons fusionnés` },
  'electorate.added': { severity: 'info', text: (p) => `Électeur ajouté : ${p.name}` },
  'electorate.removed': { severity: 'notice', text: (p) => `Électeur retiré : ${p.name}` },
  'electorate.purged': { severity: 'critical', text: (p) => `Suppression définitive du corps électoral (${p.count} fiches)` },
  'proxy.registered': { severity: 'info', text: (p) => `Pouvoir enregistré : ${p.from} → ${p.to}` },
  'proxy.rejected': { severity: 'notice', text: (p) => `Dépôt de pouvoir refusé : ${p.to} détient déjà ${p.limit} pouvoirs` },
  'proxy.revoked': { severity: 'notice', text: (p) => `Pouvoir révoqué : ${p.from} → ${p.to}` },
  'ballot.cast': { severity: 'info', text: (p) => `Bulletin déposé · reçu ${p.receipt}${p.proxies ? ` · ${p.proxies} pouvoir(s)` : ''}` },
  'ballot.rejected': { severity: 'notice', text: (p) => `Tentative de dépôt refusée : ${p.reason}` },
  'quorum.reached': { severity: 'info', text: (p) => `Quorum atteint (${p.reached} sur ${p.required} requis)` },
  'reminder.sent': { severity: 'info', text: (p) => `Relance adressée à ${p.count} électeurs n'ayant pas voté` },
  'tiebreak.applied': { severity: 'critical', text: (p) => `Départage appliqué : ${p.rule}` },
  'minutes.generated': { severity: 'info', text: () => 'Procès-verbal généré' },
  'candidacy.reviewed': { severity: 'info', text: (p) => `Candidature ${p.decision} : ${p.name}` },
  'incident.reported': { severity: 'critical', text: (p) => `Incident signalé par un électeur : ${p.reason}` },
};

export function describe(entry) {
  const action = AUDIT_ACTIONS[entry.action];
  if (!action) return entry.action;
  try { return action.text(entry.details || {}); } catch { return entry.action; }
}

export function severityOf(entry) {
  return AUDIT_ACTIONS[entry.action]?.severity || 'info';
}

/**
 * Ajoute une entrée au journal. Renvoie un NOUVEAU tableau : le journal est
 * en ajout seul, on ne modifie jamais une entrée existante.
 */
export async function appendEntry(entries, { action, actor, details = {}, at }) {
  const previous = entries[entries.length - 1];
  const payload = {
    seq: entries.length + 1,
    at: at || new Date().toISOString(),
    action,
    actor: actor || 'Système',
    details,
  };
  const hash = await chainHash(previous?.hash, payload);
  return [...entries, { ...payload, prev: previous?.hash || null, hash }];
}

/**
 * Recalcule toute la chaîne et signale la première entrée incohérente.
 * @returns {{valid:boolean, brokenAt:number|null, checked:number}}
 */
export async function verifyChain(entries) {
  let previousHash = null;
  for (let i = 0; i < entries.length; i += 1) {
    const { hash, prev, ...payload } = entries[i];
    if (prev !== previousHash) return { valid: false, brokenAt: i + 1, checked: i };
    const expected = await chainHash(previousHash, payload);
    if (expected !== hash) return { valid: false, brokenAt: i + 1, checked: i };
    previousHash = hash;
  }
  return { valid: true, brokenAt: null, checked: entries.length };
}
