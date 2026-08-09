'use strict';

/**
 * Historial de cambios de las partidas: deshacer y rehacer.
 *
 * En vez de registrar cada acción a mano, se escucha el guardado del
 * estado (`Store.onSaved`): si las listas quedaron distintas de la última
 * instantánea, eso es un paso deshacible. Así entran solas las altas
 * manuales, el inventario, los vales, las ediciones, los duplicados, los
 * borrados y las importaciones, sin tocar cada sitio que muta la lista.
 *
 * Cubre solo las partidas (materiales y códigos AX), que es lo que cuesta
 * recuperar si se borra por error; la configuración (logos, plantilla,
 * listas de códigos) no entra en el historial.
 */
const History = (() => {
    const LIMIT = 60;

    const undoStack = [];
    const redoStack = [];
    let last = null;       // instantánea del estado ya conocido
    let suspended = false; // true mientras el propio historial aplica un cambio
    let onChange = null;

    function snapshot() {
        return JSON.stringify({ materials: Store.state.materials, axItems: Store.state.axItems });
    }

    function itemCount(json) {
        const data = JSON.parse(json);
        return data.materials.length + data.axItems.length;
    }

    /** Resumen corto del salto entre dos instantáneas, para el aviso. */
    function describe(from, to) {
        const diff = itemCount(to) - itemCount(from);
        if (diff > 0) return `${diff} partida(s) recuperada(s)`;
        if (diff < 0) return `${-diff} partida(s) quitada(s)`;
        return 'cambios de una partida revertidos';
    }

    function apply(json) {
        const data = JSON.parse(json);
        // Los arrays se vacían y se rellenan en su sitio (sin sustituirlos):
        // hay código que guarda la referencia a la lista y debe seguir
        // viendo la misma.
        for (const [list, items] of [[Store.state.materials, data.materials], [Store.state.axItems, data.axItems]]) {
            list.length = 0;
            for (const item of items) list.push(item);
        }
        last = json;
    }

    function notify() {
        if (onChange) onChange();
    }

    /** Se llama tras cada guardado: si las partidas cambiaron, es un paso. */
    function capture() {
        if (suspended || last === null) return;
        const now = snapshot();
        if (now === last) return;
        undoStack.push(last);
        if (undoStack.length > LIMIT) undoStack.shift();
        redoStack.length = 0; // una edición nueva descarta lo rehacible
        last = now;
        notify();
    }

    function step(fromStack, toStack) {
        if (fromStack.length === 0) return null;
        const target = fromStack.pop();
        const description = describe(last, target);
        toStack.push(last);
        suspended = true;
        apply(target);
        suspended = false;
        notify();
        return description;
    }

    /** @returns {string|null} descripción de lo deshecho, o null si no había nada */
    function undo() {
        return step(undoStack, redoStack);
    }

    /** @returns {string|null} descripción de lo rehecho, o null si no había nada */
    function redo() {
        return step(redoStack, undoStack);
    }

    const canUndo = () => undoStack.length > 0;
    const canRedo = () => redoStack.length > 0;

    /** @param {Function} handler se llama cuando cambia lo que se puede deshacer/rehacer */
    function init(handler) {
        onChange = handler || null;
        last = snapshot();
        Store.onSaved(capture);
        notify();
    }

    return { init, undo, redo, canUndo, canRedo };
})();
