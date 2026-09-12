/**
 * roles.js — matrice des habilitations.
 *
 * Les pouvoirs sont volontairement disjoints. La ligne la plus importante de ce
 * tableau est celle qui ne porte aucune croix : « voir un résultat avant la
 * clôture » n'est accordé à personne, et ce n'est pas un oubli.
 */

import { html, raw } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import { card, pageHead, banner, table } from '../ui/components.js';
import { ROLES } from '../domain/schema.js';
import { CAPABILITIES } from '../domain/permissions.js';

export default {
  id: 'roles',

  render(ctx) {
    const roles = Object.values(ROLES);
    const yes = html`<span style="color:var(--ok)">${raw(icon('check', { size: 15 }))}</span>`;
    const no = html`<span class="dim">—</span>`;

    return html`<div class="view">
      ${pageHead({
    title: 'Rôles & accès',
    lead: "Quatre rôles aux pouvoirs disjoints : l'organisateur configure mais ne voit aucun résultat avant la clôture ; le scrutateur contrôle et clôt, sans rien configurer.",
  })}

      ${banner({
    tone: 'brand',
    title: `Rôle actuellement endossé : ${ROLES[ctx.ui.role]?.label || ctx.ui.role}.`,
    body: html`Changez-le depuis le sélecteur du bandeau supérieur : les écrans et les actions
      s'ajustent réellement — ce n'est pas une simulation d'affichage, les vues interrogent la même
      matrice que celle présentée ci-dessous.`,
  })}

      <div style="margin:var(--s-5) 0">
        ${table({
    head: ['Capacité', ...roles.map((r) => r.label)],
    caption: 'Matrice des habilitations',
    rows: Object.values(CAPABILITIES).map((capability) => [
      html`<span class="table__main">${capability.label}</span>`,
      ...roles.map((role) => (capability.roles.includes(role.id) ? yes : no)),
    ]),
  })}
      </div>

      ${card({
    title: 'Pourquoi une ligne vide',
    body: html`<p class="muted">« Voir un résultat avant la clôture » n'est accordé à aucun rôle.
        Un organisateur qui connaîtrait la tendance pourrait relancer sélectivement ; un scrutateur
        pourrait la laisser filtrer. La règle est donc appliquée dans le moteur de dépouillement
        lui-même, qui refuse de produire un décompte tant que l'urne n'est pas scellée — et pas
        seulement dans l'interface, où il suffirait d'ouvrir la console pour la contourner.</p>`,
  })}

      <div style="margin-top:var(--s-5)">
        ${card({
    title: 'Étendre la matrice',
    body: html`<p class="muted">Ajouter un rôle ou une capacité se fait dans
        <span class="mono">src/domain/permissions.js</span>. Les vues appellent
        <span class="mono">can(role, capacité)</span> : aucune n'encode d'habilitation en dur.</p>`,
  })}
    </div>`;
  },
};
