/**
 * privacy.js — données personnelles et RGPD.
 *
 * L'organisation est responsable de traitement ; Quorum est l'outil. Cet écran
 * ne récite pas le règlement : il rend les droits *exécutables* — export,
 * rectification, effacement — sur les données réellement présentes.
 */

import { html } from '../core/dom.js';
import { btn, card, pageHead, banner, table, statGrid } from '../ui/components.js';
import { formatNumber, formatDate } from '../core/format.js';
import { STATUS } from '../domain/schema.js';
import { exportAll, resetAll, setElection } from '../app.js';
import { usedBytes, download } from '../core/storage.js';
import { toast, confirmDialog, promptDialog } from '../ui/feedback.js';
import { toCsv } from '../core/csv.js';

export default {
  id: 'privacy',

  render(ctx) {
    const { elections, config } = ctx;
    const contacts = new Set();
    elections.forEach((e) => e.electorate.forEach((v) => v.email && contacts.add(v.email)));
    const closed = elections.filter((e) => e.status === STATUS.CLOSED);

    const retention = [
      ['Coordonnées du corps électoral', 'Noms, adresses e-mail, téléphones, collèges', `${config.retention.contacts} jours après clôture`],
      ["Liste d'émargement nominative", 'Annexe du procès-verbal, preuve de participation', `${Math.round(config.retention.roster / 365)} ans`],
      ['Bulletins et décompte', 'Aucune donnée personnelle en scrutin secret', `${Math.round(config.retention.ballots / 365)} ans`],
      ["Journal d'audit", 'Événements horodatés, acteurs identifiés', `${Math.round(config.retention.audit / 365)} ans`],
    ];

    return html`<div class="view">
      ${pageHead({
    title: 'Données & RGPD',
    lead: `${config.organization.name || 'Votre organisation'} est responsable de traitement. ${config.app.name} n'exploite aucune donnée à d'autres fins et ne conserve rien au-delà des durées fixées ici.`,
    actions: btn({ label: 'Exporter toutes les données', act: 'exportAll', iconName: 'download' }),
  })}

      ${banner({
    tone: 'brand',
    title: 'Où vivent ces données.',
    body: html`Dans ce navigateur, et nulle part ailleurs : ${formatNumber(Math.round(usedBytes() / 1024))} Ko
      de stockage local. Rien n'est transmis à un serveur — ce prototype n'en a pas.
      En contrepartie, <strong>l'export JSON est la seule sauvegarde réelle</strong> : vider les
      données du site les efface définitivement.`,
  })}

      <div style="margin:var(--s-5) 0">
        ${statGrid([
    { value: formatNumber(contacts.size), label: 'adresses e-mail conservées' },
    { value: formatNumber(elections.reduce((n, e) => n + e.roster.length, 0)), label: 'lignes d’émargement' },
    { value: formatNumber(elections.reduce((n, e) => n + e.ballots.length, 0)), label: 'bulletins anonymes' },
    { value: formatNumber(elections.reduce((n, e) => n + e.audit.length, 0)), label: 'événements journalisés' },
  ])}
      </div>

      ${card({
    title: 'Durées de conservation',
    hint: 'Après clôture, les coordonnées sont supprimées ; le procès-verbal et le journal d’audit sont conservés à titre de preuve.',
    body: table({
      head: ['Donnée', 'Contenu', 'Durée'],
      rows: retention.map(([what, detail, duration]) => [
        html`<span class="table__main">${what}</span>`,
        html`<span class="table__sub">${detail}</span>`,
        html`<span class="nowrap">${duration}</span>`,
      ]),
    }),
  })}

      <div class="grid grid--2" style="margin-top:var(--s-5)">
        ${card({
    title: 'Exercer les droits d’une personne',
    hint: 'Export complet des données la concernant, ou effacement. En scrutin secret, l’effacement ne touche jamais l’urne : il n’existe aucun lien à rompre.',
    body: html`<div class="row">
          ${btn({ label: 'Exporter les données d’une personne', act: 'exportPerson', iconName: 'user' })}
          ${btn({ label: 'Effacer une personne', act: 'erasePerson', variant: 'quiet-danger' })}
        </div>`,
  })}

        ${card({
    title: 'Purger les coordonnées',
    hint: `Efface e-mails et téléphones des ${formatNumber(closed.length)} scrutin(s) clos. Les noms de la liste d'émargement, le décompte et le journal d'audit sont conservés : ce sont des preuves.`,
    body: html`<div class="row">
          ${btn({ label: 'Purger les scrutins clos', act: 'purgeContacts', variant: 'quiet-danger', disabled: !closed.length })}
        </div>
        <p class="field__hint">Irréversible. Les personnes concernées ne pourront plus être recontactées
          à propos de ces scrutins.</p>`,
  })}
      </div>

      <div style="margin-top:var(--s-5)">
        ${card({
    title: 'Réinitialiser l’instance',
    hint: 'Efface tout : scrutins, corps électoraux, bulletins, journaux. Le jeu de démonstration est régénéré.',
    body: html`<div class="row">
          ${btn({ label: 'Tout effacer et régénérer la démonstration', act: 'reset', variant: 'danger' })}
          ${btn({ label: 'Tout effacer et repartir à vide', act: 'resetEmpty', variant: 'quiet-danger' })}
        </div>`,
  })}
      </div>
    </div>`;
  },

  actions: {
    exportAll: () => { exportAll(); toast('Export complet téléchargé.', 'ok'); },

    /** Droit d'accès : tout ce que l'instance sait d'une personne, en un fichier. */
    async exportPerson(ctx) {
      const query = await promptDialog({
        title: 'Exporter les données d’une personne',
        text: 'Saisissez un nom ou une adresse e-mail.',
        label: 'Personne concernée',
      });
      if (!query) return;
      const needle = query.toLowerCase();
      const rows = [['Scrutin', 'Référence', 'Nom', 'E-mail', 'Collège', 'Voix', 'A voté', 'Heure']];
      let found = 0;

      for (const election of ctx.elections) {
        for (const voter of election.electorate) {
          if (!`${voter.name} ${voter.email}`.toLowerCase().includes(needle)) continue;
          found += 1;
          const signed = election.roster.find((r) => r.voterId === voter.id);
          rows.push([
            election.title, election.ref, voter.name, voter.email, voter.college, voter.weight,
            signed ? 'oui' : 'non', signed ? formatDate(signed.at, 'seconds') : '',
          ]);
        }
      }
      if (!found) { toast('Aucune donnée ne correspond.', 'danger'); return; }
      rows.push([]);
      rows.push(['Note', "Aucun bulletin n'est rattaché à cette personne : en scrutin secret, ce lien n'existe pas."]);
      download(`donnees-personnelles-${Date.now()}.csv`, toCsv(rows), 'text/csv');
      toast(`${found} fiche(s) exportée(s).`, 'ok');
    },

    /** Droit à l'effacement : les fiches partent, les preuves restent. */
    async erasePerson(ctx) {
      const query = await promptDialog({
        title: 'Effacer les données d’une personne',
        text: "Les fiches d'électeur seront anonymisées dans tous les scrutins. La liste d'émargement des scrutins clos conserve une mention anonyme : elle est une preuve de participation, pas une donnée de contact.",
        label: 'Nom ou adresse e-mail',
        confirmLabel: 'Rechercher',
      });
      if (!query) return;
      const needle = query.toLowerCase();
      let touched = 0;

      for (const election of ctx.elections) {
        const matches = election.electorate.filter((v) => `${v.name} ${v.email}`.toLowerCase().includes(needle));
        if (!matches.length) continue;
        const ids = new Set(matches.map((v) => v.id));
        touched += matches.length;
        setElection(election.id, (current) => ({
          ...current,
          electorate: current.electorate.map((v) => (ids.has(v.id)
            ? { ...v, name: 'Électeur anonymisé', email: '', phone: '' } : v)),
          roster: current.roster.map((r) => (ids.has(r.voterId)
            ? { ...r, name: 'Électeur anonymisé' } : r)),
        }));
      }
      toast(touched ? `${touched} fiche(s) anonymisée(s).` : 'Aucune donnée ne correspond.', touched ? 'ok' : 'danger');
    },

    async purgeContacts(ctx) {
      const closed = ctx.elections.filter((e) => e.status === STATUS.CLOSED);
      const ok = await confirmDialog({
        title: 'Purger les coordonnées ?',
        text: `Les e-mails et téléphones de ${closed.length} scrutin(s) clos seront effacés. Les noms, le décompte et le journal d'audit sont conservés. Irréversible.`,
        confirmLabel: 'Purger', danger: true,
      });
      if (!ok) return;
      for (const election of closed) {
        setElection(election.id, (current) => ({
          ...current,
          electorate: current.electorate.map((v) => ({ ...v, email: '', phone: '' })),
        }));
      }
      toast('Coordonnées purgées des scrutins clos.', 'ok');
    },

    async reset() {
      const ok = await confirmDialog({
        title: 'Tout effacer ?',
        text: 'Scrutins, corps électoraux, bulletins et journaux seront supprimés, puis le jeu de démonstration régénéré. Exportez vos données d’abord si vous souhaitez les conserver.',
        confirmLabel: 'Effacer et régénérer', danger: true,
      });
      if (!ok) return;
      await resetAll({ withDemo: true });
      toast('Instance réinitialisée avec la démonstration.', 'ok');
    },

    async resetEmpty(ctx) {
      const ok = await confirmDialog({
        title: 'Repartir d’une instance vide ?',
        text: 'Tout sera effacé, sans jeu de démonstration. C’est l’état d’une installation neuve.',
        confirmLabel: 'Effacer tout', danger: true,
      });
      if (!ok) return;
      await resetAll({ withDemo: false });
      toast('Instance vidée.', 'ok');
      ctx.go('/scrutins');
    },
  },
};
