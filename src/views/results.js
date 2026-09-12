/**
 * results.js — décompte définitif.
 *
 * L'écran s'ouvre sur un verdict en une phrase, puis le montre : décompte,
 * suffrages exprimés, majorité requise, écart. L'ordre compte — le lecteur
 * pressé doit repartir avec la bonne conclusion, le lecteur attentif doit
 * pouvoir la vérifier.
 */

import { html } from '../core/dom.js';
import {
  btn, card, banner, tallyRow, keyValues, choice, table, statGrid,
} from '../ui/components.js';
import { formatNumber, formatPercent, formatDate } from '../core/format.js';
import { STATUS, METHODS, MAJORITIES, TIEBREAKS, OPTION_KIND } from '../domain/schema.js';
import { tally, tallyByCollege } from '../domain/tally.js';
import { applyTiebreak, verifySeal } from '../domain/election.js';
import { can } from '../domain/permissions.js';
import { getElection, applyOperation } from '../app.js';
import { toast, confirmDialog, promptDialog } from '../ui/feedback.js';
import { download } from '../core/storage.js';
import { toCsv } from '../core/csv.js';
import { electionHeader, electionTabs, missingElection, sealBanner, forbidden } from './_shared.js';

/** Verdict : le tour de couleur et la phrase qui l'accompagne. */
const VERDICTS = {
  adopted: { tone: 'ok', glyph: '✓', title: 'Résolution adoptée' },
  rejected: { tone: 'danger', glyph: '×', title: 'Résolution rejetée' },
  elected: { tone: 'ok', glyph: '✓', title: 'Élection acquise' },
  tie: { tone: 'warn', glyph: '=', title: 'Égalité — départage nécessaire' },
  runoff: { tone: 'warn', glyph: '↻', title: 'Second tour nécessaire' },
  'no-majority': { tone: 'warn', glyph: '!', title: 'Majorité requise non atteinte' },
  'quorum-failed': { tone: 'danger', glyph: '×', title: 'Délibération non valable — quorum non atteint' },
  counted: { tone: 'brand', glyph: 'i', title: 'Consultation dépouillée' },
  pending: { tone: 'neutral', glyph: '▪', title: 'Scrutin en cours' },
};

/** Phrase d'explication du verdict, chiffrée. */
function verdictText(election, result) {
  const rule = result.majority ? MAJORITIES[result.majority.rule] : null;
  const winners = (result.entries || []).filter((e) => e.elected).map((e) => e.label);

  switch (result.outcome) {
    case 'quorum-failed':
      return `${formatNumber(result.quorum.reached)} votants sur ${formatNumber(result.quorum.total)} inscrits, soit ${formatPercent(result.quorum.ratio)} : le quorum de ${formatNumber(result.quorum.required)} n'est pas atteint. L'assemblée n'a pas pu délibérer valablement, quelle que soit la répartition des voix.`;
    case 'adopted':
    case 'rejected': {
      const subject = result.entries.find((e) => e.id === result.majority.subjectId);
      return `${rule.label} : ${formatNumber(result.expressed)} suffrages exprimés, ${formatNumber(result.majority.required)} voix requises, ${formatNumber(subject?.votes ?? 0)} obtenues. ${
        result.abstain ? `Les ${formatNumber(result.abstain)} abstentions comptent dans le quorum mais pas dans les suffrages exprimés.` : ''}`;
    }
    case 'tie': {
      const tied = (result.entries || []).filter((e) => result.tied.includes(e.id));
      return `${tied.map((e) => e.label).join(' et ')} obtiennent ${formatNumber(tied[0]?.votes ?? 0)} voix chacun. La règle de départage prévue par vos statuts doit être appliquée, puis justifiée au procès-verbal.`;
    }
    case 'elected':
      return `${winners.join(', ')} ${winners.length > 1 ? 'sont élus' : 'est élu'} sur ${formatNumber(result.expressed)} suffrages exprimés.`;
    case 'runoff':
      return "Aucun candidat n'atteint la majorité requise. Un second tour doit être organisé entre les deux premiers.";
    case 'no-majority':
      return `Aucune proposition n'atteint les ${formatNumber(result.majority?.required ?? 0)} voix requises sur ${formatNumber(result.expressed)} suffrages exprimés.`;
    case 'counted':
      return `${formatNumber(result.stats.castBallots)} réponses recueillies. Cette consultation n'a pas d'effet juridique.`;
    default:
      return "L'urne est scellée : aucun décompte n'est calculable avant la clôture.";
  }
}

/** Le décompte lui-même : une ligne par option, ordonnée par le résultat. */
function countCard(election, result) {
  const method = METHODS[election.method];
  const ordered = [...result.entries].sort((a, b) => {
    if (a.kind === OPTION_KIND.ABSTAIN) return 1;
    if (b.kind === OPTION_KIND.ABSTAIN) return -1;
    return b.votes - a.votes;
  });

  const toneFor = (entry) => {
    if (entry.kind === OPTION_KIND.FOR) return 'ok';
    if (entry.kind === OPTION_KIND.AGAINST) return 'danger';
    if (entry.kind === OPTION_KIND.ABSTAIN) return 'neutral';
    return entry.elected ? 'ok' : '';
  };

  const noteFor = (entry) => {
    if (entry.kind === OPTION_KIND.ABSTAIN) return 'Comptée dans le quorum, exclue des suffrages exprimés.';
    if (entry.elected) return method.pick === 'many' ? 'Élu · siège pourvu' : 'Élu';
    if (result.tied.includes(entry.id)) return 'À égalité — départage requis';
    return '';
  };

  return card({
    title: 'Décompte',
    hint: method.pick === 'order'
      ? 'Comptage de Borda : un bulletin attribue N points à son premier choix, N−1 au deuxième, et ainsi de suite.'
      : '',
    body: html`
      <div style="margin-bottom:var(--s-6)">
        ${ordered.map((entry) => tallyRow({
    label: entry.label,
    sublabel: entry.sublabel,
    votes: entry.votes,
    ratio: entry.kind === OPTION_KIND.ABSTAIN ? null : entry.share,
    tone: toneFor(entry),
    note: noteFor(entry),
    elected: entry.elected,
  }))}
        ${result.blank > 0 ? tallyRow({
    label: 'Bulletins blancs',
    votes: result.blank,
    ratio: election.blankPolicy === 'counted' ? result.blank / result.expressed : null,
    tone: 'neutral',
    note: election.blankPolicy === 'counted'
      ? 'Comptés dans les suffrages exprimés, conformément au réglage du scrutin.'
      : 'Décomptés à part, hors suffrages exprimés.',
  }) : ''}
      </div>

      ${keyValues([
    ['Participation', `${formatNumber(result.stats.representedVoters)} / ${formatNumber(result.stats.registeredVoters)} — ${formatPercent(result.stats.ratio)}`],
    ['Quorum', result.quorum.enabled ? `${formatNumber(result.quorum.required)} requis · atteint` : 'non exigé'],
    ['Suffrages exprimés', formatNumber(result.expressed)],
    ['Règle appliquée', result.majority ? `${MAJORITIES[result.majority.rule].label}${result.majority.required ? ` · ${formatNumber(result.majority.required)} voix requises` : ''}` : METHODS[election.method].label],
    ...(result.condorcet
      ? [['Vainqueur de Condorcet', result.entries.find((e) => e.id === result.condorcet)?.label || '—']]
      : method.pick === 'order' ? [['Vainqueur de Condorcet', 'aucun — les préférences sont cycliques']] : []),
  ])}`,
  });
}

/** Choix de la règle de départage, quand deux options sont à égalité. */
function tiebreakCard(election, result) {
  const tied = result.entries.filter((e) => result.tied.includes(e.id));
  const applied = election.tiebreak;

  return card({
    title: 'Départage',
    hint: `${tied.map((e) => e.label).join(' et ')} sont à égalité parfaite. Choisissez la règle prévue par vos statuts — elle sera inscrite au procès-verbal avec sa justification.`,
    body: applied
      ? banner({
        tone: 'ok',
        title: `Départage appliqué : ${TIEBREAKS[applied.rule]?.label || applied.rule}.`,
        body: html`${applied.note || ''}<br><span class="dim">Décidé le ${formatDate(applied.at, 'full')} par ${applied.by}.</span>`,
      })
      : html`<div class="stack" style="--gap:var(--s-2)" role="radiogroup" aria-label="Règle de départage">
          ${Object.values(TIEBREAKS).map((rule) => choice({
    title: rule.label, sub: rule.hint, checked: false,
    act: 'applyTiebreak', data: { rule: rule.id },
  }))}
        </div>`,
  });
}

export default {
  id: 'results',

  render(ctx) {
    const election = getElection(ctx.params.id);
    if (!election) return missingElection();
    if (!can(ctx.ui.role, 'results.view')) return forbidden(ctx.ui.role, 'Consulter les résultats');

    const result = tally(election);
    const verdict = VERDICTS[result.outcome] || VERDICTS.pending;
    const colleges = election.colleges ? tallyByCollege(election) : null;

    // Urne encore ouverte : aucun décompte n'existe, et l'écran le dit.
    if (election.status !== STATUS.CLOSED) {
      return html`<div class="view">
        ${electionHeader(election)}
        ${electionTabs(election, ctx.config, 'results')}
        ${sealBanner(election)}
        <div style="margin-top:var(--s-5)">${card({
    title: 'Aucun résultat avant la clôture',
    body: html`<p class="muted">Le décompte ne s'exécute qu'une fois l'urne scellée. Ce n'est pas un
      masquage d'affichage : la fonction de dépouillement refuse de produire un résultat tant que le
      scrutin est ouvert — y compris pour un scrutateur, y compris depuis la console du navigateur.</p>
      <div class="row" style="margin-top:var(--s-4)">
        ${btn({ label: 'Suivre la participation', href: `#/scrutins/${election.id}/suivi`, variant: 'primary' })}
      </div>`,
  })}</div>
      </div>`;
    }

    return html`<div class="view">
      ${electionHeader(election, {
    actions: html`
        ${ctx.config.features.minutes
    ? btn({ label: 'Procès-verbal', href: `#/scrutins/${election.id}/pv`, variant: 'primary', iconName: 'fileText' })
    : ''}
        ${btn({ label: 'Exporter (CSV)', act: 'exportCsv', iconName: 'download' })}
        ${btn({ label: 'Vérifier le sceau', act: 'verify', iconName: 'seal' })}`,
  })}
      ${electionTabs(election, ctx.config, 'results')}
      ${sealBanner(election)}

      <div style="margin:var(--s-5) 0">
        ${banner({
    tone: verdict.tone,
    glyph: verdict.glyph,
    title: verdict.title,
    body: verdictText(election, result),
  })}
      </div>

      ${result.disclosed ? html`
        ${countCard(election, result)}
        ${result.tied.length ? html`<div style="margin-top:var(--s-5)">${tiebreakCard(election, result)}</div>` : ''}
        ${colleges?.length ? html`<div style="margin-top:var(--s-5)">${card({
    title: 'Participation par collège',
    hint: 'Le détail par collège porte sur la participation, jamais sur le contenu des bulletins : en scrutin secret, aucun bulletin n’est rattaché à un collège.',
    body: table({
      head: ['Collège', 'Votants', 'Inscrits', 'Participation'],
      rows: colleges.map((group) => [
        group.college,
        html`<span class="nums">${formatNumber(group.voters)}</span>`,
        html`<span class="nums">${formatNumber(group.registered)}</span>`,
        html`<span class="nums">${formatPercent(group.registered ? group.voters / group.registered : 0)}</span>`,
      ]),
    }),
  })}</div>` : ''}
      ` : html`<div>${card({
    title: 'Le décompte reste scellé',
    body: html`
          <p class="muted" style="margin-bottom:var(--s-4)">Publier un résultat issu d'une délibération non
            valable influencerait la seconde convocation. Les bulletins restent dans l'urne et ne seront
            jamais dépouillés : seul un procès-verbal de carence est produit.</p>
          ${statGrid([
    { value: formatNumber(result.quorum.reached), label: 'votants', hint: `quorum : ${formatNumber(result.quorum.required)}` },
    { value: formatNumber(result.quorum.total), label: 'inscrits' },
    { value: formatPercent(result.quorum.ratio), label: 'participation' },
    { value: formatNumber(election.ballots.length), label: 'bulletins scellés', hint: 'jamais ouverts' },
  ])}
          <div class="row" style="margin-top:var(--s-5)">
            ${btn({ label: 'Éditer le PV de carence', href: `#/scrutins/${election.id}/pv`, variant: 'primary' })}
          </div>
          <p class="field__hint">Usage courant : une seconde assemblée, convoquée à quinze jours
            d'intervalle sur le même ordre du jour, délibère sans condition de quorum. Vérifiez vos statuts.</p>`,
  })}</div>`}
    </div>`;
  },

  actions: {
    async applyTiebreak(ctx, { data }) {
      const rule = TIEBREAKS[data.rule];
      const note = await promptDialog({
        title: `Appliquer : ${rule.label}`,
        text: `${rule.hint} La justification saisie ici figurera au procès-verbal.`,
        label: 'Justification',
        placeholder: rule.id === 'age'
          ? 'Né le 3 mars 2011, aîné de onze jours.'
          : rule.id === 'lot' ? 'Tirage effectué devant les deux scrutateurs.' : '',
        confirmLabel: 'Appliquer et consigner',
      });
      if (note === null) return;

      await applyOperation(ctx.params.id, (election) => applyTiebreak(
        election, data.rule, note, ctx.config.session.actor || 'Organisateur',
      ));
      toast('Départage consigné au journal d’audit.', 'ok');
    },

    /** Vérifie que les bulletins présents correspondent toujours au sceau. */
    async verify(ctx) {
      const election = getElection(ctx.params.id);
      const check = await verifySeal(election);
      if (check.valid) {
        toast(`Sceau vérifié : les ${election.ballots.length} bulletins sont intacts.`, 'ok');
        return;
      }
      await confirmDialog({
        title: 'Le sceau ne correspond plus',
        text: "Le contenu de l'urne a changé depuis la clôture. Le décompte affiché ne peut plus être considéré comme fiable ; l'incident doit être porté au procès-verbal.",
        confirmLabel: 'J’ai compris',
        cancelLabel: 'Fermer',
        danger: true,
      });
    },

    /** Export du décompte, dans la forme qu'un tableur et un PV attendent. */
    exportCsv(ctx) {
      const election = getElection(ctx.params.id);
      const result = tally(election);
      if (!result.disclosed) { toast('Aucun décompte à exporter : le quorum n’a pas été atteint.', 'danger'); return; }

      const rows = [
        ['Scrutin', election.title],
        ['Référence', election.ref],
        ['Clôture', formatDate(election.seal?.at, 'seconds')],
        ['Empreinte de l’urne', election.seal?.fingerprint || ''],
        [],
        ['Proposition', 'Voix', '% des suffrages exprimés', 'Élu'],
        ...result.entries.map((entry) => [
          entry.label,
          entry.votes,
          entry.kind === OPTION_KIND.ABSTAIN ? '' : (entry.share * 100).toFixed(2),
          entry.elected ? 'oui' : '',
        ]),
        ['Bulletins blancs', result.blank, '', ''],
        [],
        ['Inscrits', result.stats.registeredVoters],
        ['Votants', result.stats.representedVoters],
        ['Suffrages exprimés', result.expressed],
        ['Majorité requise', result.majority?.required ?? ''],
      ];
      download(`${election.ref || 'decompte'}-decompte.csv`, toCsv(rows), 'text/csv');
      toast('Décompte exporté.', 'ok');
    },
  },
};
