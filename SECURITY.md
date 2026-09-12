# Politique de sécurité

## Portée

Quorum est un **prototype**. Les limites connues sont énumérées dans
[docs/SECURITY-MODEL.md](docs/SECURITY-MODEL.md) : absence d'authentification,
journal d'audit non ancré, bulletins non chiffrés, absence de vérifiabilité de
bout en bout. Ces points sont documentés, pas cachés — inutile de les signaler
comme des failles.

## Ce qui nous intéresse

Tout écart entre ce que le projet **affirme garantir** et ce qu'il fait
réellement. Par exemple :

- un chemin permettant d'obtenir un décompte avant la clôture ;
- un moyen de relier un bulletin à son auteur en scrutin secret ;
- un dépôt multiple avec le même accès ;
- une altération de l'urne ou du journal que la vérification ne détecte pas ;
- une injection de code via un intitulé de scrutin, un nom d'électeur ou un
  fichier CSV importé.

## Signalement

Ouvrez un **avis de sécurité privé** via l'onglet *Security* du dépôt GitHub, ou
écrivez au mainteneur. N'ouvrez pas d'issue publique et ne publiez pas d'exploit
fonctionnel avant correction.

Merci d'indiquer : la version, le navigateur, les étapes de reproduction, et
l'impact que vous estimez.

## Délais

Ce projet est maintenu bénévolement. Nous visons un accusé de réception sous
7 jours et un correctif ou une position argumentée sous 90 jours. Les failles
touchant les garanties énoncées ci-dessus sont traitées en priorité.
