/**
 * Módulo de Seguridad - Generador de Etiquetas con IA
 * Implementa sanitización HTML, cifrado básico y validaciones
 */

class SecurityManager {
    constructor() {
        this.isDOMPurifyLoaded = false;
        this.initDOMPurify();
    }

    /**
     * Inicializa DOMPurify de forma lazy loading
     */
    async initDOMPurify() {
        if (typeof window.DOMPurify === 'undefined') {
            try {
                await this.loadDOMPurify();
                this.isDOMPurifyLoaded = true;
            } catch (error) {
                console.warn('DOMPurify no disponible, usando fallback básico:', error);
                this.isDOMPurifyLoaded = false;
            }
        } else {
            this.isDOMPurifyLoaded = true;
        }
    }

    /**
     * Carga DOMPurify desde CDN con integrity check
     */
    loadDOMPurify() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js';
            script.integrity = 'sha384-tgqHx8IYNF5dpJmyXPVUGhxU5+XULa+F5xKmZzFpHJh5tGo5yEg5E2sJk5VqGY5';
            script.crossOrigin = 'anonymous';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Sanitiza HTML de forma segura
     * @param {string} html - HTML a sanitizar
     * @param {Element} targetElement - Elemento DOM objetivo
     */
    safeSetInnerHTML(html, targetElement) {
        if (!targetElement) {
            console.error('Elemento objetivo requerido para sanitización');
            return;
        }

        if (this.isDOMPurifyLoaded && window.DOMPurify) {
            // Usar DOMPurify si está disponible
            const cleanHTML = window.DOMPurify.sanitize(html, {
                SAFE_FOR_TEMPLATES: true,
                ALLOWED_TAGS: ['div', 'span', 'p', 'strong', 'em', 'br', 'img', 'h1', 'h2', 'h3'],
                ALLOWED_ATTR: ['class', 'id', 'src', 'alt', 'title', 'style'],
                FORBID_ATTR: ['onclick', 'onload', 'onerror'],
                FORBID_TAGS: ['script', 'object', 'embed', 'link']
            });
            targetElement.innerHTML = cleanHTML;
        } else {
            // Fallback básico de sanitización
            const sanitized = this.basicSanitize(html);
            targetElement.innerHTML = sanitized;
        }
    }

    /**
     * Sanitización básica sin dependencias externas
     * @param {string} html 
     * @returns {string}
     */
    basicSanitize(html) {
        const tempDiv = document.createElement('div');
        tempDiv.textContent = html;
        return tempDiv.innerHTML
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    /**
     * Cifrado ligero XOR + Base64 para localStorage
     * @param {string} data - Datos a cifrar
     * @returns {string}
     */
    encryptData(data) {
        try {
            const key = this.getEncryptionKey();
            let encrypted = '';

            for (let i = 0; i < data.length; i++) {
                encrypted += String.fromCharCode(
                    data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
                );
            }

            return btoa(encrypted);
        } catch (error) {
            console.error('Error al cifrar:', error);
            return data; // Fallback sin cifrado
        }
    }

    /**
     * Descifrado ligero XOR + Base64
     * @param {string} encryptedData 
     * @returns {string}
     */
    decryptData(encryptedData) {
        try {
            const key = this.getEncryptionKey();
            const encrypted = atob(encryptedData);
            let decrypted = '';

            for (let i = 0; i < encrypted.length; i++) {
                decrypted += String.fromCharCode(
                    encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length)
                );
            }

            return decrypted;
        } catch (error) {
            console.error('Error al descifrar:', error);
            return null;
        }
    }

    /**
     * Genera clave de cifrado basada en el origen
     * @returns {string}
     */
    getEncryptionKey() {
        const base = location.origin || 'default-key';
        return btoa(base).substring(0, 16);
    }

    /**
     * Valida entrada según tipo especificado
     * @param {string} input - Entrada a validar
     * @param {string} type - Tipo de validación
     * @param {number} maxLength - Longitud máxima
     * @returns {boolean}
     */
    validateInput(input, type = 'text', maxLength = 1000) {
        if (!input || input.length > maxLength) {
            return false;
        }

        const patterns = {
            email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
            numeric: /^[0-9]+(\.[0-9]+)?$/,
            alphanumeric: /^[a-zA-Z0-9\s\-_\.]+$/,
            text: /^[^<>'"&]+$/,
            url: /^https?:\/\/.+/,
            filename: /^[a-zA-Z0-9\s\-_\.()]+\.(jpg|jpeg|png|gif|webp)$/i
        };

        return patterns[type] ? patterns[type].test(input) : true;
    }

    /**
     * Valida archivos de imagen
     * @param {File} file 
     * @returns {Object}
     */
    validateImageFile(file) {
        const result = { isValid: false, error: null };

        // Verificar tipo MIME
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            result.error = 'Tipo de archivo no permitido. Use JPG, PNG o WebP.';
            return result;
        }

        // Verificar tamaño (5MB máximo)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            result.error = 'Archivo demasiado grande. Máximo 5MB.';
            return result;
        }

        // Verificar nombre de archivo
        if (!this.validateInput(file.name, 'filename')) {
            result.error = 'Nombre de archivo inválido.';
            return result;
        }

        result.isValid = true;
        return result;
    }

    /**
     * Crea un Content Security Policy meta tag
     */
    static addCSPHeader() {
        const cspMeta = document.createElement('meta');
        cspMeta.httpEquiv = 'Content-Security-Policy';
        cspMeta.content = [
            "default-src 'self'",
            "img-src 'self' data: https:",
            "script-src 'self' https://cdn.jsdelivr.net",
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
            "connect-src 'self' https://generativelanguage.googleapis.com",
            "object-src 'none'",
            "base-uri 'none'"
        ].join('; ');

        document.head.appendChild(cspMeta);
    }
}

// Inicializar CSP al cargar el módulo
if (typeof document !== 'undefined') {
    SecurityManager.addCSPHeader();
}

export default SecurityManager;
