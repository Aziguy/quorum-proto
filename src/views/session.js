/**
 * session.js — écran projeté en séance.
 *
 * Conçu pour être lu du fond d'une salle : peu d'éléments, très gros chiffres,
 * fort contraste. Aucun résultat n'y apparaît tant que le scrutin est ouvert —
 * une projection est le pire endroit pour laisser fuiter une tendance.
 */

import { html, raw } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import { btn, meter } from '../ui/components.js';
import { formatNumber, formatPercent, formatDate, formatRelative } from '../core/format.js';
import { STATUS, OPTION_KIND } from '../domain/schema.js';
import { participationStats, tally } from '../domain/tally.js';
import { evaluateQuorum } from '../domain/quorum.js';
import { getElection, store } from '../app.js';

let ticker = null;

export default {
  id: 'session',
  layout: 'bare',

  render(ctx) {
    const election = getElection(ctx.params.id);
    if (!election) {
      return html`<div class="session"><div class="session__stage">
        <h1 id="view-title" tabindex="-1">Scrutin introuvable</h1>
        <p><a href="#/scrutins" style="color:inherit">Revenir à la liste</a></p>
      </div></div>`;
    }

    const stats = participationStats(election);
    const quorum = evaluateQuorum(election, stats);
    const result = tally(election);
    const siblings = ctx.elections.filter((e) => e.status !== STATUS.DRAFT);
    const index = siblings.findIndex((e) => e.id === election.id);

    return html`<div class="session">
      <div class="session__bar no-print">
        <span>${raw(icon('external', { size: 14 }))} Mode séance · écran projeté</span>
        <span class="grow"></span>
        ${index > 0 ? btn({
    label: 'Précédent', href: `#/scrutins/${siblings[index - 1].id}/seance`,
    variant: 'ghost', size: 'sm', iconName: 'chevronLeft',
  }) : ''}
        <span class="dim">Scrutin ${index + 1} sur ${siblings.length}</span>
        ${index < siblings.length - 1 ? btn({
    label: 'Suivant', href: `#/scrutins/${siblings[index + 1].id}/seance`,
    variant: 'ghost', size: 'sm', iconName: 'chevronRight', iconAfter: true,
  }) : ''}
        ${btn({ label: 'Quitter', href: `#/scrutins/${election.id}/suivi`, variant: 'ghost', size: 'sm' })}
      </div>

      <div class="session__stage">
        <div class="row row--tight" style="margin-bottom:var(--s-4);opacity:.72;font-size:var(--text-sm)">
          <span>${election.ref}</span><span>·</span>
          <span>${ctx.config.organization.name || ctx.config.app.tagline}</span><span>·</span>
          <span>${election.status === STATUS.OPEN ? 'vote en cours' : 'scrutin clos'}</span>
        </div>

        <h1 class="session__title" id="view-title" tabindex="-1">${election.title}</h1>

        ${election.status === STATUS.OPEN ? html`
          <div class="grid grid--2" style="gap:var(--s-7);margin-top:var(--s-7)">
            <div>
              <p style="opacity:.72;margin-bottom:var(--s-2)">Bulletins déposés</p>
              <p class="session__count">${formatNumber(stats.representedVoters)}
                <span style="font-size:.3em;opacity:.6">/ ${formatNumber(stats.registeredVoters)}</span></p>
              <div style="margin-top:var(--s-5)">
                ${meter({ value: stats.representedVoters, total: stats.registeredVoters, large: true, tone: quorum.met ? 'ok' : '' })}
              </div>
              <p style="margin-top:var(--s-3);opacity:.8">
                ${quorum.enabled
    ? (quorum.met
      ? `Quorum atteint — ${formatNumber(quorum.required)} votants requis`
      : `Quorum : il manque ${formatNumber(quorum.required - quorum.reached)} votants`)
    : 'Aucun quorum exigé'}
                · ${formatPercent(stats.ratio)} de participation
              </p>
            </div>

            <div class="card">
              <p style="font-weight:600;margin-bottom:var(--s-3)">Voter depuis la salle</p>
              <p style="opacity:.8;font-size:var(--text-sm);margin-bottom:var(--s-3)">
                Ouvrez la page de vote, puis saisissez le code personnel reçu.</p>
              <p class="mono" style="font-size:var(--text-lg);word-break:break-all">
                ${window.location.origin}${window.location.pathname}#/vote</p>
              <p style="margin-top:var(--s-4);opacity:.7;font-size:var(--text-sm)">
                ${election.closesAt ? `Clôture ${formatRelative(election.closesAt)}.` : ''}
                Aucun résultat n'est affiché tant que le scrutin est ouvert.</p>
            </div>
          </div>
        ` : result.disclosed ? html`
          <div style="margin-top:var(--s-7)">
            <p style="font-size:var(--text-xl);font-weight:600;margin-bottom:var(--s-5)">
              ${raw(icon('check', { size: 22 }))}
              ${result.outcome === 'adopted' ? 'Résolution adoptée'
    : result.outcome === 'rejected' ? 'Résolution rejetée'
      : result.outcome === 'elected' ? `Élu(s) : ${result.entries.filter((e) => e.elected).map((e) => e.label).join(', ')}`
        : result.outcome === 'tie' ? 'Égalité — départage nécessaire' : 'Décompte'}
            </p>
            <div class="stack" style="--gap:var(--s-5)">
              ${result.entries.map((entry) => html`<div>
                <div class="row" style="justify-content:space-between;margin-bottom:var(--s-2)">
                  <span style="font-size:var(--text-xl);font-weight:600">${entry.label}</span>
                  <span class="nums" style="font-size:var(--text-2xl);font-weight:600">${formatNumber(entry.votes)}</span>
                </div>
                ${meter({
    value: entry.kind === OPTION_KIND.ABSTAIN ? 0 : entry.share * 100,
    total: 100, large: true,
    tone: entry.kind === OPTION_KIND.AGAINST ? 'danger' : entry.elected || entry.kind === OPTION_KIND.FOR ? 'ok' : 'neutral',
  })}
              </div>`)}
            </div>
            <p style="margin-top:var(--s-6);opacity:.75">
              ${formatNumber(result.expressed)} suffrages exprimés
              ${result.majority ? `· majorité requise ${formatNumber(result.majority.required)} voix` : ''}
              ${result.abstain ? `· ${formatNumber(result.abstain)} abstentions non comptées` : ''}</p>
          </div>
        ` : html`
          <div style="margin-top:var(--s-7);max-width:46rem">
            <p style="font-size:var(--text-xl);font-weight:600;margin-bottom:var(--s-3)">
              Délibération non valable — quorum non atteint</p>
            <p style="opacity:.8">${formatNumber(quorum.reached)} votants sur ${formatNumber(quorum.total)}
              inscrits, pour ${formatNumber(quorum.required)} requis. Les bulletins restent scellés et ne
              seront pas dépouillés.</p>
          </div>
        `}
      </div>
    </div>`;
  },

  /** Rafraîchissement lent : en séance, l'écran doit vivre sans qu'on y touche. */
  mounted() {
    clearInterval(ticker);
    ticker = setInterval(() => {
      if (window.location.hash.includes('/seance')) store.refresh();
      else clearInterval(ticker);
    }, 5000);
  },
};
