/**
 * templates.js — modèles de scrutin.
 *
 * Un modèle enregistre des règles, jamais des personnes. C'est ce qui permet de
 * le rejouer d'une année sur l'autre avec un corps électoral à jour, sans
 * traîner les adhérents de l'an dernier.
 */

import { html } from '../core/dom.js';
import { btn, card, pageHead, banner } from '../ui/components.js';
import { METHODS, MAJORITIES, makeElection, makeOption, nextRef, DEFAULT_RESOLUTION_OPTIONS } from '../domain/schema.js';
import { TEMPLATES } from '../config/templates.js';
import { addElection, setUi } from '../app.js';
import { toast } from '../ui/feedback.js';

export default {
  id: 'templates',

  render(ctx) {
    const kind = ctx.config.organization.kind;
    const suggested = TEMPLATES.filter((t) => t.tags.includes(kind));
    const others = TEMPLATES.filter((t) => !t.tags.includes(kind));

    const cardFor = (template) => card({
      title: template.title,
      hint: template.description,
      body: html`
        <ul style="list-style:none;padding:0;margin:0 0 var(--s-4)">
          ${template.rules.map((rule) => html`<li class="row row--tight" style="align-items:flex-start;padding:var(--s-1) 0">
            <span class="dot" style="margin-top:.45rem;color:var(--brand)"></span>
            <span class="choice__sub grow">${rule}</span>
          </li>`)}
        </ul>
        <div class="row">
          ${btn({ label: 'Utiliser ce modèle', act: 'use', data: { id: template.id }, variant: 'primary' })}
          <span class="dim" style="font-size:var(--text-xs)">
            ${METHODS[template.apply.method].label} · ${MAJORITIES[template.apply.majority].label}</span>
        </div>`,
    });

    return html`<div class="view">
      ${pageHead({
    title: 'Modèles',
    lead: 'Un modèle préremplit les règles d’un scrutin — mode, quorum, majorité, pouvoirs. Le corps électoral, lui, est toujours à importer : il change à chaque exercice.',
  })}

      ${suggested.length ? html`
        <p class="nav-group__title" style="padding-left:0">Adaptés à votre organisation</p>
        <div class="grid grid--2" style="margin-bottom:var(--s-7)">${suggested.map(cardFor)}</div>
      ` : ''}

      ${others.length ? html`
        <p class="nav-group__title" style="padding-left:0">Autres modèles</p>
        <div class="grid grid--2">${others.map(cardFor)}</div>
      ` : ''}

      <div style="margin-top:var(--s-7)">
        ${banner({
    tone: 'neutral',
    body: html`Ajouter un modèle à votre instance se fait dans
      <span class="mono">src/config/templates.js</span> : un objet, six lignes, aucune autre
      modification du code.`,
  })}
      </div>
    </div>`;
  },

  actions: {
    use(ctx, { data }) {
      const template = TEMPLATES.find((t) => t.id === data.id);
      if (!template) return;

      const options = template.apply.method === 'resolution'
        ? DEFAULT_RESOLUTION_OPTIONS.map((o) => makeOption(o.label, o.sublabel, o.kind))
        : [makeOption(''), makeOption('')];

      const draft = makeElection({
        ref: nextRef(ctx.elections),
        title: '',
        options,
        ...template.apply,
      }, ctx.config.defaults);

      addElection(draft);
      setUi({ wizardStep: 1 });
      toast(`Modèle « ${template.title} » appliqué.`, 'ok');
      ctx.go(`/scrutins/${draft.id}/assistant`);
    },
  },
};
