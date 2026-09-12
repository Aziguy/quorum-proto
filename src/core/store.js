/**
 * store.js — état applicatif observable, volontairement minimal.
 *
 * Deux façons d'écrire, et la distinction compte :
 *   update() modifie puis prévient les abonnés  → provoque un rendu
 *   mutate() modifie en silence                 → ne provoque aucun rendu
 *
 * `mutate` existe pour les champs de saisie : re-rendre à chaque frappe
 * détruirait la position du curseur et le focus.
 */

export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();
  let notifyScheduled = false;

  function notify() {
    // Regroupe les notifications d'un même tour de boucle en un seul rendu.
    if (notifyScheduled) return;
    notifyScheduled = true;
    queueMicrotask(() => {
      notifyScheduled = false;
      for (const listener of listeners) listener(state);
    });
  }

  return {
    get: () => state,

    /** Applique une transformation et déclenche un rendu. */
    update(recipe) {
      const patch = typeof recipe === 'function' ? recipe(state) : recipe;
      if (!patch) return state;
      state = { ...state, ...patch };
      notify();
      return state;
    },

    /** Applique une transformation sans déclencher de rendu. */
    mutate(recipe) {
      const patch = typeof recipe === 'function' ? recipe(state) : recipe;
      if (patch) state = { ...state, ...patch };
      return state;
    },

    /** Force un rendu sans changer l'état. */
    refresh: notify,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
