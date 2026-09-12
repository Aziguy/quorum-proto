# Quorum — plateforme de vote libre et auditable

Prototype fonctionnel d'une plateforme de vote destinée aux **associations,
coopératives, conseils d'administration, établissements scolaires et
organisations politiques**. Il n'est lié à aucune organisation particulière :
tout ce qui est spécifique à une instance vit dans un fichier de configuration.

> **Statut : prototype.** Le moteur métier — dépouillement, quorum, séparation
> identité/bulletin, journal chaîné — est réel et testé. L'infrastructure qui le
> protégerait en production (serveur, authentification, envoi de courriels,
> chiffrement des bulletins) ne l'est pas. Voir
> [docs/SECURITY-MODEL.md](docs/SECURITY-MODEL.md), qui énumère précisément ce
> qui est garanti et ce qui ne l'est pas.

## Démonstration

👉 **<https://aziguy.github.io/quorum-proto/>**

Sept scrutins de démonstration sont générés au premier lancement — et réellement
joués par le moteur : chaque bulletin passe par la même fonction de dépôt qu'un
vote réel, chaque chiffre affiché est calculé. Ils couvrent l'ensemble des issues
possibles : en cours, brouillon, adopté à la majorité qualifiée, égalité à
départager, quorum manqué, classement de préférences.

## Ce que le prototype sait faire

| Domaine | Détail |
|---|---|
| **Modes de scrutin** | Résolution (oui/non/abstention), élection à un siège, scrutin plurinominal à N sièges, classement de préférences (Borda + Condorcet), consultation à choix multiple |
| **Règles de décision** | Majorité simple, absolue, qualifiée (fraction configurable), unanimité ; votes blancs comptés ou décomptés à part |
| **Quorum** | En pourcentage ou en nombre, sur les votants ou sur les voix ; pouvoirs inclus ; **si le quorum manque, le décompte n'est pas produit du tout** |
| **Corps électoral** | Import CSV tolérant (virgule, point-virgule, tabulation, BOM Excel), fusion des doublons, collèges, voix pondérées, figé à l'ouverture |
| **Pouvoirs** | Plafond statutaire opposable ; un dépôt refusé est enregistré comme tel, pas effacé |
| **Secret du vote** | Le bulletin ne contient aucun identifiant d'électeur — un test le vérifie à chaque exécution |
| **Accessibilité au vote** | Lien nominatif à usage unique ; code court imprimable pour qui n'a pas d'adresse e-mail |
| **Traçabilité** | Journal d'audit chaîné en SHA-256, vérifiable depuis l'interface ; urne scellée par empreinte |
| **Restitution** | Procès-verbal généré depuis le décompte, procès-verbal de carence, exports CSV et JSON |
| **Rôles** | Organisateur, scrutateur, observateur, votant — pouvoirs disjoints, réellement appliqués |
| **Interface** | Responsive dès 320 px, thème clair/sombre, mode séance projeté, impression soignée |
| **Langues** | Français (langue source) et anglais. Le parcours votant, la navigation et les contrôles communs sont traduits ; les écrans d'organisation restent en français — `node tools/i18n-report.mjs` donne l'état exact |

## Installation

Aucune dépendance, aucune compilation, aucun `npm install`.

```bash
git clone https://github.com/Aziguy/quorum-proto.git
cd quorum-proto
python -m http.server 8000    # ou : npx serve .
```

Puis ouvrir <http://localhost:8000>.

Un serveur de fichiers statiques suffit — GitHub Pages, Netlify, un dossier
Apache, une clé USB. Le routage se fait par fragment d'URL (`#/`) : aucune règle
de réécriture n'est nécessaire.

> Le seul appel réseau est le chargement des polices IBM Plex depuis Google
> Fonts. Supprimez la balise `<link>` correspondante dans `index.html` pour un
> fonctionnement totalement hors ligne : les polices système prennent le relais.

## Configurer son instance

Tout se règle dans **`src/config/default.config.js`** :

```js
organization: { name: 'Coopérative scolaire Jean-Moulin', kind: 'school' },
features:     { proxies: false, weighting: false, demoData: false },
defaults:     { majority: 'absolute', quorum: { enabled: true, value: 50 } },
```

- `organization.kind` adapte le vocabulaire de toute l'interface (« adhérents »,
  « sociétaires », « élèves », « militants »…).
- Désactiver un module dans `features` retire son écran, son onglet et ses
  options d'assistant — sans laisser d'entrée morte.
- `features.demoData: false` démarre sur une instance vide.

Les mêmes réglages sont modifiables depuis l'écran **Réglages**, ce qui permet
d'essayer avant de figer le fichier. Le thème se rethème entièrement depuis
`assets/css/tokens.css`.

## Tests

```bash
node --test "tests/*.test.js"
```

25 tests couvrent le moteur : règles de majorité, traitement des abstentions et
des blancs, quorum, égalités, comptage de Borda, vainqueur de Condorcet, voix
pondérées, consommation du jeton, plafond de pouvoirs, scellement de l'urne et
chaînage du journal d'audit. Aucun n'a besoin de navigateur.

## Structure

```
index.html              point d'entrée unique
assets/css/             tokens.css → base → layout → components → print
src/
  core/                 outils sans domaine : dom, store, router, storage, crypto, csv, i18n
  domain/               le métier, testable et sans navigateur :
                          schema · tally · quorum · ballot · election · audit · permissions
  ui/                   composants réutilisables (icons, components, feedback)
  views/                un fichier par écran
  config/               configuration d'instance et modèles de scrutin
  i18n/                 fichiers de langue
tests/                  tests du domaine (node:test)
docs/                   architecture, modèle de données, modèle de sécurité, feuille de route
```

Lecture conseillée pour comprendre le projet, dans l'ordre :
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), puis `src/domain/tally.js`, puis
`src/domain/election.js`.

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md). Les contributions les plus utiles à ce
stade sont listées dans [docs/ROADMAP.md](docs/ROADMAP.md) — au premier rang
desquelles un serveur, sans lequel le prototype ne peut pas devenir un produit.

## Licence

[AGPL-3.0-or-later](LICENSE). Toute instance modifiée et exposée en ligne doit
republier son code source. Pour un outil de vote, l'auditabilité du code déployé
n'est pas un détail de licence : c'est la condition de la confiance.
