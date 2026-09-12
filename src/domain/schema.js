/**
 * schema.js — vocabulaire du domaine et fabriques d'objets.
 *
 * Tout le reste du code s'appuie sur ces constantes : ajouter un mode de
 * scrutin, une règle de majorité ou un rôle se fait ici et se propage
 * mécaniquement aux vues, au dépouillement et aux exports.
 */

import { newId } from '../core/crypto.js';

/* -------------------------------------------------------------------------
   Statuts
   ------------------------------------------------------------------------- */
export const STATUS = {
  DRAFT: 'draft',
  OPEN: 'open',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
};

/* -------------------------------------------------------------------------
   Nature d'une option
   Distinguer l'abstention d'un choix ordinaire n'est pas cosmétique : elle
   compte dans le quorum mais pas dans les suffrages exprimés.
   ------------------------------------------------------------------------- */
export const OPTION_KIND = {
  FOR: 'for',
  AGAINST: 'against',
  ABSTAIN: 'abstain',
  CANDIDATE: 'candidate',
  PROPOSAL: 'proposal',
};

/* -------------------------------------------------------------------------
   Modes de scrutin
   `pick` décrit la mécanique du bulletin ; `seats` le nombre d'élus attendus.
   ------------------------------------------------------------------------- */
export const METHODS = {
  resolution: {
    id: 'resolution',
    pick: 'one',
    seats: 0,
    fixedOptions: true,
    label: 'Oui / Non / Abstention',
    hint: 'Résolution, quitus, approbation des comptes',
    example: '« Approuvez-vous les comptes ? »',
  },
  single: {
    id: 'single',
    pick: 'one',
    seats: 1,
    fixedOptions: false,
    label: 'Choisir une personne parmi plusieurs',
    hint: 'Président, délégué de classe',
    example: 'Un seul nom coché',
  },
  multi: {
    id: 'multi',
    pick: 'many',
    seats: 4,
    fixedOptions: false,
    label: 'Élire plusieurs personnes',
    hint: "Renouvellement d'un bureau, N sièges",
    example: '4 noms à cocher au maximum',
  },
  ranking: {
    id: 'ranking',
    pick: 'order',
    seats: 1,
    fixedOptions: false,
    label: 'Classer par ordre de préférence',
    hint: 'Le votant ordonne les propositions',
    example: '1er, 2e, 3e…',
  },
  approval: {
    id: 'approval',
    pick: 'many',
    seats: 0,
    fixedOptions: false,
    label: "Choix multiple / sondage d'opinion",
    hint: 'Sans effet juridique',
    example: 'Plusieurs réponses possibles',
  },
};

export const DEFAULT_RESOLUTION_OPTIONS = [
  { label: 'Pour', sublabel: 'Approuver la résolution', kind: OPTION_KIND.FOR },
  { label: 'Contre', sublabel: 'Rejeter la résolution', kind: OPTION_KIND.AGAINST },
  { label: 'Abstention', sublabel: 'Ne pas prendre part au vote', kind: OPTION_KIND.ABSTAIN },
];

/* -------------------------------------------------------------------------
   Règles de majorité
   `required(expressed, runnerUp, ratio)` renvoie le nombre de voix à atteindre.
   ------------------------------------------------------------------------- */
export const MAJORITIES = {
  simple: {
    id: 'simple',
    label: 'Majorité simple',
    hint: "Le plus de voix l'emporte",
    required: (_expressed, runnerUp) => runnerUp + 1,
  },
  absolute: {
    id: 'absolute',
    label: 'Majorité absolue',
    hint: 'Plus de la moitié des suffrages exprimés',
    required: (expressed) => Math.floor(expressed / 2) + 1,
  },
  qualified: {
    id: 'qualified',
    label: 'Majorité qualifiée',
    hint: 'Une fraction des suffrages exprimés, deux tiers par défaut',
    required: (expressed, _runnerUp, ratio) => Math.ceil((expressed * ratio.num) / ratio.den),
  },
  unanimous: {
    id: 'unanimous',
    label: 'Unanimité',
    hint: 'Aucune voix contre',
    required: (expressed) => expressed,
  },
};

/* -------------------------------------------------------------------------
   Traitement des votes blancs
   ------------------------------------------------------------------------- */
export const BLANK_POLICY = {
  excluded: {
    id: 'excluded',
    label: 'Décomptés à part',
    hint: "Les blancs sont publiés mais n'entrent pas dans les suffrages exprimés — usage associatif et électoral français le plus courant.",
  },
  counted: {
    id: 'counted',
    label: 'Comptés dans les suffrages exprimés',
    hint: 'Un blanc rend la majorité plus difficile à atteindre : il pèse comme une voix contre.',
  },
};

/* -------------------------------------------------------------------------
   Règles de départage
   ------------------------------------------------------------------------- */
export const TIEBREAKS = {
  age: {
    id: 'age',
    label: "Bénéfice de l'âge",
    hint: 'Le candidat le plus âgé est proclamé élu — usage le plus courant en droit associatif français.',
  },
  chair: {
    id: 'chair',
    label: 'Voix prépondérante de la présidence',
    hint: 'La présidence tranche ; sa voix est mentionnée nominativement au procès-verbal.',
  },
  lot: {
    id: 'lot',
    label: 'Tirage au sort',
    hint: 'Tirage horodaté et journalisé, réalisé devant les scrutateurs.',
  },
  runoff: {
    id: 'runoff',
    label: 'Second tour',
    hint: 'Un nouveau scrutin est ouvert entre les candidats à égalité.',
  },
};

/* -------------------------------------------------------------------------
   Rôles
   ------------------------------------------------------------------------- */
export const ROLES = {
  organizer: { id: 'organizer', label: 'Organisateur' },
  scrutineer: { id: 'scrutineer', label: 'Scrutateur' },
  observer: { id: 'observer', label: 'Observateur' },
  voter: { id: 'voter', label: 'Votant' },
};

/* -------------------------------------------------------------------------
   Fabriques
   ------------------------------------------------------------------------- */

export function makeOption(label, sublabel = '', kind = OPTION_KIND.CANDIDATE) {
  return { id: newId('opt'), label, sublabel, kind };
}

export function makeVoter({ name, email = '', phone = '', college = '', weight = 1 }) {
  return {
    id: newId('vot'),
    name: String(name || '').trim(),
    email: String(email || '').trim().toLowerCase(),
    phone: String(phone || '').trim(),
    college: String(college || '').trim(),
    weight: Number(weight) > 0 ? Number(weight) : 1,
    token: null,
    tokenUsed: false,
    accessCode: null,
    channel: null,
  };
}

export function makeElection(overrides = {}, defaults = {}) {
  const now = new Date().toISOString();
  return {
    id: newId('scr'),
    ref: '',
    title: '',
    description: '',
    attachments: [],

    method: 'resolution',
    options: [],
    seats: 1,
    runoff: false,

    secret: true,
    weighted: false,
    colleges: false,

    proxiesEnabled: true,
    proxyLimit: 3,

    quorum: { enabled: true, mode: 'percent', value: 50, basis: 'voters' },
    majority: 'absolute',
    qualifiedRatio: { num: 2, den: 3 },
    blankPolicy: 'excluded',

    opensAt: null,
    closesAt: null,

    status: STATUS.DRAFT,
    electorate: [],
    proxies: [],
    candidacies: [],
    ballots: [],
    roster: [],
    audit: [],
    seal: null,
    tiebreak: null,

    createdAt: now,
    updatedAt: now,
    ...defaults,
    ...overrides,
  };
}

/** Référence lisible et croissante : SCR-2026-014 */
export function nextRef(elections, year = new Date().getFullYear()) {
  const prefix = `SCR-${year}-`;
  const used = elections
    .map((e) => e.ref)
    .filter((ref) => typeof ref === 'string' && ref.startsWith(prefix))
    .map((ref) => Number.parseInt(ref.slice(prefix.length), 10))
    .filter(Number.isFinite);
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}
