/**
 * about.js — note de conception.
 *
 * Cette page n'appartient pas au produit : elle documente le prototype, ses
 * hypothèses et ses limites. Une plateforme de vote qui ne dit pas ce qu'elle
 * ne garantit pas demande une confiance qu'elle n'a pas méritée.
 */

import { html } from '../core/dom.js';
import { card, pageHead, banner, table, keyValues } from '../ui/components.js';

const OBJECTS = [
  ['Scrutin', "Une question et ses règles : mode, options, quorum, majorité, fenêtre de vote, confidentialité. Porte son propre corps électoral, copié et non référencé, pour qu'une mise à jour de l'annuaire ne réécrive jamais l'histoire d'un scrutin passé."],
  ['Option', "Réponse, candidature ou proposition à classer. Sa nature (pour, contre, abstention, candidat) n'est pas décorative : elle décide de son entrée dans les suffrages exprimés."],
  ['Électeur', "Identité, contact, collège, nombre de voix. Reçoit à l'ouverture un jeton à usage unique, et un code imprimable s'il n'a pas d'adresse e-mail."],
  ['Jeton', "Droit de déposer un bulletin, une fois. Détruit au dépôt — c'est le point de rupture entre l'identité et le vote."],
  ['Émargement', "Ligne nominative : qui a voté, à quelle heure, avec combien de pouvoirs. Jamais ce qui a été voté."],
  ['Bulletin', "Choix, poids en voix, reçu de dépôt. Aucun identifiant d'électeur, à aucun moment. Inséré à une position aléatoire dans l'urne."],
  ['Pouvoir', "Transfert de voix d'un mandant vers un mandataire, plafonné par les statuts. Un refus est enregistré comme tel, pas effacé."],
  ['Événement', "Ligne du journal d'audit : acteur, action, horodatage, empreinte de l'entrée précédente. En ajout seul."],
];

const DECISIONS = [
  {
    title: 'Un seul parcours, avec des défauts sains',
    body: "Chaque règle statutaire est présente mais préréglée sur l'usage associatif français le plus courant : quorum à la moitié des inscrits, majorité absolue des suffrages exprimés, abstentions exclues du calcul mais comptées dans le quorum, pouvoirs plafonnés à trois. Le trésorier bénévole traverse l'assistant en acceptant tous les défauts ; l'organisation aux statuts inhabituels déplie les options avancées.",
    rejected: "Deux parcours distincts, « simple » et « expert » : ils obligent à choisir son camp avant de savoir ce dont on a besoin, et produisent deux interfaces à maintenir — donc deux façons de se tromper.",
  },
  {
    title: "Le secret est une propriété du code, pas une mention d'écran",
    body: "La séparation identité / bulletin n'est pas obtenue en masquant une colonne : le bulletin ne contient aucun identifiant d'électeur, et un test le vérifie à chaque exécution. De même, la fonction de dépouillement refuse de produire un résultat tant que l'urne n'est pas scellée, et n'en produit aucun si le quorum a manqué. Ce qui n'existe pas ne peut pas fuiter par la console.",
    rejected: "Un chiffrement de bout en bout affiché comme argument commercial : invérifiable par l'utilisateur, et contradictoire avec un dépouillement par des scrutateurs bénévoles.",
  },
  {
    title: 'Aucun cul-de-sac',
    body: "Un adhérent sans adresse e-mail reçoit un code imprimable qui ouvre le même bulletin. Un lien déjà consommé propose de signaler un vote contesté. Un quorum manqué produit un procès-verbal de carence plutôt qu'une page d'erreur. Chaque impasse comporte une sortie, et chaque sortie est journalisée.",
    rejected: "Renvoyer vers « contactez l'organisateur » : c'est reporter sur un bénévole un problème que l'outil pouvait résoudre.",
  },
];

const EXTENSIONS = [
  ['Un nouveau mode de scrutin', 'Ajouter une entrée dans METHODS (src/domain/schema.js) et une fonction de comptage dans tally.js. Les vues lisent la définition : aucune n’encode de liste de modes.'],
  ['Une nouvelle règle de majorité', 'Une entrée dans MAJORITIES avec sa fonction required(). L’assistant, le dépouillement et le procès-verbal la reprennent automatiquement.'],
  ['Une autre forme d’organisation', 'Collèges, voix pondérées et plafond de pouvoirs sont des attributs du corps électoral, pas du code. Une copropriété (tantièmes) ou une coopérative (parts sociales) se configurent sans développement.'],
  ['Une langue supplémentaire', 'Copier src/i18n/en.js, traduire, déclarer la langue dans core/i18n.js. Les clés absentes retombent sur le français.'],
  ['Un vrai serveur', 'src/core/storage.js est le seul module qui connaît localStorage. Le remplacer par des appels HTTP suffit : le domaine, lui, n’a aucune dépendance au navigateur.'],
];

export default {
  id: 'about',

  render(ctx) {
    return html`<div class="view">
      ${pageHead({
    title: 'Note de conception',
    lead: 'Ce que ce prototype suppose, ce qu’il garantit, et ce qu’il ne garantit pas.',
  })}

      ${banner({
    tone: 'warn',
    title: 'Prototype, et non système de vote déployable en l’état.',
    body: html`Tout s'exécute dans votre navigateur : il n'y a ni serveur, ni authentification, ni
      envoi de courriel. Quiconque ouvre la console peut lire et modifier les données locales.
      Ce que le prototype démontre, c'est la <strong>logique métier</strong> — dépouillement, quorum,
      séparation identité/bulletin, journal chaîné — pas l'infrastructure qui la protégerait en
      production.`,
  })}

      <div style="margin-top:var(--s-6)">
        ${card({
    title: 'Ce qui est réellement calculé',
    hint: 'Aucun chiffre de cette application n’est écrit en dur.',
    body: html`<ul style="padding-left:var(--s-5);color:var(--text-2)">
          <li>Les bulletins de démonstration sont déposés un à un par le moteur, jetons compris.</li>
          <li>Le décompte applique la règle de majorité configurée, sur les suffrages réellement exprimés.</li>
          <li>Le quorum est évalué sur les représentés — présents plus pouvoirs.</li>
          <li>Le procès-verbal relit le scrutin : il ne peut pas contredire le décompte.</li>
          <li>Le journal d'audit est chaîné en SHA-256 et vérifiable depuis l'écran « Journal ».</li>
        </ul>`,
  })}
      </div>

      <div style="margin-top:var(--s-5)">
        ${card({
    title: 'Objets de données',
    body: html`${table({
    head: ['Objet', 'Rôle'],
    rows: OBJECTS.map(([name, description]) => [
      html`<span class="table__main nowrap">${name}</span>`,
      html`<span class="choice__sub">${description}</span>`,
    ]),
  })}
        <div style="margin-top:var(--s-4)">${banner({
    tone: 'brand',
    title: 'La relation décisive est une non-relation.',
    body: html`En scrutin secret, <strong>Émargement</strong> et <strong>Bulletin</strong> descendent
      tous deux du <strong>Jeton</strong>, mais aucune clé ne les relie entre eux. Le jeton est détruit
      au dépôt ; ne subsistent qu'une ligne d'émargement nominative et un bulletin anonyme portant un
      reçu distinct.`,
  })}</div>`,
  })}
      </div>

      <div style="margin-top:var(--s-5)">
        ${card({
    title: 'Trois décisions structurantes',
    body: html`<div class="stack" style="--gap:var(--s-5)">
          ${DECISIONS.map((decision) => html`<div>
            <h3 style="font-size:var(--text-lg);margin-bottom:var(--s-2)">${decision.title}</h3>
            <p class="choice__sub" style="margin-bottom:var(--s-2)">${decision.body}</p>
            <p class="field__hint"><strong>Écarté :</strong> ${decision.rejected}</p>
          </div>`)}
        </div>`,
  })}
      </div>

      <div style="margin-top:var(--s-5)">
        ${card({
    title: 'Points d’extension',
    body: table({
      head: ['Pour…', 'Il suffit de…'],
      rows: EXTENSIONS.map(([what, how]) => [
        html`<span class="table__main">${what}</span>`,
        html`<span class="choice__sub">${how}</span>`,
      ]),
    }),
  })}
      </div>

      <div style="margin-top:var(--s-5)">
        ${card({
    title: 'Ce que le prototype ne garantit pas',
    body: html`<ul style="padding-left:var(--s-5);color:var(--text-2)">
          <li><strong>L'authentification.</strong> Le jeton fait office d'identité : quiconque détient
            le lien peut voter. En production, il faudrait un envoi par un canal maîtrisé, et
            idéalement un second facteur pour les scrutins sensibles.</li>
          <li><strong>L'inviolabilité.</strong> Le journal chaîné rend une altération
            <em>détectable</em>, pas impossible : sans ancrage extérieur, une chaîne peut être
            entièrement reconstruite. Un horodatage tiers ou une publication périodique des empreintes
            lèverait cette limite.</li>
          <li><strong>La confidentialité vis-à-vis de l'hébergeur.</strong> Les bulletins ne sont pas
            chiffrés côté client. Un serveur malveillant pourrait les lire. Le chiffrement à seuil,
            avec des clés réparties entre scrutateurs, est la réponse usuelle — hors du champ d'un
            prototype sans serveur.</li>
          <li><strong>La résistance à la coercition.</strong> Comme tout vote à distance, rien
            n'empêche un tiers d'assister au vote. Aucune solution technique n'y répond ; seule
            l'option d'un vote en présentiel le permet.</li>
        </ul>`,
  })}
      </div>

      <div style="margin-top:var(--s-5)">
        ${card({
    title: 'Cette instance',
    body: keyValues([
      ['Version', `${ctx.config.app.name} ${ctx.config.app.version}`],
      ['Licence', ctx.config.app.license],
      ['Dépendances externes', 'aucune — hors les polices, supprimables'],
      ['Code source', html`<a href="${ctx.config.app.repository}" target="_blank" rel="noopener">dépôt GitHub</a>`],
    ]),
  })}
      </div>
    </div>`;
  },
};
