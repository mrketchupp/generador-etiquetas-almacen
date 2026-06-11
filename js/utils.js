'use strict';

/**
 * Utilidades generales: unidades físicas, creación de DOM, toasts y archivos.
 */
const Utils = (() => {
    const MM_FACTORS = { mm: 1, cm: 10, in: 25.4, pulg: 25.4, px: 25.4 / 96 };

    /**
     * Convierte una longitud escrita por el usuario a milímetros.
     * Acepta "95.25", "95,25", "3.75in", "0.5 in", "2cm", "10px"...
     * Un número sin unidad se interpreta como milímetros.
     */
    function parseLength(value, fallbackMm) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        const match = String(value ?? '').trim().match(/^(-?\d+(?:[.,]\d+)?)\s*(mm|cm|in|pulg|px)?$/i);
        if (!match) return fallbackMm;
        const num = parseFloat(match[1].replace(',', '.'));
        const unit = (match[2] || 'mm').toLowerCase();
        return num * MM_FACTORS[unit];
    }

    function formatMm(mm) {
        return `${Math.round(mm * 10) / 10} mm`;
    }

    /** Milímetros a píxeles CSS (96 px por pulgada). */
    function mmToPx(mm) {
        return (mm * 96) / 25.4;
    }

    function clampInt(value, min, fallback) {
        const n = parseInt(value, 10);
        if (Number.isNaN(n)) return fallback;
        return Math.max(min, n);
    }

    function uid() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    /**
     * Crea un elemento DOM. El texto siempre se asigna con textContent,
     * por lo que nunca se interpreta como HTML (sin riesgo de inyección).
     */
    function el(tag, props = {}, children = []) {
        const node = document.createElement(tag);
        for (const [key, value] of Object.entries(props)) {
            if (key === 'class') node.className = value;
            else if (key === 'text') node.textContent = value;
            else if (key === 'dataset') Object.assign(node.dataset, value);
            else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
            else node.setAttribute(key, value);
        }
        for (const child of [].concat(children)) {
            if (child != null) node.append(child);
        }
        return node;
    }

    let toastHost = null;

    /** Notificación no bloqueante (reemplaza a alert()). */
    function toast(message, type = 'info') {
        if (!toastHost) {
            toastHost = el('div', { class: 'toast-host' });
            document.body.append(toastHost);
        }
        const item = el('div', { class: `toast toast--${type}`, text: message });
        toastHost.append(item);
        requestAnimationFrame(() => item.classList.add('toast--visible'));
        setTimeout(() => {
            item.classList.remove('toast--visible');
            setTimeout(() => item.remove(), 300);
        }, 3500);
    }

    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    return { parseLength, formatMm, mmToPx, clampInt, uid, el, toast, readFileAsDataURL, readFileAsText };
})();
