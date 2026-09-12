# Contribuer à Quorum

## Démarrer

```bash
git clone https://github.com/Aziguy/quorum-proto.git
cd quorum-proto
python -m http.server 8000     # ou : npx serve .
node --test "tests/*.test.js"
```

Aucune installation de dépendances : il n'y en a pas.

## Où intervenir

| Vous voulez… | Fichier |
|---|---|
| Ajouter un mode de scrutin | `src/domain/schema.js` (METHODS) + `src/domain/tally.js` |
| Ajouter une règle de majorité | `src/domain/schema.js` (MAJORITIES) |
| Ajouter un modèle de scrutin | `src/config/templates.js` |
| Ajouter une langue | copier `src/i18n/en.js`, déclarer dans `src/core/i18n.js` |
| Rethémer | `assets/css/tokens.css`, et lui seul |
| Ajouter un écran | un fichier dans `src/views/`, une route dans `src/main.js` |

## Règles du projet

1. **Aucune dépendance à l'exécution.** C'est une contrainte de sécurité autant
   que de simplicité : le code déployé doit être le code lu.
2. **Le domaine reste pur.** `src/domain/` n'importe rien de `views/`, `ui/` ou
   `app.js`, et ne touche ni au DOM, ni au stockage, ni à l'horloge autrement
   que par un paramètre. C'est ce qui le rend testable sous Node.
3. **Pas d'effet de bord dans `render()`.** Les effets vivent dans `mounted()` —
   sinon le rendu boucle.
4. **Échapper par défaut.** Utilisez le gabarit `html` ; `raw()` doit rester un
   acte conscient.
5. **Tout nouvel invariant métier vient avec son test.** Les invariants de
   sécurité (voir `docs/SECURITY-MODEL.md`) sont tenus par des tests, pas par
   des commentaires.

## Style

- ES modules, sans transpilation. Visez les navigateurs des deux dernières
  années.
- Commentaires en français, comme le reste du code. Ils expliquent **pourquoi**,
  pas **quoi** : le code dit déjà ce qu'il fait.
- Les textes d'interface passent par `t('clé', 'texte français')`.
- Indentation de 2 espaces, points-virgules, guillemets simples.

## Avant d'ouvrir une pull request

- [ ] `node --test "tests/*.test.js"` passe.
- [ ] L'application se charge sans erreur de console sur les écrans touchés.
- [ ] Aucun débordement horizontal à 320 px de large.
- [ ] Thème clair **et** thème sombre vérifiés.
- [ ] Navigation au clavier possible sur les nouveaux contrôles, avec focus
      visible.

## Signaler un bug

Indiquez le navigateur, les étapes de reproduction, et si possible un export
JSON de l'instance (écran Réglages → Exporter). **Retirez-en les données
personnelles réelles** avant de le joindre.

Pour une faille de sécurité, voir [SECURITY.md](SECURITY.md) : pas d'issue
publique.
