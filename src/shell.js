/**
 * shell.js — coquille : bandeau, navigation, conteneur de vue.
 *
 * La navigation est produite à partir de la configuration : désactiver un
 * module dans default.config.js le fait disparaître de la barre latérale sans
 * laisser d'entrée morte.
 */

import { html, raw } from './core/dom.js';
import { icon } from './ui/icons.js';
import { t } from './core/i18n.js';
import { STATUS, ROLES } from './domain/schema.js';

function navLink({ href, label, iconName, active, count }) {
  return html`<a class="nav-item" href="${href}" ${raw(active ? 'aria-current="page"' : '')}>
    <span class="nav-item__icon">${raw(icon(iconName))}</span>
    <span class="grow">${label}</span>
    ${count !== undefined && count !== null ? html`<span class="nav-item__count nums">${count}</span>` : ''}
  </a>`;
}

export function navigation(state, path) {
  const { config, elections } = state;
  const openCount = elections.filter((e) => e.status === STATUS.OPEN).length;
  const isActive = (prefix, exact = false) => (exact ? path === prefix : path.startsWith(prefix));

  return html`<nav class="app-nav" id="app-nav" data-open="${state.ui.navOpen ? 'true' : 'false'}"
    aria-label="Navigation principale">
    <a class="btn btn--primary btn--full" href="#/scrutins/nouveau" style="margin-bottom:var(--s-5)">
      ${raw(icon('plus'))} ${t('nav.new', 'Nouveau scrutin')}
    </a>

    <div class="nav-group">
      <p class="nav-group__title">${t('nav.section.ballots', 'Scrutins')}</p>
      ${navLink({
    href: '#/scrutins', label: t('nav.elections', 'Tous les scrutins'),
    iconName: 'list', active: isActive('/scrutins', true), count: elections.length,
  })}
      ${openCount ? navLink({
    href: '#/scrutins?filtre=open', label: t('nav.open', 'En cours'),
    iconName: 'clock', active: false, count: openCount,
  }) : ''}
      ${config.features.templates ? navLink({
    href: '#/modeles', label: t('nav.templates', 'Modèles'),
    iconName: 'clipboard', active: isActive('/modeles'),
  }) : ''}
    </div>

    <div class="nav-group">
      <p class="nav-group__title">${t('nav.section.org', 'Organisation')}</p>
      ${navLink({ href: '#/roles', label: t('nav.roles', 'Rôles & accès'), iconName: 'shield', active: isActive('/roles') })}
      ${config.features.privacy ? navLink({
    href: '#/donnees', label: t('nav.privacy', 'Données & RGPD'), iconName: 'lock', active: isActive('/donnees'),
  }) : ''}
      ${navLink({ href: '#/reglages', label: t('nav.settings', 'Réglages'), iconName: 'settings', active: isActive('/reglages') })}
    </div>

    <div class="nav-group">
      <p class="nav-group__title">Aide</p>
      ${navLink({ href: '#/vote', label: 'Espace votant', iconName: 'ballotBox', active: isActive('/vote') })}
      ${navLink({ href: '#/a-propos', label: t('nav.about', 'Note de conception'), iconName: 'info', active: isActive('/a-propos') })}
    </div>

    <div class="card card--flat" style="margin-top:var(--s-6);padding:var(--s-3)">
      <p class="choice__sub" style="font-size:var(--text-2xs)">
        ${config.app.name} ${config.app.version} · ${config.app.license}<br>
        Données conservées dans ce navigateur uniquement.
      </p>
    </div>
  </nav>`;
}

export function header(state) {
  const { config, ui } = state;
  const themeIcon = (document.documentElement.dataset.theme || '') === 'dark' ? 'sun' : 'moon';

  return html`<header class="app-header">
    <button type="button" class="btn btn--ghost btn--icon nav-toggle" data-act="toggleNav"
      aria-expanded="${ui.navOpen ? 'true' : 'false'}" aria-controls="app-nav"
      aria-label="${ui.navOpen ? t('nav.close', 'Fermer la navigation') : t('nav.open', 'Ouvrir la navigation')}">
      ${raw(icon(ui.navOpen ? 'close' : 'menu', { size: 18 }))}
    </button>

    <a class="brand" href="#/scrutins" style="text-decoration:none;color:inherit">
      <span class="brand__mark" aria-hidden="true">${config.app.mark}</span>
      <span class="brand__name">${config.app.name}</span>
    </a>
    ${config.organization.name
    ? html`<span class="brand__org">${config.organization.name}</span>`
    : html`<span class="brand__org">${config.app.tagline}</span>`}

    <div class="app-header__tools">
      <label class="sr-only" for="role-switch">Rôle endossé</label>
      <select class="select" id="role-switch" data-act="setRole"
        style="min-height:2rem;width:auto;font-size:var(--text-xs);padding:var(--s-1) var(--s-7) var(--s-1) var(--s-2)">
        ${Object.values(ROLES).filter((r) => r.id !== 'voter').map((role) => html`
          <option value="${role.id}" ${raw(ui.role === role.id ? 'selected' : '')}>${role.label}</option>`)}
      </select>

      <button type="button" class="btn btn--ghost btn--icon" data-act="cycleTheme"
        aria-label="Changer de thème" title="Changer de thème">${raw(icon(themeIcon, { size: 17 }))}</button>

      <button type="button" class="btn btn--ghost btn--icon" data-act="cycleLocale"
        aria-label="Changer de langue" title="Changer de langue">${raw(icon('globe', { size: 17 }))}</button>
    </div>
  </header>`;
}
