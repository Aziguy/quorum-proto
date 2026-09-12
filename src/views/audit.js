/**
 * audit.js — journal d'audit, et vérification de sa chaîne.
 *
 * Le journal est en ajout seul et chaîné : chaque entrée porte l'empreinte de
 * la précédente. Le bouton « Vérifier la chaîne » recalcule l'intégralité des
 * empreintes et désigne, le cas échéant, la première entrée incohérente.
 */

import { html } from '../core/dom.js';
import {
  btn, card, banner, statGrid, searchInput, pagination, noResults, segmented,
} from '../ui/components.js';
import { search as searchItems, paginate } from '../core/collection.js';
import { formatNumber, formatDate } from '../core/format.js';
import { describe, severityOf, verifyChain } from '../domain/audit.js';
import { can } from '../domain/permissions.js';
import { getElection, setUi, listState } from '../app.js';
import { toast } from '../ui/feedback.js';
import { download } from '../core/storage.js';
import { toCsv } from '../core/csv.js';
import { electionHeader, electionTabs, missingElection, forbidden } from './_shared.js';

const LIST = 'audit';

/** Filtrer par gravité : sur un journal fourni, c'est le tri le plus utile. */
const SEVERITIES = [
  { id: 'all', label: 'Tous' },
  { id: 'critical', label: 'Critiques' },
  { id: 'notice', label: 'Notables' },
  { id: 'info', label: 'Courants' },
];

const SEVERITY_TONE = { info: 'var(--brand)', notice: 'var(--warn)', critical: 'var(--seal)' };

function entryRow(entry, index) {
  const severity = severityOf(entry);
  return html`<li style="display:flex;gap:var(--s-3);padding:var(--s-3) 0;border-bottom:1px solid var(--border)">
    <span class="nums dim" style="flex:0 0 10.5rem;font-size:var(--text-xs)">${formatDate(entry.at, 'seconds')}</span>
    <span style="flex:0 0 auto;margin-top:.45rem;width:8px;height:8px;border-radius:${severity === 'critical' ? '2px' : '999px'};background:${SEVERITY_TONE[severity]}"></span>
    <span class="grow">
      <span style="font-size:var(--text-sm)">${describe(entry)}</span>
      <span class="table__sub" style="display:block">${entry.actor}
        · <span class="mono">#${entry.seq}</span>
        · <span class="mono" title="Empreinte de cette entrée">${entry.hash.slice(0, 12)}…</span></span>
    </span>
  </li>`;
}

export default {
  id: 'audit',

  render(ctx) {
    const election = getElection(ctx.params.id);
    if (!election) return missingElection();
    if (!can(ctx.ui.role, 'audit.view')) return forbidden(ctx.ui.role, "Consulter le journal d'audit");

    const check = ctx.ui.chainCheck;
    const critical = election.audit.filter((e) => severityOf(e) === 'critical').length;
    const severity = ctx.ui.auditSeverity || 'all';
    // Un journal se parcourt par blocs plus larges qu'un tableau nominatif.
    const list = listState(LIST, { size: 50 });

    // Du plus récent au plus ancien : on consulte un journal pour savoir ce qui
    // vient de se passer, pas pour relire l'ouverture du scrutin.
    const ordered = [...election.audit].reverse()
      .filter((entry) => severity === 'all' || severityOf(entry) === severity);
    const found = searchItems(ordered, list.q, [
      (e) => describe(e), (e) => e.actor, (e) => e.action, (e) => e.hash,
    ]);
    const page = paginate(found, list);

    return html`<div class="view">
      ${electionHeader(election, {
    actions: html`
        ${btn({ label: 'Vérifier la chaîne', act: 'verify', variant: 'primary', iconName: 'shield' })}
        ${btn({ label: 'Exporter', act: 'export', iconName: 'download' })}`,
  })}
      ${electionTabs(election, ctx.config, 'audit')}

      ${check ? banner({
    tone: check.valid ? 'ok' : 'danger',
    title: check.valid ? 'Chaîne intacte.' : `Rupture détectée à l'entrée #${check.brokenAt}.`,
    body: check.valid
      ? `Les ${formatNumber(check.checked)} entrées ont été recalculées : chacune correspond à l'empreinte de la précédente. Aucune ligne n'a été modifiée ni supprimée après coup.`
      : `Les ${formatNumber(check.checked)} premières entrées sont cohérentes ; la suivante ne correspond plus. Une modification est intervenue après l'enregistrement.`,
  }) : banner({
    tone: 'neutral',
    body: html`Chaque événement est horodaté et chaîné au précédent par une empreinte SHA-256.
      Modifier une ligne après coup invalide toutes les suivantes — ce qui rend l'altération
      <strong>détectable</strong>, à défaut d'être impossible.
      <a href="#/a-propos">Ce que cela garantit exactement</a>.`,
  })}

      <div style="margin:var(--s-5) 0">
        ${statGrid([
    { value: formatNumber(election.audit.length), label: 'événements' },
    { value: formatNumber(critical), label: 'événements critiques', hint: 'ouverture, clôture, départage' },
    { value: formatNumber(election.ballots.length), label: 'dépôts journalisés', hint: 'sans le contenu du bulletin' },
    { value: election.seal ? election.seal.fingerprint.slice(0, 9) : '—', label: 'empreinte de l’urne' },
  ])}
      </div>

      ${card({
    title: 'Événements',
    hint: 'Du plus récent au plus ancien. Les scrutateurs et observateurs y ont accès en lecture.',
    body: html`
        <div class="list-toolbar">
          ${searchInput({
    list: LIST, value: list.q,
    placeholder: 'Rechercher un événement, un acteur, une empreinte…',
    label: "Rechercher dans le journal",
  })}
          ${segmented({ items: SEVERITIES, value: severity, act: 'setSeverity', label: 'Gravité' })}
        </div>
        ${page.total
    ? html`<ul style="list-style:none;padding:0;margin:0">${page.items.map(entryRow)}</ul>
            ${pagination({ list: LIST, ...page, noun: 'événements', nounOne: 'événement' })}`
    : list.q
      ? noResults({ list: LIST, query: list.q, noun: 'événement' })
      : html`<p class="muted">Aucun événement dans cette catégorie.</p>`}`,
  })}
    </div>`;
  },

  actions: {
    setSeverity: (ctx, { data }) => setUi({ auditSeverity: data.value }),

    async verify(ctx) {
      const election = getElection(ctx.params.id);
      const result = await verifyChain(election.audit);
      setUi({ chainCheck: result });
      toast(
        result.valid
          ? `Chaîne vérifiée : ${result.checked} entrées intactes.`
          : `Rupture à l'entrée #${result.brokenAt}.`,
        result.valid ? 'ok' : 'danger',
      );
    },

    export(ctx) {
      const election = getElection(ctx.params.id);
      const rows = [
        ['Séquence', 'Horodatage', 'Acteur', 'Événement', 'Empreinte précédente', 'Empreinte'],
        ...election.audit.map((entry) => [
          entry.seq, entry.at, entry.actor, describe(entry), entry.prev || '', entry.hash,
        ]),
      ];
      download(`${election.ref}-journal-audit.csv`, toCsv(rows), 'text/csv');
      toast('Journal exporté avec ses empreintes : la chaîne reste vérifiable hors ligne.', 'ok');
    },
  },
};
