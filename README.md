# Generador de Etiquetas de Almacén

Aplicación web (100 % cliente, sin backend) para generar e imprimir etiquetas de almacén en dos formatos:

- **Material**: etiqueta completa con código AX, nombre, dimensión/clave de almacén, no. de parte, descripción, condición y categoría.
- **Código AX**: etiqueta con el código en grande y el nombre del material.

🔒 Privacidad: todos los datos (partidas, logos, CSV, API Key) viven solo en el navegador del usuario (localStorage).

## Funciones

- Alta manual de partidas y extracción automática desde la **foto de un vale de material** usando la API de Gemini (requiere API Key propia). El modelo se detecta automáticamente consultando `ListModels`, así la app sigue funcionando cuando Google renombra o retira modelos.
- Tabla de revisión editable con duplicar/eliminar. La lista **se conserva al recargar** la página. Al editar una partida, el editor se despliega en su sitio manteniendo a la vista de qué partida se trata (cantidad, nombre y dimensión, que se actualizan mientras escribes).
- **Deshacer y rehacer** los cambios de las listas con `Ctrl+Z` / `Ctrl+Shift+Z` (`⌘Z` / `⇧⌘Z` en Mac; también vale `Ctrl+Y`) o con los botones ↩️ ↪️ de la barra superior. Cubre altas manuales, inventario, vales, ediciones, duplicados, borrados, importaciones y el vaciado de listas; un alta en lote se deshace de una sola vez. Mientras escribes en un campo con texto manda el deshacer del navegador, para no perder lo tecleado.
- **Autocompletado del Nombre al escribir el código AX**, a partir de una o varias listas de códigos:
  - Se cargan **varios archivos a la vez** (CSV o Excel con columnas «Codigo AX» y «Nombre»). Cada archivo se guarda como una lista independiente que **toma el nombre del archivo** (p. ej. `CODIGOS AX CONSUMIBLES.xlsx` → «CODIGOS AX CONSUMIBLES»); volver a cargar un archivo con el mismo nombre actualiza esa lista.
  - Un **selector en el formulario de alta** elige desde qué lista se autocompleta («Todas las listas» o una en concreto). Es el mismo para los dos modos y se recuerda al recargar.
  - Al teclear aparecen las **sugerencias** (código, nombre y lista de origen) y el Nombre se rellena solo en cuanto el código coincide. También se puede buscar por nombre («BANDA») para quedarse con su código. Se navega con ↑ ↓ y se elige con Enter.
  - Nunca se pisa un Nombre escrito a mano; si el código deja de coincidir, el nombre autocompletado se limpia.
  - Las mismas reglas aplican en el editor de partidas, en la tabla de códigos AX, al añadir desde el inventario Excel y al extraer un vale con Gemini.
- Logos izquierdo/derecho (archivo o URL) y texto de almacén personalizable.
- **Diseño de plantilla configurable**: tamaño de hoja (Carta/A4), márgenes superior/lateral, dimensiones de etiqueta, separación horizontal/vertical, fuente y borde opcional. Acepta valores en mm, cm o pulgadas, y trae plantillas predefinidas, incluida la de **hojas precortadas 2 × 5 (J-5163 / Avery 5163)** con la geometría exacta del precorte.
- **Vista previa fiel a la impresión**: las filas y columnas se calculan automáticamente según lo que cabe físicamente en la hoja, por lo que no hay saltos de página inesperados ni hay que ajustar márgenes en el diálogo de impresión.
- **Exportar / importar la lista** como archivo `.json`: captura las partidas en el teléfono, exporta el archivo (WhatsApp, correo, AirDrop…) e impórtalo en la computadora para imprimir desde ahí.

## Cómo funciona la impresión

Cada hoja (`.sheet`) se genera con el tamaño físico exacto del papel y los márgenes como relleno interno; la regla `@page` se genera desde JS con `margin: 0`. Lo que se ve en la vista previa (escalada en pantalla) es exactamente lo que sale impreso. En el diálogo de impresión solo hay que dejar la escala al 100 % y desactivar «Encabezados y pies de página».

## Estructura del código

```
index.html         Marcado de la aplicación (sin lógica inline)
css/styles.css     Estilos de la interfaz
css/print.css      Hojas, etiquetas y reglas de impresión
js/utils.js        Unidades físicas (mm/in/cm), DOM helpers, toasts
js/store.js        Estado central + persistencia (con migración desde versiones anteriores)
js/history.js      Historial de las partidas para deshacer/rehacer
js/layout.js       Cálculo de la cuadrícula que cabe en la hoja y regla @page
js/labels.js       Construcción del DOM de cada etiqueta (sin innerHTML con datos del usuario)
js/csv.js          Parser de CSV con soporte de comillas
js/xlsx.js         Lector de archivos .xlsx sin dependencias externas
js/autocomplete.js Sugerencias de código AX y relleno automático del Nombre
js/gemini.js       Cliente de la API de Gemini para leer vales
js/tables.js       Tablas de revisión editables
js/inventory.js    Inventario Excel: selección múltiple y alta en lote
js/transfer.js     Exportación/importación de partidas (.json)
js/preview.js      Vista previa escalada e impresión (beforeprint/afterprint)
js/app.js          Orquestación: formularios, modales y eventos
```

## Instalación como app y uso sin conexión

La app es una PWA: servida por HTTPS (por ejemplo GitHub Pages), el navegador ofrece **instalarla** (menú → «Instalar aplicación» en Chrome/Edge, o «Añadir a pantalla de inicio» en iPhone/iPad). Tras la primera carga, un service worker guarda todos los archivos y la app **abre y funciona sin conexión a internet**: formularios, inventario Excel, listas de códigos, exportar/importar e imprimir.

Solo requieren internet dos cosas: extraer datos de un vale con Gemini y los logos configurados por URL externa (si los cargas como archivo quedan guardados dentro de la app y funcionan offline).

Las actualizaciones se descargan solas en segundo plano y se aplican en la siguiente visita. Al añadir archivos nuevos al proyecto hay que listarlos en `sw.js` (ASSETS).

## Uso sin servidor

También funciona abriendo `index.html` directamente en el navegador (sin instalación ni compilación); en ese caso no aplica el modo offline instalable.
