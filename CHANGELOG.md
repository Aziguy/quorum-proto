# Journal des modifications

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ;
le versionnement suit [SemVer](https://semver.org/lang/fr/).

## [1.0.0] — 2026-09-12

Première version complète. Le premier jet — un canevas de maquette de 1,6 Mo
sans logique métier — est conservé dans `docs/essai/` à titre de référence.

### Ajouté

- **Moteur de dépouillement** (`src/domain/tally.js`) : résolution, élection à un
  siège, scrutin plurinominal, classement de Borda avec détection du vainqueur de
  Condorcet, consultation à choix multiple. Majorités simple, absolue, qualifiée
  et unanimité ; votes blancs comptés ou décomptés à part ; voix pondérées.
- **Quorum** évalué sur les représentés (présents et pouvoirs), en pourcentage ou
  en nombre. Quorum manqué : le décompte n'est pas produit.
- **Cycle de vie d'un scrutin** : brouillon, ouverture avec distribution de
  jetons à usage unique, dépôt, clôture avec scellement de l'urne.
- **Séparation identité / bulletin** : le jeton se scinde en une ligne
  d'émargement nominative et un bulletin anonyme, sans clé commune, le bulletin
  étant inséré à une position aléatoire.
- **Pouvoirs** avec plafond statutaire opposable, refus journalisé.
- **Journal d'audit** chaîné en SHA-256, vérifiable depuis l'interface.
- **Assistant de création** en quatre étapes, avec aperçu du bulletin en direct.
- **Parcours votant** complet : bulletin, confirmation, reçu de dépôt, et les
  impasses (lien consommé, scrutin clos, code inconnu).
- **Procès-verbal** généré depuis le décompte, avec variante de carence.
- **Écrans** : tableau de bord, suivi en direct, salle de vote, corps électoral,
  pouvoirs, candidatures, résultats, journal, modèles, rôles, RGPD, réglages,
  note de conception, mode séance projeté.
- **Rôles** (organisateur, scrutateur, observateur, votant) réellement appliqués.
- **Configuration d'instance** : identité, forme juridique avec vocabulaire
  adapté, modules activables, valeurs par défaut, durées de conservation.
- **Import/export** : CSV du corps électoral et des résultats, JSON complet.
- **Internationalisation** avec le français comme langue source et repli
  automatique.
- **Thème clair et sombre**, responsive dès 320 px, feuille d'impression.
- **25 tests** du domaine, exécutables sans navigateur.
- Documentation : architecture, modèle de données, modèle de sécurité, feuille
  de route.

### Notes

- Aucune dépendance à l'exécution. Aucune étape de compilation.
- Les données restent dans le navigateur ; l'export JSON est la seule sauvegarde.
