import test from 'node:test';
import assert from 'node:assert/strict';

import { tally } from '../src/domain/tally.js';
import { STATUS, makeOption, OPTION_KIND } from '../src/domain/schema.js';
import { withResolution, withCandidates, registerVoters, stuffBallots } from './helpers.js';

/* --- Invariants de divulgation ------------------------------------------- */

test('aucun décompte tant que l’urne n’est pas scellée', () => {
  let election = registerVoters(withResolution(), 10);
  election = { ...stuffBallots(election, { Pour: 6, Contre: 2 }), status: STATUS.OPEN };
  const result = tally(election);
  assert.equal(result.entries, null, 'les entrées ne doivent pas exister');
  assert.equal(result.outcome, 'pending');
});

test('quorum non atteint : le décompte n’est pas produit du tout', () => {
  let election = registerVoters(withResolution({
    quorum: { enabled: true, mode: 'percent', value: 50, basis: 'voters' },
  }), 62);
  election = stuffBallots(election, { Pour: 20, Contre: 4 });
  const result = tally(election);
  assert.equal(result.outcome, 'quorum-failed');
  assert.equal(result.entries, null);
  assert.equal(result.quorum.required, 31);
  assert.equal(result.quorum.reached, 24);
});

/* --- Résolutions ---------------------------------------------------------- */

test('majorité absolue : l’abstention sort des suffrages exprimés', () => {
  let election = registerVoters(withResolution({ majority: 'absolute' }), 62);
  election = stuffBallots(election, { Pour: 33, Contre: 6, Abstention: 2 });
  const result = tally(election);

  assert.equal(result.expressed, 39, '39 suffrages exprimés, abstentions exclues');
  assert.equal(result.abstain, 2);
  assert.equal(result.majority.required, 20, 'moitié de 39 + 1');
  assert.equal(result.outcome, 'adopted');
  assert.equal(result.stats.representedVoters, 41, 'les abstentions comptent dans la participation');
});

test('majorité absolue manquée d’une voix : rejet', () => {
  let election = registerVoters(withResolution({
    majority: 'absolute', quorum: { enabled: false },
  }), 40);
  election = stuffBallots(election, { Pour: 10, Contre: 10 });
  const result = tally(election);
  assert.equal(result.majority.required, 11);
  assert.equal(result.outcome, 'rejected');
});

test('majorité qualifiée aux deux tiers', () => {
  let election = registerVoters(withResolution({
    majority: 'qualified', qualifiedRatio: { num: 2, den: 3 }, quorum: { enabled: false },
  }), 60);
  election = stuffBallots(election, { Pour: 40, Contre: 20 });
  const result = tally(election);
  assert.equal(result.majority.required, 40, 'ceil(60 × 2/3)');
  assert.equal(result.outcome, 'adopted');

  election = stuffBallots(election, { Pour: 39, Contre: 21 });
  assert.equal(tally(election).outcome, 'rejected');
});

test('unanimité : une seule voix contre suffit à rejeter', () => {
  let election = registerVoters(withResolution({
    majority: 'unanimous', quorum: { enabled: false },
  }), 30);
  election = stuffBallots(election, { Pour: 29, Contre: 1 });
  assert.equal(tally(election).outcome, 'rejected');

  election = stuffBallots(election, { Pour: 29, Abstention: 1 });
  assert.equal(tally(election).outcome, 'adopted', 'une abstention n’est pas une voix contre');
});

test('vote blanc : le réglage change le résultat, pas le décompte', () => {
  const base = registerVoters(withResolution({
    majority: 'absolute', quorum: { enabled: false },
  }), 40);

  const excluded = stuffBallots({ ...base, blankPolicy: 'excluded' }, { Pour: 11, Contre: 9, Blanc: 4 });
  const rExcluded = tally(excluded);
  assert.equal(rExcluded.expressed, 20);
  assert.equal(rExcluded.blank, 4);
  assert.equal(rExcluded.outcome, 'adopted', '11 > 20/2');

  const counted = stuffBallots({ ...base, blankPolicy: 'counted' }, { Pour: 11, Contre: 9, Blanc: 4 });
  const rCounted = tally(counted);
  assert.equal(rCounted.expressed, 24);
  assert.equal(rCounted.majority.required, 13);
  assert.equal(rCounted.outcome, 'rejected', 'le blanc pèse alors comme une opposition');
});

/* --- Élections ------------------------------------------------------------ */

test('élection à un siège : majorité absolue atteinte', () => {
  let election = registerVoters(withCandidates(['Inès', 'Léo', 'Sofia'], {
    majority: 'absolute', quorum: { enabled: false },
  }), 30);
  election = stuffBallots(election, { 'Inès': 16, 'Léo': 9, 'Sofia': 5 });
  const result = tally(election);
  assert.equal(result.outcome, 'elected');
  assert.deepEqual(result.entries.filter((e) => e.elected).map((e) => e.label), ['Inès']);
});

test('égalité parfaite : aucun élu proclamé, départage requis', () => {
  let election = registerVoters(withCandidates(['Inès', 'Léo'], {
    majority: 'absolute', quorum: { enabled: false },
  }), 27);
  election = stuffBallots(election, { 'Inès': 13, 'Léo': 13, Blanc: 1 });
  const result = tally(election);
  assert.equal(result.outcome, 'tie');
  assert.equal(result.tied.length, 2);
  assert.equal(result.winners.length, 0, 'personne n’est proclamé élu tant que le départage n’a pas eu lieu');
});

test('scrutin plurinominal : l’égalité ne bloque que la dernière place', () => {
  const base = registerVoters(withCandidates(
    ['Awa', 'Marc', 'Sylvie', 'Paul', 'Nadia'],
    { method: 'multi', seats: 3, quorum: { enabled: false } },
  ), 40);

  // Égalité en tête, mais deux sièges disponibles : rien n'est bloqué.
  const clear = stuffBallots(base, { Awa: 20, Marc: 20, Sylvie: 15, Paul: 5, Nadia: 2 });
  const rClear = tally(clear);
  assert.equal(rClear.outcome, 'elected');
  assert.equal(rClear.winners.length, 3);

  // Égalité sur la 3e place : les deux candidats concernés restent en suspens.
  const blocked = stuffBallots(base, { Awa: 20, Marc: 18, Sylvie: 10, Paul: 10, Nadia: 2 });
  const rBlocked = tally(blocked);
  assert.equal(rBlocked.outcome, 'tie');
  assert.deepEqual(rBlocked.winners.length, 2, 'les deux premiers sièges sont acquis');
  assert.equal(rBlocked.tied.length, 2);
});

test('classement : comptage de Borda et vainqueur de Condorcet', () => {
  const election = registerVoters(withCandidates(
    ['Gymnase', 'Minibus', 'Escalade'],
    { method: 'ranking', seats: 1, quorum: { enabled: false } },
  ), 5);
  const [gym, bus, esc] = election.options.map((o) => o.id);

  const order = (ids) => ({ order: ids });
  const ballots = [
    order([gym, bus, esc]), order([gym, esc, bus]), order([bus, gym, esc]),
    order([bus, gym, esc]), order([esc, gym, bus]),
  ].map((choice, i) => ({ id: `b${i}`, receipt: `BUL-${i}`, weight: 1, castAt: new Date().toISOString(), choice }));

  const closed = {
    ...election, ballots, status: STATUS.CLOSED,
    roster: ballots.map((b, i) => ({ id: `r${i}`, voterId: election.electorate[i].id, name: `E${i}`, at: '', proxyFor: [] })),
  };
  const result = tally(closed);

  // Borda (3 points au 1er, 2 au 2e, 1 au 3e) : Gymnase 12, Minibus 10, Escalade 8.
  const byLabel = Object.fromEntries(result.entries.map((e) => [e.label, e.votes]));
  assert.equal(byLabel.Gymnase, 12);
  assert.equal(byLabel.Minibus, 10);
  assert.equal(byLabel.Escalade, 8);
  assert.equal(byLabel.Gymnase + byLabel.Minibus + byLabel.Escalade, 30, '5 bulletins × 6 points');
  assert.equal(result.condorcet, gym, 'Gymnase bat chaque autre projet en duel');
  assert.equal(result.outcome, 'elected');
});

/* --- Voix pondérées -------------------------------------------------------- */

test('voix pondérées : le poids du bulletin, pas le nombre de bulletins', () => {
  let election = registerVoters(withResolution({
    weighted: true, majority: 'absolute', quorum: { enabled: false },
  }), 3);
  election = {
    ...election,
    status: STATUS.CLOSED,
    ballots: [
      { id: 'b1', receipt: 'A', weight: 10, castAt: '', choice: { optionId: election.options[0].id } },
      { id: 'b2', receipt: 'B', weight: 1, castAt: '', choice: { optionId: election.options[1].id } },
      { id: 'b3', receipt: 'C', weight: 1, castAt: '', choice: { optionId: election.options[1].id } },
    ],
    roster: [1, 2, 3].map((i) => ({ id: `r${i}`, voterId: `v${i}`, name: `E${i}`, at: '', proxyFor: [] })),
  };
  const result = tally(election);
  assert.equal(result.expressed, 12, 'les suffrages se comptent en voix');
  assert.equal(result.outcome, 'adopted', '10 voix contre 2, malgré une minorité de bulletins');
});

/* --- Options de scrutin à option unique ------------------------------------ */

test('un scrutin sans suffrage exprimé ne proclame rien', () => {
  let election = registerVoters(withResolution({ quorum: { enabled: false } }), 5);
  election = stuffBallots(election, { Abstention: 3 });
  const result = tally(election);
  assert.equal(result.expressed, 0);
  assert.equal(result.outcome, 'rejected');
  assert.equal(result.majority.required, 0);
});
