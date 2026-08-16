'use strict';

/**
 * Constructores de etiquetas. Todo el contenido se crea con DOM y
 * textContent (vía Utils.el), de modo que los datos del usuario nunca
 * se interpretan como HTML.
 */
const Labels = (() => {
    const { el } = Utils;

    function logoBox(src, alt) {
        const box = el('div', { class: 'label__logo' });
        if (src) box.append(el('img', { src, alt }));
        return box;
    }

    /**
     * Logo derecho de una partida: el de la posición item.logoIndex de la
     * biblioteca (0 = predeterminado). El izquierdo nunca cambia.
     */
    function rightLogoSrc(settings, item) {
        const logos = settings.rightLogos || [];
        if (!logos.length) return '';
        const idx = item && Number.isInteger(item.logoIndex) ? item.logoIndex : 0;
        return (logos[idx] || logos[0]).src;
    }

    function header(settings, item) {
        return el('div', { class: 'label__header' }, [
            logoBox(settings.logoLeft, 'Logo izquierdo'),
            el('div', { class: 'label__title' }, [
                el('h4', { text: 'ETIQUETADO ALMACEN' }),
                el('p', { text: settings.headerText }),
            ]),
            logoBox(rightLogoSrc(settings, item), 'Logo derecho'),
        ]);
    }

    function field(name, value) {
        return el('div', { class: 'label__field' }, [
            el('span', { class: 'label__field-name', text: name }),
            el('span', { class: 'label__field-value', text: value || 'N/A' }),
        ]);
    }

    /** Etiqueta completa de material. */
    function material(item, settings) {
        return el('div', { class: 'label label--material' }, [
            header(settings, item),
            el('div', { class: 'label__body' }, [
                el('div', { class: 'label__row-2' }, [
                    field('CODIGO AX:', item.codigoAx),
                    field('CONDICION:', item.condicion),
                ]),
                field('NOMBRE:', item.nombre),
                field('DIMENSIÓN:', item.dimension),
                field('DESCRIPCION:', item.descripcion),
                field('NO. PARTE:', item.noParte),
                field('ÁREA:', item.area),
            ]),
        ]);
    }

    /** Etiqueta de código AX en grande. */
    function codigoAx(item, settings) {
        return el('div', { class: 'label label--ax' }, [
            header(settings, item),
            el('div', { class: 'label__ax-code', text: item.codigoAx }),
            el('div', { class: 'label__ax-name', text: item.nombre }),
        ]);
    }

    return { material, codigoAx };
})();
