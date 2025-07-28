/**
 * UI Material - Utilidades de Material You 3
 * Helpers para theming, componentes y gestión de estados
 */

class MaterialUIHelper {
    constructor() {
        this.themeMode = 'auto'; // auto, light, dark
        this.init();
    }

    /**
     * Inicializa el sistema de theming
     */
    init() {
        this.detectColorScheme();
        this.loadSavedTheme();
        this.setupThemeToggle();
    }

    /**
     * Detecta el esquema de color preferido del usuario
     */
    detectColorScheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }

        // Escuchar cambios en las preferencias del sistema
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (this.themeMode === 'auto') {
                document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            }
        });
    }

    /**
     * Carga el tema guardado del usuario
     */
    loadSavedTheme() {
        const savedTheme = localStorage.getItem('app-theme');
        if (savedTheme) {
            this.setTheme(savedTheme);
        }
    }

    /**
     * Establece el tema de la aplicación
     * @param {string} mode - 'light', 'dark', 'auto'
     */
    setTheme(mode) {
        this.themeMode = mode;
        localStorage.setItem('app-theme', mode);

        switch (mode) {
            case 'light':
                document.documentElement.setAttribute('data-theme', 'light');
                break;
            case 'dark':
                document.documentElement.setAttribute('data-theme', 'dark');
                break;
            case 'auto':
            default:
                this.detectColorScheme();
                break;
        }
    }

    /**
     * Crea un botón Material You 3
     * @param {Object} options - Opciones del botón
     * @returns {HTMLElement}
     */
    createButton(options = {}) {
        const {
            text = 'Button',
            type = 'filled', // filled, outlined, text
            size = 'medium', // small, medium, large
            icon = null,
            onClick = null,
            disabled = false,
            className = ''
        } = options;

        const button = document.createElement('button');
        button.className = `md-${type}-button ${className}`;
        button.disabled = disabled;

        if (icon) {
            const iconEl = document.createElement('span');
            iconEl.innerHTML = icon;
            iconEl.className = 'mr-2';
            button.appendChild(iconEl);
        }

        const textEl = document.createElement('span');
        textEl.textContent = text;
        button.appendChild(textEl);

        if (onClick) {
            button.addEventListener('click', onClick);
        }

        // Añadir ripple effect
        this.addRippleEffect(button);

        return button;
    }

    /**
     * Crea una card Material You 3
     * @param {Object} options - Opciones de la card
     * @returns {HTMLElement}
     */
    createCard(options = {}) {
        const {
            title = '',
            content = '',
            elevation = 1,
            className = ''
        } = options;

        const card = document.createElement('div');
        card.className = `md-card ${className}`;
        card.style.boxShadow = `var(--md-sys-elevation-level${elevation})`;

        if (title) {
            const titleEl = document.createElement('h3');
            titleEl.className = 'md-typescale-title-large mb-md';
            titleEl.textContent = title;
            card.appendChild(titleEl);
        }

        if (content) {
            const contentEl = document.createElement('div');
            contentEl.className = 'md-typescale-body-medium';
            contentEl.innerHTML = content;
            card.appendChild(contentEl);
        }

        return card;
    }

    /**
     * Crea un input field Material You 3
     * @param {Object} options - Opciones del input
     * @returns {HTMLElement}
     */
    createInputField(options = {}) {
        const {
            label = '',
            type = 'text',
            placeholder = '',
            value = '',
            required = false,
            className = ''
        } = options;

        const fieldContainer = document.createElement('div');
        fieldContainer.className = `md-outlined-field ${className}`;

        const input = document.createElement('input');
        input.type = type;
        input.placeholder = ' '; // Necesario para el efecto de label flotante
        input.value = value;
        input.required = required;

        const labelEl = document.createElement('label');
        labelEl.textContent = label;

        fieldContainer.appendChild(input);
        fieldContainer.appendChild(labelEl);

        return fieldContainer;
    }

    /**
     * Crea tabs Material You 3
     * @param {Array} tabs - Array de objetos tab {label, content, active}
     * @returns {HTMLElement}
     */
    createTabs(tabs = []) {
        const tabContainer = document.createElement('div');
        const tabNav = document.createElement('div');
        tabNav.className = 'md-tabs';

        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content mt-lg';

        tabs.forEach((tab, index) => {
            // Crear botón de tab
            const tabButton = document.createElement('button');
            tabButton.className = `md-tab ${tab.active ? 'active' : ''}`;
            tabButton.textContent = tab.label;
            tabButton.setAttribute('data-tab-index', index);

            // Crear contenido de tab
            const tabPanel = document.createElement('div');
            tabPanel.className = `tab-panel ${!tab.active ? 'hidden' : ''}`;
            tabPanel.innerHTML = tab.content;
            tabPanel.id = `tab-panel-${index}`;

            tabButton.addEventListener('click', () => {
                // Desactivar todos los tabs
                tabNav.querySelectorAll('.md-tab').forEach(t => t.classList.remove('active'));
                tabContent.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));

                // Activar tab seleccionado
                tabButton.classList.add('active');
                tabPanel.classList.remove('hidden');
            });

            tabNav.appendChild(tabButton);
            tabContent.appendChild(tabPanel);
        });

        tabContainer.appendChild(tabNav);
        tabContainer.appendChild(tabContent);

        return tabContainer;
    }

    /**
     * Añade efecto ripple a un elemento
     * @param {HTMLElement} element 
     */
    addRippleEffect(element) {
        element.addEventListener('click', (e) => {
            const ripple = document.createElement('div');
            const rect = element.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.3);
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                animation: ripple 0.6s ease-out;
                pointer-events: none;
            `;

            // Hacer el elemento relativo si no lo es
            if (getComputedStyle(element).position === 'static') {
                element.style.position = 'relative';
            }
            element.style.overflow = 'hidden';

            element.appendChild(ripple);

            // Remover el ripple después de la animación
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });

        // Añadir estilos de animación si no existen
        if (!document.getElementById('ripple-animation')) {
            const style = document.createElement('style');
            style.id = 'ripple-animation';
            style.textContent = `
                @keyframes ripple {
                    0% { transform: scale(0); opacity: 1; }
                    100% { transform: scale(1); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Muestra un snackbar Material You 3
     * @param {string} message - Mensaje a mostrar
     * @param {Object} options - Opciones del snackbar
     */
    showSnackbar(message, options = {}) {
        const {
            duration = 4000,
            action = null,
            type = 'info' // info, success, warning, error
        } = options;

        // Remover snackbar anterior si existe
        const existingSnackbar = document.querySelector('.md-snackbar');
        if (existingSnackbar) {
            existingSnackbar.remove();
        }

        const snackbar = document.createElement('div');
        snackbar.className = `md-snackbar md-snackbar-${type}`;
        snackbar.style.cssText = `
            position: fixed;
            bottom: 16px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background-color: var(--md-sys-color-surface-container-high);
            color: var(--md-sys-color-on-surface);
            padding: var(--md-sys-spacing-lg) var(--md-sys-spacing-xl);
            border-radius: var(--md-sys-shape-corner-small);
            box-shadow: var(--md-sys-elevation-level3);
            z-index: 1000;
            max-width: 400px;
            transition: transform var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard);
            display: flex;
            align-items: center;
            gap: var(--md-sys-spacing-md);
        `;

        const messageEl = document.createElement('span');
        messageEl.className = 'md-typescale-body-medium';
        messageEl.textContent = message;
        snackbar.appendChild(messageEl);

        if (action) {
            const actionBtn = document.createElement('button');
            actionBtn.className = 'md-text-button';
            actionBtn.textContent = action.label;
            actionBtn.addEventListener('click', () => {
                action.onClick();
                snackbar.remove();
            });
            snackbar.appendChild(actionBtn);
        }

        document.body.appendChild(snackbar);

        // Animar entrada
        requestAnimationFrame(() => {
            snackbar.style.transform = 'translateX(-50%) translateY(0)';
        });

        // Auto-remover después del tiempo especificado
        if (duration > 0) {
            setTimeout(() => {
                snackbar.style.transform = 'translateX(-50%) translateY(100px)';
                setTimeout(() => {
                    if (snackbar.parentNode) {
                        snackbar.remove();
                    }
                }, 300);
            }, duration);
        }

        return snackbar;
    }

    /**
     * Crea un modal Material You 3
     * @param {Object} options - Opciones del modal
     * @returns {HTMLElement}
     */
    createModal(options = {}) {
        const {
            title = '',
            content = '',
            actions = [],
            persistent = false
        } = options;

        const overlay = document.createElement('div');
        overlay.className = 'md-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: var(--md-sys-spacing-xl);
            opacity: 0;
            transition: opacity var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard);
        `;

        const modal = document.createElement('div');
        modal.className = 'md-modal';
        modal.style.cssText = `
            background: var(--md-sys-color-surface-container-high);
            border-radius: var(--md-sys-shape-corner-large);
            padding: var(--md-sys-spacing-xl);
            max-width: 500px;
            width: 100%;
            box-shadow: var(--md-sys-elevation-level5);
            transform: scale(0.8);
            transition: transform var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized);
        `;

        if (title) {
            const titleEl = document.createElement('h2');
            titleEl.className = 'md-typescale-title-large text-on-surface mb-lg';
            titleEl.textContent = title;
            modal.appendChild(titleEl);
        }

        if (content) {
            const contentEl = document.createElement('div');
            contentEl.className = 'md-typescale-body-medium text-on-surface-variant mb-xl';
            contentEl.innerHTML = content;
            modal.appendChild(contentEl);
        }

        if (actions.length > 0) {
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'flex justify-end gap-md';

            actions.forEach(action => {
                const button = this.createButton({
                    text: action.label,
                    type: action.primary ? 'filled' : 'text',
                    onClick: () => {
                        action.onClick();
                        this.closeModal(overlay);
                    }
                });
                actionsContainer.appendChild(button);
            });

            modal.appendChild(actionsContainer);
        }

        // Cerrar modal al hacer clic fuera (si no es persistente)
        if (!persistent) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeModal(overlay);
                }
            });
        }

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Animar entrada
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            modal.style.transform = 'scale(1)';
        });

        return overlay;
    }

    /**
     * Cierra un modal
     * @param {HTMLElement} modal 
     */
    closeModal(modal) {
        const modalEl = modal.querySelector('.md-modal');
        modal.style.opacity = '0';
        modalEl.style.transform = 'scale(0.8)';

        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 300);
    }

    /**
     * Crea un loader Material You 3
     * @param {Object} options - Opciones del loader
     * @returns {HTMLElement}
     */
    createLoader(options = {}) {
        const {
            size = 'medium', // small, medium, large
            message = ''
        } = options;

        const loader = document.createElement('div');
        loader.className = 'md-loader';
        loader.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--md-sys-spacing-md);
        `;

        const spinner = document.createElement('div');
        spinner.className = 'md-spinner';

        const sizes = {
            small: '24px',
            medium: '48px',
            large: '64px'
        };

        spinner.style.cssText = `
            width: ${sizes[size]};
            height: ${sizes[size]};
            border: 3px solid var(--md-sys-color-outline-variant);
            border-top: 3px solid var(--md-sys-color-primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        `;

        loader.appendChild(spinner);

        if (message) {
            const messageEl = document.createElement('p');
            messageEl.className = 'md-typescale-body-medium text-on-surface-variant';
            messageEl.textContent = message;
            loader.appendChild(messageEl);
        }

        // Añadir animación si no existe
        if (!document.getElementById('spinner-animation')) {
            const style = document.createElement('style');
            style.id = 'spinner-animation';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        return loader;
    }

    /**
     * Configura el toggle de tema
     */
    setupThemeToggle() {
        // Esto puede ser llamado por el desarrollador para añadir un botón de tema
        const themeToggle = document.createElement('button');
        themeToggle.className = 'md-text-button';
        themeToggle.innerHTML = '🌙'; // o ☀️
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            this.setTheme(currentTheme === 'dark' ? 'light' : 'dark');
            themeToggle.innerHTML = currentTheme === 'dark' ? '🌙' : '☀️';
        });

        return themeToggle;
    }

    /**
     * Utilitarios de animación
     */
    animate = {
        fadeIn: (element, duration = 300) => {
            element.style.opacity = '0';
            element.style.transition = `opacity ${duration}ms var(--md-sys-motion-easing-standard)`;
            requestAnimationFrame(() => {
                element.style.opacity = '1';
            });
        },

        fadeOut: (element, duration = 300) => {
            element.style.transition = `opacity ${duration}ms var(--md-sys-motion-easing-standard)`;
            element.style.opacity = '0';
            return new Promise(resolve => {
                setTimeout(resolve, duration);
            });
        },

        slideIn: (element, direction = 'up', duration = 300) => {
            const directions = {
                up: 'translateY(20px)',
                down: 'translateY(-20px)',
                left: 'translateX(20px)',
                right: 'translateX(-20px)'
            };

            element.style.transform = directions[direction];
            element.style.opacity = '0';
            element.style.transition = `transform ${duration}ms var(--md-sys-motion-easing-emphasized), opacity ${duration}ms var(--md-sys-motion-easing-standard)`;

            requestAnimationFrame(() => {
                element.style.transform = 'translate(0)';
                element.style.opacity = '1';
            });
        }
    };
}

export default MaterialUIHelper;
