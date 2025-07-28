        document.addEventListener('DOMContentLoaded', () => {
            const getEl = (id) => document.getElementById(id);
            const mainContainer = document.querySelector('.main-container');
            const tabUpload = getEl('tab-upload');
            const tabManual = getEl('tab-manual');
            const uploadView = getEl('upload-view');
            const manualView = getEl('manual-view');
            const reviewView = getEl('review-view');
            const dropZone = getEl('drop-zone');
            const fileInput = getEl('file-input');
            const browseBtn = getEl('browse-btn');
            const imagePreviewContainer = getEl('image-preview-container');
            const imagePreview = getEl('image-preview');
            const processImageBtn = getEl('process-image-btn');
            const reviewTableBody = getEl('review-table-body');
            const selectAllCheckbox = getEl('select-all-checkbox');
            const preparePrintBtn = getEl('prepare-print-btn');
            const addManualItemBtn = getEl('add-manual-item-btn');
            const modal = getEl('modal');
            const loader = getEl('loader');
            const modalMessage = getEl('modal-message');
            const printPreviewView = getEl('print-preview-view');
            const printArea = getEl('print-area');
            const printNowBtn = getEl('print-now-btn');
            const backToEditorBtn = getEl('back-to-editor-btn');
            
            const apiKeyModal = getEl('api-key-modal');
            const settingsBtn = getEl('settings-btn');
            const saveSettingsBtn = getEl('save-settings-btn');
            const closeApiKeyModalBtn = getEl('close-api-key-modal-btn');
            const clearSettingsBtn = getEl('clear-settings-btn');
            const apiKeyInput = getEl('api-key-input');
            const logoLeftUrlInput = getEl('logo-left-url');
            const logoRightUrlInput = getEl('logo-right-url');
            const logoLeftFileInput = getEl('logo-left-file');
            const logoRightFileInput = getEl('logo-right-file');
            const logoLeftPreview = getEl('logo-left-preview');
            const logoRightPreview = getEl('logo-right-preview');
            const clearLogoLeftBtn = getEl('clear-logo-left');
            const clearLogoRightBtn = getEl('clear-logo-right');

            const getSetting = (key) => localStorage.getItem(key);
            const setSetting = (key, value) => localStorage.setItem(key, value);
            const removeSetting = (key) => localStorage.removeItem(key);

            const fileToBase64 = (file) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });

            const openSettingsModal = () => {
                apiKeyInput.value = getSetting('geminiApiKey') || '';
                const logoLeft = getSetting('logoLeftUrl') || '';
                const logoRight = getSetting('logoRightUrl') || '';
                logoLeftUrlInput.value = logoLeft.startsWith('http') ? logoLeft : '';
                logoRightUrlInput.value = logoRight.startsWith('http') ? logoRight : '';
                logoLeftPreview.src = logoLeft;
                logoRightPreview.src = logoRight;
                apiKeyModal.classList.remove('hidden');
            };

            const saveSettings = async () => {
                const key = apiKeyInput.value.trim();
                if (key) setSetting('geminiApiKey', key);

                if (logoLeftFileInput.files[0]) {
                    setSetting('logoLeftUrl', await fileToBase64(logoLeftFileInput.files[0]));
                } else if (logoLeftUrlInput.value.trim()) {
                    setSetting('logoLeftUrl', logoLeftUrlInput.value.trim());
                }

                if (logoRightFileInput.files[0]) {
                    setSetting('logoRightUrl', await fileToBase64(logoRightFileInput.files[0]));
                } else if (logoRightUrlInput.value.trim()) {
                    setSetting('logoRightUrl', logoRightUrlInput.value.trim());
                }

                apiKeyModal.classList.add('hidden');
                showModal("Configuración guardada.", false, 2000);
            };

            const clearSettings = () => {
                removeSetting('geminiApiKey');
                removeSetting('logoLeftUrl');
                removeSetting('logoRightUrl');
                apiKeyInput.value = '';
                logoLeftUrlInput.value = '';
                logoRightUrlInput.value = '';
                logoLeftFileInput.value = '';
                logoRightFileInput.value = '';
                logoLeftPreview.src = '';
                logoRightPreview.src = '';
                showModal("Toda la configuración ha sido borrada.", false, 2000);
            };

            const setupLogoInput = (fileInput, urlInput, preview) => {
                fileInput.addEventListener('change', async () => {
                    if (fileInput.files[0]) {
                        urlInput.value = ''; 
                        preview.src = await fileToBase64(fileInput.files[0]);
                    }
                });
                urlInput.addEventListener('input', () => {
                    if (urlInput.value.trim()) {
                        fileInput.value = ''; 
                        preview.src = urlInput.value.trim();
                    }
                });
            };
            
            setupLogoInput(logoLeftFileInput, logoLeftUrlInput, logoLeftPreview);
            setupLogoInput(logoRightFileInput, logoRightUrlInput, logoRightPreview);

            clearLogoLeftBtn.addEventListener('click', () => {
                removeSetting('logoLeftUrl');
                logoLeftUrlInput.value = '';
                logoLeftFileInput.value = '';
                logoLeftPreview.src = '';
            });
            clearLogoRightBtn.addEventListener('click', () => {
                removeSetting('logoRightUrl');
                logoRightUrlInput.value = '';
                logoRightFileInput.value = '';
                logoRightPreview.src = '';
            });

            settingsBtn.addEventListener('click', openSettingsModal);
            saveSettingsBtn.addEventListener('click', saveSettings);
            clearSettingsBtn.addEventListener('click', clearSettings);
            closeApiKeyModalBtn.addEventListener('click', () => apiKeyModal.classList.add('hidden'));

            if (!getSetting('geminiApiKey')) {
                setTimeout(openSettingsModal, 500);
            }

            tabUpload.addEventListener('click', () => {
                tabUpload.classList.add('active');
                tabManual.classList.remove('active');
                uploadView.classList.remove('hidden');
                manualView.classList.add('hidden');
            });

            tabManual.addEventListener('click', () => {
                tabManual.classList.add('active');
                tabUpload.classList.remove('active');
                manualView.classList.remove('hidden');
                uploadView.classList.add('hidden');
            });

            browseBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
            
            dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
            dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); });

            function handleFile(file) {
                if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        imagePreview.src = e.target.result;
                        imagePreviewContainer.classList.remove('hidden');
                    };
                    reader.readAsDataURL(file);
                } else {
                    showModal("Por favor, sube un archivo JPG o PNG.", false);
                }
            }
            
            function resetManualForm() {
                getEl('manual-cantidad').value = '';
                getEl('manual-codigo-ax').value = '';
                getEl('manual-nombre').value = '';
                getEl('manual-dimension').value = '';
                getEl('manual-no-parte').value = '';
                getEl('manual-descripcion').value = '';
            }

            processImageBtn.addEventListener('click', async () => {
                const apiKey = getSetting('geminiApiKey');
                if (!apiKey) {
                    showModal("Necesitas configurar tu API Key de Gemini primero.", false);
                    openSettingsModal();
                    return;
                }
                if (!imagePreview.src) {
                    showModal("Primero debes cargar una imagen.", false);
                    return;
                }
                showModal("Analizando el vale con IA...", true);
                try {
                    const base64ImageData = imagePreview.src.split(',')[1];
                    const prompt = `Analiza la siguiente imagen de un vale de material. Extrae la información de la tabla de materiales. Las columnas relevantes son 'CANTIDAD', 'CODIGO' (la segunda columna, no la que dice 'OC'), 'DESCRIPCION DEL MATERIAL', y 'CLAVE ALMACEN'. Devuelve el resultado como un array de objetos JSON. Asegúrate de que los valores de 'cantidad' sean numéricos.`;
                    const payload = {
                      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64ImageData } }] }],
                      generation_config: {
                        response_mime_type: "application/json",
                        response_schema: {
                          type: "ARRAY",
                          items: {
                            type: "OBJECT",
                            properties: {
                              cantidad: { type: "NUMBER" },
                              codigo: { type: "STRING" },
                              descripcion: { type: "STRING" },
                              claveAlmacen: { type: "STRING" }
                            },
                            required: ["cantidad", "codigo", "descripcion", "claveAlmacen"]
                          }
                        }
                      }
                    };
                    
                    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
                    
                    const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    if (!response.ok) { throw new Error(`Error en la API (${response.status}): ${response.statusText}. Revisa tu API Key.`); }
                    const result = await response.json();
                    if (result.candidates && result.candidates.length > 0) {
                        const jsonText = result.candidates[0].content.parts[0].text;
                        const extractedData = JSON.parse(jsonText);
                        populateReviewTable(extractedData, true);
                        modal.classList.add('hidden');
                    } else { throw new Error("La IA no pudo extraer los datos. Intenta con una imagen más clara."); }
                } catch (error) {
                    console.error("Error al procesar con Gemini:", error);
                    showModal(`Error al contactar la IA. Detalles: ${error.message}`, false, 6000);
                }
            });

            addManualItemBtn.addEventListener('click', () => {
                const item = {
                    cantidad: getEl('manual-cantidad').value,
                    codigoAx: getEl('manual-codigo-ax').value,
                    nombre: getEl('manual-nombre').value,
                    dimension: getEl('manual-dimension').value,
                    noParte: getEl('manual-no-parte').value,
                    descripcion: getEl('manual-descripcion').value
                };
                if (!item.cantidad || !item.codigoAx || !item.nombre) {
                    showModal("Los campos Cantidad, Código AX y Nombre son obligatorios.", false);
                    return;
                }
                populateReviewTable([item], false);
                resetManualForm();
                showModal("Partida añadida a la lista de revisión.", false);
            });

            function populateReviewTable(items, clearTable) {
                if (clearTable) { reviewTableBody.innerHTML = ''; }
                items.forEach((item) => {
                    const row = document.createElement('tr');
                    row.className = 'border-b hover:bg-purple-50';
                    row.innerHTML = `
                        <td class="p-4"><input type="checkbox" class="item-checkbox h-5 w-5 rounded text-purple-600 focus:ring-purple-500" checked></td>
                        <td class="p-2 w-24"><input type="number" class="input-field text-center font-bold" value="${item.cantidad || ''}"></td>
                        <td class="p-2"><input class="input-field" value="${item.codigo || item.codigoAx || ''}"></td>
                        <td class="p-2"><input class="input-field" value="${item.descripcion || item.nombre || ''}"></td>
                        <td class="p-2"><input class="input-field" value="${item.claveAlmacen || item.dimension || ''}"></td>
                        <td class="p-2"><input class="input-field" value="${item.noParte || ''}"></td>
                        <td class="p-2"><input class="input-field" value="${item.descripcion || ''}"></td>
                        <td class="p-2">
                            <select class="select-field">
                                <option>NUEVO</option>
                                <option>USADO NUEVO</option>
                            </select>
                        </td>
                        <td class="p-2">
                            <select class="select-field">
                                <option>INVENTARIABLE</option>
                                <option>CONSUMIBLE</option>
                            </select>
                        </td>
                    `;
                    reviewTableBody.appendChild(row);
                });
                reviewView.classList.remove('hidden');
                window.scrollTo({ top: reviewView.offsetTop, behavior: 'smooth' });
            }

            selectAllCheckbox.addEventListener('change', (e) => {
                document.querySelectorAll('.item-checkbox').forEach(cb => { cb.checked = e.target.checked; });
            });
            
            preparePrintBtn.addEventListener('click', () => {
                const selectedRows = Array.from(reviewTableBody.querySelectorAll('tr')).filter(row => 
                    row.querySelector('.item-checkbox').checked
                );
                if (selectedRows.length === 0) {
                    showModal("No has seleccionado ninguna partida para generar etiquetas.", false);
                    return;
                }
                showModal("Preparando vista previa...", true);
                printArea.innerHTML = '';
                let currentPage;
                let labelCount = 0;
                selectedRows.forEach(row => {
                    const inputs = row.querySelectorAll('input');
                    const selects = row.querySelectorAll('select');
                    const labelData = {
                        cantidad: parseInt(inputs[1].value, 10) || 0,
                        codigoAx: inputs[2].value,
                        nombre: inputs[3].value,
                        dimension: inputs[4].value,
                        noParte: inputs[5].value,
                        descripcion: inputs[6].value,
                        condicion: selects[0].value,
                        categoria: selects[1].value
                    };
                    for (let i = 0; i < labelData.cantidad; i++) {
                        if (labelCount % 12 === 0) {
                            currentPage = document.createElement('div');
                            currentPage.className = 'print-page';
                            printArea.appendChild(currentPage);
                        }
                        currentPage.appendChild(createLabelElement(labelData));
                        labelCount++;
                    }
                });
                setTimeout(() => {
                    modal.classList.add('hidden');
                    mainContainer.classList.add('hidden');
                    printPreviewView.classList.remove('hidden');
                    window.scrollTo(0, 0);
                }, 500);
            });

            printNowBtn.addEventListener('click', () => window.print());
            backToEditorBtn.addEventListener('click', () => {
                printPreviewView.classList.add('hidden');
                mainContainer.classList.remove('hidden');
            });

            function createLabelElement(data) {
                const label = document.createElement('div');
                label.className = 'label-print';
                const safeData = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, document.createTextNode(value).textContent]));
                
                const logoLeftUrl = getSetting('logoLeftUrl') || '';
                const logoRightUrl = getSetting('logoRightUrl') || '';
                const logoLeftImg = logoLeftUrl ? `<img src="${logoLeftUrl}" alt="Logo Izquierdo">` : '<div></div>';
                const logoRightImg = logoRightUrl ? `<img src="${logoRightUrl}" alt="Logo Derecho">` : '<div></div>';

                label.innerHTML = `
                    <div class="label-print-header">
                        ${logoLeftImg}
                        <div class="label-print-title">
                            <strong>ETIQUETADO ALMACEN</strong><br>
                            <span>BRONCO RIG-91</span>
                        </div>
                        ${logoRightImg}
                    </div>
                    <div class="label-print-body">
                        <div class="flex-line">
                            <div><strong>CODIGO AX:</strong> <span>${safeData.codigoAx}</span></div>
                            <div><strong>CONDICION:</strong> <span>${safeData.condicion}</span></div>
                        </div>
                        <p><strong>NOMBRE:</strong> <span>${safeData.nombre}</span></p>
                        <p><strong>DIMENSIÓN:</strong> <span>${safeData.dimension}</span></p>
                        <p><strong>DESCRIPCION:</strong> <span>${safeData.descripcion}</span></p>
                        <p><strong>NO. PARTE:</strong> <span>${safeData.noParte}</span></p>
                        <p><strong>CATEGORIA:</strong> <span>${safeData.categoria}</span></p>
                    </div>
                `;
                return label;
            }

            function showModal(message, showLoader = false, duration = 4000) {
                modalMessage.textContent = message;
                if(loader) loader.style.display = showLoader ? 'block' : 'none';
                modal.classList.remove('hidden');
                if (!showLoader) {
                    setTimeout(() => modal.classList.add('hidden'), duration);
                }
            }
        });