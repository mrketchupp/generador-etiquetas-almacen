'use strict';

/**
 * Orquestación de la UI: formularios, pestañas, modales y eventos.
 * Sin atributos onclick en el HTML: todo se conecta aquí.
 */
const App = (() => {
    const { el, toast, clampInt, readFileAsDataURL, readFileAsText } = Utils;
    const $ = (id) => document.getElementById(id);

    // ---------- Modo (Material / Código AX) ----------

    function setMode(mode) {
        Store.state.mode = mode;
        Store.save();
        $('tabMaterial').classList.toggle('tab--active', mode === 'material');
        $('tabCodigoAx').classList.toggle('tab--active', mode === 'codigoax');
        $('panelMaterial').hidden = mode !== 'material';
        $('panelCodigoAx').hidden = mode !== 'codigoax';
    }

    // ---------- Tablas ----------

    function refreshTables() {
        Tables.renderMaterials(refreshTables);
        Tables.renderAx(refreshTables);
        Store.save();
    }

    // ---------- Formularios de alta ----------

    function bindMaterialForm() {
        $('materialForm').addEventListener('submit', (event) => {
            event.preventDefault();
            Store.state.materials.push({
                id: Utils.uid(),
                cantidad: clampInt($('fCantidad').value, 1, 1),
                codigoAx: $('fCodigoAx').value.trim(),
                nombre: $('fNombre').value.trim(),
                dimension: $('fDimension').value.trim(),
                noParte: $('fNoParte').value.trim(),
                descripcion: $('fDescripcion').value.trim(),
                condicion: 'NUEVO',
                categoria: 'INVENTARIABLE',
            });
            event.target.reset();
            $('fCantidad').value = '1';
            refreshTables();
            $('fCodigoAx').focus();
            toast('Partida añadida a la lista', 'success');
        });

        $('fCodigoAx').addEventListener('change', () => {
            const nombre = Store.lookupNombre($('fCodigoAx').value);
            if (nombre) $('fNombre').value = nombre;
        });
    }

    function bindAxForm() {
        $('axForm').addEventListener('submit', (event) => {
            event.preventDefault();
            Store.state.axItems.push({
                id: Utils.uid(),
                cantidad: clampInt($('fAxCantidad').value, 1, 1),
                codigoAx: $('fAxCodigo').value.trim(),
                nombre: $('fAxNombre').value.trim(),
            });
            event.target.reset();
            $('fAxCantidad').value = '1';
            refreshTables();
            $('fAxCodigo').focus();
            toast('Código añadido a la lista', 'success');
        });

        $('fAxCodigo').addEventListener('change', () => {
            const nombre = Store.lookupNombre($('fAxCodigo').value);
            if (nombre) $('fAxNombre').value = nombre;
        });
    }

    // ---------- Vista previa / impresión ----------

    function bindPreview() {
        $('btnPreviewMaterial').addEventListener('click', Preview.open);
        $('btnPreviewAx').addEventListener('click', Preview.open);
        $('previewBack').addEventListener('click', Preview.close);
        $('previewPrint').addEventListener('click', Preview.print);
    }

    // ---------- Modal de diseño de plantilla ----------

    const LAYOUT_FIELDS = [
        ['cfgMargin', 'marginMm', 0],
        ['cfgGap', 'gapMm', 0],
        ['cfgLabelWidth', 'labelWidthMm', 5],
        ['cfgLabelHeight', 'labelHeightMm', 5],
    ];

    function fillLayoutForm() {
        const layout = Store.state.settings.layout;
        $('cfgPageSize').value = layout.pageSize;
        for (const [id, key] of LAYOUT_FIELDS) $(id).value = layout[key];
        $('cfgFontSize').value = layout.fontSizePx;
        updateLayoutSummary();
    }

    function updateLayoutSummary() {
        const grid = Layout.computeGrid(Store.state.settings.layout);
        const summary = $('layoutSummary');
        if (grid.perPage > 0) {
            summary.textContent = `✔ Caben ${grid.cols} columna(s) × ${grid.rows} fila(s) = ` +
                `${grid.perPage} etiquetas por hoja. Área útil: ` +
                `${Utils.formatMm(grid.usableW)} × ${Utils.formatMm(grid.usableH)}.`;
            summary.classList.remove('is-error');
        } else {
            summary.textContent = `⚠️ ${grid.warnings.join(' ')}`;
            summary.classList.add('is-error');
        }
    }

    function applyLayoutChanges() {
        Layout.applyToDocument(Store.state.settings.layout);
        Store.save();
        updateLayoutSummary();
        if (Preview.isOpen) Preview.render();
    }

    function bindLayoutModal() {
        const modal = $('layoutModal');
        $('btnLayout').addEventListener('click', () => {
            fillLayoutForm();
            modal.showModal();
        });
        $('layoutModalClose').addEventListener('click', () => modal.close());
        enableBackdropClose(modal);

        $('cfgPageSize').addEventListener('change', () => {
            Store.state.settings.layout.pageSize = $('cfgPageSize').value;
            applyLayoutChanges();
        });

        for (const [id, key, min] of LAYOUT_FIELDS) {
            $(id).addEventListener('change', () => {
                const layout = Store.state.settings.layout;
                const parsed = Utils.parseLength($(id).value, layout[key]);
                layout[key] = Math.max(min, parsed);
                $(id).value = layout[key];
                applyLayoutChanges();
            });
        }

        $('cfgFontSize').addEventListener('change', () => {
            const layout = Store.state.settings.layout;
            const parsed = parseFloat($('cfgFontSize').value);
            layout.fontSizePx = Number.isFinite(parsed) ? Math.max(5, parsed) : layout.fontSizePx;
            $('cfgFontSize').value = layout.fontSizePx;
            applyLayoutChanges();
        });

        $('cfgPreset').addEventListener('change', () => {
            const preset = Store.LAYOUT_PRESETS.find((p) => p.id === $('cfgPreset').value);
            if (preset) {
                Store.state.settings.layout = { ...preset.layout };
                fillLayoutForm();
                applyLayoutChanges();
            }
            $('cfgPreset').value = '';
        });

        $('cfgReset').addEventListener('click', () => {
            Store.state.settings.layout = { ...Store.DEFAULT_LAYOUT };
            fillLayoutForm();
            applyLayoutChanges();
            toast('Diseño restaurado a los valores por defecto', 'info');
        });
    }

    // ---------- Modal de configuración general ----------

    function updateLogoPreview(key) {
        const src = Store.state.settings[key];
        const preview = $(`${key}Preview`);
        preview.replaceChildren();
        if (src) {
            preview.append(el('img', { src, alt: 'Logo' }));
            preview.classList.remove('logo-preview--empty');
        } else {
            preview.textContent = 'Sin logo configurado';
            preview.classList.add('logo-preview--empty');
        }
    }

    function bindLogoControls(key) {
        $(`${key}File`).addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            try {
                Store.state.settings[key] = await readFileAsDataURL(file);
                $(`${key}Url`).value = '';
                Store.save();
                updateLogoPreview(key);
            } catch {
                toast('No se pudo leer la imagen del logo', 'error');
            }
        });

        $(`${key}Url`).addEventListener('change', () => {
            Store.state.settings[key] = $(`${key}Url`).value.trim();
            Store.save();
            updateLogoPreview(key);
        });

        $(`${key}Clear`).addEventListener('click', () => {
            Store.state.settings[key] = '';
            $(`${key}Url`).value = '';
            $(`${key}File`).value = '';
            Store.save();
            updateLogoPreview(key);
        });
    }

    function updateCsvStatus() {
        const count = Object.keys(Store.state.codigosAX).length;
        $('csvStatus').textContent = count > 0
            ? `${count} códigos AX cargados`
            : 'Sin códigos cargados';
    }

    function bindCsvControls() {
        $('csvFile').addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            try {
                const map = CSV.parseCodigosMap(await readFileAsText(file));
                const count = Object.keys(map).length;
                if (count === 0) {
                    toast('El CSV debe tener columnas "Codigo AX" y "Nombre"', 'error');
                    return;
                }
                Store.state.codigosAX = map;
                Store.save();
                updateCsvStatus();
                toast(`${count} códigos AX cargados`, 'success');
            } catch {
                toast('No se pudo leer el archivo CSV', 'error');
            }
        });

        $('csvClear').addEventListener('click', () => {
            Store.state.codigosAX = {};
            $('csvFile').value = '';
            Store.save();
            updateCsvStatus();
            toast('Tabla de códigos eliminada', 'info');
        });
    }

    function bindGeneralConfig() {
        $('cfgHeaderText').addEventListener('change', () => {
            Store.state.settings.headerText = $('cfgHeaderText').value.trim() || 'BRONCO RIG-91';
            $('cfgHeaderText').value = Store.state.settings.headerText;
            Store.save();
        });

        $('geminiKeySave').addEventListener('click', () => {
            const key = $('geminiKeyInput').value.trim();
            if (!key) {
                toast('Ingresa una API Key válida', 'error');
                return;
            }
            Store.state.settings.geminiApiKey = key;
            Store.save();
            updateGeminiUi();
            toast('API Key guardada', 'success');
        });

        $('geminiKeyClear').addEventListener('click', () => {
            Store.state.settings.geminiApiKey = '';
            $('geminiKeyInput').value = '';
            Store.save();
            updateGeminiUi();
            toast('API Key eliminada', 'info');
        });
    }

    function bindConfigModal() {
        const modal = $('configModal');
        $('btnConfig').addEventListener('click', () => modal.showModal());
        $('configModalClose').addEventListener('click', () => modal.close());
        enableBackdropClose(modal);

        bindLogoControls('logoLeft');
        bindLogoControls('logoRight');
        bindCsvControls();
        bindGeneralConfig();
    }

    // ---------- Vale de material (imagen + Gemini) ----------

    let voucherDataUrl = '';

    function updateGeminiUi() {
        const hasKey = Boolean(Store.state.settings.geminiApiKey);
        $('voucherProcess').disabled = !(hasKey && voucherDataUrl);
        $('voucherKeyHint').hidden = hasKey;
    }

    function setVoucherStatus(message, type) {
        const box = $('voucherStatus');
        box.textContent = message;
        box.className = `status${type ? ` status--${type}` : ''}`;
        box.hidden = !message;
    }

    function clearVoucher() {
        voucherDataUrl = '';
        $('voucherInput').value = '';
        $('voucherPreview').removeAttribute('src');
        $('voucherPreviewBox').hidden = true;
        setVoucherStatus('', '');
        updateGeminiUi();
    }

    async function processVoucher() {
        const apiKey = Store.state.settings.geminiApiKey;
        if (!apiKey) {
            toast('Configura tu API Key de Gemini en ⚙️ Configuración', 'warning');
            $('configModal').showModal();
            return;
        }

        const button = $('voucherProcess');
        button.disabled = true;
        button.textContent = '⏳ Procesando…';
        setVoucherStatus('Analizando imagen…', 'info');

        try {
            const items = await Gemini.extractMaterials(voucherDataUrl, apiKey);
            for (const item of items) {
                Store.state.materials.push({
                    id: Utils.uid(),
                    cantidad: clampInt(item.cantidad, 1, 1),
                    codigoAx: String(item.codigo || '').trim(),
                    nombre: String(item.descripcion || '').trim(),
                    dimension: String(item.claveAlmacen || '').trim(),
                    noParte: '',
                    descripcion: String(item.descripcion || '').trim(),
                    condicion: 'NUEVO',
                    categoria: 'INVENTARIABLE',
                });
            }
            refreshTables();
            setVoucherStatus(`✅ Se extrajeron ${items.length} materiales. Revísalos en la tabla de abajo.`, 'success');
        } catch (error) {
            console.error('Error al procesar el vale:', error);
            setVoucherStatus(`❌ ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            button.textContent = '📷 Obtener datos';
            updateGeminiUi();
        }
    }

    function bindVoucher() {
        $('voucherInput').addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) {
                clearVoucher();
                return;
            }
            if (!/^image\/(png|jpe?g)$/.test(file.type)) {
                toast('Solo se permiten imágenes JPG o PNG', 'error');
                event.target.value = '';
                return;
            }
            try {
                voucherDataUrl = await readFileAsDataURL(file);
                $('voucherPreview').src = voucherDataUrl;
                $('voucherPreviewBox').hidden = false;
                setVoucherStatus('', '');
            } catch {
                toast('No se pudo cargar la imagen', 'error');
            }
            updateGeminiUi();
        });

        $('voucherClear').addEventListener('click', clearVoucher);
        $('voucherProcess').addEventListener('click', processVoucher);
    }

    // ---------- Helpers ----------

    function enableBackdropClose(dialog) {
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) dialog.close();
        });
    }

    // ---------- Inicialización ----------

    function init() {
        // Opciones de los selects del modal de diseño
        const presetSelect = $('cfgPreset');
        presetSelect.append(el('option', { value: '', text: 'Aplicar plantilla predefinida…' }));
        for (const preset of Store.LAYOUT_PRESETS) {
            presetSelect.append(el('option', { value: preset.id, text: preset.label }));
        }
        const pageSelect = $('cfgPageSize');
        for (const [id, page] of Object.entries(Store.PAGE_SIZES)) {
            pageSelect.append(el('option', { value: id, text: page.label }));
        }

        Layout.applyToDocument(Store.state.settings.layout);
        setMode(Store.state.mode);
        refreshTables();

        // Valores iniciales del modal de configuración
        $('cfgHeaderText').value = Store.state.settings.headerText;
        $('geminiKeyInput').value = Store.state.settings.geminiApiKey;
        for (const key of ['logoLeft', 'logoRight']) {
            const src = Store.state.settings[key];
            $(`${key}Url`).value = src && !src.startsWith('data:') ? src : '';
            updateLogoPreview(key);
        }
        updateCsvStatus();
        updateGeminiUi();

        // Eventos
        $('tabMaterial').addEventListener('click', () => setMode('material'));
        $('tabCodigoAx').addEventListener('click', () => setMode('codigoax'));
        bindMaterialForm();
        bindAxForm();
        bindPreview();
        bindLayoutModal();
        bindConfigModal();
        bindVoucher();
    }

    document.addEventListener('DOMContentLoaded', init);

    return { setMode, refreshTables };
})();
