/**
 * _shared.js — éléments communs aux écrans d'un scrutin.
 *
 * L'en-tête et les onglets sont identiques d'un écran à l'autre : les écrire
 * une fois garantit qu'ils ne divergent pas, et qu'ajouter un onglet se fait
 * en un seul endroit.
 */

import { html, raw } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import { statusBadge, banner, emptyState, btn } from '../ui/components.js';
import { formatDate, formatRelative, formatNumber } from '../core/format.js';
import { STATUS, METHODS } from '../domain/schema.js';
import { participationStats } from '../domain/tally.js';
import { can } from '../domain/permissions.js';

/** Onglets d'un scrutin, filtrés selon la configuration et le statut. */
export function electionTabs(election, config, active) {
  const base = `#/scrutins/${election.id}`;
  const stats = participationStats(election);
  const items = [];

  if (election.status === STATUS.DRAFT) {
    items.push({ id: 'wizard', label: 'Configuration', href: `${base}/assistant` });
  } else {
    items.push({ id: 'monitor', label: 'Suivi', href: `${base}/suivi` });
  }
  if (election.status === STATUS.CLOSED) {
    items.push({ id: 'results', label: 'Résultats', href: `${base}/resultats` });
    if (config.features.minutes) items.push({ id: 'minutes', label: 'Procès-verbal', href: `${base}/pv` });
  }
  items.push({ id: 'electorate', label: 'Électeurs', href: `${base}/electeurs`, count: stats.registeredVoters });
  if (config.features.proxies && election.proxiesEnabled) {
    items.push({
      id: 'proxies', label: 'Pouvoirs', href: `${base}/pouvoirs`,
      count: election.proxies.filter((p) => p.status === 'valid').length,
    });
  }
  if (config.features.candidacies && election.candidacies.length) {
    items.push({ id: 'candidacies', label: 'Candidatures', href: `${base}/candidatures`, count: election.candidacies.length });
  }
  if (election.status === STATUS.OPEN) {
    items.push({ id: 'polling', label: 'Salle de vote', href: `${base}/urne` });
  }
  if (config.features.audit) {
    items.push({ id: 'audit', label: 'Journal', href: `${base}/journal`, count: election.audit.length });
  }

  return html`<nav class="segmented no-print" aria-label="Sections du scrutin" style="margin-bottom:var(--s-5);display:flex">
    ${items.map((item) => html`<a class="segmented__btn" href="${item.href}"
      aria-pressed="${item.id === active ? 'true' : 'false'}"
      ${raw(item.id === active ? 'aria-current="page"' : '')}>${item.label}${
  item.count !== undefined ? html` <span class="dim nums">${item.count}</span>` : ''}</a>`)}
  </nav>`;
}

/** Sous-titre : ce qu'il faut savoir du scrutin en une ligne. */
export function electionSummary(election) {
  const method = METHODS[election.method];
  const parts = [method.label];
  if (method.pick === 'many' && method.id !== 'approval') parts.push(`${election.seats} sièges`);
  parts.push(election.secret ? 'scrutin secret' : 'vote nominatif');

  if (election.status === STATUS.OPEN && election.closesAt) {
    parts.push(`clôture ${formatRelative(election.closesAt)} (${formatDate(election.closesAt, 'datetime')})`);
  } else if (election.status === STATUS.CLOSED && election.seal) {
    parts.push(`clos le ${formatDate(election.seal.at, 'datetime')}`);
  } else if (election.status === STATUS.DRAFT) {
    parts.push('brouillon, modifiable');
  }
  return parts.join(' · ');
}

/** En-tête commun : référence, statut, titre, résumé. */
export function electionHeader(election, { actions = '' } = {}) {
  return html`
    <a class="back-link" href="#/scrutins">${raw(icon('chevronLeft'))} Tous les scrutins</a>
    <header class="page-head">
      <div class="page-head__text">
        <div class="row row--tight" style="margin-bottom:var(--s-2)">
          ${statusBadge(election.status)}
          <span class="mono dim">${election.ref}</span>
        </div>
        <h1 id="view-title" tabindex="-1">${election.title || 'Scrutin sans intitulé'}</h1>
        <p>${electionSummary(election)}</p>
      </div>
      ${actions ? html`<div class="page-head__actions no-print">${actions}</div>` : ''}
    </header>`;
}

/** Écran affiché quand l'identifiant de scrutin ne correspond à rien. */
export function missingElection() {
  return html`<div class="view">${emptyState({
    iconName: 'search',
    title: 'Ce scrutin est introuvable',
    body: "Il a peut-être été supprimé, ou le lien provient d'une autre instance de Quorum. Les données restent locales à chaque navigateur.",
    actions: btn({ label: 'Revenir aux scrutins', href: '#/scrutins', variant: 'primary' }),
  })}</div>`;
}

/** Bandeau « urne scellée » — la même phrase partout où elle s'applique. */
export function sealBanner(election) {
  if (election.status === STATUS.OPEN) {
    return banner({
      tone: 'seal',
      title: 'Urne scellée jusqu’à la clôture.',
      body: html`Aucun résultat partiel n'est calculable — ni par vous, ni par les scrutateurs.
        Le décompte ne s'exécute qu'une fois le scrutin clos, ce qui interdit toute annonce prématurée.
        <span class="mono" style="display:block;margin-top:var(--s-2);opacity:.75">urne · ${formatNumber(election.ballots.length)} bulletins déposés</span>`,
    });
  }
  if (election.status === STATUS.CLOSED && election.seal) {
    return banner({
      tone: 'seal',
      body: html`Urne scellée le ${formatDate(election.seal.at, 'seconds')}. Plus aucun bulletin ne peut être
        ajouté, retiré ni modifié — le décompte est définitif.
        <span class="mono" style="display:block;margin-top:var(--s-2);opacity:.75">empreinte ${election.seal.fingerprint}</span>`,
    });
  }
  return '';
}

/** Bandeau affiché lorsqu'un rôle n'a pas accès à l'écran demandé. */
export function forbidden(role, capability) {
  return html`<div class="view">${banner({
    tone: 'warn',
    title: 'Accès refusé pour ce rôle.',
    body: html`La capacité « ${capability} » n'est pas accordée au rôle endossé.
      Changez de rôle depuis le bandeau supérieur, ou consultez
      <a href="#/roles">la matrice des habilitations</a>.`,
  })}</div>`;
}

export function requires(ctx, capability) {
  return can(ctx.ui.role, capability);
}
