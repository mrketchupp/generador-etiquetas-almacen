## Generador de Etiquetas con IA
Herramienta para la generación masiva de etiquetas de inventario, construida con Vanilla JavaScript y potenciada por la API de Gemini para el análisis de imágenes.

🔒 Seguridad y Privacidad: Su enfoque garantiza que las credenciales y personalizaciones son privadas para cada usuario y navegador.

🚀 Cómo Funciona en Resumen
 * Configuración del Usuario: La app solicita y guarda la API Key y los logos en localStorage.
 * Entrada de Datos: El usuario puede añadir partidas manualmente o subir una imagen de un vale.
 * Llamada a la API (si se usa imagen): La imagen se convierte a Base64 y se envía a la API de Gemini. La respuesta JSON se usa para poblar la tabla de revisión.
 * Generación de Vista Previa: Al solicitar la impresión, la app genera dinámicamente los elementos HTML de las etiquetas y los organiza en divs que simulan hojas de papel.
 * Impresión Final: Se invoca la función window.print(), y las reglas @media print se encargan de formatear el documento final para la impresora.
