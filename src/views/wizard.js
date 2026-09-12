/**
 * wizard.js — assistant de création d'un scrutin, en quatre étapes.
 *
 * Parti pris : chaque règle statutaire est présente, mais préréglée sur
 * l'usage le plus courant. Le trésorier bénévole peut traverser l'assistant en
 * acceptant tous les défauts ; l'association aux statuts inhabituels déplie les
 * options avancées. Un seul parcours, pas deux interfaces à maintenir.
 */

import { html, raw } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import {
  btn, card, field, choice, switchRow, segmented, stepperNumber, banner, keyValues,
} from '../ui/components.js';
import { formatNumber, formatDate, toLocalInput, fromLocalInput } from '../core/format.js';
import {
  METHODS, MAJORITIES, BLANK_POLICY, STATUS, DEFAULT_RESOLUTION_OPTIONS,
  makeElection, makeOption, makeVoter, nextRef,
} from '../domain/schema.js';
import { QUORUM_PRESETS, evaluateQuorum } from '../domain/quorum.js';
import { readiness, openElection, addVoters } from '../domain/election.js';
import { participationStats } from '../domain/tally.js';
import { parseTable } from '../core/csv.js';
import { pickFile } from '../core/storage.js';
import {
  getElection, setElection, setElectionSilently, addElection, setUi, applyOperation,
} from '../app.js';
import { toast, confirmDialog, promptDialog } from '../ui/feedback.js';
import { missingElection } from './_shared.js';

const STEPS = [
  { num: 1, label: 'Objet du vote' },
  { num: 2, label: 'Mode de scrutin' },
  { num: 3, label: 'Corps électoral' },
  { num: 4, label: 'Règles et ouverture' },
];

/** Crée un brouillon et bascule dessus : l'assistant travaille sur du réel. */
function createDraft(ctx) {
  const { config, elections } = ctx;
  const draft = makeElection({
    ref: nextRef(elections),
    options: DEFAULT_RESOLUTION_OPTIONS.map((o) => makeOption(o.label, o.sublabel, o.kind)),
  }, config.defaults);
  addElection(draft);
  setUi({ wizardStep: 1 });
  return draft;
}

/* --- Étape 1 : objet du vote ------------------------------------------------ */

function stepObject(election) {
  return card({
    title: 'Objet du vote',
    hint: 'Ce que les votants liront en haut de leur bulletin.',
    body: html`
      ${field({
    label: 'Intitulé de la résolution', name: 'title', value: election.title,
    act: 'setTitle', placeholder: 'Approbation des comptes de l’exercice…',
    hint: 'Une phrase complète et sans ambiguïté : elle sera reprise telle quelle au procès-verbal.',
  })}
      ${field({
    label: 'Exposé des motifs', name: 'description', value: election.description,
    act: 'setDescription', rows: 4, optional: true,
    placeholder: 'Contexte, rapport joint, conséquences du vote…',
  })}

      <div class="field">
        <p class="field__label">Pièces jointes</p>
        ${election.attachments.length ? html`<div class="stack" style="--gap:var(--s-2);margin-bottom:var(--s-3)">
          ${election.attachments.map((file, index) => html`
            <div class="row row--tight" style="padding:var(--s-2) var(--s-3);background:var(--surface-2);border-radius:var(--r-sm)">
              ${raw(icon('fileText', { size: 14 }))}
              <span class="grow" style="font-size:var(--text-sm)">${file.name}</span>
              <span class="dim" style="font-size:var(--text-xs)">${file.size}</span>
              <button class="btn btn--ghost btn--sm" data-act="removeAttachment" data-index="${index}"
                aria-label="Retirer ${file.name}">×</button>
            </div>`)}
        </div>` : html`<p class="field__hint" style="margin-bottom:var(--s-3)">
          Aucune pièce. Les votants peuvent voter sans, mais un rapport joint réduit les abstentions.</p>`}
        ${btn({ label: 'Ajouter une pièce', act: 'addAttachment', iconName: 'plus', size: 'sm' })}
      </div>`,
  });
}

/* --- Étape 2 : mode de scrutin ---------------------------------------------- */

function stepMethod(election, { ui }) {
  const method = METHODS[election.method];
  const fixed = method.fixedOptions;
  const optionsTitle = {
    resolution: 'Réponses proposées',
    single: 'Candidatures',
    multi: 'Candidatures',
    ranking: 'Propositions à classer',
    approval: 'Réponses possibles',
  }[election.method];

  return html`
    ${card({
    title: 'Comment vote-t-on ?',
    hint: 'Choisissez la formulation qui correspond à votre décision. Le vocabulaire technique reste en coulisses.',
    body: html`<div class="stack" style="--gap:var(--s-2)" role="radiogroup" aria-label="Mode de scrutin">
        ${Object.values(METHODS).map((m) => choice({
    title: m.label, sub: m.hint, aside: m.example,
    checked: m.id === election.method, act: 'setMethod', data: { method: m.id },
  }))}
      </div>`,
  })}

    ${card({
    modifier: 'card--pad-lg',
    body: html`
        <div class="row" style="justify-content:space-between;margin-bottom:var(--s-4)">
          <h2 class="card__title" style="margin:0">${optionsTitle}</h2>
          ${method.pick === 'many' && method.id !== 'approval'
    ? stepperNumber({ value: election.seats, act: 'setSeats', label: 'Sièges à pourvoir', max: Math.max(1, election.options.length) })
    : ''}
        </div>

        <div class="stack" style="--gap:var(--s-2)">
          ${election.options.map((option, index) => html`
            <div class="row row--tight">
              <span class="dim nums" style="flex:0 0 1.5rem;text-align:right">${index + 1}</span>
              <input class="input grow" value="${option.label}" data-act="setOptionLabel"
                data-id="${option.id}" aria-label="Libellé de la proposition ${index + 1}"
                ${raw(fixed ? 'readonly' : '')}>
              <input class="input" style="flex:0 1 12rem" value="${option.sublabel}"
                data-act="setOptionSub" data-id="${option.id}"
                placeholder="Précision" aria-label="Précision ${index + 1}"
                ${raw(fixed ? 'readonly' : '')}>
              <button class="btn btn--ghost btn--icon" data-act="removeOption" data-id="${option.id}"
                aria-label="Retirer ${option.label}" ${raw(fixed || election.options.length <= 2 ? 'disabled' : '')}>
                ${raw(icon('close', { size: 14 }))}</button>
            </div>`)}
        </div>

        ${fixed
    ? banner({
      tone: 'neutral',
      body: "Les trois réponses d'une résolution sont imposées par l'usage : ni leur libellé ni leur ordre ne se modifient. Changez de mode de scrutin si vous avez besoin d'autres réponses.",
    })
    : html`<div style="margin-top:var(--s-4)">
            ${btn({ label: 'Ajouter une proposition', act: 'addOption', iconName: 'plus', size: 'sm' })}
          </div>`}

        <div class="card__section">
          ${btn({
    label: ui.wizardAdvanced ? 'Masquer les options avancées' : 'Options avancées',
    act: 'toggleAdvanced', variant: 'ghost', size: 'sm',
    iconName: ui.wizardAdvanced ? 'chevronDown' : 'chevronRight',
  })}
          ${ui.wizardAdvanced ? html`<div style="margin-top:var(--s-3)">
            ${switchRow({
    title: 'Second tour automatique',
    sub: "Si personne n'atteint la majorité requise au premier tour, un second tour s'ouvre entre les deux premiers.",
    checked: election.runoff, act: 'toggleRunoff',
  })}
            ${switchRow({
    title: 'Vote nominatif (non secret)',
    sub: 'Chaque voix est publiée avec le nom du votant. Usage : conseils d’administration, votes à main levée dématérialisés.',
    checked: !election.secret, act: 'toggleSecret',
  })}
          </div>` : ''}
        </div>`,
  })}`;
}

/* --- Étape 3 : corps électoral ---------------------------------------------- */

function stepElectorate(election, { config }) {
  const stats = participationStats(election);
  const withoutEmail = election.electorate.filter((v) => !v.email).length;
  const colleges = [...new Set(election.electorate.map((v) => v.college).filter(Boolean))];

  return html`
    ${card({
    title: 'Qui a le droit de voter ?',
    hint: "Le corps électoral est figé à l'ouverture du scrutin. Toute modification ultérieure est inscrite au journal d'audit.",
    body: html`
        <div class="row" style="margin-bottom:var(--s-4)">
          ${btn({ label: 'Importer un fichier CSV', act: 'importCsv', iconName: 'upload', variant: 'primary' })}
          ${btn({ label: 'Coller une liste', act: 'pasteList', iconName: 'clipboard' })}
          ${btn({ label: 'Ajouter une personne', act: 'addOneVoter', iconName: 'plus' })}
          ${election.electorate.length
    ? btn({ label: 'Vider la liste', act: 'clearElectorate', variant: 'quiet-danger', size: 'sm' })
    : ''}
        </div>

        <div class="code-block" style="margin-bottom:var(--s-4)">Nom ; Prénom ; E-mail ; Collège ; Voix
Diagne ; Awa ; awa.diagne@exemple.org ; Membres actifs ; 1
Le Goff ; Yann ; yann.legoff@exemple.org ; Membres bienfaiteurs ; 3</div>
        <p class="field__hint" style="margin-top:calc(-1 * var(--s-3));margin-bottom:var(--s-4)">
          Séparateur virgule, point-virgule ou tabulation. Les colonnes Collège et Voix sont facultatives.
          Les doublons d'adresse e-mail sont fusionnés automatiquement.</p>

        ${election.electorate.length ? html`
          ${banner({
    tone: 'ok',
    title: `${formatNumber(stats.registeredVoters)} électeurs reconnus.`,
    body: html`Total de ${formatNumber(stats.registeredWeight)} ${config.vocabulary.unit}${
  colleges.length > 1 ? html`, répartis en ${colleges.length} collèges` : ''}.`,
    actions: btn({ label: 'Vérifier la liste', href: `#/scrutins/${election.id}/electeurs`, size: 'sm' }),
  })}
          ${withoutEmail ? html`<div style="margin-top:var(--s-3)">${banner({
    tone: 'warn',
    title: `${formatNumber(withoutEmail)} personne(s) sans adresse e-mail.`,
    body: "Aucun cul-de-sac : un code d'accès imprimable sera généré à l'ouverture, à remettre en main propre. Il ouvre le même bulletin.",
  })}</div>` : ''}
        ` : banner({
    tone: 'warn',
    title: 'Le corps électoral est vide.',
    body: 'Le scrutin ne pourra pas être ouvert tant que personne n’y figure.',
  })}`,
  })}

    ${card({
    title: 'Cas particuliers de vos statuts',
    hint: 'Tout est désactivé par défaut. N’activez que ce que vos statuts prévoient réellement.',
    body: html`
        ${config.features.colleges ? switchRow({
    title: 'Collèges ou catégories de membres',
    sub: 'Membres actifs, bienfaiteurs, membres de droit — les résultats sont alors détaillés par collège.',
    checked: election.colleges, act: 'toggleColleges',
  }) : ''}
        ${config.features.weighting ? switchRow({
    title: 'Voix pondérées',
    sub: `Parts sociales, tantièmes de copropriété, nombre de licences. La colonne « Voix » du fichier est alors prise en compte.`,
    checked: election.weighted, act: 'toggleWeighted',
  }) : ''}
        ${config.features.proxies ? html`
          ${switchRow({
    title: 'Pouvoirs (procurations)',
    sub: 'Un membre empêché confie sa voix à un autre. Le plafond est opposable : au-delà, le dépôt est refusé et journalisé.',
    checked: election.proxiesEnabled, act: 'toggleProxies',
  })}
          ${election.proxiesEnabled ? html`<div style="padding-left:var(--s-8)">
            ${stepperNumber({ value: election.proxyLimit, act: 'setProxyLimit', label: 'Plafond par mandataire', min: 1, max: 20 })}
          </div>` : ''}` : ''}`,
  })}`;
}

/* --- Étape 4 : règles de décision et ouverture ------------------------------ */

function stepRules(election, { config }) {
  const stats = participationStats(election);
  const quorum = evaluateQuorum(election, stats);
  const check = readiness(election);

  return html`
    ${card({
    title: 'Qui voit quoi ?',
    hint: 'Ce réglage ne pourra plus être modifié après l’ouverture du scrutin.',
    body: html`
        <div class="grid grid--2" role="radiogroup" aria-label="Confidentialité du vote">
          ${choice({
    title: 'Bulletin secret', sub: 'Personne, pas même vous, ne peut relier un vote à son auteur.',
    checked: election.secret, act: 'setSecrecy', data: { secret: 'true' },
  })}
          ${choice({
    title: 'Vote nominatif', sub: 'Chaque voix est publiée avec le nom. Usage : conseils d’administration.',
    checked: !election.secret, act: 'setSecrecy', data: { secret: 'false' },
  })}
        </div>
        ${election.secret ? html`<div style="margin-top:var(--s-4)">
          <p class="field__label">Ce que « secret » veut dire concrètement</p>
          <div class="grid" style="grid-template-columns:1fr auto 1fr;align-items:center;gap:var(--s-3)">
            <div class="card card--flat" style="padding:var(--s-3)">
              <strong style="font-size:var(--text-sm)">Liste d’émargement</strong>
              <p class="choice__sub">Qui a voté, et à quelle heure. Consultable par les scrutateurs.</p>
            </div>
            <div class="dim center" style="font-size:var(--text-2xs);line-height:1.3">aucun lien<br>entre<br>les deux</div>
            <div class="card card--flat" style="padding:var(--s-3)">
              <strong style="font-size:var(--text-sm)">Urne</strong>
              <p class="choice__sub">Les bulletins déposés, sans identité, dans un ordre mélangé.</p>
            </div>
          </div>
        </div>` : ''}`,
  })}

    ${card({
    title: 'Règles de décision',
    body: html`
        ${switchRow({
    title: 'Exiger un quorum',
    sub: 'Nombre minimum de votants pour que la décision soit valable. Les pouvoirs y comptent.',
    checked: election.quorum.enabled, act: 'toggleQuorum',
  })}
        ${election.quorum.enabled ? html`<div style="padding-left:var(--s-8);margin-bottom:var(--s-5)">
          ${segmented({
    items: QUORUM_PRESETS.map((p) => ({ id: String(p.value), label: p.label })),
    value: String(election.quorum.value), act: 'setQuorum',
  })}
          <p class="field__hint">Sur ${formatNumber(stats.registeredVoters)} inscrits, il faudra
            <strong>${formatNumber(quorum.required)} votants</strong> pour que le scrutin soit valable.</p>
        </div>` : ''}

        <p class="field__label">Majorité requise</p>
        <div class="stack" style="--gap:var(--s-2);margin-bottom:var(--s-5)" role="radiogroup" aria-label="Majorité requise">
          ${Object.values(MAJORITIES).map((m) => choice({
    title: m.label, sub: m.hint, checked: election.majority === m.id,
    act: 'setMajority', data: { majority: m.id },
  }))}
        </div>

        <p class="field__label">Votes blancs</p>
        ${segmented({
    items: Object.values(BLANK_POLICY).map((b) => ({ id: b.id, label: b.label })),
    value: election.blankPolicy, act: 'setBlankPolicy',
  })}
        <p class="field__hint">${BLANK_POLICY[election.blankPolicy].hint}</p>`,
  })}

    ${card({
    title: 'Ouverture et clôture',
    body: html`
        <div class="grid grid--2">
          ${field({
    label: 'Ouverture du vote', name: 'opensAt', type: 'datetime-local',
    value: toLocalInput(election.opensAt), act: 'setOpensAt',
    hint: 'Laissez vide pour ouvrir immédiatement.',
  })}
          ${field({
    label: 'Clôture automatique', name: 'closesAt', type: 'datetime-local',
    value: toLocalInput(election.closesAt), act: 'setClosesAt',
    hint: `Fuseau : ${config.organization.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}`,
  })}
        </div>`,
  })}

    ${card({
    title: 'Récapitulatif avant ouverture',
    body: html`
        ${keyValues([
    ['Mode de scrutin', METHODS[election.method].label],
    ['Confidentialité', election.secret ? 'Bulletin secret' : 'Vote nominatif'],
    ['Corps électoral', `${formatNumber(stats.registeredVoters)} inscrits · ${formatNumber(stats.registeredWeight)} ${config.vocabulary.unit}`],
    ['Quorum', election.quorum.enabled ? `${formatNumber(quorum.required)} votants requis` : 'aucun'],
    ['Majorité', MAJORITIES[election.majority].label],
    ['Votes blancs', BLANK_POLICY[election.blankPolicy].label],
    ['Pouvoirs', election.proxiesEnabled ? `plafonnés à ${election.proxyLimit} par mandataire` : 'non autorisés'],
    ['Clôture', election.closesAt ? formatDate(election.closesAt, 'full') : 'manuelle'],
  ])}

        <div class="card__section">
          ${check.ready ? html`
            <div class="row">
              ${btn({
    label: `Ouvrir le scrutin et distribuer ${formatNumber(stats.registeredVoters)} accès`,
    act: 'openElection', variant: 'primary', iconName: 'ballotBox',
  })}
              ${btn({ label: 'Enregistrer comme brouillon', href: '#/scrutins' })}
            </div>
            <p class="field__hint">Chaque électeur reçoit un lien nominatif, utilisable une seule fois.
              Le corps électoral sera figé à cet instant.</p>
            ${check.warnings.map((w) => html`<div style="margin-top:var(--s-3)">${banner({ tone: 'warn', body: w.text })}</div>`)}
          ` : banner({
    tone: 'warn',
    title: 'Le scrutin ne peut pas encore être ouvert.',
    body: html`<ul style="margin:var(--s-2) 0 0 var(--s-4)">${check.issues.map((i) => html`<li>${i.text}</li>`)}</ul>`,
  })}
        </div>`,
  })}`;
}

/* --- Aperçu du bulletin ----------------------------------------------------- */

function preview(election, config) {
  const method = METHODS[election.method];
  return html`<aside class="split__aside">
    ${card({
    modifier: 'card--flat',
    body: html`
        <div class="row row--tight" style="justify-content:space-between;margin-bottom:var(--s-3)">
          <strong style="font-size:var(--text-sm)">Aperçu du bulletin</strong>
          <span class="dim" style="font-size:var(--text-2xs)">vu par les votants</span>
        </div>

        <div class="card" style="padding:var(--s-4)">
          <div class="row row--tight" style="margin-bottom:var(--s-3)">
            <span class="brand__mark" style="width:1.25rem;height:1.25rem;font-size:var(--text-2xs)">${config.app.mark}</span>
            <span class="dim" style="font-size:var(--text-2xs)">${config.organization.name || config.app.tagline}</span>
          </div>
          <span class="badge badge--brand">${method.label}</span>
          <h3 data-preview="title" style="font-size:var(--text-lg);margin:var(--s-3) 0 var(--s-2)">
            ${election.title || 'Intitulé de la résolution'}</h3>
          <p data-preview="description" class="choice__sub" style="margin-bottom:var(--s-3)">
            ${election.description.slice(0, 110) || 'L’exposé des motifs apparaîtra ici.'}</p>

          <div class="stack" style="--gap:var(--s-2)">
            ${election.options.slice(0, 5).map((option, index) => html`
              <div class="row row--tight" style="padding:var(--s-2) var(--s-3);border:1px solid var(--border);border-radius:var(--r-sm)">
                <span class="choice__mark ${method.pick === 'many' ? 'choice__mark--box' : ''}"
                  style="width:.85rem;height:.85rem"></span>
                <span class="grow" style="font-size:var(--text-sm)" data-preview="option-${option.id}">
                  ${option.label || `Proposition ${index + 1}`}</span>
                ${method.pick === 'order' ? html`<span class="dim" style="font-size:var(--text-2xs)">${index + 1}ᵉ</span>` : ''}
              </div>`)}
            ${election.options.length > 5 ? html`<p class="dim center" style="font-size:var(--text-2xs)">
              + ${election.options.length - 5} autres</p>` : ''}
          </div>

          <div class="row row--tight" style="margin-top:var(--s-3);font-size:var(--text-2xs);color:var(--text-3)">
            ${raw(icon(election.secret ? 'lock' : 'user', { size: 12 }))}
            <span>${election.secret
    ? 'Bulletin secret : votre nom n’apparaîtra jamais à côté de votre choix.'
    : 'Vote nominatif : votre nom sera publié avec votre choix.'}</span>
          </div>
        </div>`,
  })}
  </aside>`;
}

/* --- Actions ---------------------------------------------------------------- */

/** Applique une modification au brouillon courant. */
function edit(ctx, patch) {
  return setElection(ctx.params.id, (election) => ({
    ...election, ...(typeof patch === 'function' ? patch(election) : patch),
  }));
}

/** Modifie sans re-rendre, puis rafraîchit le seul fragment concerné. */
function editQuietly(ctx, patch, previewSelector, previewText) {
  setElectionSilently(ctx.params.id, patch);
  if (previewSelector) {
    const node = document.querySelector(previewSelector);
    if (node) node.textContent = previewText;
  }
}

/** Options par défaut d'un mode de scrutin donné. */
function optionsFor(method, previous) {
  if (method === 'resolution') {
    return DEFAULT_RESOLUTION_OPTIONS.map((o) => makeOption(o.label, o.sublabel, o.kind));
  }
  // On conserve les propositions saisies si elles ne venaient pas d'une résolution.
  const reusable = previous.filter((o) => o.kind === 'candidate' || o.kind === 'proposal');
  if (reusable.length >= 2) return reusable;
  return [makeOption(''), makeOption('')];
}

/** Reconnaît les colonnes usuelles d'un export de tableur. */
function voterFromRecord(record) {
  const first = record.prenom || record.firstname || '';
  const last = record.nom || record.lastname || record.name || '';
  const full = (record.nomcomplet || record.fullname || `${first} ${last}`).trim();
  if (!full) return null;
  return makeVoter({
    name: full,
    email: record.email || record.mail || record.courriel || record.adresseemail || '',
    phone: record.telephone || record.tel || record.mobile || record.phone || '',
    college: record.college || record.categorie || record.section || record.classe || '',
    weight: Number(record.voix || record.poids || record.parts || record.weight || 1),
  });
}

async function ingest(ctx, text) {
  const { records } = parseTable(text);
  const voters = records.map(voterFromRecord).filter(Boolean);
  if (!voters.length) {
    toast('Aucune ligne exploitable : vérifiez la ligne d’en-tête.', 'danger');
    return;
  }
  const result = await applyOperation(ctx.params.id, (election) => addVoters(
    election, voters, ctx.config.session.actor || 'Organisateur', { imported: true },
  ));
  if (!result.ok) { toast('Le corps électoral est figé : le scrutin est déjà ouvert.', 'danger'); return; }
  toast(
    `${result.added} électeur(s) ajouté(s)${result.merged ? `, ${result.merged} doublon(s) fusionné(s)` : ''}.`,
    'ok',
  );
}

const WIZARD_ACTIONS = {
  /* --- Navigation entre étapes --- */
  goStep: (ctx, { data }) => setUi({ wizardStep: Number(data.step) }),
  nextStep: (ctx) => setUi({ wizardStep: Math.min(STEPS.length, (ctx.ui.wizardStep || 1) + 1) }),
  prevStep: (ctx) => setUi({ wizardStep: Math.max(1, (ctx.ui.wizardStep || 1) - 1) }),

  /* --- Étape 1 --- */
  setTitle: (ctx, { el }) => editQuietly(
    ctx, { title: el.value }, '[data-preview="title"]', el.value || 'Intitulé de la résolution',
  ),
  setDescription: (ctx, { el }) => editQuietly(
    ctx, { description: el.value }, '[data-preview="description"]',
    el.value.slice(0, 110) || 'L’exposé des motifs apparaîtra ici.',
  ),

  async addAttachment(ctx) {
    const name = await promptDialog({
      title: 'Ajouter une pièce jointe',
      text: 'Le prototype n’héberge aucun fichier : seule la référence est enregistrée, comme elle figurera sur le bulletin.',
      label: 'Nom du document',
      placeholder: 'Comptes_2025-2026.pdf',
    });
    if (!name) return;
    edit(ctx, (election) => ({ attachments: [...election.attachments, { name, size: '—' }] }));
  },

  removeAttachment: (ctx, { data }) => edit(ctx, (election) => ({
    attachments: election.attachments.filter((_, i) => i !== Number(data.index)),
  })),

  /* --- Étape 2 --- */
  setMethod: (ctx, { data }) => edit(ctx, (election) => {
    const method = METHODS[data.method];
    return {
      method: data.method,
      options: optionsFor(data.method, election.options),
      seats: method.pick === 'many' && method.id !== 'approval' ? election.seats || method.seats : method.seats,
    };
  }),

  setSeats: (ctx, { data }) => edit(ctx, (election) => ({
    seats: Math.max(1, Math.min(election.options.length, election.seats + Number(data.delta))),
  })),

  setOptionLabel: (ctx, { el, data }) => editQuietly(
    ctx,
    {
      options: getElection(ctx.params.id).options.map((o) => (
        o.id === data.id ? { ...o, label: el.value } : o
      )),
    },
    `[data-preview="option-${data.id}"]`,
    el.value || 'Proposition',
  ),

  setOptionSub: (ctx, { el, data }) => editQuietly(ctx, {
    options: getElection(ctx.params.id).options.map((o) => (
      o.id === data.id ? { ...o, sublabel: el.value } : o
    )),
  }),

  addOption: (ctx) => edit(ctx, (election) => ({ options: [...election.options, makeOption('')] })),

  removeOption: (ctx, { data }) => edit(ctx, (election) => ({
    options: election.options.filter((o) => o.id !== data.id),
    seats: Math.min(election.seats, election.options.length - 1),
  })),

  toggleAdvanced: (ctx) => setUi({ wizardAdvanced: !ctx.ui.wizardAdvanced }),
  toggleRunoff: (ctx) => edit(ctx, (e) => ({ runoff: !e.runoff })),
  toggleSecret: (ctx) => edit(ctx, (e) => ({ secret: !e.secret })),
};

/* --- Étape 3 : corps électoral --- */
Object.assign(WIZARD_ACTIONS, {
  async importCsv(ctx) {
    const picked = await pickFile('.csv,.txt,text/csv');
    if (!picked) return;
    await ingest(ctx, picked.text);
  },

  async pasteList(ctx) {
    const text = await promptDialog({
      title: 'Coller une liste d’électeurs',
      text: 'Première ligne : les en-têtes de colonnes. Séparateur virgule, point-virgule ou tabulation.',
      label: 'Liste',
      multiline: true,
      placeholder: 'Nom ; Prénom ; E-mail ; Collège ; Voix',
      confirmLabel: 'Importer',
    });
    if (!text) return;
    await ingest(ctx, text);
  },

  async addOneVoter(ctx) {
    const name = await promptDialog({
      title: 'Ajouter un électeur',
      label: 'Nom et prénom',
      placeholder: 'Awa Diagne',
    });
    if (!name) return;
    const email = await promptDialog({
      title: `Adresse e-mail de ${name}`,
      text: 'Laissez vide pour générer un code d’accès imprimable à remettre en main propre.',
      label: 'Adresse e-mail',
      confirmLabel: 'Ajouter',
    });
    const result = await applyOperation(ctx.params.id, (election) => addVoters(
      election, [makeVoter({ name, email: email || '' })], ctx.config.session.actor || 'Organisateur',
    ));
    toast(result.ok ? `${name} ajouté au corps électoral.` : 'Ajout impossible.', result.ok ? 'ok' : 'danger');
  },

  async clearElectorate(ctx) {
    const election = getElection(ctx.params.id);
    const ok = await confirmDialog({
      title: 'Vider le corps électoral ?',
      text: `Les ${election.electorate.length} fiches seront supprimées. Le scrutin étant encore un brouillon, aucun bulletin n'est concerné.`,
      confirmLabel: 'Vider la liste',
      danger: true,
    });
    if (!ok) return;
    edit(ctx, { electorate: [], proxies: [] });
    toast('Corps électoral vidé.');
  },

  toggleColleges: (ctx) => edit(ctx, (e) => ({ colleges: !e.colleges })),
  toggleWeighted: (ctx) => edit(ctx, (e) => ({ weighted: !e.weighted })),
  toggleProxies: (ctx) => edit(ctx, (e) => ({ proxiesEnabled: !e.proxiesEnabled })),
  setProxyLimit: (ctx, { data }) => edit(ctx, (e) => ({
    proxyLimit: Math.max(1, Math.min(20, e.proxyLimit + Number(data.delta))),
  })),
});

/* --- Étape 4 : règles et ouverture --- */
Object.assign(WIZARD_ACTIONS, {
  setSecrecy: (ctx, { data }) => edit(ctx, { secret: data.secret === 'true' }),
  toggleQuorum: (ctx) => edit(ctx, (e) => ({ quorum: { ...e.quorum, enabled: !e.quorum.enabled } })),
  setQuorum: (ctx, { data }) => edit(ctx, (e) => ({ quorum: { ...e.quorum, value: Number(data.value) } })),
  setMajority: (ctx, { data }) => edit(ctx, { majority: data.majority }),
  setBlankPolicy: (ctx, { data }) => edit(ctx, { blankPolicy: data.value }),
  setOpensAt: (ctx, { el }) => edit(ctx, { opensAt: fromLocalInput(el.value) }),
  setClosesAt: (ctx, { el }) => edit(ctx, { closesAt: fromLocalInput(el.value) }),

  /**
   * Ouverture : la confirmation est explicite car l'opération est
   * irréversible — le corps électoral se fige et les jetons partent.
   */
  async openElection(ctx) {
    const election = getElection(ctx.params.id);
    const ok = await confirmDialog({
      title: 'Ouvrir le scrutin ?',
      text: `${election.electorate.length} accès nominatifs vont être générés. Le corps électoral et les règles seront figés : ni l'un ni les autres ne pourront plus être modifiés.`,
      confirmLabel: 'Ouvrir le scrutin',
    });
    if (!ok) return;

    const result = await applyOperation(ctx.params.id, (current) => openElection(
      current, ctx.config.session.actor || 'Organisateur',
    ));
    if (!result.ok) {
      toast({
        'empty-electorate': 'Le corps électoral est vide.',
        'not-enough-options': 'Il faut au moins deux propositions.',
        'already-open': 'Ce scrutin est déjà ouvert.',
      }[result.error] || 'Ouverture impossible.', 'danger');
      return;
    }
    toast('Scrutin ouvert · accès distribués.', 'ok');
    ctx.go(`/scrutins/${ctx.params.id}/urne`);
  },
});

/* --- Vue -------------------------------------------------------------------- */

export default {
  id: 'wizard',

  render(ctx) {
    const isNew = !ctx.params.id;
    const election = isNew ? null : getElection(ctx.params.id);

    // La création du brouillon a lieu dans mounted(), jamais pendant le rendu :
    // un effet déclenché depuis render() provoquerait un rendu en boucle.
    if (isNew) return html`<div class="view"><p class="muted">Création du brouillon…</p></div>`;
    if (!election) return missingElection();

    if (election.status !== STATUS.DRAFT) {
      return html`<div class="view">
        ${banner({
    tone: 'seal',
    title: 'Ce scrutin est ouvert : sa configuration est figée.',
    body: html`Modifier les règles après l'ouverture reviendrait à changer les règles en cours de partie.
      <a href="#/scrutins/${election.id}/suivi">Suivre la participation</a>.`,
  })}
      </div>`;
    }

    const step = ctx.ui.wizardStep || 1;
    const content = [stepObject, stepMethod, stepElectorate, stepRules][step - 1];

    return html`<div class="view">
      <a class="back-link" href="#/scrutins">${raw(icon('chevronLeft'))} Tous les scrutins</a>
      <header class="page-head">
        <div class="page-head__text">
          <h1 id="view-title" tabindex="-1">Nouveau scrutin</h1>
          <p>Brouillon <span class="mono">${election.ref}</span> · enregistré automatiquement</p>
        </div>
        <div class="page-head__actions">
          <span class="dim" style="font-size:var(--text-sm)">Étape ${step} sur ${STEPS.length}</span>
        </div>
      </header>

      <nav class="steps" aria-label="Étapes de création">
        ${STEPS.map((s) => html`<button type="button" class="step" data-act="goStep" data-step="${s.num}"
          ${raw(s.num === step ? 'aria-current="step"' : '')} data-done="${s.num < step ? 'true' : 'false'}">
          <span class="step__num">${s.num < step ? '✓' : s.num}</span>
          <span class="step__label">${s.label}</span>
        </button>`)}
      </nav>

      <div class="split">
        <div class="stack" style="--gap:var(--s-4)">
          ${content(election, ctx)}

          <div class="row" style="justify-content:space-between">
            ${btn({ label: 'Précédent', act: 'prevStep', iconName: 'chevronLeft', disabled: step === 1 })}
            ${step < STEPS.length
    ? btn({ label: 'Continuer', act: 'nextStep', variant: 'primary', iconName: 'chevronRight', iconAfter: true })
    : html`<span class="dim" style="font-size:var(--text-xs)">Vous pourrez revenir sur chaque étape
        tant que le scrutin n'est pas ouvert.</span>`}
          </div>
        </div>
        ${preview(election, ctx.config)}
      </div>
    </div>`;
  },

  /**
   * Appelé une fois par entrée sur la route. C'est ici que vivent les effets :
   * créer le brouillon, puis rediriger vers son URL propre — de sorte qu'un
   * rechargement de page reprenne le brouillon au lieu d'en créer un second.
   */
  mounted(ctx) {
    if (ctx.params.id) return;
    const draft = createDraft(ctx);
    ctx.go(`/scrutins/${draft.id}/assistant`, { replace: true });
  },

  actions: WIZARD_ACTIONS,
};
