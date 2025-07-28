/**  Lógica Principal – ES Modules (Material You 3 + Seguridad)  */
import SecurityManager from './security.js';
import MaterialUIHelper from './ui-material.js';

// Instancias únicas
const security = new SecurityManager();
const ui       = new MaterialUIHelper();

/* Helpers de almacenamiento más seguro */
const getSetting = key   => sessionStorage.getItem(key);
const setSetting = (k,v) => sessionStorage.setItem(k,v);

/* Iniciador */
function init() {
  // 1 · Cargar ajustes
  ['geminiApiKey','logoLeftUrl','logoRightUrl'].forEach(k => setSetting(k, getSetting(k)));

  // 2 · Convertir botones y tabs existentes a Material You 3
  document.querySelectorAll('button.btn-primary').forEach(b => b.className = 'md-filled-button');
  document.querySelectorAll('button.btn-secondary').forEach(b => b.className = 'md-outlined-button');
  document.querySelectorAll('.tab').forEach(t => t.className = 'md-tab');

  // 3 · Ripple global
  document.querySelectorAll('button').forEach(el => ui.addRippleEffect(el));

  // 4 · Sanitizar inputs de la tabla de revisión en vivo
  const reviewBody = document.getElementById('review-table-body');
  const obs = new MutationObserver(() => {
    reviewBody.querySelectorAll('input').forEach(i => {
      i.addEventListener('input', () => {
        if (!security.validateInput(i.value, 'text')) {
          i.value = i.value.replace(/[<>\"']/g, '');
          ui.showSnackbar('Entrada inválida. Caracteres eliminados.', {type:'warning'});
        }
      });
    });
  });
  obs.observe(reviewBody, { childList:true });

  // Exponer helpers para debug si se requiere
  window._app = {security, ui};
}

document.addEventListener('DOMContentLoaded', init);
