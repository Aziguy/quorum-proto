# Modèle de sécurité

Ce document énonce ce que Quorum garantit, ce qu'il ne garantit pas, et pourquoi.
Une plateforme de vote qui ne publie pas ses limites demande une confiance
qu'elle n'a pas méritée.

## Ce que le prototype garantit réellement

### 1. Aucun résultat avant le scellement de l'urne

`tally()` refuse de produire un décompte tant que le scrutin n'est pas clos.
Ce n'est pas un masquage d'affichage : la valeur `entries` vaut `null`, et
l'objet n'existe donc pas — pas même pour quelqu'un qui ouvrirait la console du
navigateur. La capacité `results.preview` n'est accordée à **aucun rôle**, et la
matrice de `permissions.js` le montre explicitement.

*Vérifié par :* `tests/tally.test.js` → « aucun décompte tant que l'urne n'est
pas scellée ».

### 2. Quorum manqué : le décompte n'est jamais produit

Si le quorum n'est pas atteint à la clôture, `tally()` renvoie
`outcome: 'quorum-failed'` et **aucune entrée**. Les bulletins restent dans
l'urne ; seul un procès-verbal de carence est édité. Publier un résultat issu
d'une délibération invalide influencerait la seconde convocation.

*Vérifié par :* `tests/tally.test.js` → « quorum non atteint ».

### 3. Séparation de l'identité et du bulletin

C'est l'invariant central. Au dépôt, le jeton se scinde en deux objets qui ne
partagent aucune clé :

```
jeton ──┬──► émargement  { voterId, nom, heure, pouvoirs }   nominatif
        └──► bulletin    { reçu, choix, voix }               anonyme
```

Le jeton est détruit dans la foulée. Le bulletin est en outre inséré à une
position aléatoire (mélange de Fisher-Yates alimenté par `crypto.getRandomValues`),
de sorte que l'ordre d'arrivée cesse d'être un indice.

*Vérifié par :* `tests/election.test.js` → « le bulletin déposé ne porte aucune
trace du votant », qui contrôle les clés de l'objet **et** cherche l'identifiant
et le nom dans sa sérialisation complète.

### 4. Un électeur, une voix

Le jeton est consommé au dépôt : `token` passe à `null` et `tokenUsed` à `true`.
Une seconde tentative avec le même lien est refusée.

*Vérifié par :* `tests/election.test.js` → « le jeton est consommé ».

### 5. Détection de l'altération de l'urne

La clôture calcule l'empreinte SHA-256 de l'ensemble des bulletins, sérialisés de
façon canonique (clés triées, donc indépendante de l'ordre d'insertion). Ajouter,
retirer ou modifier un bulletin après coup change l'empreinte. Le bouton
« Vérifier le sceau » recalcule et compare.

*Vérifié par :* `tests/election.test.js` → « le sceau détecte toute modification ».

### 6. Détection de l'altération du journal

Chaque entrée du journal d'audit porte l'empreinte de la précédente. Modifier une
ligne invalide toutes les suivantes, et `verifyChain()` désigne la première
entrée incohérente.

*Vérifié par :* `tests/election.test.js` → « le journal reste chaîné de bout en
bout ».

## Ce que le prototype NE garantit pas

### L'authentification

Le jeton **est** l'identité : quiconque détient le lien peut voter. Il n'y a ni
mot de passe, ni second facteur, ni vérification que le destinataire du courriel
est bien la personne inscrite.

*Ce qu'il faudrait :* un envoi par un canal maîtrisé, un jeton à durée de vie
courte, et pour les scrutins sensibles un second facteur (code SMS, lien de
confirmation, identité vérifiée).

### L'inviolabilité du journal

Le chaînage rend l'altération **détectable**, pas **impossible**. Quelqu'un qui
contrôle le stockage peut reconstruire toute la chaîne depuis le début : les
empreintes seront cohérentes, et la falsification indétectable.

*Ce qu'il faudrait :* un ancrage extérieur — publication périodique de
l'empreinte courante auprès d'un tiers, horodatage qualifié, ou dépôt chez les
scrutateurs. Sans point d'ancrage, une chaîne ne prouve rien contre celui qui la
détient.

### La confidentialité vis-à-vis de l'hébergeur

Les bulletins ne sont pas chiffrés. Dans ce prototype ils ne quittent pas le
navigateur, donc la question ne se pose pas ; dès qu'un serveur existe, il peut
lire l'urne. La séparation identité/bulletin le prive du *lien*, mais pas du
contenu — il verrait la répartition des voix avant la clôture.

*Ce qu'il faudrait :* un chiffrement à seuil, les clés réparties entre plusieurs
scrutateurs, le déchiffrement n'étant possible qu'à plusieurs. C'est l'approche
de Belenios et de Helios.

### La vérifiabilité de bout en bout

Le reçu de dépôt prouve qu'un bulletin **existe** dans l'urne. Il ne permet pas
de vérifier que son contenu est celui qu'on a choisi, ni qu'il a été correctement
compté.

*Ce qu'il faudrait :* la publication de l'urne chiffrée et une preuve
cryptographique de dépouillement correct, vérifiable par quiconque.

### La résistance à la coercition

Comme tout vote à distance : rien n'empêche un tiers d'assister au vote, ni un
électeur de céder ou de vendre son lien. Aucune solution technique n'y répond.

*Ce qu'il faudrait :* la possibilité d'un vote en présentiel, ou un mécanisme de
revote qui annule le bulletin précédent — qui suppose, lui, de conserver le lien
entre électeur et bulletin, donc d'affaiblir le secret.

### La disponibilité

Aucun serveur, donc aucune redondance ni sauvegarde. Vider les données du site
efface tout, définitivement. L'export JSON est la seule sauvegarde, et l'écran
« Données & RGPD » le rappelle.

## Signaler une faille

Voir [SECURITY.md](../SECURITY.md) à la racine du dépôt. Ne publiez pas
d'exploit fonctionnel dans une *issue* publique.
