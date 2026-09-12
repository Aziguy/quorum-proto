# Modèle de données et vocabulaire

## Objets

| Objet | Rôle |
|---|---|
| **Scrutin** (`election`) | Une question et ses règles : mode, options, quorum, majorité, fenêtre de vote, confidentialité. Porte **son propre** corps électoral, copié et non référencé. |
| **Option** | Réponse, candidature ou proposition. Sa `kind` (`for`, `against`, `abstain`, `candidate`, `proposal`) décide de son entrée dans les suffrages exprimés. |
| **Électeur** (`voter`) | Identité, contact, collège, nombre de voix. Reçoit un jeton à l'ouverture. |
| **Jeton** (`token`) | Droit de déposer un bulletin, une fois. Détruit au dépôt. |
| **Émargement** (`roster`) | Ligne nominative : qui a voté, quand, avec combien de pouvoirs. |
| **Bulletin** (`ballot`) | Choix, poids en voix, reçu. **Aucun identifiant d'électeur.** |
| **Pouvoir** (`proxy`) | Transfert de voix, plafonné. Un refus est conservé avec le statut `rejected`. |
| **Événement** (`audit`) | Acteur, action, horodatage, empreinte chaînée. En ajout seul. |

### Pourquoi le corps électoral est copié

Un scrutin passé doit rester lisible tel qu'il s'est déroulé. Si le corps
électoral était une référence vers un annuaire vivant, radier un membre en 2027
changerait rétroactivement le taux de participation de l'assemblée de 2026 — et
donc la validité d'une délibération déjà actée.

## Formes du choix

| Mode | `pick` | Forme stockée |
|---|---|---|
| Résolution, élection à un siège | `one` | `{ optionId }` ou `{ blank: true }` |
| Plurinominal, approbation | `many` | `{ optionIds: [...] }` |
| Classement | `order` | `{ order: [id, id, ...] }` |

## Règles de décompte

### Suffrages exprimés

```
exprimés = somme des voix des options dont kind != 'abstain'
         + blancs si blankPolicy === 'counted'
```

L'abstention compte dans le **quorum** mais jamais dans les **suffrages
exprimés** : c'est l'usage associatif et électoral français. Les votes blancs
suivent le réglage du scrutin — les décompter à part (défaut) rend la majorité
plus facile à atteindre que les inclure.

### Majorité requise

| Règle | Voix nécessaires |
|---|---|
| Simple | voix du second, plus une |
| Absolue | moitié des exprimés arrondie en dessous, plus une |
| Qualifiée | exprimés x num / den, arrondi au-dessus (2/3 par défaut) |
| Unanimité | aucune voix contre, et au moins une voix pour |

Pour une **résolution**, la majorité s'apprécie sur la réponse « Pour » et son
opposée « Contre » — jamais sur l'option arrivée en tête, qui pourrait être
l'abstention.

### Quorum

```
requis  = mode 'percent' ? arrondi_sup(total x valeur / 100) : valeur
atteint = représentés >= requis        (représentés = présents + pouvoirs)
```

`basis` choisit l'assiette : nombre de votants (défaut) ou total des voix.

### Égalités

L'égalité qui compte est celle qui se joue **sur la dernière place à pourvoir**.
Deux candidats à égalité en tête ne bloquent rien s'il reste assez de sièges pour
les deux. Quand elle bloque, aucun élu n'est proclamé sur les places disputées
tant qu'une règle de départage n'a pas été appliquée et justifiée.

### Classement (Borda)

Un bulletin classant K options attribue **K points au premier, K−1 au deuxième**,
et ainsi de suite jusqu'à 1. La convention est explicitée au procès-verbal, car
il en existe d'autres (K−1 … 0) qui changent les écarts sans changer l'ordre.

Le **vainqueur de Condorcet** — l'option qui bat toutes les autres en duel — est
signalé lorsqu'il existe. Son absence est une information en soi : elle signale
des préférences cycliques, et elle est affichée telle quelle.

### Voix pondérées

Chaque bulletin porte un poids : voix propre de l'électeur, plus celles de ses
mandants. Le décompte additionne des **voix**, pas des bulletins. Une minorité de
bulletins peut donc l'emporter — c'est le principe des parts sociales et des
tantièmes.

## Cycle de vie

```
  brouillon ──ouverture──► ouvert ──clôture──► clos
      |                       |                  |
  tout est              corps électoral      urne scellée
  modifiable            figé, jetons         décompte définitif
                        distribués           PV éditable
```

Chaque transition est journalisée. La configuration d'un scrutin ouvert est
figée : modifier les règles en cours de partie n'aurait aucun sens.

## Rôles

| Capacité | Organisateur | Scrutateur | Observateur | Votant |
|---|:--:|:--:|:--:|:--:|
| Créer et configurer | oui | | | |
| Importer le corps électoral | oui | | | |
| Voir la participation en direct | oui | oui | oui | |
| Voir la liste d'émargement | oui | oui | | |
| **Voir un résultat avant la clôture** | | | | |
| Clore le scrutin | oui | oui | | |
| Consulter les résultats après clôture | oui | oui | oui | |
| Consulter le journal d'audit | oui | oui | oui | |
| Déposer un bulletin | | | | oui |

La ligne vide n'est pas un oubli : elle est appliquée dans le moteur de
dépouillement, pas seulement dans l'interface.
