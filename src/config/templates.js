/**
 * templates.js — modèles de scrutin.
 *
 * Un modèle enregistre des règles, jamais des personnes : on le rejoue d'une
 * année sur l'autre avec un corps électoral à jour. Ajouter un modèle ici le
 * rend disponible dans l'assistant, sans autre modification.
 */

export const TEMPLATES = [
  {
    id: 'ag-annuelle',
    title: 'Assemblée générale annuelle',
    description: "Résolution soumise à l'approbation des membres : rapport moral, comptes, quitus.",
    tags: ['association', 'cooperative'],
    rules: ['Quorum : la moitié des inscrits', 'Majorité absolue, abstentions exclues', 'Bulletin secret · pouvoirs plafonnés à 3'],
    apply: {
      method: 'resolution',
      secret: true,
      majority: 'absolute',
      blankPolicy: 'excluded',
      quorum: { enabled: true, mode: 'percent', value: 50, basis: 'voters' },
      proxiesEnabled: true,
      proxyLimit: 3,
    },
  },
  {
    id: 'bureau',
    title: 'Élection du bureau',
    description: 'Scrutin plurinominal à plusieurs sièges, avec dépôt de candidatures en amont.',
    tags: ['association', 'party'],
    rules: ['4 sièges à pourvoir', 'Majorité simple', "Départage : bénéfice de l'âge"],
    apply: {
      method: 'multi',
      seats: 4,
      secret: true,
      majority: 'simple',
      blankPolicy: 'excluded',
      quorum: { enabled: true, mode: 'percent', value: 33, basis: 'voters' },
      proxiesEnabled: true,
      proxyLimit: 3,
    },
  },
  {
    id: 'delegue-classe',
    title: 'Délégué de classe',
    description: "Élection d'un délégué, adaptée à un corps électoral de moins de 35 élèves.",
    tags: ['school'],
    rules: ['Un seul nom par bulletin', 'Majorité absolue, second tour', 'Sans quorum'],
    apply: {
      method: 'single',
      seats: 1,
      secret: true,
      majority: 'absolute',
      runoff: true,
      blankPolicy: 'excluded',
      quorum: { enabled: false, mode: 'percent', value: 50, basis: 'voters' },
      proxiesEnabled: false,
      proxyLimit: 0,
    },
  },
  {
    id: 'statuts',
    title: 'Modification des statuts',
    description: 'Assemblée générale extraordinaire : quorum et majorité renforcés.',
    tags: ['association', 'cooperative', 'party'],
    rules: ['Quorum : deux tiers des inscrits', 'Majorité qualifiée des deux tiers', 'Bulletin secret'],
    apply: {
      method: 'resolution',
      secret: true,
      majority: 'qualified',
      qualifiedRatio: { num: 2, den: 3 },
      blankPolicy: 'excluded',
      quorum: { enabled: true, mode: 'percent', value: 67, basis: 'voters' },
      proxiesEnabled: true,
      proxyLimit: 3,
    },
  },
  {
    id: 'consultation',
    title: 'Consultation sans effet juridique',
    description: "Sondage d'opinion auprès des membres : plusieurs réponses possibles, aucun quorum.",
    tags: ['association', 'cooperative', 'school', 'party', 'company'],
    rules: ['Choix multiple', 'Sans quorum ni majorité', 'Résultats publiés à tous'],
    apply: {
      method: 'approval',
      secret: true,
      majority: 'simple',
      blankPolicy: 'excluded',
      quorum: { enabled: false, mode: 'percent', value: 50, basis: 'voters' },
      proxiesEnabled: false,
      proxyLimit: 0,
    },
  },
  {
    id: 'priorites',
    title: 'Classement de priorités budgétaires',
    description: 'Les membres ordonnent des projets ; le décompte se fait par points (Borda).',
    tags: ['association', 'cooperative', 'company'],
    rules: ['Classement par ordre de préférence', 'Comptage de Borda', 'Vainqueur de Condorcet signalé'],
    apply: {
      method: 'ranking',
      seats: 1,
      secret: true,
      majority: 'simple',
      blankPolicy: 'excluded',
      quorum: { enabled: true, mode: 'percent', value: 33, basis: 'voters' },
      proxiesEnabled: true,
      proxyLimit: 3,
    },
  },
];
