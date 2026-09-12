/**
 * not-found.js — route inconnue.
 */

import { html } from '../core/dom.js';
import { emptyState, btn } from '../ui/components.js';

export default {
  id: 'not-found',

  render(ctx) {
    return html`<div class="view">
      <h1 id="view-title" tabindex="-1" class="sr-only">Page introuvable</h1>
      ${emptyState({
    iconName: 'search',
    title: 'Cette page n’existe pas',
    body: html`L'adresse <span class="mono">${ctx.path}</span> ne correspond à aucun écran.
      Elle provient peut-être d'un lien obsolète.`,
    actions: html`${btn({ label: 'Aller aux scrutins', href: '#/scrutins', variant: 'primary' })}
      ${btn({ label: 'Espace votant', href: '#/vote' })}`,
  })}
    </div>`;
  },
};
