/**
 * dashboard.js — liste des scrutins.
 *
 * Écran d'accueil de l'organisateur. Chaque carte répond à trois questions
 * dans cet ordre : où en est ce scrutin, combien de gens ont voté, le quorum
 * est-il tenu. Le reste attend qu'on ouvre le scrutin.
 */

import { html, raw } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import {
  btn, statusBadge, segmented, emptyState, meter, pageHead, statGrid, badge,
} from '../ui/components.js';
import { formatNumber, formatPercent, formatRelative, formatDate } from '../core/format.js';
import { STATUS, METHODS } from '../domain/schema.js';
import { participationStats } from '../domain/tally.js';
import { evaluateQuorum } from '../domain/quorum.js';
import { setUi } from '../app.js';

const FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: STATUS.DRAFT, label: 'Brouillons' },
  { id: STATUS.OPEN, label: 'En cours' },
  { id: STATUS.CLOSED, label: 'Clos' },
];

/** Destination naturelle d'un scrutin selon son statut. */
export function electionHref(election) {
  if (election.status === STATUS.DRAFT) return `#/scrutins/${election.id}/assistant`;
  if (election.status === STATUS.OPEN) return `#/scrutins/${election.id}/suivi`;
  return `#/scrutins/${election.id}/resultats`;
}

function electionCard(election) {
  const stats = participationStats(election);
  const quorum = evaluateQuorum(election, stats);
  const method = METHODS[election.method];

  const meta = [
    method.label,
    method.pick === 'many' && method.id !== 'approval' ? `${election.seats} sièges` : null,
    election.status === STATUS.OPEN && election.closesAt
      ? `clôture ${formatRelative(election.closesAt)}`
      : election.status === STATUS.CLOSED && election.seal
        ? `clos le ${formatDate(election.seal.at, 'short')}`
        : election.status === STATUS.DRAFT ? 'jamais ouvert' : null,
  ].filter(Boolean).join(' · ');

  const quorumChip = !quorum.enabled
    ? badge('sans quorum', 'neutral')
    : quorum.met
      ? badge('quorum atteint', 'ok')
      : election.status === STATUS.CLOSED
        ? badge('quorum manqué', 'danger')
        : badge(`${formatNumber(quorum.required - quorum.reached)} voix du quorum`, 'warn');

  return html`<a class="card-link" href="${electionHref(election)}">
    <div class="card-link__body">
      <div class="row row--tight" style="margin-bottom:var(--s-2)">
        ${statusBadge(election.status)}
        <span class="mono dim" style="font-size:var(--text-xs)">${election.ref}</span>
      </div>
      <div style="font-size:var(--text-lg);font-weight:600;line-height:1.3;margin-bottom:var(--s-1)">
        ${election.title || 'Scrutin sans intitulé'}</div>
      <div class="dim" style="font-size:var(--text-sm)">${meta}</div>
    </div>

    <div class="card-link__meter">
      ${meter({
    value: stats.representedVoters,
    total: stats.registeredVoters,
    tone: quorum.met ? 'ok' : 'neutral',
    label: `Participation ${election.ref}`,
  })}
      <div class="dim nums" style="font-size:var(--text-xs);margin-top:var(--s-2)">
        ${formatNumber(stats.representedVoters)} / ${formatNumber(stats.registeredVoters)}
        · ${formatPercent(stats.ratio)}
      </div>
    </div>

    <div class="card-link__side">${quorumChip}</div>
    <span class="card-link__arrow">${raw(icon('arrowRight'))}</span>
  </a>`;
}

export default {
  id: 'dashboard',

  render(ctx) {
    const { elections, config } = ctx;
    const filter = ctx.query.filtre || ctx.ui.filter || 'all';
    const visible = filter === 'all' ? elections : elections.filter((e) => e.status === filter);

    const open = elections.filter((e) => e.status === STATUS.OPEN);
    const totalVoters = open.reduce((sum, e) => sum + participationStats(e).representedVoters, 0);
    const totalRegistered = open.reduce((sum, e) => sum + e.electorate.length, 0);

    if (!elections.length) {
      return html`<div class="view">
        ${pageHead({ title: 'Scrutins', lead: `${config.app.name} conserve vos scrutins dans ce navigateur, et nulle part ailleurs.` })}
        ${emptyState({
    title: 'Aucun scrutin pour l’instant',
    body: "Créez votre premier scrutin, ou partez d'un modèle prêt à l'emploi : assemblée générale annuelle, élection du bureau, conseil de classe.",
    actions: html`${btn({ label: 'Créer un scrutin', href: '#/scrutins/nouveau', variant: 'primary', iconName: 'plus' })}
      ${btn({ label: 'Partir d’un modèle', href: '#/modeles' })}`,
  })}
      </div>`;
    }

    return html`<div class="view">
      ${pageHead({
    title: 'Scrutins',
    lead: config.organization.name
      ? `${config.organization.name} — ${formatNumber(elections.length)} scrutin(s) enregistré(s).`
      : `${formatNumber(elections.length)} scrutin(s) enregistré(s).`,
    actions: btn({ label: 'Nouveau scrutin', href: '#/scrutins/nouveau', variant: 'primary', iconName: 'plus' }),
  })}

      ${open.length ? statGrid([
    { value: formatNumber(open.length), label: 'scrutins ouverts' },
    { value: formatNumber(totalVoters), label: 'votants enregistrés', hint: `sur ${formatNumber(totalRegistered)} inscrits` },
    {
      value: formatPercent(totalRegistered ? totalVoters / totalRegistered : 0),
      label: 'participation moyenne',
    },
    {
      value: formatNumber(elections.filter((e) => e.status === STATUS.CLOSED).length),
      label: 'scrutins clos', hint: 'décomptes définitifs',
    },
  ]) : ''}

      <div style="margin:var(--s-5) 0">
        ${segmented({ items: FILTERS, value: filter, act: 'setFilter', label: 'Filtrer' })}
      </div>

      ${visible.length
    ? html`<div class="stack">${visible.map(electionCard)}</div>`
    : html`<div class="empty"><p style="margin:0">Aucun scrutin dans cette catégorie.</p></div>`}
    </div>`;
  },

  actions: {
    setFilter(ctx, { data }) {
      setUi({ filter: data.value });
      ctx.go(data.value === 'all' ? '/scrutins' : `/scrutins?filtre=${data.value}`, { replace: true });
    },
  },
};
