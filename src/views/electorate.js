/**
 * electorate.js — corps électoral d'un scrutin.
 *
 * Le corps électoral est *copié* dans le scrutin, pas référencé : il est figé à
 * l'ouverture, de sorte qu'une mise à jour de l'annuaire ne réécrive jamais
 * l'histoire d'un scrutin passé.
 */

import { html } from '../core/dom.js';
import { btn, banner, table, statGrid, segmented } from '../ui/components.js';
import { formatNumber, formatDate, initials } from '../core/format.js';
import { STATUS, makeVoter } from '../domain/schema.js';
import { removeVoter, addVoters, proxiesHeldBy } from '../domain/election.js';
import { participationStats } from '../domain/tally.js';
import { can } from '../domain/permissions.js';
import { getElection, applyOperation, setUi } from '../app.js';
import { toast, confirmDialog, promptDialog } from '../ui/feedback.js';
import { download, pickFile } from '../core/storage.js';
import { toCsv, parseTable } from '../core/csv.js';
import { electionHeader, electionTabs, missingElection } from './_shared.js';

const FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'voted', label: 'Ont voté' },
  { id: 'pending', label: 'N’ont pas voté' },
  { id: 'nomail', label: 'Sans e-mail' },
  { id: 'proxy', label: 'Mandataires' },
];

function voterRow(election, voter, editable) {
  const proxies = proxiesHeldBy(election, voter.id).length;
  const signed = election.roster.find((r) => r.voterId === voter.id);
  return [
    html`<span class="row row--tight">
      <span class="brand__mark" style="background:var(--surface-3);color:var(--text-2);font-family:var(--font-sans);font-size:var(--text-2xs)">${initials(voter.name)}</span>
      <span>
        <span class="table__main">${voter.name}</span>
        <span class="table__sub" style="display:block">${voter.email || voter.phone || 'aucun contact'}</span>
      </span>
    </span>`,
    voter.college || html`<span class="dim">—</span>`,
    html`<span class="nums">${formatNumber(voter.weight)}</span>${
  proxies ? html` <span class="badge badge--brand">+${proxies}</span>` : ''}`,
    voter.email
      ? html`<span class="badge badge--neutral">e-mail</span>`
      : html`<span class="badge badge--warn">code à remettre</span>`,
    signed
      ? html`<span class="badge badge--ok">a voté</span>
        <span class="table__sub" style="display:block">${formatDate(signed.at, 'datetime')}</span>`
      : html`<span class="dim">en attente</span>`,
    editable ? btn({
      label: 'Retirer', act: 'removeVoter', data: { id: voter.id },
      variant: 'ghost', size: 'sm',
    }) : '',
  ];
}

export default {
  id: 'electorate',

  render(ctx) {
    const election = getElection(ctx.params.id);
    if (!election) return missingElection();

    const stats = participationStats(election);
    const editable = election.status === STATUS.DRAFT && can(ctx.ui.role, 'electorate.manage');
    const filter = ctx.ui.electorateFilter || 'all';
    const search = (ctx.ui.electorateSearch || '').toLowerCase();

    const voters = election.electorate.filter((voter) => {
      if (search && !`${voter.name} ${voter.email} ${voter.college}`.toLowerCase().includes(search)) return false;
      if (filter === 'voted') return voter.tokenUsed;
      if (filter === 'pending') return !voter.tokenUsed;
      if (filter === 'nomail') return !voter.email;
      if (filter === 'proxy') return proxiesHeldBy(election, voter.id).length > 0;
      return true;
    });

    const withoutEmail = election.electorate.filter((v) => !v.email).length;
    const colleges = new Set(election.electorate.map((v) => v.college).filter(Boolean));

    return html`<div class="view">
      ${electionHeader(election, {
    actions: html`
        ${editable ? btn({ label: 'Importer', act: 'import', iconName: 'upload' }) : ''}
        ${editable ? btn({ label: 'Ajouter', act: 'addVoter', iconName: 'plus' }) : ''}
        ${btn({ label: 'Exporter', act: 'export', iconName: 'download' })}`,
  })}
      ${electionTabs(election, ctx.config, 'electorate')}

      ${editable ? '' : banner({
    tone: 'seal',
    title: 'Corps électoral figé.',
    body: `Arrêté à l'ouverture du scrutin, le ${formatDate(election.opensAt, 'full')}. Toute modification serait inscrite au journal d'audit — et resterait visible de tous.`,
  })}

      <div style="margin:var(--s-5) 0">
        ${statGrid([
    { value: formatNumber(stats.registeredVoters), label: 'inscrits' },
    { value: formatNumber(stats.registeredWeight), label: ctx.config.vocabulary.unit, hint: election.weighted ? 'voix pondérées' : 'une voix par personne' },
    { value: formatNumber(colleges.size || 0), label: 'collèges', hint: election.colleges ? 'détail au dépouillement' : 'non utilisés' },
    { value: formatNumber(withoutEmail), label: 'sans e-mail', hint: 'code imprimable' },
  ])}
      </div>

      ${withoutEmail ? banner({
    tone: 'warn',
    title: `${formatNumber(withoutEmail)} personne(s) sans adresse e-mail.`,
    body: "Aucun cul-de-sac : un code d'accès imprimable est généré à l'ouverture, à remettre en main propre. Il ouvre exactement le même bulletin.",
    actions: election.status === STATUS.OPEN
      ? btn({ label: 'Imprimer les codes', href: `#/scrutins/${election.id}/urne`, size: 'sm' })
      : '',
  }) : ''}

      <div class="row" style="margin:var(--s-5) 0">
        <input class="input grow" type="search" placeholder="Rechercher un nom, une adresse, un collège…"
          value="${ctx.ui.electorateSearch || ''}" data-act="search" aria-label="Rechercher un électeur"
          style="max-width:22rem">
        ${segmented({ items: FILTERS, value: filter, act: 'setElectorateFilter', label: 'Filtrer' })}
      </div>

      ${voters.length ? html`
        ${table({
    head: ['Électeur', 'Collège', ctx.config.vocabulary.unit, 'Accès', 'Émargement', ''],
    caption: 'Corps électoral',
    rows: voters.slice(0, 80).map((voter) => voterRow(election, voter, editable)),
  })}
        ${voters.length > 80 ? html`<p class="field__hint">${formatNumber(voters.length - 80)} électeurs
          supplémentaires non affichés. Affinez la recherche ou exportez la liste.</p>` : ''}
      ` : html`<div class="empty"><p style="margin:0">Aucun électeur ne correspond.</p></div>`}

      <p class="field__hint" style="margin-top:var(--s-5)">
        Les adresses e-mail ne servent qu'à l'envoi des accès. Elles sont supprimées
        ${ctx.config.retention.contacts} jours après la clôture, sauf prolongation décidée dans
        <a href="#/donnees">Données &amp; RGPD</a>.
      </p>
    </div>`;
  },

  actions: {
    // La recherche ne re-rend pas le champ : elle filtre puis rafraîchit.
    search(ctx, { el }) {
      setUi({ electorateSearch: el.value });
      // Le champ est re-rendu avec sa valeur : on lui rend le focus et le curseur.
      queueMicrotask(() => {
        const field = document.querySelector('input[data-act="search"]');
        if (field) { field.focus(); field.setSelectionRange(field.value.length, field.value.length); }
      });
    },

    setElectorateFilter: (ctx, { data }) => setUi({ electorateFilter: data.value }),

    async import(ctx) {
      const picked = await pickFile('.csv,.txt,text/csv');
      if (!picked) return;
      const { records } = parseTable(picked.text);
      const voters = records.map((record) => {
        const name = (record.nomcomplet || `${record.prenom || ''} ${record.nom || ''}`).trim();
        if (!name) return null;
        return makeVoter({
          name,
          email: record.email || record.mail || record.courriel || '',
          phone: record.telephone || record.tel || '',
          college: record.college || record.categorie || record.classe || '',
          weight: Number(record.voix || record.parts || 1),
        });
      }).filter(Boolean);

      if (!voters.length) { toast('Aucune ligne exploitable : vérifiez la ligne d’en-tête.', 'danger'); return; }
      const result = await applyOperation(ctx.params.id, (election) => addVoters(
        election, voters, ctx.config.session.actor || 'Organisateur', { imported: true },
      ));
      toast(result.ok
        ? `${result.added} ajouté(s), ${result.merged} doublon(s) fusionné(s).`
        : 'Le corps électoral est figé.', result.ok ? 'ok' : 'danger');
    },

    async addVoter(ctx) {
      const name = await promptDialog({ title: 'Ajouter un électeur', label: 'Nom et prénom' });
      if (!name) return;
      const email = await promptDialog({
        title: `Contact de ${name}`,
        text: 'Laissez vide pour générer un code d’accès imprimable.',
        label: 'Adresse e-mail', confirmLabel: 'Ajouter',
      });
      const result = await applyOperation(ctx.params.id, (election) => addVoters(
        election, [makeVoter({ name, email: email || '' })], ctx.config.session.actor || 'Organisateur',
      ));
      toast(result.ok ? `${name} ajouté.` : 'Ajout impossible : le corps électoral est figé.', result.ok ? 'ok' : 'danger');
    },

    async removeVoter(ctx, { data }) {
      const election = getElection(ctx.params.id);
      const voter = election.electorate.find((v) => v.id === data.id);
      const ok = await confirmDialog({
        title: `Retirer ${voter.name} ?`,
        text: 'La fiche et les pouvoirs associés seront supprimés du scrutin. L’opération est inscrite au journal d’audit.',
        confirmLabel: 'Retirer', danger: true,
      });
      if (!ok) return;
      const result = await applyOperation(ctx.params.id, (current) => removeVoter(
        current, data.id, ctx.config.session.actor || 'Organisateur',
      ));
      toast(result.ok ? `${voter.name} retiré.` : 'Retrait impossible : le scrutin est ouvert.', result.ok ? 'ok' : 'danger');
    },

    export(ctx) {
      const election = getElection(ctx.params.id);
      const rows = [
        ['Nom', 'E-mail', 'Téléphone', 'Collège', 'Voix', 'A voté', 'Heure d’émargement'],
        ...election.electorate.map((voter) => {
          const signed = election.roster.find((r) => r.voterId === voter.id);
          return [
            voter.name, voter.email, voter.phone, voter.college, voter.weight,
            signed ? 'oui' : 'non', signed ? formatDate(signed.at, 'seconds') : '',
          ];
        }),
      ];
      download(`${election.ref}-corps-electoral.csv`, toCsv(rows), 'text/csv');
      toast('Corps électoral exporté.', 'ok');
    },
  },
};
