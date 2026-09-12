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
import { t } from '../core/i18n.js';
import { STATUS, METHODS } from '../domain/schema.js';
import { participationStats } from '../domain/tally.js';
import { evaluateQuorum } from '../domain/quorum.js';
import { setUi } from '../app.js';

const filters = () => [
  { id: 'all', label: t('filter.all', 'Tous') },
  { id: STATUS.DRAFT, label: t('status.draft', 'Brouillon') },
  { id: STATUS.OPEN, label: t('status.open', 'En cours') },
  { id: STATUS.CLOSED, label: t('status.closed', 'Clos') },
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
    method.pick === 'many' && method.id !== 'approval'
      ? t('dashboard.seats', '{n} sièges', { n: election.seats }) : null,
    election.status === STATUS.OPEN && election.closesAt
      ? t('dashboard.closesIn', 'clôture {when}', { when: formatRelative(election.closesAt) })
      : election.status === STATUS.CLOSED && election.seal
        ? t('dashboard.closedOn', 'clos le {date}', { date: formatDate(election.seal.at, 'short') })
        : election.status === STATUS.DRAFT ? t('dashboard.neverOpened', 'jamais ouvert') : null,
  ].filter(Boolean).join(' · ');

  const quorumChip = !quorum.enabled
    ? badge(t('quorum.none', 'sans quorum'), 'neutral')
    : quorum.met
      ? badge(t('quorum.met', 'quorum atteint'), 'ok')
      : election.status === STATUS.CLOSED
        ? badge(t('quorum.missed', 'quorum manqué'), 'danger')
        : badge(t('quorum.remaining', '{n} voix du quorum', {
          n: formatNumber(quorum.required - quorum.reached),
        }), 'warn');

  return html`<a class="card-link" href="${electionHref(election)}">
    <div class="card-link__body">
      <div class="row row--tight" style="margin-bottom:var(--s-2)">
        ${statusBadge(election.status)}
        <span class="mono dim" style="font-size:var(--text-xs)">${election.ref}</span>
      </div>
      <div style="font-size:var(--text-lg);font-weight:600;line-height:1.3;margin-bottom:var(--s-1)">
        ${election.title || t('election.untitled', 'Scrutin sans intitulé')}</div>
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
        ${pageHead({
    title: t('dashboard.title', 'Scrutins'),
    lead: t('dashboard.emptyLead', '{app} conserve vos scrutins dans ce navigateur, et nulle part ailleurs.', { app: config.app.name }),
  })}
        ${emptyState({
    title: t('dashboard.empty.title', 'Aucun scrutin pour l’instant'),
    body: t('dashboard.empty.body', "Créez votre premier scrutin, ou partez d'un modèle prêt à l'emploi : assemblée générale annuelle, élection du bureau, conseil de classe."),
    actions: html`${btn({ label: t('dashboard.create', 'Créer un scrutin'), href: '#/scrutins/nouveau', variant: 'primary', iconName: 'plus' })}
      ${btn({ label: t('dashboard.fromTemplate', 'Partir d’un modèle'), href: '#/modeles' })}`,
  })}
      </div>`;
    }

    return html`<div class="view">
      ${pageHead({
    title: t('dashboard.title', 'Scrutins'),
    lead: config.organization.name
      ? t('dashboard.leadOrg', '{org} — {n} scrutin(s) enregistré(s).', {
        org: config.organization.name, n: formatNumber(elections.length),
      })
      : t('dashboard.lead', '{n} scrutin(s) enregistré(s).', { n: formatNumber(elections.length) }),
    actions: btn({
      label: t('nav.new', 'Nouveau scrutin'), href: '#/scrutins/nouveau',
      variant: 'primary', iconName: 'plus',
    }),
  })}

      ${open.length ? statGrid([
    { value: formatNumber(open.length), label: t('dashboard.stat.open', 'scrutins ouverts') },
    {
      value: formatNumber(totalVoters),
      label: t('dashboard.stat.voters', 'votants enregistrés'),
      hint: t('dashboard.stat.outOf', 'sur {n} inscrits', { n: formatNumber(totalRegistered) }),
    },
    {
      value: formatPercent(totalRegistered ? totalVoters / totalRegistered : 0),
      label: t('dashboard.stat.turnout', 'participation moyenne'),
      hint: t('dashboard.stat.turnoutHint', 'scrutins ouverts uniquement'),
    },
    {
      value: formatNumber(elections.filter((e) => e.status === STATUS.CLOSED).length),
      label: t('dashboard.stat.closed', 'scrutins clos'),
      hint: t('dashboard.stat.closedHint', 'décomptes définitifs'),
    },
  ]) : ''}

      <div style="margin:var(--s-5) 0">
        ${segmented({ items: filters(), value: filter, act: 'setFilter', label: t('common.filter', 'Filtrer') })}
      </div>

      ${visible.length
    ? html`<div class="stack">${visible.map(electionCard)}</div>`
    : html`<div class="empty"><p style="margin:0">${t('dashboard.emptyCategory', 'Aucun scrutin dans cette catégorie.')}</p></div>`}
    </div>`;
  },

  actions: {
    setFilter(ctx, { data }) {
      setUi({ filter: data.value });
      ctx.go(data.value === 'all' ? '/scrutins' : `/scrutins?filtre=${data.value}`, { replace: true });
    },
  },
};
