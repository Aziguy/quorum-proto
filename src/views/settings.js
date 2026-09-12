/**
 * settings.js — configuration de l'instance.
 *
 * Tout ce que cet écran modifie existe aussi dans
 * src/config/default.config.js : une instance peut donc être préconfigurée au
 * déploiement, sans que personne n'ait à cliquer. L'interface n'est qu'un
 * confort par-dessus le fichier.
 */

import { html } from '../core/dom.js';
import {
  btn, card, pageHead, banner, field, switchRow, segmented, keyValues,
} from '../ui/components.js';
import { formatNumber } from '../core/format.js';
import { ORGANIZATION_KINDS } from '../config/default.config.js';
import { LOCALES, getLocale } from '../core/i18n.js';
import { usedBytes, CURRENT_VERSION } from '../core/storage.js';
import {
  updateConfig, exportAll, importFile, currentTheme, applyTheme, applyLocale, store,
} from '../app.js';
import { toast } from '../ui/feedback.js';

const FEATURE_LABELS = {
  proxies: ['Pouvoirs (procurations)', 'Autorise un membre empêché à confier sa voix à un autre.'],
  colleges: ['Collèges de membres', 'Catégories de membres, détaillées dans la participation.'],
  weighting: ['Voix pondérées', 'Parts sociales, tantièmes, licences : une personne, plusieurs voix.'],
  candidacies: ['Candidatures', 'Dépôt et validation des candidatures avant l’ouverture.'],
  templates: ['Modèles de scrutin', 'Règles réutilisables d’une année sur l’autre.'],
  sessionMode: ['Mode séance', 'Écran projeté, lisible du fond de la salle.'],
  privacy: ['Écran Données & RGPD', 'Durées de conservation et exercice des droits.'],
  audit: ['Journal d’audit', 'Événements horodatés et chaînés.'],
  minutes: ['Procès-verbal', 'Document officiel généré depuis le décompte.'],
  demoData: ['Jeu de démonstration', 'Sept scrutins réellement joués, au premier lancement.'],
};

export default {
  id: 'settings',

  render(ctx) {
    const { config } = ctx;
    const org = config.organization;
    const theme = currentTheme();

    return html`<div class="view">
      ${pageHead({
    title: 'Réglages',
    lead: 'Identité de l’instance, modules actifs et valeurs par défaut de l’assistant.',
    actions: html`${btn({ label: 'Exporter', act: 'export', iconName: 'download' })}
      ${btn({ label: 'Importer', act: 'import', iconName: 'upload' })}`,
  })}

      ${card({
    title: 'Identité',
    hint: 'Ces informations apparaissent sur les bulletins, les procès-verbaux et les exports.',
    body: html`
        ${field({
    label: 'Nom de l’organisation', name: 'orgName', value: org.name,
    act: 'setOrgName', placeholder: 'Club athlétique de Vaugirard',
  })}
        <div class="field">
          <label class="field__label" for="f_kind">Forme juridique</label>
          <select class="select" id="f_kind" data-act="setKind">
            ${ORGANIZATION_KINDS.map((k) => html`<option value="${k.id}"
              ${k.id === org.kind ? 'selected' : ''}>${k.label}</option>`)}
          </select>
          <p class="field__hint">Détermine le vocabulaire employé dans l’interface :
            actuellement « ${config.vocabulary.members} », « ${config.vocabulary.unit} ».</p>
        </div>
        ${field({
    label: 'Mention légale', name: 'legal', value: org.legalMention,
    act: 'setLegal', optional: true, placeholder: 'association loi 1901',
    hint: 'Reprise en en-tête du procès-verbal.',
  })}
        <div class="grid grid--2">
          ${field({ label: 'Présidence — nom', name: 'chair', value: org.chair.name, act: 'setChair', optional: true })}
          ${field({ label: 'Secrétariat ou trésorerie — nom', name: 'secretary', value: org.secretary.name, act: 'setSecretary', optional: true })}
        </div>
        ${field({
    label: 'Personne connectée', name: 'actor', value: config.session.actor, act: 'setActor',
    hint: 'Nom inscrit au journal d’audit pour les actions réalisées depuis ce poste.',
  })}`,
  })}

      <div style="margin-top:var(--s-5)">
        ${card({
    title: 'Modules',
    hint: 'Désactiver un module retire son écran et ses options d’assistant — sans laisser d’entrée morte dans la navigation.',
    body: html`${Object.entries(FEATURE_LABELS).map(([key, [label, hint]]) => switchRow({
    title: label, sub: hint, checked: config.features[key], act: 'toggleFeature', data: { key },
  }))}`,
  })}
      </div>

      <div class="grid grid--2" style="margin-top:var(--s-5)">
        ${card({
    title: 'Apparence',
    body: html`
          <div class="field">
            <p class="field__label">Thème</p>
            ${segmented({
    items: [{ id: 'system', label: 'Système' }, { id: 'light', label: 'Clair' }, { id: 'dark', label: 'Sombre' }],
    value: theme, act: 'setTheme',
  })}
          </div>
          <div class="field">
            <p class="field__label">Langue</p>
            ${segmented({
    items: Object.entries(LOCALES).map(([code, l]) => ({ id: code, label: l.label })),
    value: getLocale(), act: 'setLocaleValue',
  })}
            <p class="field__hint">Les textes non traduits retombent sur le français.
              Ajouter une langue : copier <span class="mono">src/i18n/en.js</span>.</p>
          </div>`,
  })}

        ${card({
    title: 'Stockage local',
    body: html`${keyValues([
    ['Version du format', String(CURRENT_VERSION)],
    ['Espace occupé', `${formatNumber(Math.round(usedBytes() / 1024))} Ko`],
    ['Scrutins', formatNumber(ctx.elections.length)],
    ['Emplacement', 'ce navigateur uniquement'],
  ])}
          <div style="margin-top:var(--s-4)">
            ${banner({
    tone: 'warn',
    body: 'Vider les données de site efface tout définitivement. L’export JSON est la seule sauvegarde.',
  })}
          </div>`,
  })}
      </div>

      <div style="margin-top:var(--s-5)">
        ${card({
    title: 'À propos de cette instance',
    body: keyValues([
      ['Application', `${config.app.name} ${config.app.version}`],
      ['Licence', config.app.license],
      ['Code source', html`<a href="${config.app.repository}" target="_blank" rel="noopener">${config.app.repository}</a>`],
    ]),
  })}
      </div>
    </div>`;
  },

  actions: {
    // Les champs texte n'entraînent pas de re-rendu : la saisie reste fluide.
    setOrgName: (ctx, { el }) => updateConfig({ organization: { name: el.value } }),
    setLegal: (ctx, { el }) => updateConfig({ organization: { legalMention: el.value } }),
    setChair: (ctx, { el }) => updateConfig({ organization: { chair: { name: el.value } } }),
    setSecretary: (ctx, { el }) => updateConfig({ organization: { secretary: { name: el.value } } }),
    setActor: (ctx, { el }) => updateConfig({ session: { actor: el.value } }),

    /** Changer de forme juridique change aussi le vocabulaire de l'interface. */
    setKind(ctx, { el }) {
      const kind = ORGANIZATION_KINDS.find((k) => k.id === el.value);
      if (!kind) return;
      updateConfig({
        organization: {
          kind: kind.id,
          legalMention: ctx.config.organization.legalMention || kind.legal,
        },
        vocabulary: kind.vocabulary,
      });
      toast(`Vocabulaire adapté : « ${kind.vocabulary.members} ».`, 'ok');
    },

    toggleFeature(ctx, { data }) {
      const next = !ctx.config.features[data.key];
      updateConfig({ features: { [data.key]: next } });
      toast(`${FEATURE_LABELS[data.key][0]} : ${next ? 'activé' : 'désactivé'}.`);
    },

    setTheme(ctx, { data }) { applyTheme(data.value); store.refresh(); },
    setLocaleValue(ctx, { data }) { applyLocale(data.value); toast(LOCALES[data.value].label); },

    export: () => { exportAll(); toast('Export téléchargé.', 'ok'); },

    async import(ctx) {
      const result = await importFile();
      if (!result.ok) {
        toast({
          cancelled: 'Import annulé.',
          'invalid-json': 'Fichier illisible : ce n’est pas du JSON valide.',
          'unknown-format': 'Format non reconnu. Attendu : un export Quorum.',
        }[result.error] || 'Import impossible.', result.error === 'cancelled' ? 'info' : 'danger');
        return;
      }
      toast(result.kind === 'full'
        ? `Instance remplacée : ${result.count} scrutin(s) importé(s).`
        : 'Scrutin importé.', 'ok');
      ctx.go('/scrutins');
    },
  },
};
