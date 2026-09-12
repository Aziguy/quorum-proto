# Feuille de route

Par ordre d'importance décroissante. Les trois premiers points conditionnent le
passage du prototype au produit.

## 1. Un serveur — indispensable

Sans lui, rien n'est partageable : chaque navigateur a sa propre copie des
données, et personne ne peut voter depuis chez lui.

- API REST ou GraphQL couvrant le domaine existant.
- `src/core/storage.js` est **le seul module à remplacer** : le domaine et les
  vues n'ont aucune dépendance au stockage local.
- Envoi des accès par courriel, avec jeton à durée de vie limitée.
- Contrôle d'accès côté serveur : la matrice de `permissions.js` doit être
  rejouée là-bas — l'interface ne protège rien.

## 2. Chiffrement des bulletins

Un serveur qui héberge l'urne peut la lire. Le chiffrement à seuil, avec des
clés réparties entre scrutateurs, empêche tout dépouillement partiel avant la
clôture, y compris par l'hébergeur. Voir Belenios et Helios.

## 3. Ancrage du journal d'audit

Le chaînage détecte l'altération mais ne l'empêche pas : qui contrôle le
stockage peut reconstruire la chaîne. Publier périodiquement l'empreinte
courante auprès d'un tiers — horodatage qualifié, dépôt chez les scrutateurs —
ferme cette porte.

## 4. Fonctionnalités métier

- **Second tour automatique** : la case existe dans l'assistant, la génération du
  scrutin suivant reste à écrire.
- **Scrutins enchaînés** : une assemblée générale comporte plusieurs résolutions
  votées d'affilée, sur le même corps électoral et le même accès.
- **Dépôt de candidature par les intéressés**, avec profession de foi et pièces
  justificatives, plutôt que par l'organisateur.
- **Répartition proportionnelle** (d'Hondt, Sainte-Laguë) pour les scrutins de
  liste.
- **Jugement majoritaire**, de plus en plus demandé par les associations.
- **Purge automatique** à l'échéance des durées de conservation, aujourd'hui
  déclenchée manuellement.

## 5. Interface

- **QR code** en mode séance, pour ouvrir la page de vote depuis la salle.
- **Glisser-déposer** pour le bulletin de classement, en complément des flèches —
  qui doivent rester, pour l'accessibilité au clavier.
- **Traduction complète** de l'anglais, puis d'autres langues.
- **Rapport d'accessibilité** RGAA / WCAG 2.2 AA, avec audit externe.

## 6. Qualité

- Tests de bout en bout (Playwright) sur les parcours critiques, en complément
  des tests de domaine.
- Vérification automatique des contrastes de la palette.
- Étude de charge : le prototype garde tout en mémoire, ce qui plafonne vers
  quelques milliers d'électeurs par scrutin.

## Ce qui restera hors de portée

La **résistance à la coercition** dans un vote à distance. Rien n'empêche un
tiers d'assister au vote ou un électeur de céder son accès. Seule l'option d'un
vote en présentiel y répond — et elle relève de l'organisation, pas du logiciel.
