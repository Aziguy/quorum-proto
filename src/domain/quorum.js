/**
 * quorum.js — condition de validité de la délibération.
 *
 * Le quorum se calcule sur les *représentés* (présents + pouvoirs), pas sur
 * les seuls bulletins déposés : c'est la règle associative française usuelle,
 * et c'est aussi ce qui rend le pouvoir utile. Les instances qui appliquent
 * une autre règle changent `basis` sans toucher au reste du code.
 */

/**
 * @param {object} election
 * @param {object} stats  — sortie de participationStats()
 * @returns {{enabled:boolean, required:number, reached:number, total:number,
 *            met:boolean, ratio:number, basis:string, label:string}}
 */
export function evaluateQuorum(election, stats) {
  const config = election.quorum || { enabled: false };

  if (!config.enabled) {
    return {
      enabled: false, required: 0, met: true,
      reached: stats.representedVoters, total: stats.registeredVoters,
      ratio: stats.ratio, basis: 'voters',
      label: 'Aucun quorum exigé',
    };
  }

  const byWeight = config.basis === 'weight';
  const total = byWeight ? stats.registeredWeight : stats.registeredVoters;
  const reached = byWeight ? stats.castWeight : stats.representedVoters;

  const required = config.mode === 'count'
    ? Math.max(0, Math.round(config.value))
    : Math.ceil((total * config.value) / 100);

  return {
    enabled: true,
    required,
    reached,
    total,
    met: reached >= required,
    ratio: total > 0 ? reached / total : 0,
    basis: byWeight ? 'weight' : 'voters',
    label: config.mode === 'count'
      ? `${required} ${byWeight ? 'voix' : 'votants'} requis`
      : `${config.value} % des ${byWeight ? 'voix' : 'inscrits'} — ${required} requis`,
  };
}

/** Seuils proposés dans l'assistant, avec leur formulation courante. */
export const QUORUM_PRESETS = [
  { value: 25, label: 'Un quart' },
  { value: 33, label: 'Un tiers' },
  { value: 50, label: 'La moitié' },
  { value: 67, label: 'Deux tiers' },
];
