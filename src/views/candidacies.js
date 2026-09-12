/**
 * candidacies.js — dépôt et validation des candidatures.
 *
 * Une candidature validée ne devient pas automatiquement une ligne du bulletin :
 * c'est l'organisateur qui décide du moment du report, et l'ordre d'affichage
 * lui appartient. Automatiser ce pas ferait perdre la trace d'une décision.
 */

import { html } from '../core/dom.js';
import { btn, card, banner, statGrid } from '../ui/components.js';
import { initials } from '../core/format.js';
import { STATUS, makeOption } from '../domain/schema.js';
import { can } from '../domain/permissions.js';
import { getElection, setElection } from '../app.js';
import { toast, promptDialog } from '../ui/feedback.js';
import { electionHeader, electionTabs, missingElection } from './_shared.js';

const STATES = {
  validated: { label: 'Validée', tone: 'ok' },
  pending: { label: 'À valider', tone: 'warn' },
  incomplete: { label: 'Pièce manquante', tone: 'neutral' },
  rejected: { label: 'Refusée', tone: 'danger' },
};

function candidacyCard(candidacy, { editable, onBallot }) {
  const state = STATES[candidacy.status] || STATES.pending;
  return card({
    body: html`
      <div class="row row--tight" style="margin-bottom:var(--s-3)">
        <span class="brand__mark" style="background:var(--surface-3);color:var(--text-2);font-family:var(--font-sans);font-size:var(--text-xs)">${initials(candidacy.name)}</span>
        <span class="grow">
          <span class="table__main">${candidacy.name}</span>
          <span class="table__sub" style="display:block">${candidacy.meta || ''}</span>
        </span>
        <span class="badge badge--${state.tone}">${state.label}</span>
      </div>
      <p class="choice__sub" style="margin-bottom:var(--s-4)">
        ${candidacy.statement || 'Aucune profession de foi déposée.'}</p>
      ${candidacy.reason ? html`<p class="field__error">Motif du refus : ${candidacy.reason}</p>` : ''}
      ${onBallot ? html`<p class="field__hint">Déjà reportée sur le bulletin.</p>` : ''}
      ${editable ? html`<div class="row row--tight">
        ${candidacy.status !== 'validated'
    ? btn({ label: 'Valider', act: 'validate', data: { id: candidacy.id }, size: 'sm', variant: 'primary' })
    : ''}
        ${candidacy.status !== 'rejected'
    ? btn({ label: 'Refuser avec motif', act: 'reject', data: { id: candidacy.id }, size: 'sm', variant: 'quiet-danger' })
    : ''}
      </div>` : ''}`,
  });
}

export default {
  id: 'candidacies',

  render(ctx) {
    const election = getElection(ctx.params.id);
    if (!election) return missingElection();

    const editable = election.status === STATUS.DRAFT && can(ctx.ui.role, 'candidacies.review');
    const validated = election.candidacies.filter((c) => c.status === 'validated');
    const onBallot = new Set(election.options.map((o) => o.label));

    return html`<div class="view">
      ${electionHeader(election, {
    actions: editable
      ? btn({ label: 'Reporter les validées sur le bulletin', act: 'syncBallot', variant: 'primary' })
      : '',
  })}
      ${electionTabs(election, ctx.config, 'candidacies')}

      ${banner({
    tone: 'neutral',
    body: html`Les candidatures validées apparaissent sur le bulletin dans l'ordre défini à l'étape
      « Mode de scrutin » de l'assistant.${election.seats
    ? html` <strong>${election.seats} siège(s)</strong> à pourvoir.` : ''}`,
  })}

      <div style="margin:var(--s-5) 0">
        ${statGrid([
    { value: String(election.candidacies.length), label: 'candidatures déposées' },
    { value: String(validated.length), label: 'validées' },
    { value: String(election.candidacies.filter((c) => c.status === 'pending').length), label: 'à examiner' },
    { value: String(election.options.length), label: 'noms sur le bulletin' },
  ])}
      </div>

      ${election.candidacies.length
    ? html`<div class="grid grid--2">${election.candidacies.map((candidacy) => candidacyCard(candidacy, {
      editable, onBallot: onBallot.has(candidacy.name),
    }))}</div>`
    : html`<div class="empty"><p style="margin:0">Aucune candidature déposée sur ce scrutin.</p></div>`}
    </div>`;
  },

  actions: {
    validate(ctx, { data }) {
      setElection(ctx.params.id, (election) => ({
        ...election,
        candidacies: election.candidacies.map((c) => (c.id === data.id ? { ...c, status: 'validated' } : c)),
      }));
      toast('Candidature validée.', 'ok');
    },

    async reject(ctx, { data }) {
      const reason = await promptDialog({
        title: 'Refuser la candidature',
        text: 'Le motif est communiqué au candidat et conservé avec la candidature.',
        label: 'Motif du refus',
        confirmLabel: 'Refuser',
      });
      if (!reason) return;
      setElection(ctx.params.id, (election) => ({
        ...election,
        candidacies: election.candidacies.map((c) => (
          c.id === data.id ? { ...c, status: 'rejected', reason } : c)),
      }));
      toast('Candidature refusée, motif consigné.');
    },

    /** Reporte les candidatures validées sur le bulletin, sans créer de doublon. */
    syncBallot(ctx) {
      const election = getElection(ctx.params.id);
      const existing = new Set(election.options.map((o) => o.label));
      const additions = election.candidacies
        .filter((c) => c.status === 'validated' && !existing.has(c.name))
        .map((c) => makeOption(c.name, c.meta || ''));

      if (!additions.length) { toast('Le bulletin est déjà à jour.'); return; }
      setElection(ctx.params.id, (current) => ({
        ...current,
        options: [...current.options.filter((o) => o.label.trim()), ...additions],
      }));
      toast(`${additions.length} candidature(s) reportée(s) sur le bulletin.`, 'ok');
    },
  },
};
