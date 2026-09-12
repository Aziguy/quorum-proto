/**
 * polling-station.js — « salle de vote ».
 *
 * En production, chaque accès part par e-mail et l'organisateur ne le voit
 * jamais. Ici, le prototype n'envoie rien : les accès sont donc listés pour que
 * la chaîne complète — lien, bulletin, dépôt, reçu — soit réellement praticable.
 * C'est la seule concession à l'absence de serveur, et l'écran le dit lui-même.
 */

import { html } from '../core/dom.js';
import { btn, card, banner, table, statGrid, segmented } from '../ui/components.js';
import { formatNumber, formatDate } from '../core/format.js';
import { STATUS } from '../domain/schema.js';
import { pendingVoters, proxiesHeldBy } from '../domain/election.js';
import { getElection, setUi } from '../app.js';
import { toast } from '../ui/feedback.js';
import { download } from '../core/storage.js';
import { toCsv } from '../core/csv.js';
import { electionHeader, electionTabs, missingElection } from './_shared.js';

const FILTERS = [
  { id: 'pending', label: 'N’ont pas voté' },
  { id: 'voted', label: 'Ont voté' },
  { id: 'code', label: 'Sans e-mail' },
  { id: 'all', label: 'Tous' },
];

function accessRow(election, voter) {
  const proxies = proxiesHeldBy(election, voter.id).length;
  const code = voter.accessCode || voter.token;
  return [
    html`<span class="table__main">${voter.name}</span>
      ${proxies ? html` <span class="badge badge--brand">+${proxies} pouvoir(s)</span>` : ''}
      <span class="table__sub" style="display:block">${voter.email || 'sans adresse e-mail'}</span>`,
    voter.channel === 'code' ? 'code imprimé' : 'e-mail',
    voter.tokenUsed
      ? html`<span class="dim">détruit</span>`
      : html`<span class="mono" style="font-size:var(--text-xs)">${code}</span>`,
    voter.tokenUsed
      ? html`<span class="badge badge--ok">a voté</span>`
      : html`<span class="badge badge--neutral">en attente</span>`,
    voter.tokenUsed ? '' : btn({
      label: 'Ouvrir le bulletin', size: 'sm',
      href: `#/vote/${election.id}/${code}`,
    }),
  ];
}

export default {
  id: 'polling-station',

  render(ctx) {
    const election = getElection(ctx.params.id);
    if (!election) return missingElection();

    if (election.status !== STATUS.OPEN) {
      return html`<div class="view">
        ${electionHeader(election)}
        ${electionTabs(election, ctx.config, 'polling')}
        ${banner({
    tone: 'neutral',
    title: 'La salle de vote est fermée.',
    body: 'Les accès ne sont générés qu’à l’ouverture du scrutin, et détruits au dépôt de chaque bulletin.',
  })}
      </div>`;
    }

    const filter = ctx.ui.pollingFilter || 'pending';
    const voters = election.electorate.filter((voter) => {
      if (filter === 'pending') return !voter.tokenUsed;
      if (filter === 'voted') return voter.tokenUsed;
      if (filter === 'code') return !voter.email;
      return true;
    });
    const withoutEmail = election.electorate.filter((v) => !v.email);

    return html`<div class="view">
      ${electionHeader(election, {
    actions: html`
        ${btn({ label: 'Exporter les accès', act: 'exportAccess', iconName: 'download' })}
        ${withoutEmail.length
    ? btn({ label: `Imprimer ${withoutEmail.length} codes`, act: 'printCodes', iconName: 'printer' })
    : ''}`,
  })}
      ${electionTabs(election, ctx.config, 'polling')}

      ${banner({
    tone: 'warn',
    title: 'Écran propre au prototype.',
    body: html`Une instance reliée à un serveur de messagerie enverrait ces liens sans jamais les
      afficher : un organisateur capable de lire le lien d'un électeur pourrait voter à sa place.
      Cette liste existe pour que vous puissiez <strong>réellement</strong> parcourir le vote
      de bout en bout.`,
  })}

      <div style="margin:var(--s-5) 0">
        ${statGrid([
    { value: formatNumber(election.electorate.length), label: 'accès distribués' },
    { value: formatNumber(election.roster.length), label: 'accès consommés', hint: 'jeton détruit au dépôt' },
    { value: formatNumber(pendingVoters(election).length), label: 'accès encore valides' },
    { value: formatNumber(withoutEmail.length), label: 'codes à remettre', hint: 'électeurs sans e-mail' },
  ])}
      </div>

      <div style="margin-bottom:var(--s-4)">
        ${segmented({ items: FILTERS, value: filter, act: 'setPollingFilter', label: 'Filtrer' })}
      </div>

      ${card({
    body: voters.length
      ? table({
        head: ['Électeur', 'Canal', 'Accès', 'État', ''],
        caption: 'Accès au bulletin',
        rows: voters.slice(0, 60).map((voter) => accessRow(election, voter)),
      })
      : html`<p class="muted">Aucun électeur dans cette catégorie.</p>`,
  })}

      ${voters.length > 60 ? html`<p class="field__hint">${formatNumber(voters.length - 60)} électeurs
        supplémentaires non affichés. Utilisez l'export pour la liste complète.</p>` : ''}
    </div>`;
  },

  actions: {
    setPollingFilter: (ctx, { data }) => setUi({ pollingFilter: data.value }),

    exportAccess(ctx) {
      const election = getElection(ctx.params.id);
      const base = `${window.location.origin}${window.location.pathname}`;
      const rows = [
        ['Nom', 'E-mail', 'Canal', 'Code d’accès', 'A voté', 'Lien'],
        ...election.electorate.map((voter) => [
          voter.name,
          voter.email,
          voter.channel === 'code' ? 'code imprimé' : 'e-mail',
          voter.accessCode || voter.token || '',
          voter.tokenUsed ? 'oui' : 'non',
          voter.tokenUsed ? '' : `${base}#/vote/${election.id}/${voter.accessCode || voter.token}`,
        ]),
      ];
      download(`${election.ref}-acces.csv`, toCsv(rows), 'text/csv');
      toast('Accès exportés. Ce fichier est sensible : il permet de voter.', 'ok');
    },

    /** Feuille de codes à découper, pour les électeurs sans adresse e-mail. */
    printCodes(ctx) {
      const election = getElection(ctx.params.id);
      const targets = election.electorate.filter((v) => !v.email && !v.tokenUsed);
      if (!targets.length) { toast('Aucun code en attente de remise.'); return; }

      const win = window.open('', '_blank');
      if (!win) { toast('Le navigateur a bloqué la fenêtre d’impression.', 'danger'); return; }

      const cards = targets.map((voter) => `<div class="c">
        <strong>${voter.name}</strong>
        <div class="k">${voter.accessCode || voter.token}</div>
        <div class="n">À saisir sur la page de vote. Code personnel, à usage unique.</div>
      </div>`).join('');

      win.document.write([
        '<!doctype html><meta charset="utf-8">',
        `<title>Codes d'accès — ${election.ref}</title>`,
        '<style>body{font:14px/1.5 system-ui,sans-serif;margin:2rem;color:#111}',
        '.c{border:1px solid #bbb;border-radius:8px;padding:1rem;margin-bottom:.75rem;page-break-inside:avoid}',
        '.k{font:600 22px ui-monospace,monospace;letter-spacing:.12em;margin:.4rem 0}',
        '.n{font-size:12px;color:#555}h1{font-size:18px;margin-bottom:.25rem}</style>',
        `<h1>${election.title}</h1>`,
        `<p class="n">Codes d'accès à remettre en main propre · ${formatDate(new Date(), 'full')}</p>`,
        cards,
      ].join(''));
      win.document.close();
      win.focus();
      win.print();
    },
  },
};
