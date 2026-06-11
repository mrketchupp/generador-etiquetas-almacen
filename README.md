# Generador de Etiquetas de Almacén

Aplicación web (100 % cliente, sin backend) para generar e imprimir etiquetas de almacén en dos formatos:

- **Material**: etiqueta completa con código AX, nombre, dimensión/clave de almacén, no. de parte, descripción, condición y categoría.
- **Código AX**: etiqueta con el código en grande y el nombre del material.

🔒 Privacidad: todos los datos (partidas, logos, CSV, API Key) viven solo en el navegador del usuario (localStorage).

## Funciones

- Alta manual de partidas y extracción automática desde la **foto de un vale de material** usando la API de Gemini (requiere API Key propia).
- Tabla de revisión editable con duplicar/eliminar. La lista **se conserva al recargar** la página.
- Autocompletado de nombres a partir de un **CSV** con columnas «Codigo AX» y «Nombre».
- Logos izquierdo/derecho (archivo o URL) y texto de almacén personalizable.
- **Diseño de plantilla configurable**: tamaño de hoja (Carta/A4), margen, dimensiones de etiqueta, separación y tamaño de fuente. Acepta valores en mm, cm o pulgadas, y trae plantillas predefinidas.
- **Vista previa fiel a la impresión**: las filas y columnas se calculan automáticamente según lo que cabe físicamente en la hoja, por lo que no hay saltos de página inesperados ni hay que ajustar márgenes en el diálogo de impresión.

## Cómo funciona la impresión

Cada hoja (`.sheet`) se genera con el tamaño físico exacto del papel y los márgenes como relleno interno; la regla `@page` se genera desde JS con `margin: 0`. Lo que se ve en la vista previa (escalada en pantalla) es exactamente lo que sale impreso. En el diálogo de impresión solo hay que dejar la escala al 100 % y desactivar «Encabezados y pies de página».

## Estructura del código

```
index.html        Marcado de la aplicación (sin lógica inline)
css/styles.css    Estilos de la interfaz
css/print.css     Hojas, etiquetas y reglas de impresión
js/utils.js       Unidades físicas (mm/in/cm), DOM helpers, toasts
js/store.js       Estado central + persistencia (con migración desde la versión anterior)
js/layout.js      Cálculo de la cuadrícula que cabe en la hoja y regla @page
js/labels.js      Construcción del DOM de cada etiqueta (sin innerHTML con datos del usuario)
js/csv.js         Parser de CSV con soporte de comillas
js/gemini.js      Cliente de la API de Gemini para leer vales
js/tables.js      Tablas de revisión editables
js/preview.js     Vista previa escalada e impresión (beforeprint/afterprint)
js/app.js         Orquestación: formularios, modales y eventos
```

## Uso

No requiere instalación ni compilación: funciona abriendo `index.html` directamente en el navegador, con cualquier servidor estático o en GitHub Pages.
