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
                logoIndex: 0,
            });
            event.target.reset();
            $('fCantidad').value = '1';
            refreshTables();
            $('fCodigoAx').focus();
            toast('Partida añadida a la lista', 'success');
            suggestLogos();
        });

        $('fCodigoAx').addEventListener('change', () => {
            const nombre = Store.lookupNombre($('fCodigoAx').value);
            if (nombre) $('fNombre').value = nombre;
            else suggestCodigosFile();
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
            suggestLogos();
        });

        $('fAxCodigo').addEventListener('change', () => {
            const nombre = Store.lookupNombre($('fAxCodigo').value);
            if (nombre) $('fAxNombre').value = nombre;
            else suggestCodigosFile();
        });
    }

    // ---------- Sugerencia: lista de códigos AX ----------

    let codigosSuggested = false;

    /**
     * Si el usuario escribe códigos a mano y no hay lista de códigos
     * cargada, se le sugiere (una vez por sesión) cargarla para
     * autocompletar los nombres, con acceso directo a la configuración.
     */
    function suggestCodigosFile() {
        if (codigosSuggested) return;
        if (Object.keys(Store.state.codigosAX).length > 0) return;
        // una sola sugerencia a la vez; la otra saldrá en la próxima acción
        if (document.querySelector('.toast--action')) return;
        codigosSuggested = true;
        Utils.toastAction(
            '💡 El Nombre puede autocompletarse solo: carga una vez tu lista de códigos AX.',
            'Cargar lista',
            () => {
                $('configModal').showModal();
                const help = $('csvHelp');
                if (help) help.open = true;
                $('csvSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
            },
        );
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
        ['cfgMarginTop', 'marginTopMm', 0],
        ['cfgMarginLeft', 'marginLeftMm', 0],
        ['cfgGapX', 'gapXMm', 0],
        ['cfgGapY', 'gapYMm', 0],
        ['cfgLabelWidth', 'labelWidthMm', 5],
        ['cfgLabelHeight', 'labelHeightMm', 5],
    ];

    function fillLayoutForm() {
        const layout = Store.state.settings.layout;
        $('cfgPageSize').value = layout.pageSize;
        for (const [id, key] of LAYOUT_FIELDS) $(id).value = layout[key];
        $('cfgFontSize').value = layout.fontSizePx;
        $('cfgShowBorder').checked = layout.showBorder !== false;
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

        $('cfgShowBorder').addEventListener('change', () => {
            Store.state.settings.layout.showBorder = $('cfgShowBorder').checked;
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
                toast('✅ Logo izquierdo cargado', 'success');
            } catch {
                toast('No se pudo leer la imagen del logo', 'error');
            }
        });

        $(`${key}Url`).addEventListener('change', () => {
            Store.state.settings[key] = $(`${key}Url`).value.trim();
            Store.save();
            updateLogoPreview(key);
            if (Store.state.settings[key]) toast('✅ Logo izquierdo actualizado', 'success');
        });

        $(`${key}Clear`).addEventListener('click', () => {
            Store.state.settings[key] = '';
            $(`${key}Url`).value = '';
            $(`${key}File`).value = '';
            Store.save();
            updateLogoPreview(key);
            toast('Logo izquierdo eliminado', 'info');
        });
    }

    // ---------- Biblioteca de logos derechos ----------

    function renderRightLogos() {
        const list = $('rightLogosList');
        const logos = Store.state.settings.rightLogos;
        list.replaceChildren();
        if (!logos.length) {
            list.append(el('p', { class: 'hint', text: 'Sin logos registrados: el lado derecho de la etiqueta quedará vacío.' }));
        }
        logos.forEach((logo, index) => {
            list.append(el('div', { class: 'logo-row' }, [
                el('img', { class: 'logo-row__img', src: logo.src, alt: 'Logo derecho' }),
                el('span', { class: 'logo-row__name', text: index === 0 ? 'Predeterminado' : `Alternativo ${index}` }),
                index > 0 ? el('button', {
                    class: 'btn btn--small', type: 'button', text: '★ Hacer predeterminado',
                    onclick: () => {
                        logos.splice(index, 1);
                        logos.unshift(logo);
                        Store.save();
                        renderRightLogos();
                        refreshTables();
                    },
                }) : null,
                el('button', {
                    class: 'btn btn--small btn--danger', type: 'button', text: 'Eliminar',
                    onclick: () => {
                        if (!confirm('¿Eliminar este logo?')) return;
                        logos.splice(index, 1);
                        Store.save();
                        renderRightLogos();
                        refreshTables();
                    },
                }),
            ]));
        });
    }

    // La imagen elegida se muestra al instante en una vista previa; el
    // nombre del archivo solo no basta para saber si cargó bien.
    let pendingLogoSrc = '';

    function updateNewLogoPreview() {
        const preview = $('newLogoPreview');
        preview.replaceChildren();
        if (pendingLogoSrc) {
            preview.append(el('img', { src: pendingLogoSrc, alt: 'Vista previa del logo' }));
            preview.classList.remove('logo-preview--empty');
        } else {
            preview.textContent = 'Aún sin imagen: elige un archivo o pega una URL';
            preview.classList.add('logo-preview--empty');
        }
        $('newLogoAdd').disabled = !pendingLogoSrc;
    }

    function addRightLogo() {
        if (!pendingLogoSrc) {
            toast('Elige un archivo o pega una URL primero', 'error');
            return;
        }
        Store.state.settings.rightLogos.push({ id: Utils.uid(), src: pendingLogoSrc });
        Store.save();
        pendingLogoSrc = '';
        $('newLogoFile').value = '';
        $('newLogoUrl').value = '';
        updateNewLogoPreview();
        renderRightLogos();
        refreshTables();
        toast('✅ Logo derecho añadido', 'success');
    }

    function bindRightLogos() {
        $('newLogoFile').addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            try {
                pendingLogoSrc = await readFileAsDataURL(file);
                $('newLogoUrl').value = '';
                updateNewLogoPreview();
                toast('Imagen cargada: revisa la vista previa y pulsa «Añadir logo»', 'info');
            } catch {
                pendingLogoSrc = '';
                updateNewLogoPreview();
                toast('No se pudo leer la imagen del logo', 'error');
            }
        });

        $('newLogoUrl').addEventListener('change', () => {
            pendingLogoSrc = $('newLogoUrl').value.trim();
            if (pendingLogoSrc) $('newLogoFile').value = '';
            updateNewLogoPreview();
        });

        $('newLogoAdd').addEventListener('click', addRightLogo);
    }

    // ---------- Sugerencia: cargar logos ----------

    let logosSuggested = false;

    /** Si se empieza a trabajar sin ningún logo, se sugiere cargarlos. */
    function suggestLogos() {
        if (logosSuggested) return;
        const settings = Store.state.settings;
        if (settings.logoLeft || settings.rightLogos.length > 0) return;
        // una sola sugerencia a la vez; la otra saldrá en la próxima acción
        if (document.querySelector('.toast--action')) return;
        logosSuggested = true;
        Utils.toastAction(
            '💡 Tus etiquetas se imprimirán sin logos. Cárgalos una vez y quedan guardados.',
            'Cargar logos',
            () => {
                const modal = $('configModal');
                modal.showModal();
                modal.scrollTop = 0;
            },
        );
    }

    function updateCsvStatus() {
        const count = Object.keys(Store.state.codigosAX).length;
        const status = $('csvStatus');
        status.className = 'hint';
        status.textContent = count > 0
            ? `✅ ${count} códigos AX cargados`
            : 'Sin códigos cargados';
    }

    /** Lee la lista de códigos desde CSV o Excel (.xlsx). */
    async function parseCodigosFile(file) {
        const isExcel = /\.xlsx$/i.test(file.name) || (file.type || '').includes('spreadsheetml');
        if (!isExcel) {
            return CSV.parseCodigosMap(await readFileAsText(file));
        }
        const sheets = await Xlsx.read(file);
        const map = {};
        for (const sheet of sheets) {
            // localizar la fila de encabezados en las primeras filas
            for (let i = 0; i < Math.min(sheet.rows.length, 10); i++) {
                const cells = sheet.rows[i].map((c) => String(c ?? '').trim().toLowerCase());
                const codeIdx = cells.findIndex((c) => c.includes('codigo') || c.includes('código'));
                const nameIdx = cells.findIndex((c) => c.includes('nombre'));
                if (codeIdx === -1 || nameIdx === -1) continue;
                for (const row of sheet.rows.slice(i + 1)) {
                    const code = String(row[codeIdx] ?? '').trim().toUpperCase();
                    const name = String(row[nameIdx] ?? '').trim();
                    if (code && name) map[code] = name;
                }
                break;
            }
        }
        return map;
    }

    /** Muestra la ayuda de formato (para corregir el archivo sin ser técnico). */
    function showCodigosFormatError(message) {
        const status = $('csvStatus');
        status.className = 'status status--error';
        status.textContent = `❌ ${message}`;
        const help = $('csvHelp');
        if (help) help.open = true;
        toast('Revisa el formato del archivo: abrí la guía con un ejemplo', 'error');
    }

    function bindCsvControls() {
        $('csvFile').addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            try {
                const map = await parseCodigosFile(file);
                const count = Object.keys(map).length;
                if (count === 0) {
                    showCodigosFormatError('No encontré las columnas «Codigo AX» y «Nombre». Compara tu archivo con el ejemplo de abajo.');
                    return;
                }
                Store.state.codigosAX = map;
                Store.save();
                updateCsvStatus();
                toast(`${count} códigos AX cargados`, 'success');
            } catch (error) {
                console.error('Error al leer la lista de códigos:', error);
                showCodigosFormatError('No se pudo leer el archivo. Debe ser .csv o .xlsx como el ejemplo de abajo.');
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
            toast('✅ Texto de almacén guardado', 'success');
        });

        $('geminiKeySave').addEventListener('click', () => {
            const key = $('geminiKeyInput').value.trim();
            if (!key) {
                toast('Ingresa una API Key válida', 'error');
                return;
            }
            Store.state.settings.geminiApiKey = key;
            Store.state.settings.geminiModel = ''; // se resuelve de nuevo con la nueva key
            Store.save();
            updateGeminiUi();
            toast('API Key guardada', 'success');
        });

        $('geminiKeyClear').addEventListener('click', () => {
            Store.state.settings.geminiApiKey = '';
            Store.state.settings.geminiModel = '';
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
        bindRightLogos();
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
                const oc = String(item.oc || '').trim();
                Store.state.materials.push({
                    id: Utils.uid(),
                    cantidad: clampInt(item.cantidad, 1, 1),
                    codigoAx: String(item.codigo || '').trim(),
                    // DESCRIPCION DEL MATERIAL del vale → Nombre de la etiqueta;
                    // O.C. del vale → Descripción de la etiqueta, con prefijo
                    // "OC:" para que se entienda a qué se refiere el valor.
                    nombre: String(item.descripcion || '').trim(),
                    dimension: String(item.claveAlmacen || '').trim(),
                    noParte: '',
                    descripcion: oc ? `OC: ${oc}` : '',
                    condicion: 'NUEVO',
                    categoria: 'INVENTARIABLE',
                    logoIndex: 0,
                });
            }
            refreshTables();
            setVoucherStatus(`✅ Se extrajeron ${items.length} materiales. Revísalos en la tabla de abajo.`, 'success');
            toast(`✅ ${items.length} materiales extraídos del vale`, 'success');
            suggestLogos();
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
                toast('✅ Imagen del vale cargada', 'success');
            } catch {
                toast('No se pudo cargar la imagen', 'error');
            }
            updateGeminiUi();
        });

        $('voucherClear').addEventListener('click', clearVoucher);
        $('voucherProcess').addEventListener('click', processVoucher);
    }

    // ---------- Vaciar listas ----------

    function bindClearButtons() {
        $('btnClearMaterials').addEventListener('click', () => {
            const count = Store.state.materials.length;
            if (!confirm(`¿Vaciar toda la lista de materiales (${count} partida(s))? Esta acción no se puede deshacer.`)) return;
            Store.state.materials.length = 0;
            refreshTables();
            toast('Lista de materiales vaciada', 'info');
        });

        $('btnClearAx').addEventListener('click', () => {
            const count = Store.state.axItems.length;
            if (!confirm(`¿Vaciar toda la lista de códigos AX (${count} partida(s))? Esta acción no se puede deshacer.`)) return;
            Store.state.axItems.length = 0;
            refreshTables();
            toast('Lista de códigos AX vaciada', 'info');
        });
    }

    // ---------- Exportar / importar partidas ----------

    function bindTransfer() {
        const fileInput = $('importFileInput');

        for (const id of ['btnExportMaterial', 'btnExportAx']) {
            $(id).addEventListener('click', () => {
                if (Store.state.materials.length === 0 && Store.state.axItems.length === 0) {
                    toast('No hay partidas para exportar', 'warning');
                    return;
                }
                Transfer.exportData();
                toast('Lista exportada como archivo .json', 'success');
            });
        }

        for (const id of ['btnImportMaterial', 'btnImportAx']) {
            $(id).addEventListener('click', () => fileInput.click());
        }

        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            try {
                const added = await Transfer.importFile(file);
                refreshTables();
                toast(`Importado: ${added.materials} material(es) y ${added.axItems} código(s) AX`, 'success');
            } catch (error) {
                toast(error.message || 'No se pudo importar el archivo', 'error');
            }
            event.target.value = '';
        });
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
        const leftSrc = Store.state.settings.logoLeft;
        $('logoLeftUrl').value = leftSrc && !leftSrc.startsWith('data:') ? leftSrc : '';
        updateLogoPreview('logoLeft');
        renderRightLogos();
        updateNewLogoPreview();
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
        bindTransfer();
        bindClearButtons();
        Inventory.init({ onAdd: () => { refreshTables(); suggestLogos(); } });

        // Service worker: permite usar la app sin conexión una vez cargada
        // (no aplica al abrir el archivo directamente con file://).
        if ('serviceWorker' in navigator && location.protocol !== 'file:') {
            navigator.serviceWorker.register('sw.js').catch((error) => {
                console.warn('No se pudo registrar el service worker:', error);
            });
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    return { setMode, refreshTables, suggestCodigosFile };
})();
