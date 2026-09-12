/**
 * tally.js — dépouillement.
 *
 * Ce module est volontairement pur : il ne lit ni le DOM, ni le stockage, ni
 * l'horloge. Un scrutin entre, un décompte sort. C'est ce qui le rend
 * testable (tests/tally.test.js) et vérifiable par un tiers.
 *
 * Deux invariants tiennent tout le fichier :
 *   1. Rien n'est dépouillé tant que l'urne n'est pas scellée.
 *   2. Si le quorum n'est pas atteint, le décompte n'est pas renvoyé du tout —
 *      pas « renvoyé puis masqué ». Une valeur absente ne fuit pas.
 */

import { METHODS, MAJORITIES, OPTION_KIND, STATUS } from './schema.js';
import { evaluateQuorum } from './quorum.js';

/** Voix portées par un bulletin (voix propre + pouvoirs détenus). */
function ballotWeight(ballot) {
  return Number.isFinite(ballot.weight) && ballot.weight > 0 ? ballot.weight : 1;
}

/** Totaux de participation, calculables à tout moment, y compris urne scellée. */
export function participationStats(election) {
  const registeredVoters = election.electorate.length;
  const registeredWeight = election.electorate.reduce((sum, v) => sum + (v.weight || 1), 0);

  const castBallots = election.ballots.length;
  const castWeight = election.ballots.reduce((sum, b) => sum + ballotWeight(b), 0);

  const proxiesUsed = election.roster.reduce((sum, r) => sum + (r.proxyFor?.length || 0), 0);
  const representedVoters = election.roster.length + proxiesUsed;

  return {
    registeredVoters,
    registeredWeight,
    castBallots,
    castWeight,
    proxiesUsed,
    representedVoters,
    ratio: registeredVoters > 0 ? representedVoters / registeredVoters : 0,
    pending: Math.max(0, registeredVoters - representedVoters),
  };
}

/* -------------------------------------------------------------------------
   Comptage brut par mode de scrutin
   ------------------------------------------------------------------------- */

function countDirect(election) {
  // Un seul choix par bulletin (résolution, élection à un siège).
  const totals = new Map(election.options.map((o) => [o.id, 0]));
  let blank = 0;
  for (const ballot of election.ballots) {
    const weight = ballotWeight(ballot);
    if (ballot.choice?.blank || !ballot.choice?.optionId) { blank += weight; continue; }
    if (!totals.has(ballot.choice.optionId)) { blank += weight; continue; }
    totals.set(ballot.choice.optionId, totals.get(ballot.choice.optionId) + weight);
  }
  return { totals, blank };
}

function countMultiple(election) {
  // Plusieurs choix par bulletin (plurinominal, approbation).
  const totals = new Map(election.options.map((o) => [o.id, 0]));
  let blank = 0;
  for (const ballot of election.ballots) {
    const weight = ballotWeight(ballot);
    const ids = ballot.choice?.optionIds || [];
    if (ballot.choice?.blank || ids.length === 0) { blank += weight; continue; }
    for (const id of ids) {
      if (totals.has(id)) totals.set(id, totals.get(id) + weight);
    }
  }
  return { totals, blank };
}

/**
 * Comptage de Borda : un classement de K options attribue K points au premier,
 * K-1 au deuxième, etc. Convention explicitée dans le procès-verbal, car il en
 * existe d'autres (K-1 … 0) qui changent les écarts sans changer l'ordre.
 */
function countRanking(election) {
  const totals = new Map(election.options.map((o) => [o.id, 0]));
  const size = election.options.length;
  let blank = 0;
  for (const ballot of election.ballots) {
    const weight = ballotWeight(ballot);
    const order = ballot.choice?.order || [];
    if (ballot.choice?.blank || order.length === 0) { blank += weight; continue; }
    order.forEach((id, index) => {
      if (totals.has(id)) totals.set(id, totals.get(id) + (size - index) * weight);
    });
  }
  return { totals, blank };
}

/**
 * Vainqueur de Condorcet : l'option qui bat toutes les autres en duel.
 * Il n'en existe pas toujours — c'est le paradoxe de Condorcet, et l'absence
 * de vainqueur est une information en soi, affichée telle quelle.
 */
export function condorcetWinner(election) {
  const ids = election.options.map((o) => o.id);
  if (ids.length < 2) return null;
  const wins = new Map(ids.map((id) => [id, 0]));

  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      let scoreA = 0;
      let scoreB = 0;
      for (const ballot of election.ballots) {
        const order = ballot.choice?.order || [];
        const rankA = order.indexOf(ids[i]);
        const rankB = order.indexOf(ids[j]);
        if (rankA === -1 && rankB === -1) continue;
        const weight = ballotWeight(ballot);
        // Une option non classée est réputée moins bien placée que toute option classée.
        const betterA = rankA !== -1 && (rankB === -1 || rankA < rankB);
        if (betterA) scoreA += weight; else scoreB += weight;
      }
      if (scoreA > scoreB) wins.set(ids[i], wins.get(ids[i]) + 1);
      else if (scoreB > scoreA) wins.set(ids[j], wins.get(ids[j]) + 1);
    }
  }
  const target = ids.length - 1;
  const winners = ids.filter((id) => wins.get(id) === target);
  return winners.length === 1 ? winners[0] : null;
}

/* -------------------------------------------------------------------------
   Dépouillement complet
   ------------------------------------------------------------------------- */

/**
 * @returns {object} décompte. `entries` vaut null quand le résultat ne doit
 * pas exister : urne non scellée, ou quorum non atteint.
 */
export function tally(election) {
  const method = METHODS[election.method];
  const stats = participationStats(election);
  const quorum = evaluateQuorum(election, stats);

  const base = {
    method: election.method,
    stats,
    quorum,
    entries: null,
    blank: 0,
    abstain: 0,
    expressed: 0,
    majority: null,
    winners: [],
    tied: [],
    condorcet: null,
    outcome: 'pending',
    disclosed: false,
  };

  // Invariant 1 — aucun décompte avant le scellement de l'urne.
  if (election.status !== STATUS.CLOSED) return base;

  // Invariant 2 — quorum manqué : le décompte n'est pas produit.
  if (!quorum.met) return { ...base, outcome: 'quorum-failed' };

  const counter = method.pick === 'order' ? countRanking
    : method.pick === 'many' ? countMultiple
      : countDirect;
  const { totals, blank } = counter(election);

  const options = election.options.map((option) => ({
    id: option.id,
    label: option.label,
    sublabel: option.sublabel,
    kind: option.kind,
    votes: totals.get(option.id) || 0,
  }));

  const abstain = options
    .filter((o) => o.kind === OPTION_KIND.ABSTAIN)
    .reduce((sum, o) => sum + o.votes, 0);

  // Suffrages exprimés : hors abstention, et hors blancs sauf réglage contraire.
  const countable = options.filter((o) => o.kind !== OPTION_KIND.ABSTAIN);
  const expressed = countable.reduce((sum, o) => sum + o.votes, 0)
    + (election.blankPolicy === 'counted' ? blank : 0);

  const ranked = [...countable].sort((a, b) => b.votes - a.votes);
  const entries = options.map((option) => ({
    ...option,
    share: expressed > 0 && option.kind !== OPTION_KIND.ABSTAIN ? option.votes / expressed : 0,
    rank: option.kind === OPTION_KIND.ABSTAIN ? null : ranked.findIndex((o) => o.id === option.id) + 1,
    elected: false,
  }));

  const result = {
    ...base,
    entries,
    blank,
    abstain,
    expressed,
    disclosed: true,
    condorcet: method.pick === 'order' ? condorcetWinner(election) : null,
  };

  if (method.pick === 'many' || method.pick === 'order') {
    return finishMultiSeat(election, result, ranked, method);
  }
  return finishSingleWinner(election, result, ranked);
}

/**
 * Résolution ou élection à un seul siège.
 * Pour une résolution, la majorité s'apprécie sur la réponse « Pour » et son
 * opposée « Contre » — pas sur l'option arrivée en tête, qui pourrait être
 * l'abstention.
 */
function finishSingleWinner(election, result, ranked) {
  const rule = MAJORITIES[election.majority];
  const isResolution = election.method === 'resolution';

  const subject = isResolution
    ? result.entries.find((e) => e.kind === OPTION_KIND.FOR)
    : ranked[0];
  const opposition = isResolution
    ? (result.entries.find((e) => e.kind === OPTION_KIND.AGAINST)?.votes ?? 0)
    : (ranked[1]?.votes ?? 0);

  if (!subject || result.expressed === 0) {
    return { ...result, outcome: isResolution ? 'rejected' : 'no-majority', majority: {
      rule: election.majority, label: rule.label, required: 0, met: false, subjectId: subject?.id ?? null,
    } };
  }

  const required = election.majority === 'unanimous'
    ? result.expressed
    : rule.required(result.expressed, opposition, election.qualifiedRatio);

  const met = election.majority === 'unanimous'
    ? opposition === 0 && subject.votes > 0
    : subject.votes >= required;

  const tied = !isResolution && ranked.length > 1
    && ranked[0].votes === ranked[1].votes && ranked[0].votes > 0
    ? ranked.filter((o) => o.votes === ranked[0].votes)
    : [];

  const entries = result.entries.map((entry) => ({
    ...entry,
    elected: !isResolution && met && tied.length === 0 && entry.id === subject.id,
  }));

  let outcome;
  if (isResolution) outcome = met ? 'adopted' : 'rejected';
  else if (tied.length) outcome = 'tie';
  else if (met) outcome = 'elected';
  else outcome = election.runoff ? 'runoff' : 'no-majority';

  return {
    ...result,
    entries,
    outcome,
    tied: tied.map((o) => o.id),
    winners: outcome === 'elected' || outcome === 'adopted' ? [subject.id] : [],
    majority: {
      rule: election.majority, label: rule.label, required, met, subjectId: subject.id,
    },
  };
}

/**
 * Élection plurinominale, classement ou sondage d'approbation.
 * L'égalité qui compte est celle qui se joue *sur la dernière place à
 * pourvoir* : deux candidats à égalité en tête ne bloquent rien s'il reste
 * assez de sièges pour les deux.
 */
function finishMultiSeat(election, result, ranked, method) {
  const seats = method.id === 'approval' ? 0 : Math.max(1, Number(election.seats) || 1);

  if (seats === 0) {
    // Sondage d'opinion : on classe, on ne proclame personne.
    return { ...result, outcome: 'counted', majority: null };
  }

  const cutoff = ranked[seats - 1]?.votes ?? 0;
  const nextOut = ranked[seats]?.votes ?? -1;
  const tiedAtCutoff = cutoff === nextOut && cutoff > 0
    ? ranked.filter((o) => o.votes === cutoff).map((o) => o.id)
    : [];

  const safeWinners = ranked
    .slice(0, seats)
    .filter((o) => o.votes > 0 && !tiedAtCutoff.includes(o.id))
    .map((o) => o.id);

  const entries = result.entries.map((entry) => ({
    ...entry, elected: safeWinners.includes(entry.id),
  }));

  return {
    ...result,
    entries,
    winners: safeWinners,
    tied: tiedAtCutoff,
    seats,
    outcome: tiedAtCutoff.length ? 'tie' : (safeWinners.length ? 'elected' : 'no-majority'),
    majority: null,
  };
}

/** Décompte détaillé par collège, quand l'option est activée. */
export function tallyByCollege(election) {
  if (!election.colleges) return null;
  const byVoter = new Map(election.electorate.map((v) => [v.id, v.college || '—']));
  const groups = new Map();
  for (const entry of election.roster) {
    const college = byVoter.get(entry.voterId) || '—';
    const current = groups.get(college) || { college, voters: 0, registered: 0 };
    current.voters += 1 + (entry.proxyFor?.length || 0);
    groups.set(college, current);
  }
  for (const voter of election.electorate) {
    const college = voter.college || '—';
    const current = groups.get(college) || { college, voters: 0, registered: 0 };
    current.registered += 1;
    groups.set(college, current);
  }
  return [...groups.values()].sort((a, b) => a.college.localeCompare(b.college));
}
