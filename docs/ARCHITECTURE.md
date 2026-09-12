# Architecture

## Pourquoi zéro dépendance et zéro compilation

Un outil de vote est un outil de confiance. Trois conséquences ont dicté la
structure :

1. **Le code déployé doit être le code lu.** Sans étape de compilation, ce que
   le navigateur exécute est exactement ce qui figure dans le dépôt. Un
   observateur peut ouvrir les sources depuis son navigateur et vérifier.
2. **Aucune dépendance tierce.** Pas d'arbre de 300 paquets transitifs à
   auditer, pas de chaîne d'approvisionnement à surveiller, pas de mise à jour
   de sécurité subie.
3. **Reprise par un bénévole.** Le trésorier qui veut adapter l'outil de son
   association doit pouvoir le faire avec un éditeur de texte. `git clone`,
   `python -m http.server`, c'est tout.

Le prix payé : pas de typage statique, pas de rendu incrémental. À l'échelle du
projet (≈ 6 000 lignes), le compromis est favorable — et les invariants
critiques sont tenus par des tests plutôt que par des types.

## Les quatre couches

```
  views/     un fichier par écran · rendent du HTML, ne décident de rien
     │
  ui/        composants réutilisables · ne connaissent pas le domaine
     │
  app.js     état, persistance, opérations transversales
     │
  domain/    le métier · pur, testable, sans navigateur
     │
  core/      outils sans domaine · dom, store, router, storage, crypto, csv, i18n
```

**La règle qui tient tout :** une flèche ne remonte jamais. `domain/` n'importe
rien de `views/`, `ui/` ni `app.js` ; `core/` n'importe rien du tout. C'est ce
qui rend le domaine exécutable sous Node — donc testable sans navigateur — et
remplaçable par des appels HTTP le jour où un serveur apparaît.

## Boucle de rendu

Une seule boucle, deux déclencheurs :

```
changement de route ─┐
                     ├─► paint() ─► view.render(ctx) ─► innerHTML
changement d'état  ──┘
```

- Les vues sont des **fonctions pures de l'état** : elles renvoient une chaîne
  HTML, sans effet de bord. Un effet déclenché depuis `render()` provoquerait un
  rendu en boucle — les effets vivent dans `mounted()`.
- Le rendu remplace tout le contenu de la vue. À cette échelle, c'est plus
  rapide qu'un algorithme de réconciliation, et surtout impossible à
  désynchroniser.
- Le focus n'est déplacé qu'au **changement de page**, jamais à un simple
  re-rendu : sinon l'utilisateur perdrait le focus à chaque frappe.

### La saisie de texte

Re-rendre à chaque caractère détruirait la position du curseur. D'où deux
écritures distinctes dans le store :

| Méthode | Effet | Usage |
|---|---|---|
| `store.update()` | modifie **et** notifie | clics, bascules, navigation |
| `store.mutate()` | modifie en silence | champs de saisie |

Les vues qui utilisent `mutate` rafraîchissent elles-mêmes le fragment d'écran
concerné — par exemple l'aperçu du bulletin dans l'assistant, mis à jour par une
écriture DOM ciblée pendant que l'on tape.

## Événements

Un seul écouteur par type d'événement, posé sur `document`, qui distribue à la
vue courante via l'attribut `data-act` :

```html
<button data-act="close" data-id="scr_42">Clôturer</button>
```

```js
actions: {
  close(ctx, { data }) { /* data.id === 'scr_42' */ }
}
```

Conséquence : rien à nettoyer au changement de page, aucun écouteur ne survit à
la vue qui l'a créé, et le balisage reste inspectable tel quel.

## Sûreté du balisage

`core/dom.js` expose un gabarit balisé qui **échappe par défaut** :

```js
html`<h1>${titreSaisiParUnUtilisateur}</h1>`   // échappé
html`<div>${raw(balisageDejaConstruit)}</div>` // inséré tel quel, explicitement
```

L'asymétrie est volontaire : l'injection devient un acte conscient, jamais un
oubli. Tout contenu saisi par un organisateur ou un votant passe par la voie
échappée.

## Routage

Par fragment d'URL (`#/scrutins/:id/suivi`), comparé segment par segment plutôt
que par expression régulière. Deux raisons : aucun caractère de chemin n'a
besoin d'être échappé, et le fragment fonctionne sur GitHub Pages, derrière un
partage de fichiers ou en ouverture directe du fichier local — sans la moindre
règle de réécriture côté serveur.

## Persistance

`core/storage.js` est **le seul module qui connaît `localStorage`**. Le
remplacer par des appels HTTP suffit à brancher un serveur : ni le domaine ni
les vues n'ont besoin d'être touchés.

Le format est versionné (`quorum.state.v1`) et le module porte une liste de
migrations successives, vide pour l'instant. L'export JSON est la seule
sauvegarde réelle d'une instance sans serveur, et l'interface le dit.

## Internationalisation

Le français est la **langue source**, écrite directement dans les appels :

```js
t('wizard.step1.title', 'Objet du vote')
```

Le code reste lisible sans consulter de fichier de langue, et traduire consiste
à copier `src/i18n/en.js` puis à le remplir. Une clé absente retombe sur le
français : une traduction partielle ne casse jamais l'interface.

## Thème

`assets/css/tokens.css` est la source unique de vérité : couleurs, espace,
typographie, rayons, élévations. Les trois autres feuilles n'utilisent que des
variables. Rethémer une instance, c'est modifier un seul fichier — et le thème
sombre est déjà défini, y compris pour le réglage « système ».

## Listes : recherche, tri, pagination

Un seul mécanisme sert toutes les listes de l'application — scrutins, corps
électoral, accès, émargement, pouvoirs, journal d'audit.

```
core/collection.js     search() · sortItems() · paginate() · pageWindow()
                       fonctions pures, aucune dépendance
        │
ui/components.js       searchInput() · pagination() · sortHeader() · noResults()
        │
app.js                 listState(id, defaults) · setList(id, patch)
        │
main.js                actions globales listSearch / listPage / listSize / listSort
```

Une vue n'écrit donc aucune action de liste : elle déclare un identifiant,
appelle `listState`, filtre, et rend les composants.

```js
const LIST = 'electorate';
const list = listState(LIST);
const found = search(items, list.q, [(v) => v.name, (v) => v.email]);
const page = paginate(sortItems(found, SORTS[list.sort], list.direction), list);
```

### Choix retenus

- **Recherche insensible aux accents et aux séparateurs.** « benedicte » trouve
  « Bénédicte » : une liste importée d'un tableur n'est jamais saisie deux fois
  de la même manière.
- **ET entre les termes**, pas OU. On affine une liste, on ne l'élargit pas :
  « awa bienf » ne doit renvoyer que les Awa bienfaiteurs.
- **Retour à la première page** dès qu'un filtre change. Rester en page 7 d'un
  résultat qui n'en compte plus que deux afficherait un écran vide.
- **Page hors bornes ramenée dans les bornes.** Supprimer le dernier élément
  d'une page ne doit pas produire une liste vide.
- **L'état vit dans l'interface, pas dans le stockage.** Une recherche est une
  intention du moment ; la retrouver au prochain démarrage serait déroutant.

### Conservation du focus

Filtrer re-rend la vue, donc détruit le champ de saisie. `paint()` relève
l'élément focalisé et la position du curseur avant le rendu, puis les restaure
après. Sans cela, taper dans une recherche perdrait le focus au premier
caractère — et insérer un caractère au milieu d'un mot renverrait le curseur
en fin de ligne.

Le mécanisme est générique : il vaut pour tout champ portant un `id`, pas
seulement pour la recherche.
