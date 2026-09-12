/**
 * permissions.js — matrice des capacités par rôle.
 *
 * Les pouvoirs sont volontairement disjoints : l'organisateur configure mais
 * ne voit aucun résultat avant la clôture ; le scrutateur contrôle et clôt
 * mais ne configure rien. Aucun rôle ne peut voir un résultat partiel — la
 * ligne correspondante est à `false` partout, et ce n'est pas un oubli.
 */

export const CAPABILITIES = {
  'election.create': { label: 'Créer et configurer un scrutin', roles: ['organizer'] },
  'electorate.manage': { label: 'Importer le corps électoral', roles: ['organizer'] },
  'proxies.manage': { label: 'Enregistrer les pouvoirs', roles: ['organizer'] },
  'candidacies.review': { label: 'Valider les candidatures', roles: ['organizer'] },
  'monitor.view': { label: 'Voir la participation en direct', roles: ['organizer', 'scrutineer', 'observer'] },
  'roster.view': { label: "Voir la liste d'émargement", roles: ['organizer', 'scrutineer'] },
  'results.preview': { label: 'Voir un résultat avant la clôture', roles: [] },
  'election.close': { label: 'Clore le scrutin', roles: ['organizer', 'scrutineer'] },
  'results.view': { label: 'Consulter les résultats après clôture', roles: ['organizer', 'scrutineer', 'observer'] },
  'minutes.sign': { label: 'Éditer et signer le procès-verbal', roles: ['organizer', 'scrutineer'] },
  'audit.view': { label: "Consulter le journal d'audit", roles: ['organizer', 'scrutineer', 'observer'] },
  'privacy.manage': { label: 'Exercer les droits RGPD', roles: ['organizer'] },
  'ballot.cast': { label: 'Déposer un bulletin', roles: ['voter'] },
};

export function can(role, capability) {
  return Boolean(CAPABILITIES[capability]?.roles.includes(role));
}

/** Liste des capacités d'un rôle, pour l'écran « Rôles & accès ». */
export function capabilitiesOf(role) {
  return Object.entries(CAPABILITIES)
    .filter(([, cap]) => cap.roles.includes(role))
    .map(([id, cap]) => ({ id, label: cap.label }));
}
