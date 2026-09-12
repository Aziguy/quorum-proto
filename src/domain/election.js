/**
 * election.js — cycle de vie d'un scrutin.
 *
 * Toutes les fonctions renvoient un NOUVEAU scrutin plutôt que de modifier
 * l'existant. C'est ce qui permet d'écrire au journal d'audit et à l'état dans
 * la même transaction, sans état intermédiaire incohérent.
 *
 * La séparation identité / bulletin se joue entièrement dans `castBallot` :
 * l'émargement reçoit un nom, l'urne reçoit un bulletin, et aucune clé ne
 * relie les deux. Le jeton, seul point de passage, est consommé au dépôt.
 */

import { STATUS, METHODS } from './schema.js';
import { appendEntry } from './audit.js';
import { participationStats } from './tally.js';
import { evaluateQuorum } from './quorum.js';
import {
  voteToken, receiptCode, randomCode, sha256, fingerprint, canonical, shuffle,
} from '../core/crypto.js';

/* -------------------------------------------------------------------------
   Interrogation
   ------------------------------------------------------------------------- */

export function isVotingOpen(election, now = new Date()) {
  if (election.status !== STATUS.OPEN) return false;
  const time = now.getTime();
  if (election.opensAt && time < new Date(election.opensAt).getTime()) return false;
  if (election.closesAt && time > new Date(election.closesAt).getTime()) return false;
  return true;
}

export function findVoterByToken(election, token) {
  const needle = String(token || '').trim().toUpperCase();
  if (!needle) return null;
  return election.electorate.find(
    (voter) => voter.token === needle || voter.accessCode === needle,
  ) || null;
}

/** Pouvoirs valides détenus par un mandataire. */
export function proxiesHeldBy(election, voterId) {
  return election.proxies.filter((p) => p.toId === voterId && p.status === 'valid');
}

/** Voix portées par un électeur : la sienne, plus celles de ses mandants. */
export function voiceWeight(election, voter) {
  const own = voter.weight || 1;
  const byId = new Map(election.electorate.map((v) => [v.id, v]));
  const proxied = proxiesHeldBy(election, voter.id)
    .reduce((sum, p) => sum + (byId.get(p.fromId)?.weight || 1), 0);
  return own + proxied;
}

/* -------------------------------------------------------------------------
   Corps électoral
   ------------------------------------------------------------------------- */

/**
 * Fusionne des électeurs importés. Les doublons sont détectés sur l'e-mail —
 * seul identifiant naturel disponible dans un fichier de tableur — et fusionnés
 * silencieusement, car un import en double est l'erreur la plus fréquente.
 */
export async function addVoters(election, voters, actor, { imported = false } = {}) {
  if (election.status !== STATUS.DRAFT) {
    return { ok: false, error: 'electorate-frozen', election };
  }
  const byEmail = new Map(
    election.electorate.filter((v) => v.email).map((v) => [v.email, v]),
  );
  const next = [...election.electorate];
  let added = 0;
  let merged = 0;

  for (const voter of voters) {
    const existing = voter.email ? byEmail.get(voter.email) : null;
    if (existing) {
      Object.assign(existing, {
        name: voter.name || existing.name,
        college: voter.college || existing.college,
        phone: voter.phone || existing.phone,
        weight: voter.weight || existing.weight,
      });
      merged += 1;
      continue;
    }
    next.push(voter);
    if (voter.email) byEmail.set(voter.email, voter);
    added += 1;
  }

  const audit = await appendEntry(election.audit, {
    action: imported ? 'electorate.imported' : 'electorate.added',
    actor,
    details: imported ? { added, merged } : { name: voters[0]?.name || '—' },
  });

  return { ok: true, added, merged, election: { ...election, electorate: next, audit } };
}

export async function removeVoter(election, voterId, actor) {
  if (election.status !== STATUS.DRAFT) return { ok: false, error: 'electorate-frozen', election };
  const voter = election.electorate.find((v) => v.id === voterId);
  if (!voter) return { ok: false, error: 'not-found', election };
  const audit = await appendEntry(election.audit, {
    action: 'electorate.removed', actor, details: { name: voter.name },
  });
  return {
    ok: true,
    election: {
      ...election,
      electorate: election.electorate.filter((v) => v.id !== voterId),
      proxies: election.proxies.filter((p) => p.fromId !== voterId && p.toId !== voterId),
      audit,
    },
  };
}

/* -------------------------------------------------------------------------
   Pouvoirs (procurations)
   ------------------------------------------------------------------------- */

/**
 * Le plafond statutaire est vérifié ici, et le refus est journalisé au même
 * titre qu'une acceptation : une procuration refusée est un fait de la vie de
 * l'assemblée, pas une erreur technique à taire.
 */
export async function registerProxy(election, fromId, toId, actor) {
  const byId = new Map(election.electorate.map((v) => [v.id, v]));
  const from = byId.get(fromId);
  const to = byId.get(toId);

  if (!from || !to) return { ok: false, error: 'not-found', election };
  if (fromId === toId) return { ok: false, error: 'self-proxy', election };
  if (election.proxies.some((p) => p.fromId === fromId && p.status === 'valid')) {
    return { ok: false, error: 'already-given', election };
  }
  if (election.roster.some((r) => r.voterId === fromId)) {
    return { ok: false, error: 'already-voted', election };
  }

  const held = proxiesHeldBy(election, toId).length;
  if (election.proxyLimit > 0 && held >= election.proxyLimit) {
    const audit = await appendEntry(election.audit, {
      action: 'proxy.rejected', actor,
      details: { to: to.name, limit: election.proxyLimit },
    });
    const rejected = {
      id: `prx_${randomCode(8).toLowerCase()}`,
      fromId, toId, status: 'rejected',
      createdAt: new Date().toISOString(),
    };
    return {
      ok: false, error: 'limit-reached', limit: election.proxyLimit,
      election: { ...election, proxies: [...election.proxies, rejected], audit },
    };
  }

  const proxy = {
    id: `prx_${randomCode(8).toLowerCase()}`,
    fromId, toId, status: 'valid',
    createdAt: new Date().toISOString(),
  };
  const audit = await appendEntry(election.audit, {
    action: 'proxy.registered', actor, details: { from: from.name, to: to.name },
  });
  return { ok: true, election: { ...election, proxies: [...election.proxies, proxy], audit } };
}

export async function revokeProxy(election, proxyId, actor) {
  const proxy = election.proxies.find((p) => p.id === proxyId);
  if (!proxy || proxy.status !== 'valid') return { ok: false, error: 'not-found', election };
  const byId = new Map(election.electorate.map((v) => [v.id, v]));
  const audit = await appendEntry(election.audit, {
    action: 'proxy.revoked', actor,
    details: { from: byId.get(proxy.fromId)?.name, to: byId.get(proxy.toId)?.name },
  });
  return {
    ok: true,
    election: {
      ...election,
      proxies: election.proxies.map((p) => (p.id === proxyId ? { ...p, status: 'revoked' } : p)),
      audit,
    },
  };
}

/* -------------------------------------------------------------------------
   Ouverture et clôture
   ------------------------------------------------------------------------- */

/**
 * Ouvre le scrutin : le corps électoral est figé et chaque électeur reçoit un
 * jeton à usage unique. Les électeurs sans e-mail reçoivent en plus un code
 * court, imprimable et remis en main propre — aucun cul-de-sac.
 */
export async function openElection(election, actor) {
  if (election.status !== STATUS.DRAFT) return { ok: false, error: 'already-open', election };
  if (election.electorate.length === 0) return { ok: false, error: 'empty-electorate', election };
  if (election.options.length < 2) return { ok: false, error: 'not-enough-options', election };

  const electorate = election.electorate.map((voter) => ({
    ...voter,
    token: voteToken(),
    tokenUsed: false,
    accessCode: voter.email ? null : randomCode(7),
    channel: voter.email ? 'email' : 'code',
  }));

  const audit = await appendEntry(election.audit, {
    action: 'election.opened', actor, details: { voters: electorate.length },
  });

  return {
    ok: true,
    election: {
      ...election,
      electorate,
      status: STATUS.OPEN,
      opensAt: election.opensAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      audit,
    },
  };
}

/**
 * Clôt le scrutin et scelle l'urne : l'empreinte couvre l'ensemble des
 * bulletins déposés. Toute addition, retrait ou modification ultérieure la
 * change, et devient donc détectable.
 */
export async function closeElection(election, actor, { at = new Date() } = {}) {
  if (election.status !== STATUS.OPEN) return { ok: false, error: 'not-open', election };

  const digest = await sha256(canonical(
    election.ballots.map((b) => ({ receipt: b.receipt, choice: b.choice, weight: b.weight })),
  ));
  const seal = {
    at: at.toISOString(),
    hash: digest,
    fingerprint: fingerprint(digest, 4),
    ballotCount: election.ballots.length,
  };
  const audit = await appendEntry(election.audit, {
    action: 'election.closed', actor, at: seal.at,
    details: { fingerprint: seal.fingerprint, ballots: seal.ballotCount },
  });

  return {
    ok: true,
    election: {
      ...election, status: STATUS.CLOSED, seal,
      closesAt: election.closesAt || seal.at,
      updatedAt: seal.at, audit,
    },
  };
}

/** Vérifie que les bulletins présents correspondent toujours au sceau. */
export async function verifySeal(election) {
  if (!election.seal) return { valid: false, reason: 'no-seal' };
  const digest = await sha256(canonical(
    election.ballots.map((b) => ({ receipt: b.receipt, choice: b.choice, weight: b.weight })),
  ));
  return { valid: digest === election.seal.hash, expected: election.seal.hash, actual: digest };
}

/* -------------------------------------------------------------------------
   Dépôt d'un bulletin
   ------------------------------------------------------------------------- */

/**
 * Le seul endroit du code où identité et bulletin coexistent — le temps d'un
 * appel de fonction, et sans jamais se rencontrer dans une même structure :
 *
 *   jeton ──┬──► ligne d'émargement  { voterId, nom, heure }      nominative
 *           └──► bulletin            { reçu, choix, voix }        anonyme
 *
 * Le jeton est consommé, les deux objets partent chacun de leur côté, et aucune
 * clé ne permet de les recoudre. Le bulletin est inséré à une position
 * aléatoire : même l'ordre d'arrivée cesse d'être un indice.
 */
export async function castBallot(election, token, choice, { at = new Date() } = {}) {
  if (!isVotingOpen(election, at)) {
    return { ok: false, error: election.status === STATUS.CLOSED ? 'closed' : 'not-open', election };
  }
  const voter = findVoterByToken(election, token);
  if (!voter) return { ok: false, error: 'unknown-token', election };
  if (voter.tokenUsed) return { ok: false, error: 'token-used', election };

  const proxies = proxiesHeldBy(election, voter.id);
  const byId = new Map(election.electorate.map((v) => [v.id, v]));
  const weight = (voter.weight || 1)
    + proxies.reduce((sum, p) => sum + (byId.get(p.fromId)?.weight || 1), 0);

  const receipt = receiptCode();
  const timestamp = at.toISOString();

  // --- Urne : aucun identifiant de votant ici, ni maintenant ni plus tard.
  const ballot = { id: receipt, receipt, castAt: timestamp, weight, choice };
  const ballots = shuffle([...election.ballots, ballot]);

  // --- Émargement : nominatif, sans la moindre trace du choix.
  const rosterEntry = {
    id: `emg_${randomCode(8).toLowerCase()}`,
    voterId: voter.id,
    name: voter.name,
    at: timestamp,
    channel: voter.channel || 'email',
    proxyFor: proxies.map((p) => p.fromId),
  };

  const electorate = election.electorate.map((v) => (
    v.id === voter.id ? { ...v, tokenUsed: true, token: null, accessCode: null } : v
  ));

  let audit = await appendEntry(election.audit, {
    action: 'ballot.cast', actor: 'Urne',
    details: { receipt, proxies: proxies.length }, at: timestamp,
  });

  const next = {
    ...election, ballots, electorate,
    roster: [...election.roster, rosterEntry],
    updatedAt: timestamp,
  };

  // Le franchissement du quorum est journalisé une fois, au moment où il a lieu.
  const before = evaluateQuorum(election, participationStats(election));
  const after = evaluateQuorum(next, participationStats(next));
  if (after.enabled && after.met && !before.met) {
    audit = await appendEntry(audit, {
      action: 'quorum.reached', actor: 'Système',
      details: { reached: after.reached, required: after.required }, at: timestamp,
    });
  }

  return { ok: true, receipt, election: { ...next, audit } };
}

/** Motifs de refus, formulés pour un votant et non pour un développeur. */
export const CAST_ERRORS = {
  'unknown-token': "Ce lien ne correspond à aucun électeur de ce scrutin.",
  'token-used': 'Ce lien a déjà servi à déposer un bulletin.',
  closed: 'Le scrutin est clos : l’urne a été scellée.',
  'not-open': "Le vote n'est pas encore ouvert.",
  incomplete: 'Votre bulletin est incomplet.',
};

/* -------------------------------------------------------------------------
   Opérations de séance
   ------------------------------------------------------------------------- */

export async function recordReminder(election, actor) {
  const pending = election.electorate.filter((v) => !v.tokenUsed).length;
  const audit = await appendEntry(election.audit, {
    action: 'reminder.sent', actor, details: { count: pending },
  });
  return { ok: true, count: pending, election: { ...election, audit } };
}

export async function applyTiebreak(election, rule, note, actor) {
  const audit = await appendEntry(election.audit, {
    action: 'tiebreak.applied', actor, details: { rule, note },
  });
  return {
    ok: true,
    election: {
      ...election,
      tiebreak: { rule, note, at: new Date().toISOString(), by: actor },
      audit,
    },
  };
}

export async function reportIncident(election, reason, actor) {
  const audit = await appendEntry(election.audit, {
    action: 'incident.reported', actor, details: { reason },
  });
  return { ok: true, election: { ...election, audit } };
}

/** Électeurs n'ayant pas encore voté et disposant d'un jeton actif. */
export function pendingVoters(election) {
  return election.electorate.filter((v) => !v.tokenUsed);
}

/** Le scrutin est-il prêt à être ouvert ? Liste des manques, pas un booléen. */
export function readiness(election) {
  const issues = [];
  if (!election.title.trim()) issues.push({ field: 'title', text: "L'intitulé de la résolution est vide." });
  if (election.options.length < 2) issues.push({ field: 'options', text: 'Il faut au moins deux propositions.' });
  if (election.options.some((o) => !o.label.trim())) issues.push({ field: 'options', text: 'Une proposition est sans libellé.' });
  if (election.electorate.length === 0) issues.push({ field: 'electorate', text: 'Le corps électoral est vide.' });
  if (METHODS[election.method].pick === 'many' && election.seats > election.options.length) {
    issues.push({ field: 'seats', text: 'Il y a plus de sièges à pourvoir que de candidats.' });
  }
  if (election.closesAt && election.opensAt
      && new Date(election.closesAt) <= new Date(election.opensAt)) {
    issues.push({ field: 'dates', text: 'La clôture précède l’ouverture.' });
  }
  const withoutEmail = election.electorate.filter((v) => !v.email).length;
  return {
    ready: issues.length === 0,
    issues,
    warnings: withoutEmail
      ? [{ field: 'electorate', text: `${withoutEmail} électeur(s) sans adresse e-mail : un code imprimable leur sera généré.` }]
      : [],
  };
}
