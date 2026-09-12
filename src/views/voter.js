/**
 * voter.js — le bulletin, côté votant.
 *
 * C'est le seul écran que verront 95 % des utilisateurs, une seule fois,
 * souvent depuis un téléphone dans les transports. Trois conséquences tenues
 * de bout en bout : aucun compte à créer, une seule décision par écran, et
 * chaque message d'erreur dit ce qu'il faut faire ensuite.
 */

import { html, raw } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import { btn, card, banner, choice } from '../ui/components.js';
import { formatDate, formatRelative } from '../core/format.js';
import { t } from '../core/i18n.js';
import { METHODS, STATUS } from '../domain/schema.js';
import {
  findVoterByToken, castBallot, isVotingOpen, proxiesHeldBy, CAST_ERRORS, reportIncident,
} from '../domain/election.js';
import {
  emptyChoice, toggleOption, moveInOrder, isComplete, guidance, describeChoice, maxSelections,
} from '../domain/ballot.js';
import { getElection, applyOperation, setUi } from '../app.js';
import { toast } from '../ui/feedback.js';

/** Cartouche commun à tous les états du parcours votant. */
function frame(config, body, { wide = false } = {}) {
  return html`<div class="fullscreen">
    <header class="app-header">
      <span class="brand">
        <span class="brand__mark" aria-hidden="true">${config.app.mark}</span>
        <span class="brand__name">${config.app.name}</span>
      </span>
      <span class="brand__org">${config.organization.name || config.app.tagline}</span>
      <div class="app-header__tools">
        <button type="button" class="btn btn--ghost btn--icon" data-act="cycleTheme"
          aria-label="Changer de thème">${raw(icon('moon', { size: 17 }))}</button>
      </div>
    </header>
    <div class="ballot" style="${wide ? 'width:min(46rem,100%)' : ''}">${body}</div>
  </div>`;
}

/** Écran d'accueil : saisie du code reçu. */
function accessScreen(ctx, { error = '' } = {}) {
  const elections = ctx.elections.filter((e) => e.status === STATUS.OPEN);
  return frame(ctx.config, html`
    <div class="ballot__head">
      <h1 class="ballot__title" id="view-title" tabindex="-1">${t('voter.access.title', 'Accéder à mon bulletin')}</h1>
      <p class="ballot__desc">${t('voter.access.lead', "Saisissez le code figurant dans votre invitation, ou ouvrez directement le lien qui vous a été transmis. Aucun compte n'est nécessaire.")}</p>
    </div>

    ${error ? banner({ tone: 'danger', title: t('voter.access.denied', 'Accès refusé.'), body: error }) : ''}

    ${card({
    body: html`<form data-act="submitToken">
        <div class="field">
          <label class="field__label" for="token">${t('voter.access.code', "Code d'accès")}</label>
          <input class="input mono" id="token" name="token" autocomplete="off"
            style="text-transform:uppercase;letter-spacing:.08em" placeholder="XXXXXXX" required>
          <p class="field__hint">${t('voter.access.codeHint', 'Sept caractères pour un code remis en main propre, seize pour un lien reçu par e-mail.')}</p>
        </div>
        ${btn({ label: t('voter.access.open', 'Ouvrir mon bulletin'), type: 'submit', variant: 'primary', full: true, size: 'lg' })}
      </form>`,
  })}

    ${elections.length ? html`<div style="margin-top:var(--s-5)">
      ${card({
    modifier: 'card--flat',
    title: t('voter.access.openBallots', 'Scrutins ouverts'),
    hint: t('voter.access.needCode', 'Vous devez disposer d’un code pour y participer.'),
    body: html`<ul style="list-style:none;padding:0">${elections.map((e) => html`
          <li style="padding:var(--s-2) 0;border-bottom:1px solid var(--border)">
            <strong style="font-size:var(--text-sm)">${e.title}</strong>
            <span class="choice__sub" style="display:block">
              ${e.closesAt ? `clôture ${formatRelative(e.closesAt)}` : 'clôture manuelle'}</span>
          </li>`)}</ul>`,
  })}
    </div>` : ''}

    <p class="center dim" style="margin-top:var(--s-6);font-size:var(--text-xs)">
      Code perdu ? L'organisateur de votre ${ctx.config.vocabulary.body} peut vous en remettre un nouveau.
      <br><a href="#/scrutins">Retour à l'espace organisateur</a>
    </p>`);
}

/* --- Le bulletin ------------------------------------------------------------ */

function ballotScreen(ctx, election, voter, currentChoice) {
  const method = METHODS[election.method];
  const proxies = proxiesHeldBy(election, voter.id);
  const byId = new Map(election.electorate.map((v) => [v.id, v]));
  const ready = isComplete(election, currentChoice);

  const options = method.pick === 'order'
    ? html`<div class="stack" style="--gap:var(--s-2)">
        ${(currentChoice.order || []).map((id, index) => {
    const option = election.options.find((o) => o.id === id);
    return html`<div class="rank-row">
            <span class="rank-row__num">${index + 1}</span>
            <span class="grow">
              <span style="font-weight:600;font-size:var(--text-sm)">${option.label}</span>
              ${option.sublabel ? html`<span class="choice__sub" style="display:block">${option.sublabel}</span>` : ''}
            </span>
            <span class="rank-row__moves">
              <button type="button" class="rank-row__move" data-act="moveUp" data-id="${id}"
                aria-label="Monter ${option.label}" ${raw(index === 0 ? 'disabled' : '')}>${raw(icon('arrowUp', { size: 14 }))}</button>
              <button type="button" class="rank-row__move" data-act="moveDown" data-id="${id}"
                aria-label="Descendre ${option.label}" ${raw(index === (currentChoice.order || []).length - 1 ? 'disabled' : '')}>${raw(icon('arrowDown', { size: 14 }))}</button>
            </span>
          </div>`;
  })}
      </div>`
    : html`<div class="ballot__options" role="${method.pick === 'many' ? 'group' : 'radiogroup'}"
        aria-label="Votre choix">
        ${election.options.map((option) => choice({
    title: option.label,
    sub: option.sublabel,
    box: method.pick === 'many',
    role: method.pick === 'many' ? 'checkbox' : 'radio',
    checked: method.pick === 'many'
      ? (currentChoice.optionIds || []).includes(option.id)
      : currentChoice.optionId === option.id,
    act: 'pick',
    data: { id: option.id },
  }))}
      </div>`;

  return frame(ctx.config, html`
    <div class="ballot__head">
      <p class="ballot__org">${election.ref} · ${ctx.config.organization.name || ''}</p>
      <span class="badge badge--brand">${method.label}</span>
      <h1 class="ballot__title" id="view-title" tabindex="-1" style="margin-top:var(--s-3)">${election.title}</h1>
      ${election.description ? html`<p class="ballot__desc">${election.description}</p>` : ''}
    </div>

    ${election.attachments.length ? html`<div style="margin-bottom:var(--s-4)">
      ${banner({
    tone: 'neutral',
    body: html`${election.attachments.length} document(s) joint(s) :
      ${election.attachments.map((f) => f.name).join(', ')}.`,
  })}
    </div>` : ''}

    ${proxies.length ? html`<div style="margin-bottom:var(--s-4)">
      ${banner({
    tone: 'brand',
    title: `Vous votez avec ${proxies.length + 1} voix.`,
    body: `Votre voix, et celles de ${proxies.map((p) => byId.get(p.fromId)?.name).filter(Boolean).join(', ')}, qui vous ont donné pouvoir.`,
  })}
    </div>` : ''}

    ${method.pick === 'order'
    ? html`<p class="field__hint" style="margin-bottom:var(--s-3)">Classez les ${election.options.length} propositions,
        de la plus à la moins prioritaire.</p>`
    : method.pick === 'many'
      ? html`<p class="field__hint" style="margin-bottom:var(--s-3)">Cochez jusqu'à ${maxSelections(election)} réponse(s).</p>`
      : ''}

    ${options}

    <div style="margin-top:var(--s-4)">
      ${banner({
    tone: 'neutral',
    glyph: '▪',
    body: election.secret
      ? t('voter.secret', 'Bulletin secret. Votre nom apparaîtra dans la liste d’émargement, jamais à côté de votre choix.')
      : t('voter.public', 'Vote nominatif : votre nom sera publié à côté de votre choix.'),
  })}
    </div>

    <div class="ballot__sticky">
      ${btn({ label: t('common.continue', 'Continuer'), act: 'review', variant: 'primary', full: true, size: 'lg', disabled: !ready })}
      <p class="center dim" style="margin-top:var(--s-2);font-size:var(--text-xs)">${guidance(election, currentChoice)}</p>
      ${method.pick !== 'order' ? html`<div class="center" style="margin-top:var(--s-2)">
        ${btn({ label: t('voter.blank', 'Voter blanc'), act: 'voteBlank', variant: 'ghost', size: 'sm' })}
      </div>` : ''}
    </div>`);
}

/* --- Confirmation, reçu, impasses ------------------------------------------- */

function confirmScreen(ctx, election, currentChoice, sending) {
  const recap = describeChoice(election, currentChoice);
  return frame(ctx.config, html`
    ${btn({ label: t('voter.confirm.edit', 'Modifier mon choix'), act: 'back', variant: 'ghost', size: 'sm', iconName: 'chevronLeft' })}
    <div class="ballot__head" style="margin-top:var(--s-4)">
      <h1 class="ballot__title" id="view-title" tabindex="-1">${t('voter.confirm.title', 'Confirmez votre vote')}</h1>
      <p class="ballot__desc">${t('voter.confirm.body', "Une fois déposé, votre bulletin ne peut plus être retiré ni modifié : il rejoint l'urne scellée.")}</p>
    </div>

    ${card({
    body: html`
        <p class="field__label">${t('voter.confirm.yourBallot', 'Votre bulletin')}</p>
        <div class="stack" style="--gap:var(--s-2)">
          ${recap.map((item) => html`<div class="row row--tight">
            ${item.rank ? html`<span class="rank-row__num">${item.rank}</span>` : raw(icon('check'))}
            <span style="font-weight:600">${item.label}</span>
          </div>`)}
        </div>`,
  })}

    <div class="ballot__sticky">
      ${btn({
    label: sending ? t('voter.confirm.sending', 'Dépôt en cours…') : t('voter.confirm.cast', 'Déposer mon bulletin'),
    act: 'submitBallot', variant: 'primary', full: true, size: 'lg', busy: sending,
  })}
      <p class="center dim" style="margin-top:var(--s-2);font-size:var(--text-xs)">
        ${election.closesAt ? `Vote ouvert jusqu'au ${formatDate(election.closesAt, 'full')}.` : ''}</p>
    </div>`);
}

function receiptScreen(ctx, election, receipt) {
  return frame(ctx.config, html`
    <div class="ballot__icon" style="background:var(--ok-soft);color:var(--ok)">${raw(icon('check', { size: 26 }))}</div>
    <div class="ballot__head">
      <h1 class="ballot__title" id="view-title" tabindex="-1">${t('voter.done.title', 'Votre vote est enregistré')}</h1>
      <p class="ballot__desc">Vous avez voté le ${formatDate(new Date(), 'full')}. Votre nom est porté sur
        la liste d'émargement ; votre choix, lui, n'est relié à personne.</p>
    </div>

    ${card({
    body: html`
        <p class="field__label">${t('voter.done.receipt', 'Preuve de dépôt')}</p>
        <p class="receipt" style="margin-bottom:var(--s-3)">${receipt}</p>
        <p class="choice__sub">${t('voter.done.receiptHint', "Ce code figurera dans la liste des bulletins déposés publiée après la clôture. Il prouve que votre bulletin est dans l'urne, sans rien révéler de son contenu. Notez-le : il ne vous sera pas renvoyé.")}</p>
        <div style="margin-top:var(--s-4)">
          ${btn({ label: t('voter.done.copy', 'Copier le code'), act: 'copyReceipt', data: { receipt }, iconName: 'copy', full: true })}
        </div>`,
  })}

    <p class="center dim" style="margin-top:var(--s-5);font-size:var(--text-xs)">
      ${election.closesAt
    ? `Les résultats seront publiés après le ${formatDate(election.closesAt, 'full')}.`
    : 'Les résultats seront publiés après la clôture du scrutin.'}
      <br><a href="#/vote">Déposer un autre bulletin</a>
    </p>`);
}

/** Impasses : lien déjà consommé, scrutin clos, pas encore ouvert. */
function deadEndScreen(ctx, election, kind) {
  const screens = {
    'token-used': {
      tone: 'warn', glyph: '▪', title: t('voter.used.title', 'Ce lien a déjà servi'),
      body: t('voter.used.body', "Un bulletin a été déposé depuis votre lien. Un électeur ne dispose que d'une voix : le lien s'est consommé à cet instant."),
      extra: html`<p class="choice__sub">Vous ne reconnaissez pas ce vote ? Signalez-le : l'organisateur et
        les scrutateurs recevront l'alerte, qui sera inscrite au journal d'audit. Le bulletin déposé ne peut
        être ni lu ni retiré, mais l'incident sera mentionné au procès-verbal.</p>
        <div style="margin-top:var(--s-4)">${btn({
    label: 'Signaler un vote que je n’ai pas fait', act: 'report', variant: 'quiet-danger', full: true,
  })}</div>`,
    },
    closed: {
      tone: 'danger', glyph: '×', title: t('voter.closed.title', 'Le vote est clos'),
      body: election?.seal
        ? `Le scrutin s'est achevé le ${formatDate(election.seal.at, 'full')}, et l'urne a été scellée à cet instant précis. Votre bulletin ne peut plus être déposé.`
        : "Le scrutin est clos : votre bulletin ne peut plus être déposé.",
      extra: html`<p class="choice__sub">En cas d'empêchement durable, pensez au pouvoir : vous pourrez confier
        votre voix à un autre membre lors du prochain scrutin.</p>`,
    },
    'not-open': {
      tone: 'neutral', glyph: '!', title: t('voter.early.title', 'Le vote n’est pas encore ouvert'),
      body: election?.opensAt
        ? `Le scrutin ouvrira le ${formatDate(election.opensAt, 'full')}. Conservez votre lien : il restera valable.`
        : "Le scrutin n'est pas encore ouvert. Conservez votre lien.",
      extra: '',
    },
    'unknown-token': {
      tone: 'danger', glyph: '×', title: t('voter.unknown.title', 'Code non reconnu'),
      body: t('voter.unknown.body', "Ce code ne correspond à aucun électeur d'un scrutin ouvert. Vérifiez la saisie, ou demandez un nouveau lien à l'organisateur."),
      extra: html`<div style="margin-top:var(--s-4)">${btn({ label: 'Ressaisir un code', href: '#/vote', full: true })}</div>`,
    },
  };
  const screen = screens[kind] || screens['unknown-token'];

  return frame(ctx.config, html`
    <div class="ballot__icon" style="background:var(--${screen.tone === 'danger' ? 'danger' : screen.tone === 'warn' ? 'warn' : 'neutral'}-soft);color:var(--${screen.tone === 'neutral' ? 'text-3' : screen.tone})">
      ${screen.glyph}</div>
    <div class="ballot__head">
      <h1 class="ballot__title" id="view-title" tabindex="-1">${screen.title}</h1>
      <p class="ballot__desc">${screen.body}</p>
    </div>
    ${card({ body: html`${screen.extra}` })}
    <p class="center dim" style="margin-top:var(--s-5);font-size:var(--text-xs)">
      <a href="#/vote">Retour à l'accueil votant</a></p>`);
}

/* --- Vue --------------------------------------------------------------------- */

/** Retrouve l'électeur à partir d'un code, dans un scrutin donné ou dans tous. */
function resolveAccess(ctx) {
  const { eid, token } = ctx.params;
  if (!token) return null;
  const candidates = eid ? [getElection(eid)].filter(Boolean) : ctx.elections;
  for (const election of candidates) {
    const voter = findVoterByToken(election, token);
    if (voter) return { election, voter };
  }
  // Un jeton consommé n'existe plus : on cherche alors l'émargement correspondant.
  return { election: eid ? getElection(eid) : null, voter: null };
}

export default {
  id: 'voter',
  layout: 'bare',

  render(ctx) {
    const { ui } = ctx;
    if (!ctx.params.token) return accessScreen(ctx, { error: ui.voterError });

    const access = resolveAccess(ctx);

    // Le reçu passe avant tout : à ce stade le jeton a justement été détruit,
    // et l'électeur serait sinon renvoyé vers « ce lien a déjà servi » — ce qui
    // est vrai, mais serait un aveuglant contresens juste après son vote.
    if (ctx.ui.voterReceipt) {
      const election = access?.election || getElection(ctx.params.eid);
      if (election) return receiptScreen(ctx, election, ctx.ui.voterReceipt);
    }

    if (!access?.voter) {
      const election = access?.election;
      if (election && election.status === STATUS.CLOSED) return deadEndScreen(ctx, election, 'closed');
      // Jeton absent de la liste : soit inconnu, soit déjà consommé.
      const used = election?.roster?.length > 0;
      return deadEndScreen(ctx, election, used ? 'token-used' : 'unknown-token');
    }

    const { election, voter } = access;
    if (voter.tokenUsed) return deadEndScreen(ctx, election, 'token-used');
    if (election.status === STATUS.CLOSED) return deadEndScreen(ctx, election, 'closed');
    if (!isVotingOpen(election)) {
      const early = election.opensAt && Date.now() < new Date(election.opensAt).getTime();
      return deadEndScreen(ctx, election, early ? 'not-open' : 'closed');
    }

    const currentChoice = ui.voterChoice && ui.voterChoiceFor === election.id
      ? ui.voterChoice
      : emptyChoice(election);

    return ui.voterStep === 'confirm'
      ? confirmScreen(ctx, election, currentChoice, ui.voterSending)
      : ballotScreen(ctx, election, voter, currentChoice);
  },

  /** Le parcours votant repart toujours de zéro : aucun choix ne survit à la page. */
  mounted() {
    setUi({ voterChoice: null, voterChoiceFor: null, voterStep: 'ballot', voterReceipt: null, voterError: '', voterSending: false });
  },

  actions: {
    submitToken(ctx, { el }) {
      const value = new FormData(el).get('token');
      const token = String(value || '').trim().toUpperCase();
      if (!token) return;
      const target = ctx.elections.find((e) => findVoterByToken(e, token));
      if (!target) {
        setUi({ voterError: "Ce code ne correspond à aucun électeur. Vérifiez la saisie, ou demandez un nouveau lien à l'organisateur." });
        return;
      }
      setUi({ voterError: '' });
      ctx.go(`/vote/${target.id}/${token}`);
    },

    pick(ctx, { data }) {
      const election = getElection(resolveAccess(ctx).election.id);
      const current = ctx.ui.voterChoice && ctx.ui.voterChoiceFor === election.id
        ? ctx.ui.voterChoice : emptyChoice(election);
      const next = toggleOption(election, current, data.id);
      if (next === current) { toast(`Vous ne pouvez pas cocher plus de ${maxSelections(election)} réponses.`); return; }
      setUi({ voterChoice: next, voterChoiceFor: election.id });
    },

    moveUp: (ctx, { data }) => moveChoice(ctx, data.id, -1),
    moveDown: (ctx, { data }) => moveChoice(ctx, data.id, 1),

    voteBlank(ctx) {
      const election = resolveAccess(ctx).election;
      setUi({ voterChoice: { blank: true }, voterChoiceFor: election.id, voterStep: 'confirm' });
    },

    review: () => setUi({ voterStep: 'confirm' }),
    back: () => setUi({ voterStep: 'ballot' }),

    async submitBallot(ctx) {
      const { election, voter } = resolveAccess(ctx);
      const currentChoice = ctx.ui.voterChoice || emptyChoice(election);
      setUi({ voterSending: true });

      const result = await applyOperation(election.id, (current) => castBallot(current, voter.token, currentChoice));
      if (!result.ok) {
        setUi({ voterSending: false, voterStep: 'ballot' });
        toast(CAST_ERRORS[result.error] || 'Le dépôt a échoué. Votre lien reste valable, réessayez.', 'danger');
        return;
      }
      setUi({ voterSending: false, voterReceipt: result.receipt });
    },

    async copyReceipt(ctx, { data }) {
      try {
        await navigator.clipboard.writeText(data.receipt);
        toast('Preuve de dépôt copiée.', 'ok');
      } catch {
        toast('Copie impossible : notez le code manuellement.', 'danger');
      }
    },

    async report(ctx) {
      const election = resolveAccess(ctx)?.election;
      if (!election) return;
      await applyOperation(election.id, (current) => reportIncident(
        current, 'Un électeur conteste un vote déposé depuis son lien', 'Électeur',
      ));
      toast('Signalement transmis et inscrit au journal d’audit.', 'ok');
    },
  },
};

function moveChoice(ctx, optionId, delta) {
  const election = resolveAccess(ctx).election;
  const current = ctx.ui.voterChoice && ctx.ui.voterChoiceFor === election.id
    ? ctx.ui.voterChoice : emptyChoice(election);
  setUi({ voterChoice: moveInOrder(current, optionId, delta), voterChoiceFor: election.id });
}
