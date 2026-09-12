/**
 * ballot.js — contenu d'un bulletin : validation, complétude, description.
 *
 * Aucune fonction de ce fichier ne connaît l'identité du votant. C'est
 * délibéré : le bulletin est manipulé partout ailleurs sans jamais offrir de
 * prise pour y rattacher un nom.
 */

import { METHODS } from './schema.js';

export const EMPTY_CHOICE = Object.freeze({});

/** Crée un choix vierge adapté au mode de scrutin. */
export function emptyChoice(election) {
  const pick = METHODS[election.method].pick;
  if (pick === 'many') return { optionIds: [] };
  if (pick === 'order') return { order: election.options.map((o) => o.id) };
  return { optionId: null };
}

/** Nombre maximum de choix autorisés (plurinominal borné par les sièges). */
export function maxSelections(election) {
  const method = METHODS[election.method];
  if (method.pick !== 'many') return 1;
  return method.id === 'approval' ? election.options.length : Math.max(1, election.seats || 1);
}

/** Applique un clic sur une option et renvoie le nouveau choix. */
export function toggleOption(election, choice, optionId) {
  const pick = METHODS[election.method].pick;
  if (pick === 'one') {
    return { optionId: choice.optionId === optionId ? null : optionId, blank: false };
  }
  if (pick === 'many') {
    const current = choice.optionIds || [];
    if (current.includes(optionId)) {
      return { optionIds: current.filter((id) => id !== optionId), blank: false };
    }
    if (current.length >= maxSelections(election)) return choice; // plafond atteint
    return { optionIds: [...current, optionId], blank: false };
  }
  return choice;
}

/** Déplace une option dans un bulletin de classement. */
export function moveInOrder(choice, optionId, delta) {
  const order = [...(choice.order || [])];
  const index = order.indexOf(optionId);
  const target = index + delta;
  if (index === -1 || target < 0 || target >= order.length) return choice;
  [order[index], order[target]] = [order[target], order[index]];
  return { ...choice, order, blank: false };
}

/** Un bulletin est-il prêt à être déposé ? */
export function isComplete(election, choice) {
  if (!choice) return false;
  if (choice.blank) return true;
  const pick = METHODS[election.method].pick;
  if (pick === 'one') return Boolean(choice.optionId);
  if (pick === 'many') return (choice.optionIds || []).length > 0;
  if (pick === 'order') return (choice.order || []).length === election.options.length;
  return false;
}

/** Message d'aide contextuel affiché sous le bulletin. */
export function guidance(election, choice) {
  const method = METHODS[election.method];
  if (choice?.blank) return 'Vous déposez un bulletin blanc.';
  if (method.pick === 'one') {
    return choice?.optionId ? 'Vous pourrez revenir en arrière avant de déposer.' : 'Sélectionnez une réponse pour continuer.';
  }
  if (method.pick === 'many') {
    const chosen = (choice?.optionIds || []).length;
    const max = maxSelections(election);
    if (method.id === 'approval') return `${chosen} réponse(s) sélectionnée(s). Vous pouvez en choisir plusieurs.`;
    return chosen === 0
      ? `Cochez jusqu'à ${max} nom(s).`
      : `${chosen} nom(s) sur ${max}. Voter pour moins de candidats que de sièges est permis.`;
  }
  return 'Ordonnez toutes les propositions, de la plus à la moins prioritaire.';
}

/** Récapitulatif lisible d'un choix, pour l'écran de confirmation et le reçu. */
export function describeChoice(election, choice) {
  if (!choice || choice.blank) return [{ rank: null, label: 'Bulletin blanc' }];
  const byId = new Map(election.options.map((o) => [o.id, o]));
  const pick = METHODS[election.method].pick;

  if (pick === 'one') {
    const option = byId.get(choice.optionId);
    return option ? [{ rank: null, label: option.label }] : [];
  }
  if (pick === 'many') {
    return (choice.optionIds || [])
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((option) => ({ rank: null, label: option.label }));
  }
  return (choice.order || [])
    .map((id, index) => ({ rank: index + 1, label: byId.get(id)?.label }))
    .filter((item) => item.label);
}
