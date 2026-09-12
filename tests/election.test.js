import test from 'node:test';
import assert from 'node:assert/strict';

import {
  openElection, closeElection, castBallot, registerProxy,
  verifySeal, readiness, isVotingOpen, proxiesHeldBy,
} from '../src/domain/election.js';
import { verifyChain } from '../src/domain/audit.js';
import { tally } from '../src/domain/tally.js';
import { STATUS } from '../src/domain/schema.js';
import { withResolution, registerVoters } from './helpers.js';

function ready(overrides = {}) {
  return registerVoters(withResolution({ quorum: { enabled: false }, ...overrides }), 5);
}

/* --- Séparation identité / bulletin --------------------------------------- */

test('le bulletin déposé ne porte aucune trace du votant', async () => {
  const opened = (await openElection(ready(), 'Test')).election;
  const voter = opened.electorate[0];
  const result = await castBallot(opened, voter.token, { optionId: opened.options[0].id });

  assert.equal(result.ok, true);
  const ballot = result.election.ballots[0];

  // L'urne ne contient que le reçu, l'heure, le poids et le choix.
  assert.deepEqual(Object.keys(ballot).sort(), ['castAt', 'choice', 'id', 'receipt', 'weight']);
  const serialized = JSON.stringify(ballot);
  assert.ok(!serialized.includes(voter.id), 'aucun identifiant de votant dans le bulletin');
  assert.ok(!serialized.includes(voter.name), 'aucun nom dans le bulletin');

  // L'émargement est nominatif et ne contient aucun choix.
  const entry = result.election.roster[0];
  assert.equal(entry.voterId, voter.id);
  assert.ok(!JSON.stringify(entry).includes(opened.options[0].id), 'aucun choix dans l’émargement');
});

test('le jeton est consommé : un électeur ne vote qu’une fois', async () => {
  const opened = (await openElection(ready(), 'Test')).election;
  const token = opened.electorate[0].token;
  const first = await castBallot(opened, token, { optionId: opened.options[0].id });
  assert.equal(first.ok, true);
  assert.equal(first.election.electorate[0].token, null, 'le jeton est détruit au dépôt');

  const second = await castBallot(first.election, token, { optionId: opened.options[1].id });
  assert.equal(second.ok, false);
  assert.equal(second.error, 'unknown-token');
  assert.equal(second.election.ballots.length, 1, 'aucun second bulletin dans l’urne');
});

test('un jeton inconnu ou un scrutin clos refuse le dépôt', async () => {
  const opened = (await openElection(ready(), 'Test')).election;
  assert.equal((await castBallot(opened, 'INEXISTANT', {})).error, 'unknown-token');

  const closed = (await closeElection(opened, 'Test')).election;
  const result = await castBallot(closed, opened.electorate[0].token, {});
  assert.equal(result.error, 'closed');
});

/* --- Pouvoirs -------------------------------------------------------------- */

test('le plafond statutaire de pouvoirs est opposable, et le refus journalisé', async () => {
  let election = registerVoters(withResolution({ proxyLimit: 2, quorum: { enabled: false } }), 6);
  const [a, b, c, d, mandatary] = election.electorate;

  for (const from of [a, b]) {
    const result = await registerProxy(election, from.id, mandatary.id, 'Organisateur');
    assert.equal(result.ok, true);
    election = result.election;
  }
  assert.equal(proxiesHeldBy(election, mandatary.id).length, 2);

  const refused = await registerProxy(election, c.id, mandatary.id, 'Organisateur');
  assert.equal(refused.ok, false);
  assert.equal(refused.error, 'limit-reached');
  assert.equal(proxiesHeldBy(refused.election, mandatary.id).length, 2, 'le pouvoir refusé ne compte pas');
  assert.ok(
    refused.election.audit.some((e) => e.action === 'proxy.rejected'),
    'un refus est un fait de séance, il est inscrit au journal',
  );

  assert.equal((await registerProxy(election, d.id, d.id, 'Organisateur')).error, 'self-proxy');
});

test('le mandataire vote avec ses propres voix et celles de ses mandants', async () => {
  let election = registerVoters(withResolution({ proxyLimit: 3, quorum: { enabled: false } }), 4);
  const [a, b, mandatary] = election.electorate;
  election = (await registerProxy(election, a.id, mandatary.id, 'Org')).election;
  election = (await registerProxy(election, b.id, mandatary.id, 'Org')).election;
  election = (await openElection(election, 'Org')).election;

  const holder = election.electorate.find((v) => v.id === mandatary.id);
  const result = await castBallot(election, holder.token, { optionId: election.options[0].id });

  assert.equal(result.election.ballots[0].weight, 3, '1 voix propre + 2 pouvoirs');
  assert.deepEqual(result.election.roster[0].proxyFor.sort(), [a.id, b.id].sort());
});

/* --- Ouverture, clôture, scellement ---------------------------------------- */

test('l’ouverture distribue un jeton, et un code imprimable à qui n’a pas d’e-mail', async () => {
  const election = registerVoters(withResolution(), 3);
  election.electorate[2] = { ...election.electorate[2], email: '' };

  const { election: opened } = await openElection(election, 'Org');
  assert.equal(opened.status, STATUS.OPEN);
  assert.ok(opened.electorate.every((v) => v.token), 'chacun reçoit un jeton');
  assert.equal(opened.electorate[2].accessCode?.length, 7, 'un code court remplace l’e-mail');
  assert.equal(opened.electorate[0].accessCode, null);
  assert.equal(new Set(opened.electorate.map((v) => v.token)).size, 3, 'les jetons sont distincts');
});

test('le sceau détecte toute modification de l’urne après clôture', async () => {
  const opened = (await openElection(ready(), 'Org')).election;
  let election = opened;
  for (const voter of opened.electorate.slice(0, 3)) {
    election = (await castBallot(election, voter.token, { optionId: opened.options[0].id })).election;
  }
  const closed = (await closeElection(election, 'Scrutateur')).election;

  assert.equal((await verifySeal(closed)).valid, true);
  assert.equal(closed.seal.ballotCount, 3);

  const tampered = { ...closed, ballots: closed.ballots.slice(1) };
  assert.equal((await verifySeal(tampered)).valid, false, 'un bulletin retiré invalide le sceau');

  const stuffed = {
    ...closed,
    ballots: [...closed.ballots, { receipt: 'FAUX', choice: { optionId: closed.options[1].id }, weight: 1 }],
  };
  assert.equal((await verifySeal(stuffed)).valid, false, 'un bulletin ajouté invalide le sceau');
});

test('le journal d’audit reste chaîné de bout en bout du cycle de vie', async () => {
  const opened = (await openElection(ready(), 'Org')).election;
  let election = opened;
  for (const voter of opened.electorate) {
    election = (await castBallot(election, voter.token, { optionId: opened.options[0].id })).election;
  }
  const closed = (await closeElection(election, 'Scrutateur')).election;

  assert.equal((await verifyChain(closed.audit)).valid, true);
  assert.ok(closed.audit.length >= 7, 'ouverture + 5 dépôts + clôture');

  const falsified = closed.audit.map((e, i) => (i === 2 ? { ...e, actor: 'Quelqu’un d’autre' } : e));
  assert.equal((await verifyChain(falsified)).valid, false);
});

test('le franchissement du quorum est journalisé une fois et une seule', async () => {
  let election = registerVoters(withResolution({
    quorum: { enabled: true, mode: 'count', value: 2, basis: 'voters' },
  }), 5);
  election = (await openElection(election, 'Org')).election;
  const ids = election.electorate.map((v) => v.id);

  for (const id of ids) {
    const voter = election.electorate.find((v) => v.id === id);
    election = (await castBallot(election, voter.token, { optionId: election.options[0].id })).election;
  }
  const crossings = election.audit.filter((e) => e.action === 'quorum.reached');
  assert.equal(crossings.length, 1);
  assert.equal(crossings[0].details.reached, 2, 'journalisé au moment exact du franchissement');
});

/* --- Garde-fous et bout en bout -------------------------------------------- */

test('readiness énumère les manques au lieu de répondre par oui ou non', () => {
  const check = readiness(withResolution({ title: '  ' }));
  assert.equal(check.ready, false);
  assert.deepEqual(check.issues.map((i) => i.field).sort(), ['electorate', 'title']);
  assert.equal(readiness(ready()).ready, true);
});

test('la fenêtre de vote est respectée', () => {
  const open = {
    ...withResolution(), status: STATUS.OPEN,
    opensAt: '2026-09-20T18:00:00Z', closesAt: '2026-09-27T20:00:00Z',
  };
  assert.equal(isVotingOpen(open, new Date('2026-09-22T10:00:00Z')), true);
  assert.equal(isVotingOpen(open, new Date('2026-09-19T10:00:00Z')), false, 'avant l’ouverture');
  assert.equal(isVotingOpen(open, new Date('2026-09-28T10:00:00Z')), false, 'après la clôture');
});

test('bout en bout : cinq électeurs, un scrutin, un résultat', async () => {
  const opened = (await openElection(ready({ majority: 'absolute' }), 'Org')).election;
  const [pour, contre] = opened.options;
  const choices = [pour, pour, pour, contre, contre];
  let election = opened;

  for (let i = 0; i < opened.electorate.length; i += 1) {
    const voter = election.electorate.find((v) => v.id === opened.electorate[i].id);
    election = (await castBallot(election, voter.token, { optionId: choices[i].id })).election;
  }
  const closed = (await closeElection(election, 'Scrutateur')).election;
  const result = tally(closed);

  assert.equal(result.expressed, 5);
  assert.equal(result.majority.required, 3);
  assert.equal(result.outcome, 'adopted');
  assert.equal(result.stats.representedVoters, 5);
});
