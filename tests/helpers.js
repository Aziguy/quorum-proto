/** Constructeurs minimalistes pour les tests du domaine. */
import { makeElection, makeOption, makeVoter, STATUS, OPTION_KIND, METHODS } from '../src/domain/schema.js';

export function buildElection(overrides = {}) {
  return makeElection({ title: 'Scrutin de test', ...overrides });
}

export function withResolution(overrides = {}) {
  return buildElection({
    method: 'resolution',
    options: [
      makeOption('Pour', '', OPTION_KIND.FOR),
      makeOption('Contre', '', OPTION_KIND.AGAINST),
      makeOption('Abstention', '', OPTION_KIND.ABSTAIN),
    ],
    ...overrides,
  });
}

export function withCandidates(labels, overrides = {}) {
  return buildElection({
    method: 'single',
    options: labels.map((label) => makeOption(label)),
    ...overrides,
  });
}

/** Inscrit N électeurs fictifs. */
export function registerVoters(election, count, weight = 1) {
  const electorate = Array.from({ length: count }, (_, i) => makeVoter({
    name: `Électeur ${i + 1}`, email: `e${i + 1}@test.fr`, weight,
  }));
  return { ...election, electorate };
}

/**
 * Dépose des bulletins directement dans l'urne, en court-circuitant le jeton.
 * Les tests du dépouillement ne doivent pas dépendre du cycle de vie ; le
 * cycle de vie est testé séparément dans election.test.js.
 */
export function stuffBallots(election, distribution, { weight = 1 } = {}) {
  const ballots = [];
  const roster = [];
  let index = 0;
  for (const [optionLabel, count] of Object.entries(distribution)) {
    const option = election.options.find((o) => o.label === optionLabel);
    for (let i = 0; i < count; i += 1) {
      index += 1;
      ballots.push({
        id: `b${index}`, receipt: `BUL-${index}`,
        castAt: new Date(2026, 8, 20, 18, index).toISOString(),
        weight,
        choice: optionLabel === 'Blanc'
          ? { blank: true }
          : METHODS[election.method].pick === 'many'
            ? { optionIds: [option.id] }
            : { optionId: option.id },
      });
      roster.push({
        id: `r${index}`, voterId: election.electorate[index - 1]?.id || `v${index}`,
        name: `Électeur ${index}`, at: new Date().toISOString(), proxyFor: [],
      });
    }
  }
  return { ...election, ballots, roster, status: STATUS.CLOSED };
}
