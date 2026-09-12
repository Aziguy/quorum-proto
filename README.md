# Quorum — plateforme de vote libre et auditable

Prototype fonctionnel d'une plateforme de vote pour **associations, coopératives,
conseils d'administration, établissements scolaires et organisations politiques**.
Il n'est lié à aucune organisation : tout ce qui est propre à une instance vit
dans un fichier de configuration.

**Démonstration : <https://aziguy.github.io/quorum-proto/>**

> **Statut : prototype.** Le moteur métier — dépouillement, quorum, séparation
> identité/bulletin, journal chaîné — est réel, calculé et testé. L'infrastructure
> qui le protégerait en production (serveur, authentification, envoi de courriels,
> chiffrement des bulletins) ne l'est pas.
> [docs/SECURITY-MODEL.md](docs/SECURITY-MODEL.md) énumère précisément ce qui est
> garanti et ce qui ne l'est pas.

**Sommaire** — [Le prototype pas à pas](#le-prototype-pas-à-pas) ·
[Installer](#installer) · [Configurer](#configurer-son-instance) ·
[Tester](#tester) · [Structure](#structure) · [Contribuer](#contribuer)

| | |
|---|---|
| [1. Créer le scrutin](#étape-1--créer-le-scrutin) | [7. La salle de vote](#étape-7--la-salle-de-vote) |
| [2. L'objet du vote](#étape-2--lobjet-du-vote) | [8. Voter](#étape-8--voter) |
| [3. Le mode de scrutin](#étape-3--le-mode-de-scrutin) | [9. Suivre la participation](#étape-9--suivre-la-participation) |
| [4. Le corps électoral](#étape-4--le-corps-électoral) | [10. Clôturer](#étape-10--clôturer) |
| [5. Les règles de décision](#étape-5--les-règles-de-décision) | [11. Les résultats](#étape-11--les-résultats) |
| [6. Ouvrir le scrutin](#étape-6--ouvrir-le-scrutin) | [12. Le PV et le journal](#étape-12--le-procès-verbal-et-le-journal) |

---

# Le prototype pas à pas

Le parcours ci-dessous est celui d'une élection réelle, du premier clic au
procès-verbal. Les chiffres cités proviennent d'un scrutin joué de bout en bout
pendant les tests : 28 électeurs, 27 votants, une égalité à départager.

Chaque étape indique **ce que vous faites**, **ce que vous voyez**, et **ce qui
se passe réellement** — quel module travaille, quelle donnée est écrite.

## Avant de commencer : d'où viennent les données

Au premier lancement, l'application génère **sept scrutins de démonstration**.
Ils ne sont pas des captures d'écran : chaque bulletin est déposé par le moteur,
par la même fonction qu'un vote réel. Ils couvrent toutes les issues possibles —
en cours, brouillon, adopté aux deux tiers, égalité, quorum manqué, classement de
préférences.

Tout est conservé dans le **stockage local de votre navigateur**, et nulle part
ailleurs. Il n'y a pas de serveur. Deux conséquences :

- vos données ne partent jamais ;
- vider les données du site les efface définitivement — l'export JSON
  (*Réglages → Exporter*) est la seule sauvegarde.

Pour repartir d'une instance vierge : *Données & RGPD → Tout effacer*.

---

## Étape 1 — Créer le scrutin

**Vous faites :** *Nouveau scrutin*, dans la barre latérale.

**Vous voyez :** l'assistant s'ouvre directement sur l'étape 1, avec une
référence déjà attribuée — `SCR-2026-017` — et la mention « enregistré
automatiquement ».

**Ce qui se passe :** le brouillon est créé *avant* que vous saisissiez quoi que
ce soit, puis l'URL est remplacée par celle du brouillon
(`#/scrutins/scr_…/assistant`). Ce n'est pas un détail : recharger la page ou
fermer l'onglet ne perd rien, et revenir sur `/scrutins/nouveau` ne crée pas un
second brouillon.

> La création a lieu dans `mounted()`, jamais pendant le rendu : un effet
> déclenché depuis `render()` provoquerait un rendu en boucle.

## Étape 2 — L'objet du vote

**Vous faites :** vous saisissez l'intitulé et, si besoin, l'exposé des motifs.

**Vous voyez :** l'aperçu du bulletin, à droite, se met à jour **pendant que vous
tapez**, sans que le curseur bouge.

**Ce qui se passe :** les champs de texte n'entraînent pas de rendu complet. Ils
écrivent en silence (`setElectionSilently`) puis mettent à jour le seul fragment
concerné de l'aperçu. Re-rendre à chaque frappe déplacerait le curseur.

L'intitulé sera repris **mot pour mot** au procès-verbal : écrivez-le comme une
résolution, pas comme un titre.

## Étape 3 — Le mode de scrutin

**Vous faites :** vous choisissez parmi cinq formulations, puis vous saisissez les
propositions ou les candidatures.

| Mode | Pour quoi | Décompte |
|---|---|---|
| Oui / Non / Abstention | Résolution, quitus, approbation des comptes | Majorité sur les suffrages exprimés |
| Choisir une personne | Président, délégué de classe | Majorité, second tour possible |
| Élire plusieurs personnes | Bureau, N sièges | Les N premiers |
| Classer par préférence | Priorités budgétaires | Points de Borda, vainqueur de Condorcet signalé |
| Choix multiple | Sondage sans effet juridique | Approbations cumulées |

**Ce qui se passe :** changer de mode recompose les options. Pour une résolution,
les trois réponses sont **imposées et non modifiables** : leur nature (*pour*,
*contre*, *abstention*) décide de leur entrée dans les suffrages exprimés, ce qui
n'est pas un choix de vocabulaire mais une règle de calcul.

Les options avancées, repliées par défaut, ajoutent le second tour automatique et
le vote nominatif.

## Étape 4 — Le corps électoral

**Vous faites :** *Coller une liste* ou *Importer un fichier CSV*. Le format
attendu :

```
Nom ; Prénom ; E-mail ; Collège ; Voix
Diagne ; Awa ; awa.diagne@exemple.org ; Membres actifs ; 1
Le Goff ; Yann ; yann.legoff@exemple.org ; Membres bienfaiteurs ; 3
```

**Vous voyez :** « **28 électeurs reconnus** », puis un avertissement si certains
n'ont pas d'adresse e-mail.

**Ce qui se passe :**

- Le séparateur est deviné — virgule, point-virgule ou tabulation — et le BOM
  d'Excel est ignoré. Les en-têtes sont normalisés : `E-mail`, `Email` et
  `Courriel` conduisent au même champ.
- Les **doublons d'adresse e-mail sont fusionnés** silencieusement : importer
  deux fois le même fichier est l'erreur la plus fréquente, et la plus bénigne.
- Les colonnes `Collège` et `Voix` sont facultatives. Elles ne servent que si
  vous activez les options correspondantes, juste en dessous.
- L'import est inscrit au journal d'audit (`electorate.imported`), avec le nombre
  de lignes ajoutées et fusionnées.

Trois cas particuliers se règlent ici, tous désactivés par défaut :

| Option | Ce qu'elle change |
|---|---|
| **Collèges** | Les résultats détaillent la participation par catégorie de membres |
| **Voix pondérées** | La colonne `Voix` est lue : le décompte additionne des voix, pas des bulletins |
| **Pouvoirs** | Un membre empêché confie sa voix à un autre, dans la limite d'un plafond |

## Étape 5 — Les règles de décision

**Vous faites :** vous réglez la confidentialité, le quorum, la majorité, le sort
des votes blancs et les dates.

**Vous voyez :** le quorum se calcule devant vous — « Sur 28 inscrits, il faudra
**14 votants** ». Le récapitulatif final reprend tout.

**Ce qui se passe :**

- **Bulletin secret** ou **vote nominatif**. Ce réglage ne pourra plus changer
  après l'ouverture. En scrutin secret, l'écran montre les deux boîtes —
  émargement et urne — et la mention « aucun lien entre les deux ».
- Le **quorum** se calcule sur les *représentés* : présents **plus** pouvoirs.
  C'est la règle associative usuelle, et c'est ce qui rend le pouvoir utile.
- La **majorité requise** est un nombre de voix, pas un pourcentage : moitié des
  exprimés plus une pour l'absolue, deux tiers arrondis au-dessus pour la
  qualifiée.
- Les **votes blancs** sont décomptés à part par défaut. Les inclure dans les
  suffrages exprimés rend la majorité plus difficile à atteindre : un blanc pèse
  alors comme une voix contre.

Tant que quelque chose manque, le bouton d'ouverture est remplacé par la **liste
de ce qui bloque** — « une proposition est sans libellé », « le corps électoral
est vide ». Jamais un bouton grisé sans explication.

## Étape 6 — Ouvrir le scrutin

**Vous faites :** *Ouvrir le scrutin*, puis vous confirmez.

**Vous voyez :** la salle de vote, avec un accès par électeur.

**Ce qui se passe — c'est le moment le plus structurant du cycle :**

1. Le **corps électoral est figé**. Il est copié dans le scrutin, pas référencé :
   radier un membre l'an prochain ne changera pas le taux de participation de
   cette assemblée.
2. Chaque électeur reçoit un **jeton à usage unique** de 16 caractères, tiré du
   générateur cryptographique du navigateur.
3. Ceux qui n'ont pas d'adresse e-mail reçoivent en plus un **code court de
   7 caractères, imprimable**, à remettre en main propre. Il ouvre exactement le
   même bulletin. Aucun cul-de-sac.
4. La configuration devient **non modifiable**. Changer les règles en cours de
   partie n'aurait pas de sens.
5. L'ouverture est journalisée avec l'effectif figé.

> Les codes n'emploient ni I, ni L, ni O, ni U : on élimine les confusions à la
> lecture (1/I/L, 0/O) et le risque de former un mot malencontreux. Ces codes
> sont dictés au téléphone.

## Étape 7 — La salle de vote

**Vous voyez :** la liste des accès, avec un bouton *Ouvrir le bulletin* par
électeur.

**Ce qui se passe :** rien de plus — et c'est le seul écran qui n'existerait pas
en production. Une instance reliée à un serveur de messagerie enverrait ces liens
sans jamais les afficher : un organisateur capable de lire le lien d'un électeur
pourrait voter à sa place. L'écran le dit lui-même, en toutes lettres.

Il est là pour que vous puissiez parcourir **réellement** le vote de bout en bout.
*Imprimer les codes* produit une feuille à découper pour les électeurs sans
adresse e-mail.

## Étape 8 — Voter

**Vous faites :** vous ouvrez un bulletin, vous choisissez, vous confirmez.

**Vous voyez :** trois écrans, un seul par décision. Le bulletin, la
confirmation, le reçu. Aucun compte à créer.

**Ce qui se passe au dépôt — l'invariant central du projet :**

```
jeton ──┬──► ligne d'émargement   { électeur, nom, heure, pouvoirs }   nominative
        └──► bulletin             { reçu, choix, voix }                anonyme
```

Les deux objets partent chacun de leur côté et **aucune clé ne les relie**. Le
jeton, seul point de passage, est détruit dans la foulée. Le bulletin est inséré
à une **position aléatoire** dans l'urne, de sorte que même l'ordre d'arrivée
cesse d'être un indice.

L'électeur repart avec une **preuve de dépôt** — `BUL-7F3A-91C4`. Elle prouve que
son bulletin est dans l'urne, sans rien révéler de son contenu.

Rouvrir le même lien affiche « **Ce lien a déjà servi** », avec la possibilité de
signaler un vote que l'on n'a pas fait : l'incident est inscrit au journal
d'audit et mentionné au procès-verbal.

> Ce n'est pas une promesse d'interface. Un test vérifie à chaque exécution que
> le bulletin ne contient ni l'identifiant ni le nom du votant — en inspectant sa
> sérialisation complète, pas seulement ses champs déclarés.

## Étape 9 — Suivre la participation

**Vous voyez :** le taux de participation, une jauge avec le repère de quorum, la
liste d'émargement — et **aucun résultat**.

**Ce qui se passe :** le décompte n'est pas masqué, il **n'existe pas**. La
fonction de dépouillement refuse de produire un résultat tant que l'urne n'est
pas scellée, et renvoie une valeur absente plutôt qu'une valeur cachée. Ouvrir la
console du navigateur ne donne rien de plus. La capacité « voir un résultat avant
la clôture » n'est accordée à **aucun rôle** — la ligne est vide dans la matrice,
et ce n'est pas un oubli.

La liste d'émargement dit **qui** a voté et **quand**, jamais **quoi**. Elle est
interrogeable : c'est le document que les scrutateurs consultent en séance pour
répondre à « untel a-t-il déjà voté ? ».

Deux outils ici : *Relancer* s'adresse à ceux dont l'accès n'a pas été consommé,
sans nommer personne dans le journal. *Simuler des votes* dépose des bulletins
aléatoires — outil de démonstration, journalisé comme tout autre dépôt.

Le **mode séance** (`/seance`) projette le même écran en grand : gros chiffres,
fort contraste, rafraîchissement automatique, et toujours aucun résultat.

## Étape 10 — Clôturer

**Vous faites :** *Clôturer maintenant*, puis vous confirmez.

**Ce qui se passe :** l'urne est **scellée**. L'empreinte SHA-256 de l'ensemble
des bulletins est calculée sur une sérialisation canonique — clés triées, donc
indépendante de l'ordre d'insertion — et conservée avec le scrutin.

À partir de là, ajouter, retirer ou modifier un bulletin change l'empreinte. Le
bouton *Vérifier le sceau*, sur l'écran des résultats, recalcule et compare.

## Étape 11 — Les résultats

**Vous voyez :** un verdict en une phrase, puis de quoi le vérifier.

```
Égalité — départage nécessaire
Inès Bouchard et Léo Marchand obtiennent 13 voix chacun.

Inès Bouchard    13   50,0 %   ███████████████
Léo Marchand     13   50,0 %   ███████████████
Bulletins blancs  1      —

Participation          27 / 28 — 96,4 %
Quorum                 14 requis · atteint
Suffrages exprimés     26
Règle appliquée        Majorité absolue · 14 voix requises
```

**Ce qui se passe :** tout est calculé. Les suffrages exprimés excluent les
abstentions, la majorité requise en découle, et l'écart est affiché.

Trois issues méritent une mention :

- **Égalité.** L'égalité qui compte est celle qui se joue *sur la dernière place
  à pourvoir* : deux candidats à égalité en tête ne bloquent rien s'il reste
  assez de sièges pour les deux. Quand elle bloque, **personne n'est proclamé**
  tant qu'une règle de départage n'a pas été choisie et justifiée — la
  justification part au procès-verbal et au journal.
- **Quorum manqué.** Le décompte n'est pas produit du tout. Les bulletins restent
  scellés et ne seront jamais dépouillés : seul un procès-verbal de carence est
  édité. Publier un résultat issu d'une délibération invalide influencerait la
  seconde convocation.
- **Classement.** Le comptage de Borda attribue K points au premier choix, K−1 au
  deuxième. Le **vainqueur de Condorcet** est signalé s'il existe ; son absence
  est affichée telle quelle, car elle signale des préférences cycliques.

## Étape 12 — Le procès-verbal et le journal

**Vous voyez :** un document prêt à imprimer, et un journal d'audit vérifiable.

**Ce qui se passe :** le procès-verbal n'est pas un gabarit à trous. Chaque
chiffre est relu depuis le scrutin au moment de l'affichage : il ne *peut pas*
contredire le décompte, puisqu'ils sont la même donnée vue deux fois. Composition
de l'assemblée, question soumise, décompte, conclusion, intégrité, annexes,
signatures.

Le **journal d'audit** est en ajout seul et chaîné : chaque entrée porte
l'empreinte de la précédente. *Vérifier la chaîne* recalcule l'intégralité des
empreintes et désigne, le cas échéant, la première entrée incohérente.

> Ce que cela garantit : la **détection** d'une altération. Ce que cela ne
> garantit pas : son impossibilité. Sans ancrage extérieur, qui contrôle le
> stockage peut reconstruire toute la chaîne. C'est écrit dans
> [docs/SECURITY-MODEL.md](docs/SECURITY-MODEL.md), et affiché dans
> l'application.

---

## Les écrans que vous ne verrez qu'en cas de problème

Ils comptent autant que le parcours nominal, car ce sont eux qui décident si un
électeur abandonne ou non.

| Situation | Ce que voit l'électeur |
|---|---|
| Lien déjà utilisé | « Ce lien a déjà servi », avec un bouton pour signaler un vote contesté |
| Scrutin clos | La date exacte du scellement, et un renvoi vers les résultats |
| Vote pas encore ouvert | La date d'ouverture, et la consigne de conserver son lien |
| Code inconnu | Une invitation à ressaisir, et à demander un nouveau lien |
| Pas d'adresse e-mail | Un code imprimé remis en main propre, qui ouvre le même bulletin |
| Quorum manqué | Un procès-verbal de carence, pas une page d'erreur |

## Qui voit quoi

Quatre rôles aux pouvoirs volontairement disjoints. Le sélecteur du bandeau
supérieur permet de les endosser : les écrans et les actions s'ajustent
réellement, ce n'est pas une simulation d'affichage.

| Capacité | Organisateur | Scrutateur | Observateur | Votant |
|---|:--:|:--:|:--:|:--:|
| Créer et configurer un scrutin | ✓ | | | |
| Importer le corps électoral | ✓ | | | |
| Voir la participation en direct | ✓ | ✓ | ✓ | |
| Voir la liste d'émargement | ✓ | ✓ | | |
| **Voir un résultat avant la clôture** | | | | |
| Clore le scrutin | ✓ | ✓ | | |
| Consulter les résultats après clôture | ✓ | ✓ | ✓ | |
| Consulter le journal d'audit | ✓ | ✓ | ✓ | |
| Déposer un bulletin | | | | ✓ |

---

# Installer

Aucune dépendance, aucune compilation, aucun `npm install`.

```bash
git clone https://github.com/Aziguy/quorum-proto.git
cd quorum-proto
python -m http.server 8000      # ou : npx serve .
```

Puis <http://localhost:8000>. Un serveur de fichiers statiques suffit —
GitHub Pages, Netlify, un dossier Apache, une clé USB. Le routage se fait par
fragment d'URL (`#/`) : aucune règle de réécriture n'est nécessaire.

> Le seul appel réseau charge les polices IBM Plex depuis Google Fonts.
> Supprimez la balise `<link>` correspondante dans `index.html` pour un
> fonctionnement totalement hors ligne : les polices système prennent le relais.

# Configurer son instance

Tout se règle dans **`src/config/default.config.js`** :

```js
organization: { name: 'Coopérative scolaire Jean-Moulin', kind: 'school' },
features:     { proxies: false, weighting: false, demoData: false },
defaults:     { majority: 'absolute', quorum: { enabled: true, value: 50 } },
```

- `organization.kind` adapte le **vocabulaire de toute l'interface** :
  « adhérents », « sociétaires », « élèves », « militants »…
- Désactiver un module dans `features` retire son écran, son onglet et ses
  options d'assistant — sans laisser d'entrée morte.
- `features.demoData: false` démarre sur une instance vide.

Les mêmes réglages sont modifiables depuis l'écran **Réglages**, ce qui permet
d'essayer avant de figer le fichier. Le thème se rethème entièrement depuis
`assets/css/tokens.css`.

Ajouter une langue : copier `src/i18n/en.js`, traduire, la déclarer dans
`src/core/i18n.js`. `node tools/i18n-report.mjs` liste les clés manquantes. Le
parcours votant, la navigation et les contrôles communs sont traduits en
anglais ; les écrans d'organisation restent en français source.

# Tester

```bash
node --test "tests/*.test.js"
```

25 tests couvrent le moteur : règles de majorité, abstentions et votes blancs,
quorum, égalités, comptage de Borda, vainqueur de Condorcet, voix pondérées,
consommation du jeton, plafond de pouvoirs, scellement de l'urne et chaînage du
journal. Aucun n'a besoin de navigateur.

Les invariants de sécurité y sont vérifiés explicitement — notamment qu'aucun
décompte n'existe avant le scellement, et qu'un bulletin ne porte aucune trace
de son auteur.

# Structure

```
index.html              point d'entrée unique
assets/css/             tokens.css → base → layout → components → print
src/
  core/                 outils sans domaine : dom, store, router, storage,
                        crypto, csv, collection, format, i18n
  domain/               le métier, testable et sans navigateur :
                        schema · tally · quorum · ballot · election ·
                        audit · permissions · seed
  ui/                   composants réutilisables (icons, components, feedback)
  views/                un fichier par écran
  config/               configuration d'instance et modèles de scrutin
  i18n/                 fichiers de langue
tests/                  tests du domaine (node:test)
tools/                  rapport de traduction
docs/                   architecture · domaine · modèle de sécurité · feuille de route
```

Une règle tient tout : **une flèche ne remonte jamais**. `domain/` n'importe rien
de `views/`, `ui/` ni `app.js` ; `core/` n'importe rien du tout. C'est ce qui rend
le domaine exécutable sous Node — donc testable sans navigateur — et remplaçable
par des appels HTTP le jour où un serveur apparaît. `core/storage.js` est le seul
module qui connaît `localStorage`.

Lecture conseillée : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), puis
`src/domain/tally.js`, puis `src/domain/election.js`.

# Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md). Les contributions les plus utiles à ce
stade sont listées dans [docs/ROADMAP.md](docs/ROADMAP.md) — au premier rang
desquelles un serveur, sans lequel le prototype ne peut pas devenir un produit.

Pour une faille de sécurité : [SECURITY.md](SECURITY.md), pas d'issue publique.

# Licence

[AGPL-3.0-or-later](LICENSE). Toute instance modifiée et exposée en ligne doit
republier son code source. Pour un outil de vote, l'auditabilité du code déployé
n'est pas un détail de licence : c'est la condition de la confiance.
