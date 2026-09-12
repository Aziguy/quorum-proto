/**
 * proxies.js — pouvoirs (procurations).
 *
 * Le plafond statutaire est la seule règle du domaine qui produise un refus
 * *visible* : un dépôt au-delà du plafond est enregistré comme refusé, pas
 * effacé. Une procuration refusée est un fait de la vie de l'assemblée.
 */

import { html } from '../core/dom.js';
import {
  btn, card, banner, table, statGrid, field, searchInput, pagination, noResults,
} from '../ui/components.js';
import { search as searchItems, paginate } from '../core/collection.js';
import { formatNumber, formatDate } from '../core/format.js';
import { STATUS } from '../domain/schema.js';
import { registerProxy, revokeProxy, proxiesHeldBy } from '../domain/election.js';
import { can } from '../domain/permissions.js';
import { getElection, applyOperation, listState } from '../app.js';
import { toast, confirmDialog } from '../ui/feedback.js';
import { electionHeader, electionTabs, missingElection } from './_shared.js';

const LIST = 'proxies';

const PROXY_ERRORS = {
  'limit-reached': 'plafond atteint',
  'already-given': 'le mandant a déjà donné pouvoir',
  'already-voted': 'le mandant a déjà voté',
  'self-proxy': 'un membre ne peut se donner pouvoir à lui-même',
  'not-found': 'personne introuvable',
};

export default {
  id: 'proxies',

  render(ctx) {
    const election = getElection(ctx.params.id);
    if (!election) return missingElection();

    if (!election.proxiesEnabled) {
      return html`<div class="view">
        ${electionHeader(election)}
        ${electionTabs(election, ctx.config, 'proxies')}
        ${banner({
    tone: 'neutral',
    title: 'Les pouvoirs ne sont pas autorisés sur ce scrutin.',
    body: 'Cette règle se change à l’étape « Corps électoral » de l’assistant, tant que le scrutin est un brouillon.',
  })}
      </div>`;
    }

    const byId = new Map(election.electorate.map((v) => [v.id, v]));
    const list = listState(LIST);
    const valid = election.proxies.filter((p) => p.status === 'valid');
    const rejected = election.proxies.filter((p) => p.status === 'rejected');
    const mandataries = new Set(valid.map((p) => p.toId));
    const editable = election.status !== STATUS.CLOSED && can(ctx.ui.role, 'proxies.manage');

    // Ne peuvent donner pouvoir que ceux qui n'ont ni voté ni déjà mandaté.
    const eligible = election.electorate.filter((voter) => (
      !election.roster.some((r) => r.voterId === voter.id)
      && !valid.some((p) => p.fromId === voter.id)
    ));
    const holders = election.electorate.filter((voter) => (
      proxiesHeldBy(election, voter.id).length < election.proxyLimit
    ));

    const name = (id) => byId.get(id)?.name || '';
    const foundProxies = searchItems([...election.proxies].reverse(), list.q, [
      (p) => name(p.fromId), (p) => name(p.toId), (p) => p.status,
    ]);
    const proxyPage = paginate(foundProxies, list);

    return html`<div class="view">
      ${electionHeader(election)}
      ${electionTabs(election, ctx.config, 'proxies')}

      ${banner({
    tone: 'neutral',
    body: html`Un membre empêché confie sa voix à un autre. Vos statuts plafonnent à
      <strong>${election.proxyLimit} pouvoir(s)</strong> par mandataire ; au-delà, l'application
      refuse le dépôt et l'inscrit au journal d'audit.`,
  })}

      <div style="margin:var(--s-5) 0">
        ${statGrid([
    { value: formatNumber(valid.length), label: 'pouvoirs valides' },
    { value: formatNumber(mandataries.size), label: 'mandataires concernés' },
    { value: formatNumber(rejected.length), label: 'dépôts refusés', hint: 'plafond atteint' },
    { value: formatNumber(eligible.length), label: 'peuvent encore mandater' },
  ])}
      </div>

      ${editable ? card({
    title: 'Enregistrer un pouvoir reçu',
    hint: 'Formulaire papier, courrier ou dépôt en séance : le pouvoir est saisi ici par l’organisateur.',
    body: html`<form data-act="registerProxy">
          <div class="grid grid--2">
            ${field({
    label: 'Mandant — celui qui donne sa voix', name: 'from', act: 'noop',
    options: [{ value: '', label: 'Choisir…' }, ...eligible.map((v) => ({ value: v.id, label: v.name }))],
    hint: `${formatNumber(eligible.length)} personnes éligibles.`,
  })}
            ${field({
    label: 'Mandataire — celui qui portera la voix', name: 'to', act: 'noop',
    options: [{ value: '', label: 'Choisir…' }, ...holders.map((v) => ({
      value: v.id,
      label: `${v.name} (${proxiesHeldBy(election, v.id).length}/${election.proxyLimit})`,
    }))],
    hint: 'Seuls les membres sous le plafond sont proposés.',
  })}
          </div>
          ${btn({ label: 'Enregistrer le pouvoir', type: 'submit', variant: 'primary' })}
        </form>`,
  }) : ''}

      <div style="margin-top:var(--s-5)">
        ${card({
    title: 'Pouvoirs enregistrés',
    body: election.proxies.length ? html`
      <div class="list-toolbar">
        ${searchInput({
    list: LIST, value: list.q,
    placeholder: 'Rechercher un mandant ou un mandataire…',
    label: 'Rechercher un pouvoir', width: '22rem',
  })}
      </div>
      ${proxyPage.total ? html`${table({
      head: ['Mandant', 'Mandataire', 'Déposé le', 'État', ''],
      caption: 'Liste des pouvoirs',
      rows: proxyPage.items.map((proxy) => [
        byId.get(proxy.fromId)?.name || '—',
        html`${byId.get(proxy.toId)?.name || '—'}
            <span class="dim nums">(${proxiesHeldBy(election, proxy.toId).length}/${election.proxyLimit})</span>`,
        formatDate(proxy.createdAt, 'datetime'),
        proxy.status === 'valid'
          ? html`<span class="badge badge--ok">valide</span>`
          : proxy.status === 'rejected'
            ? html`<span class="badge badge--danger">refusé — plafond</span>`
            : html`<span class="badge badge--neutral">révoqué</span>`,
        proxy.status === 'valid' && editable
          ? btn({ label: 'Révoquer', act: 'revoke', data: { id: proxy.id }, variant: 'ghost', size: 'sm' })
          : '',
      ]),
    })}
        ${pagination({ list: LIST, ...proxyPage, noun: 'pouvoirs', nounOne: 'pouvoir' })}`
    : noResults({ list: LIST, query: list.q, noun: 'pouvoir' })}`
      : html`<p class="muted">Aucun pouvoir enregistré.</p>`,
  })}
      </div>
    </div>`;
  },

  actions: {
    noop() {},

    async registerProxy(ctx, { el }) {
      const data = new FormData(el);
      const from = data.get('from');
      const to = data.get('to');
      if (!from || !to) { toast('Sélectionnez un mandant et un mandataire.', 'danger'); return; }

      const result = await applyOperation(ctx.params.id, (election) => registerProxy(
        election, from, to, ctx.config.session.actor || 'Organisateur',
      ));
      if (!result.ok) {
        toast(`Dépôt refusé : ${PROXY_ERRORS[result.error] || result.error}.`, 'danger');
        return;
      }
      toast('Pouvoir enregistré.', 'ok');
    },

    async revoke(ctx, { data }) {
      const ok = await confirmDialog({
        title: 'Révoquer ce pouvoir ?',
        text: 'Le mandant retrouvera sa voix et pourra voter lui-même. La révocation est journalisée.',
        confirmLabel: 'Révoquer', danger: true,
      });
      if (!ok) return;
      await applyOperation(ctx.params.id, (election) => revokeProxy(
        election, data.id, ctx.config.session.actor || 'Organisateur',
      ));
      toast('Pouvoir révoqué.', 'ok');
    },
  },
};
