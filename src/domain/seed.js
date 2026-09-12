/**
 * seed.js — jeu de démonstration.
 *
 * Les scrutins de démonstration ne sont pas des captures d'écran : ils sont
 * réellement joués par le moteur. Chaque bulletin passe par castBallot, chaque
 * clôture scelle une urne, chaque chiffre affiché est calculé. C'est ce qui
 * permet de dire « ce que vous voyez fonctionne » sans réserve.
 *
 * Supprimer ce fichier n'affecte que la démonstration (features.demoData).
 */

import {
  makeElection, makeOption, makeVoter, OPTION_KIND, DEFAULT_RESOLUTION_OPTIONS,
} from './schema.js';
import { openElection, closeElection, castBallot, registerProxy } from './election.js';
import { appendEntry } from './audit.js';

/* --- Générateur pseudo-aléatoire reproductible ---------------------------- */
/** Les mêmes chiffres à chaque réinitialisation : une démo doit être stable. */
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SURNAMES = [
  'Diagne', 'Ferreira', 'Nguyen', 'Berthier', 'Slimani', 'Ravel', 'Ostermann',
  'Toussaint', 'Marchetti', 'Dubosc', 'Kaczmarek', 'Brun', 'Vanel', 'Camara',
  'Lemoine', 'Bouchard', 'Marchand', 'Le Goff', 'Anselme', 'Perrin', 'Bonnet',
  'Cohen', 'Alvarez', 'Rossi', 'Keita', 'Lambert', 'Fontaine', 'Bertin',
  'Marques', 'Chevallier', 'Hamon', 'Vasseur', 'Traoré', 'Petit', 'Girard',
  'Rey', 'Colin', 'Baron', 'Tanguy', 'Meunier', 'Arnaud', 'Blin',
];
const GIVEN = [
  'Awa', 'Marc', 'Sylvie', 'Paul', 'Nadia', 'Jean-Luc', 'Camille', 'Bernard',
  'Léa', 'Claire', 'Olivier', 'Hélène', 'Serge', 'Fatou', 'Hubert', 'Inès',
  'Léo', 'Yann', 'Sarah', 'Thomas', 'Julie', 'Antoine', 'Malik', 'Chloé',
  'Pierre', 'Amine', 'Louise', 'Victor', 'Rachida', 'Émile', 'Sofia', 'Gaël',
  'Manon', 'Idris', 'Agnès', 'Rémi', 'Zoé', 'Hugo', 'Farida', 'Noé', 'Lise', 'Jonas',
];
const COLLEGES = ['Membres actifs', 'Membres actifs', 'Membres actifs', 'Membres bienfaiteurs', 'Membres de droit'];

function slug(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z]+/g, '');
}

/** Construit un corps électoral fictif et reproductible. */
function buildPeople(count, seed, { emailless = 0, domain = 'exemple.org' } = {}) {
  const random = mulberry32(seed);
  const people = [];
  const used = new Set();
  for (let i = 0; i < count; i += 1) {
    let name;
    do {
      name = `${GIVEN[Math.floor(random() * GIVEN.length)]} ${SURNAMES[Math.floor(random() * SURNAMES.length)]}`;
    } while (used.has(name));
    used.add(name);
    const hasEmail = i >= emailless;
    people.push(makeVoter({
      name,
      email: hasEmail ? `${slug(name).slice(0, 18)}@${domain}` : '',
      phone: hasEmail ? '' : '06 00 00 00 00',
      college: COLLEGES[Math.floor(random() * COLLEGES.length)],
      weight: 1,
    }));
  }
  return people;
}

/* --- Fabrique d'un scrutin joué ------------------------------------------- */

/** Développe { indexOption: nombre } en une liste d'index, un par bulletin. */
function distribution(spec) {
  const out = [];
  for (const [index, count] of Object.entries(spec)) {
    for (let i = 0; i < count; i += 1) out.push(Number(index));
  }
  return out;
}

/**
 * Ouvre le scrutin, fait voter les électeurs désignés, et le clôt si demandé.
 * `choices` est une liste de choix, appliquée aux électeurs dans l'ordre.
 */
async function play(draft, { actor, proxies = [], choices, close = false }) {
  let election = draft;

  for (const [fromIndex, toIndex] of proxies) {
    const result = await registerProxy(
      election,
      election.electorate[fromIndex].id,
      election.electorate[toIndex].id,
      actor,
    );
    election = result.election;
  }

  election = (await openElection(election, actor)).election;

  // Les bulletins sont horodatés dans la fenêtre de vote, et répartis dedans :
  // un scrutin passé doit produire une liste d'émargement crédible, pas une
  // rafale de dépôts à la milliseconde de la génération.
  const start = new Date(election.opensAt || Date.now()).getTime();
  const end = Math.min(
    new Date(election.closesAt || Date.now()).getTime(),
    Date.now(),
  );
  const span = Math.max(end - start, 1);

  for (let i = 0; i < choices.length; i += 1) {
    const target = election.electorate[i];
    if (!target?.token) continue;
    const at = new Date(start + Math.round((span * (i + 1)) / (choices.length + 1)));
    const result = await castBallot(election, target.token, choices[i], { at });
    if (result.ok) election = result.election;
  }

  if (close) {
    const sealedAt = new Date(election.closesAt || Date.now());
    election = (await closeElection(election, 'Sylvie Nguyen · scrutatrice', { at: sealedAt })).election;
  }
  return election;
}

/** Choix « une seule réponse » à partir d'un index d'option (-1 = blanc). */
const pickOne = (options) => (index) => (
  index < 0 ? { blank: true } : { optionId: options[index].id }
);

async function created(election, actor) {
  const audit = await appendEntry(election.audit, {
    action: 'election.created', actor, details: { title: election.title },
  });
  return { ...election, audit };
}

function daysFromNow(days, hour = 18) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

/* --- Jeu de démonstration -------------------------------------------------- */

const ACTOR = 'Hubert Lemoine · trésorier';

function resolutionOptions() {
  return DEFAULT_RESOLUTION_OPTIONS.map((o) => makeOption(o.label, o.sublabel, o.kind));
}

/**
 * Sept scrutins qui couvrent l'ensemble des issues possibles : en cours,
 * brouillon, adopté, rejeté pour quorum, égalité à départager, classement.
 * Une démonstration qui ne montre que le cas nominal ne démontre rien.
 */
export async function buildDemoData(config) {
  const elections = [];
  const members = buildPeople(62, 20260912, { emailless: 3 });
  const students = buildPeople(28, 4242, { domain: 'lycee.exemple.fr' });

  /* 1. Résolution en cours — participation réelle, urne scellée. */
  let comptes = makeElection({
    ref: 'SCR-2026-014',
    title: "Approbation des comptes de l'exercice 2025-2026",
    description: "Approbation des comptes clos au 31 août 2026 et quitus au trésorier, sur rapport du commissaire aux comptes.",
    attachments: [{ name: 'Rapport_moral_2026.pdf', size: '412 Ko' }, { name: 'Comptes_2025-2026.pdf', size: '1,2 Mo' }],
    method: 'resolution',
    options: resolutionOptions(),
    electorate: members.map((m) => ({ ...m })),
    majority: 'absolute',
    quorum: { enabled: true, mode: 'percent', value: 50, basis: 'voters' },
    proxyLimit: 3,
    opensAt: daysFromNow(-4),
    closesAt: daysFromNow(3, 20),
  }, config.defaults);
  comptes = await created(comptes, ACTOR);

  const choose = pickOne(comptes.options);
  comptes = await play(comptes, {
    actor: ACTOR,
    // Sept pouvoirs confiés à quatre mandataires — dont un au plafond.
    proxies: [[50, 0], [51, 0], [52, 0], [53, 1], [54, 1], [55, 2], [56, 3]],
    choices: [
      ...[0, 0, 0, 0].map(choose),                       // les 4 mandataires : 11 voix
      ...distribution({ 0: 22, 1: 6, 2: 2 }).map(choose), // 30 votants directs
    ],
  });
  elections.push(comptes);

  /* 2. Élection plurinominale en cours — 4 sièges, 6 candidatures. */
  const candidates = ['Awa Diagne', 'Marc Ferreira', 'Sylvie Nguyen', 'Paul Berthier', 'Nadia Slimani', 'Jean-Luc Ravel'];
  const sections = ['Athlétisme', 'Natation', 'Bénévoles', 'Handball', 'Athlétisme', 'Trésorerie'];
  let bureau = makeElection({
    ref: 'SCR-2026-015',
    title: 'Renouvellement du bureau — 4 sièges à pourvoir',
    description: 'Six candidatures validées pour quatre sièges. Vous pouvez cocher jusqu’à quatre noms.',
    method: 'multi',
    seats: 4,
    options: candidates.map((name, i) => makeOption(name, sections[i], OPTION_KIND.CANDIDATE)),
    electorate: members.map((m) => ({ ...m })),
    majority: 'simple',
    quorum: { enabled: true, mode: 'percent', value: 33, basis: 'voters' },
    opensAt: daysFromNow(-4),
    closesAt: daysFromNow(3, 20),
    candidacies: candidates.map((name, i) => ({
      id: `cand_${i}`,
      name,
      meta: `${sections[i]} · adhérent depuis ${2011 + i}`,
      status: i === 1 ? 'pending' : i === 3 ? 'incomplete' : 'validated',
      statement: i === 0
        ? "Je souhaite poursuivre l'assainissement des comptes engagé en 2024 et publier un état trimestriel de la trésorerie."
        : i === 1
          ? "Mon objectif : ouvrir un créneau piscine le dimanche matin et créer une commission des familles."
          : 'Profession de foi déposée avec la candidature.',
    })),
  }, config.defaults);
  bureau = await created(bureau, ACTOR);

  const slate = (indices) => ({ optionIds: indices.map((i) => bureau.options[i].id) });
  bureau = await play(bureau, {
    actor: ACTOR,
    choices: [
      ...Array.from({ length: 14 }, () => slate([0, 1, 2, 3])),
      ...Array.from({ length: 9 }, () => slate([0, 2, 4, 5])),
      ...Array.from({ length: 7 }, () => slate([0, 1, 2, 5])),
      ...Array.from({ length: 5 }, () => slate([3, 4, 5])),
      ...Array.from({ length: 3 }, () => slate([0])),
    ],
  });
  elections.push(bureau);

  /* 3. Brouillon — tout est configurable tant que rien n'est ouvert. */
  elections.push(await created(makeElection({
    ref: 'SCR-2026-016',
    title: 'Quitus au trésorier',
    description: '',
    method: 'resolution',
    options: resolutionOptions(),
    electorate: members.map((m) => ({ ...m })),
    quorum: { enabled: true, mode: 'percent', value: 50, basis: 'voters' },
  }, config.defaults), ACTOR));

  /* 4. Élection close sur une égalité parfaite — départage à trancher. */
  let delegue = makeElection({
    ref: 'SCR-2026-007',
    title: 'Élection du délégué de classe — 4e B',
    description: 'Scrutin à un tour, majorité absolue des suffrages exprimés.',
    method: 'single',
    seats: 1,
    options: [
      makeOption('Inès Bouchard', 'Candidate'),
      makeOption('Léo Marchand', 'Candidat'),
    ],
    electorate: students.map((s) => ({ ...s })),
    majority: 'absolute',
    runoff: true,
    proxiesEnabled: false,
    proxyLimit: 0,
    quorum: { enabled: true, mode: 'percent', value: 50, basis: 'voters' },
    opensAt: daysFromNow(-20),
    closesAt: daysFromNow(-19, 17),
  }, config.defaults);
  delegue = await created(delegue, 'Camille Ostermann · professeure principale');
  delegue = await play(delegue, {
    actor: 'Camille Ostermann · professeure principale',
    close: true,
    choices: distribution({ 0: 13, 1: 13 }).map(pickOne(delegue.options)).concat([{ blank: true }]),
  });
  elections.push(delegue);

  /* 5. Résolution adoptée à la majorité qualifiée des deux tiers. */
  let cotisation = makeElection({
    ref: 'SCR-2026-006',
    title: 'Hausse de la cotisation annuelle à 145 €',
    description: "Assemblée générale extraordinaire — modification du montant de la cotisation à compter du 1er janvier 2027.",
    method: 'resolution',
    options: resolutionOptions(),
    electorate: members.map((m) => ({ ...m })),
    majority: 'qualified',
    qualifiedRatio: { num: 2, den: 3 },
    quorum: { enabled: true, mode: 'percent', value: 50, basis: 'voters' },
    opensAt: daysFromNow(-40),
    closesAt: daysFromNow(-33, 20),
  }, config.defaults);
  cotisation = await created(cotisation, ACTOR);
  cotisation = await play(cotisation, {
    actor: ACTOR,
    close: true,
    choices: distribution({ 0: 40, 1: 10, 2: 2 }).map(pickOne(cotisation.options)),
  });
  elections.push(cotisation);

  /* 6. Quorum non atteint — le décompte n'est pas produit, par construction. */
  let statuts = makeElection({
    ref: 'SCR-2026-005',
    title: 'Modification de l’article 7 des statuts',
    description: "Extension de l'objet social à l'organisation de compétitions régionales.",
    method: 'resolution',
    options: resolutionOptions(),
    electorate: members.map((m) => ({ ...m })),
    majority: 'qualified',
    qualifiedRatio: { num: 2, den: 3 },
    quorum: { enabled: true, mode: 'percent', value: 67, basis: 'voters' },
    opensAt: daysFromNow(-60),
    closesAt: daysFromNow(-53, 20),
  }, config.defaults);
  statuts = await created(statuts, ACTOR);
  statuts = await play(statuts, {
    actor: ACTOR,
    close: true,
    choices: distribution({ 0: 18, 1: 5, 2: 1 }).map(pickOne(statuts.options)),
  });
  elections.push(statuts);

  /* 7. Classement de préférences — Borda, et vainqueur de Condorcet signalé. */
  let priorites = makeElection({
    ref: 'SCR-2026-004',
    title: 'Priorités budgétaires 2027',
    description: 'Classez les quatre projets, du plus au moins prioritaire. Le décompte se fait par points.',
    method: 'ranking',
    seats: 1,
    options: [
      makeOption('Rénovation du gymnase', '48 000 €', OPTION_KIND.PROPOSAL),
      makeOption('Achat d’un minibus', '32 000 €', OPTION_KIND.PROPOSAL),
      makeOption('Création d’une section escalade', '19 000 €', OPTION_KIND.PROPOSAL),
      makeOption('Baisse de la cotisation', '− 12 000 €', OPTION_KIND.PROPOSAL),
    ],
    electorate: members.map((m) => ({ ...m })),
    quorum: { enabled: true, mode: 'percent', value: 33, basis: 'voters' },
    opensAt: daysFromNow(-90),
    closesAt: daysFromNow(-83, 20),
  }, config.defaults);
  priorites = await created(priorites, ACTOR);

  const rank = (indices) => ({ order: indices.map((i) => priorites.options[i].id) });
  priorites = await play(priorites, {
    actor: ACTOR,
    close: true,
    choices: [
      ...Array.from({ length: 12 }, () => rank([0, 1, 2, 3])),
      ...Array.from({ length: 9 }, () => rank([1, 0, 3, 2])),
      ...Array.from({ length: 6 }, () => rank([3, 0, 1, 2])),
      ...Array.from({ length: 5 }, () => rank([2, 0, 1, 3])),
    ],
  });
  elections.push(priorites);

  return { elections, directory: members };
}
