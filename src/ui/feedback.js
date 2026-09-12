/**
 * feedback.js — retours éphémères et confirmations.
 *
 * Toute action destructrice passe par `confirm()`. Toute action réussie passe
 * par `toast()`, qui annonce aussi le message aux lecteurs d'écran : un retour
 * visuel seul laisse une partie des utilisateurs sans confirmation.
 */

import { announce } from '../core/dom.js';
import { icon } from './icons.js';

const GLYPHS = { ok: 'check', danger: 'alert', info: 'info' };

export function toast(message, tone = 'info', { duration = 4000 } = {}) {
  const region = document.getElementById('toasts');
  if (!region) return;

  const node = document.createElement('div');
  node.className = `toast${tone === 'info' ? '' : ` toast--${tone}`}`;
  node.innerHTML = `${icon(GLYPHS[tone] || 'info')}<span></span>
    <button class="toast__close" type="button" aria-label="Fermer">×</button>`;
  node.querySelector('span').textContent = message;
  node.querySelector('.toast__close').addEventListener('click', () => node.remove());

  region.appendChild(node);
  // Au-delà de trois, les notifications masquent le contenu qu'elles commentent.
  while (region.children.length > 3) region.firstElementChild.remove();

  announce(message);
  setTimeout(() => node.remove(), duration);
}

/**
 * Confirmation modale. Renvoie une promesse résolue à true/false.
 * `danger` colore le bouton d'action et exige une confirmation explicite —
 * jamais de validation par la touche Entrée sur une suppression.
 */
export function confirmDialog({
  title, text, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false,
}) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'modal';
    dialog.innerHTML = `
      <form method="dialog" class="modal__body">
        <h2 class="modal__title"></h2>
        <p class="modal__text"></p>
        <div class="modal__actions">
          <button value="cancel" class="btn btn--ghost"></button>
          <button value="confirm" class="btn ${danger ? 'btn--danger' : 'btn--primary'}"></button>
        </div>
      </form>`;
    dialog.querySelector('.modal__title').textContent = title;
    dialog.querySelector('.modal__text').textContent = text;
    dialog.querySelector('[value="cancel"]').textContent = cancelLabel;
    dialog.querySelector('[value="confirm"]').textContent = confirmLabel;

    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm');
      dialog.remove();
    });
    dialog.showModal();
    // Le focus part sur « Annuler » : l'action par défaut n'est jamais destructrice.
    dialog.querySelector('[value="cancel"]').focus();
  });
}

/** Saisie courte en modale (nom d'un électeur, motif de refus…). */
export function promptDialog({
  title, text, label, value = '', confirmLabel = 'Valider', multiline = false, placeholder = '',
}) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'modal';
    dialog.innerHTML = `
      <form method="dialog" class="modal__body">
        <h2 class="modal__title"></h2>
        <p class="modal__text"></p>
        <div class="field">
          <label class="field__label" for="prompt-input"></label>
          ${multiline
            ? '<textarea class="textarea" id="prompt-input" rows="8"></textarea>'
            : '<input class="input" id="prompt-input" type="text">'}
        </div>
        <div class="modal__actions">
          <button value="cancel" class="btn btn--ghost">Annuler</button>
          <button value="confirm" class="btn btn--primary"></button>
        </div>
      </form>`;
    dialog.querySelector('.modal__title').textContent = title;
    dialog.querySelector('.modal__text').textContent = text || '';
    dialog.querySelector('label').textContent = label;
    dialog.querySelector('[value="confirm"]').textContent = confirmLabel;
    const input = dialog.querySelector('#prompt-input');
    input.value = value;
    if (placeholder) input.placeholder = placeholder;

    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm' ? input.value.trim() : null);
      dialog.remove();
    });
    dialog.showModal();
    input.focus();
  });
}
