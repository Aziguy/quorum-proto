/**
 * minutes.js — procès-verbal.
 *
 * Le PV n'est pas un gabarit à trous : chaque chiffre est relu depuis le
 * scrutin au moment de l'affichage. On ne peut donc pas produire un
 * procès-verbal qui contredise le décompte — ils sont la même donnée, vue deux
 * fois.
 */

import { html } from '../core/dom.js';
import { btn, banner } from '../ui/components.js';
import { formatNumber, formatPercent, formatDate } from '../core/format.js';
import { STATUS, METHODS, MAJORITIES, OPTION_KIND, TIEBREAKS, BLANK_POLICY } from '../domain/schema.js';
import { tally } from '../domain/tally.js';
import { can } from '../domain/permissions.js';
import { getElection } from '../app.js';
import { toast } from '../ui/feedback.js';
import { download } from '../core/storage.js';
import { electionHeader, electionTabs, missingElection, forbidden } from './_shared.js';

/** Phrase de composition de l'assemblée. */
function composition(election, result, config) {
  const { stats, quorum } = result;
  return html`Corps électoral arrêté à l'ouverture du scrutin :
    <strong>${formatNumber(stats.registeredVoters)} ${config.vocabulary.members}</strong>.
    Nombre de votants : <strong>${formatNumber(stats.representedVoters)}</strong>${
  stats.proxiesUsed ? html`, dont ${formatNumber(stats.proxiesUsed)} par pouvoir` : ''}.
    Taux de participation : <strong>${formatPercent(stats.ratio)}</strong>.
    ${quorum.enabled
    ? html`Le quorum statutaire, fixé à ${formatNumber(quorum.required)} votants, est
        <strong>${quorum.met ? 'atteint' : 'non atteint'}</strong> :
        l'assemblée ${quorum.met ? 'peut valablement délibérer' : "n'a pas pu délibérer valablement"}.`
    : html`Aucun quorum n'est exigé par les statuts pour ce scrutin.`}`;
}

/** Tableau du décompte, mis en forme pour un document officiel. */
function countTable(election, result) {
  return html`<table class="table" style="margin:var(--s-4) 0">
    <thead><tr><th>Réponse</th><th class="table__num">Voix</th><th class="table__num">% exprimés</th></tr></thead>
    <tbody>
      ${result.entries.map((entry) => html`<tr>
        <td>${entry.label}${entry.kind === OPTION_KIND.ABSTAIN
    ? ' (non comptée dans les suffrages exprimés)' : ''}${entry.elected ? ' — élu' : ''}</td>
        <td class="table__num">${formatNumber(entry.votes)}</td>
        <td class="table__num">${entry.kind === OPTION_KIND.ABSTAIN ? '—' : formatPercent(entry.share)}</td>
      </tr>`)}
      ${result.blank ? html`<tr>
        <td>Bulletins blancs${election.blankPolicy === 'excluded' ? ' (décomptés à part)' : ''}</td>
        <td class="table__num">${formatNumber(result.blank)}</td>
        <td class="table__num">${election.blankPolicy === 'counted' ? formatPercent(result.blank / result.expressed) : '—'}</td>
      </tr>` : ''}
    </tbody>
  </table>`;
}

/** Conclusion : la phrase que le greffe recopiera. */
function conclusion(election, result) {
  if (election.method === 'resolution') {
    const subject = result.entries.find((e) => e.id === result.majority.subjectId);
    return html`Suffrages exprimés : ${formatNumber(result.expressed)}.
      Majorité requise : ${formatNumber(result.majority.required)} voix.
      La résolution recueille ${formatNumber(subject?.votes ?? 0)} voix :
      <strong>elle est ${result.outcome === 'adopted' ? 'adoptée' : 'rejetée'}</strong>.`;
  }
  const elected = result.entries.filter((e) => e.elected);
  if (elected.length) {
    return html`Sur ${formatNumber(result.expressed)} suffrages exprimés,
      <strong>${elected.map((e) => e.label).join(', ')}</strong>
      ${elected.length > 1 ? 'sont proclamés élus' : 'est proclamé élu'}.`;
  }
  if (result.outcome === 'tie') {
    const tied = result.entries.filter((e) => result.tied.includes(e.id));
    return html`${tied.map((e) => e.label).join(' et ')} obtiennent le même nombre de voix
      (${formatNumber(tied[0]?.votes ?? 0)}). ${election.tiebreak
    ? html`La règle de départage retenue est « ${TIEBREAKS[election.tiebreak.rule]?.label} » :
        ${election.tiebreak.note || 'appliquée conformément aux statuts'}.`
    : html`<strong>Aucune règle de départage n'a encore été appliquée</strong> ; la proclamation reste en suspens.`}`;
  }
  return html`Aucune proposition n'atteint la majorité requise
    (${formatNumber(result.majority?.required ?? 0)} voix sur ${formatNumber(result.expressed)} exprimés).`;
}

export default {
  id: 'minutes',

  render(ctx) {
    const election = getElection(ctx.params.id);
    if (!election) return missingElection();
    if (!can(ctx.ui.role, 'minutes.sign')) return forbidden(ctx.ui.role, 'Éditer le procès-verbal');

    if (election.status !== STATUS.CLOSED) {
      return html`<div class="view">
        ${electionHeader(election)}
        ${electionTabs(election, ctx.config, 'minutes')}
        ${banner({
    tone: 'neutral',
    title: 'Le procès-verbal n’existe pas encore.',
    body: 'Il est établi à la clôture, à partir du décompte définitif. Le rédiger plus tôt reviendrait à préjuger du résultat.',
  })}
      </div>`;
    }

    const result = tally(election);
    const { config } = ctx;
    const org = config.organization;
    const carence = !result.disclosed;

    return html`<div class="view">
      ${electionHeader(election, {
    actions: html`
        ${btn({ label: 'Imprimer / PDF', act: 'print', variant: 'primary', iconName: 'printer' })}
        ${btn({ label: 'Télécharger (texte)', act: 'exportText', iconName: 'download' })}`,
  })}
      ${electionTabs(election, ctx.config, 'minutes')}

      <article class="doc">
        <header class="doc__header">
          <p class="doc__org">${org.name || 'Organisation'}${org.legalMention ? ` — ${org.legalMention}` : ''}</p>
          <h2 class="doc__title">Procès-verbal${carence ? ' de carence' : ''}<br>
            ${election.title}</h2>
        </header>

        <p>Les ${config.vocabulary.members} de l’organisation
          ${org.name ? html`« ${org.name} »` : ''}, régulièrement convoqués,
          ont voté par voie électronique${election.opensAt ? ` du ${formatDate(election.opensAt, 'full')}` : ''}
          au ${formatDate(election.seal?.at, 'full')}, sur la plateforme ${config.app.name}
          (scrutin <span class="mono">${election.ref}</span>).</p>

        <h2>1. Composition de l’assemblée</h2>
        <p>${composition(election, result, config)}</p>

        <h2>2. Question soumise au vote</h2>
        <p>« ${election.title} »${election.description ? ` ${election.description}` : ''}</p>
        <p>Modalités : ${METHODS[election.method].label.toLowerCase()},
          ${election.secret ? 'scrutin secret' : 'vote nominatif'},
          ${MAJORITIES[election.majority].label.toLowerCase()},
          votes blancs ${BLANK_POLICY[election.blankPolicy].label.toLowerCase()}${
  election.proxiesEnabled ? `, pouvoirs plafonnés à ${election.proxyLimit} par mandataire` : ''}.</p>

        ${carence ? html`
          <p><strong>Le quorum n’ayant pas été atteint, il n’a pas été procédé au dépouillement.</strong>
            Les ${formatNumber(election.ballots.length)} bulletins déposés demeurent scellés dans l'urne et
            ne seront pas ouverts. Aucun résultat ne peut donc être proclamé, quelle que soit la
            répartition des voix.</p>
          <p>Il appartient à l'organe compétent de procéder à une seconde convocation, dans les
            conditions prévues par les statuts.</p>
        ` : html`
          ${countTable(election, result)}
          <p>${conclusion(election, result)}</p>
        `}

        <h2>3. Intégrité du scrutin</h2>
        <p>${election.secret
    ? html`Le scrutin s'est déroulé à bulletin secret : la liste d'émargement, annexée au présent
        procès-verbal, atteste de l'identité des votants sans permettre de relier un bulletin à son
        auteur.`
    : html`Le scrutin s'est déroulé à vote nominatif : chaque voix est publiée avec son auteur.`}
          L'urne a été scellée à la clôture ; aucune modification n'est intervenue depuis.</p>
        <p class="mono" style="font-size:var(--text-xs)">
          Scellement : ${formatDate(election.seal?.at, 'seconds')}<br>
          Empreinte de l'urne : ${election.seal?.fingerprint || '—'}<br>
          Journal d'audit : ${formatNumber(election.audit.length)} événements horodatés et chaînés</p>

        <h2>4. Annexes</h2>
        <p>Annexe 1 — liste d'émargement (${formatNumber(election.roster.length)} votants).
          ${election.proxies.filter((p) => p.status === 'valid').length
    ? `Annexe 2 — liste des pouvoirs (${election.proxies.filter((p) => p.status === 'valid').length}).` : ''}
          ${election.attachments.length
    ? `Annexe 3 — ${election.attachments.map((a) => a.name).join(', ')}.` : ''}</p>

        <div class="doc__signatures">
          <div>${org.chair.role || 'La présidence'}<br>
            <strong>${org.chair.name || '—'}</strong>
            <div class="doc__sign-line">Signature</div></div>
          <div>${org.secretary.role || 'Le secrétariat'}<br>
            <strong>${org.secretary.name || '—'}</strong>
            <div class="doc__sign-line">Signature</div></div>
        </div>
      </article>

      <p class="field__hint no-print" style="margin-top:var(--s-5)">
        Les noms figurant en signature se règlent dans <a href="#/reglages">Réglages</a>.
        L'impression du navigateur produit un PDF sans en-tête ni menu.</p>
    </div>`;
  },

  actions: {
    print: () => window.print(),

    /** Version texte : archivable, diffusable, lisible sans navigateur. */
    exportText(ctx) {
      const election = getElection(ctx.params.id);
      const result = tally(election);
      const doc = document.querySelector('.doc');
      const text = doc ? doc.innerText.replace(/\n{3,}/g, '\n\n') : '';
      download(`${election.ref}-proces-verbal.txt`, text, 'text/plain');
      toast('Procès-verbal exporté.', 'ok');
    },
  },
};
