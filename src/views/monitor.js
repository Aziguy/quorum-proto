/**
 * monitor.js — suivi d'un scrutin ouvert.
 *
 * Cet écran répond à une seule question : où en est la participation. Il n'y a
 * délibérément aucun résultat partiel, pour personne — c'est ce qui interdit
 * une annonce prématurée capable d'influencer les votants restants.
 */

import { html } from '../core/dom.js';
import { btn, card, banner, statGrid, quorumGauge, table, keyValues } from '../ui/components.js';
import { formatNumber, formatPercent, formatDate, formatRelative } from '../core/format.js';
import { STATUS } from '../domain/schema.js';
import { participationStats } from '../domain/tally.js';
import { evaluateQuorum } from '../domain/quorum.js';
import {
  closeElection, recordReminder, pendingVoters, castBallot, isVotingOpen,
} from '../domain/election.js';
import { emptyChoice, toggleOption } from '../domain/ballot.js';
import { can } from '../domain/permissions.js';
import { getElection, applyOperation } from '../app.js';
import { toast, confirmDialog } from '../ui/feedback.js';
import { electionHeader, electionTabs, missingElection, sealBanner, forbidden } from './_shared.js';

/** Liste d'émargement : qui a voté, et quand. Jamais ce qui a été voté. */
function rosterCard(election) {
  const recent = [...election.roster].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12);
  return card({
    title: 'Liste d’émargement',
    hint: 'Qui a voté, et à quelle heure. Jamais ce qui a été voté.',
    body: recent.length
      ? html`${table({
    head: ['Électeur', 'Heure', 'Accès', 'Pouvoirs'],
    caption: 'Derniers émargements',
    rows: recent.map((entry) => [
      html`<span class="table__main">${entry.name}</span>`,
      html`<span class="nums">${formatDate(entry.at, 'seconds')}</span>`,
      entry.channel === 'code' ? 'code remis en main propre' : 'lien par e-mail',
      entry.proxyFor?.length
        ? html`<span class="badge badge--brand">+${entry.proxyFor.length}</span>`
        : html`<span class="dim">—</span>`,
    ]),
  })}
      ${election.roster.length > recent.length
    ? html`<p class="field__hint">${formatNumber(election.roster.length - recent.length)} émargements antérieurs non affichés.</p>`
    : ''}`
      : html`<p class="muted">Personne n'a encore voté.</p>`,
  });
}

export default {
  id: 'monitor',

  render(ctx) {
    const election = getElection(ctx.params.id);
    if (!election) return missingElection();
    if (!can(ctx.ui.role, 'monitor.view')) return forbidden(ctx.ui.role, 'Voir la participation');

    const stats = participationStats(election);
    const quorum = evaluateQuorum(election, stats);
    const pending = pendingVoters(election);
    const validProxies = election.proxies.filter((p) => p.status === 'valid');
    const windowOpen = isVotingOpen(election);
    const notYetOpen = election.opensAt && Date.now() < new Date(election.opensAt).getTime();

    return html`<div class="view">
      ${electionHeader(election, {
    actions: html`
        ${btn({ label: 'Salle de vote', href: `#/scrutins/${election.id}/urne`, iconName: 'ballotBox' })}
        ${ctx.config.features.sessionMode
    ? btn({ label: 'Mode séance', href: `#/scrutins/${election.id}/seance`, iconName: 'external' })
    : ''}
        ${can(ctx.ui.role, 'election.close')
    ? btn({ label: 'Clôturer maintenant', act: 'close', variant: 'primary', iconName: 'seal' })
    : ''}`,
  })}
      ${electionTabs(election, ctx.config, 'monitor')}

      ${!windowOpen && election.status === STATUS.OPEN ? banner({
    tone: 'warn',
    title: notYetOpen ? 'Le vote n’est pas encore ouvert.' : 'La date de clôture est dépassée.',
    body: notYetOpen
      ? html`Ouverture ${formatRelative(election.opensAt)}. Les accès sont distribués, mais tout dépôt est refusé.`
      : html`Les dépôts sont refusés depuis le ${formatDate(election.closesAt, 'full')}.
        Clôturez le scrutin pour sceller l'urne et déclencher le décompte.`,
  }) : ''}

      ${statGrid([
    { value: formatPercent(stats.ratio), label: 'de participation', hint: `${formatNumber(stats.representedVoters)} sur ${formatNumber(stats.registeredVoters)} inscrits` },
    { value: formatNumber(election.ballots.length), label: 'bulletins dans l’urne', hint: 'contenu inaccessible' },
    { value: formatNumber(validProxies.length), label: 'pouvoirs exercés', hint: `plafond : ${election.proxyLimit} par mandataire` },
    { value: formatNumber(pending.length), label: 'n’ont pas encore voté', hint: 'accès toujours valides' },
  ])}

      <div style="margin:var(--s-6) 0">
        ${card({
    title: 'Participation',
    body: html`
            ${quorumGauge({ reached: stats.representedVoters, required: quorum.required, total: quorum.total, met: quorum.met })}
            <div style="margin-top:var(--s-6)">
              ${quorum.enabled ? banner({
    tone: quorum.met ? 'ok' : 'warn',
    title: quorum.met ? 'Quorum atteint.' : `Il manque ${formatNumber(Math.max(0, quorum.required - quorum.reached))} votants.`,
    body: quorum.met
      ? 'La délibération sera valable. Les pouvoirs comptent dans le quorum.'
      : 'Si le quorum n’est pas atteint à la clôture, les bulletins resteront scellés et ne seront jamais dépouillés : seul un procès-verbal de carence sera produit.',
  }) : banner({ tone: 'neutral', body: 'Aucun quorum exigé : la délibération sera valable quel que soit le nombre de votants.' })}
            </div>`,
  })}
      </div>

      ${sealBanner(election)}

      <div class="grid grid--2" style="margin-top:var(--s-6)">
        ${card({
    title: 'Relancer les non-votants',
    hint: `${formatNumber(pending.length)} personnes n'ont pas encore déposé de bulletin.`,
    body: html`
            <p class="choice__sub" style="margin-bottom:var(--s-4)">La relance ne révèle rien : elle s'adresse
              à ceux dont l'accès n'a pas été consommé. Elle est inscrite au journal d'audit sans nommer personne.</p>
            <div class="row">
              ${btn({
    label: 'Relancer', act: 'remind', iconName: 'mail',
    disabled: !pending.length || !can(ctx.ui.role, 'electorate.manage'),
  })}
              ${btn({ label: 'Simuler 10 votes', act: 'simulate', iconName: 'play', disabled: !pending.length || !windowOpen })}
            </div>
            <p class="field__hint">« Simuler » dépose des bulletins aléatoires au nom d'électeurs
              n'ayant pas voté — outil de démonstration, journalisé comme tout autre dépôt.</p>`,
  })}

        ${card({
    title: 'État du scrutin',
    body: keyValues([
      ['Ouverture', election.opensAt ? formatDate(election.opensAt, 'full') : 'immédiate'],
      ['Clôture prévue', election.closesAt ? formatDate(election.closesAt, 'full') : 'manuelle'],
      ['Corps électoral', `${formatNumber(stats.registeredVoters)} inscrits, figé`],
      ['Voix totales', formatNumber(stats.registeredWeight)],
      ['Accès non consommés', formatNumber(pending.length)],
      ['Événements journalisés', formatNumber(election.audit.length)],
    ]),
  })}
      </div>

      ${can(ctx.ui.role, 'roster.view')
    ? html`<div style="margin-top:var(--s-6)">${rosterCard(election)}</div>`
    : html`<div style="margin-top:var(--s-6)">${banner({
      tone: 'neutral',
      body: "La liste d'émargement est réservée à l'organisateur et aux scrutateurs. Le rôle endossé n'y a pas accès.",
    })}</div>`}
    </div>`;
  },

  actions: {
    async close(ctx) {
      const election = getElection(ctx.params.id);
      const ok = await confirmDialog({
        title: 'Clôturer le scrutin ?',
        text: `L'urne sera scellée avec ses ${election.ballots.length} bulletins. Plus aucun vote ne pourra être déposé, et le décompte deviendra définitif. Cette opération est irréversible.`,
        confirmLabel: 'Clôturer et sceller',
      });
      if (!ok) return;

      const result = await applyOperation(ctx.params.id, (current) => closeElection(
        current, ctx.config.session.actor || 'Organisateur',
      ));
      if (!result.ok) { toast('Clôture impossible.', 'danger'); return; }
      toast(`Urne scellée · empreinte ${result.election.seal.fingerprint}`, 'ok');
      ctx.go(`/scrutins/${ctx.params.id}/resultats`);
    },

    async remind(ctx) {
      const result = await applyOperation(ctx.params.id, (election) => recordReminder(
        election, ctx.config.session.actor || 'Organisateur',
      ));
      toast(`Relance adressée à ${result.count} électeurs.`, 'ok');
    },

    /**
     * Dépose des bulletins au nom d'électeurs n'ayant pas voté. Passe par
     * castBallot comme un vrai dépôt : jeton consommé, émargement créé,
     * bulletin mélangé dans l'urne, journal mis à jour.
     */
    async simulate(ctx) {
      let election = getElection(ctx.params.id);
      const targets = pendingVoters(election).slice(0, 10);
      if (!targets.length) { toast('Tout le monde a déjà voté.'); return; }

      for (const target of targets) {
        const voter = election.electorate.find((v) => v.id === target.id);
        if (!voter?.token) continue;
        // Un choix au hasard parmi les options, pour produire une répartition crédible.
        const pick = election.options[Math.floor(Math.random() * election.options.length)];
        const choice = toggleOption(election, emptyChoice(election), pick.id);
        const result = await castBallot(election, voter.token, choice);
        if (result.ok) election = result.election;
      }
      await applyOperation(ctx.params.id, () => ({ ok: true, election }));
      toast(`${targets.length} bulletins déposés.`, 'ok');
    },
  },
};
