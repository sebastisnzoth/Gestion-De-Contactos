# Diseño — Gestión de Contactos

## Norte visual
Herramienta operativa para importar planillas TRF, COMP y Actividades, revisar duplicados y exportar contactos VCF. Prioridad: legibilidad y acciones comprensibles con tablas densas, sin elementos decorativos que oculten información.

## Sistema visual de la propuesta
- **Superficie**: azul niebla `#f3f6fb`; tarjetas blancas `#ffffff`.
- **Texto**: azul tinta `#14243b`; secundario `#62758e`.
- **Acción principal**: azul `#2056be`; foco `#4179e6`.
- **Bordes**: `#dce5f0`; confirmación positiva `#176b54`.
- **Tipografía**: Manrope para títulos y DM Sans para cuerpo; fallback system-ui.
- **Composición**: encabezado amplio con estado operativo neutro; módulos de carga, conciliación y exportación preservan su estructura y comportamiento.
- **Firma**: presentación de espacio de trabajo («Listo para procesar») en lugar de saludo personalizado fijo.
- **Responsive**: contenido fluido y tarjetas de una columna en móvil; sin eliminar acciones.
- **Accesibilidad**: foco visible, controles nativos, desplazamiento operable, soporte reduced-motion.

## Propiedad y mapping de tokens
Los tokens de ejecución viven en `src/index.css` (CSS variables `--workspace-*`). Este documento refleja su intención y valores; `src/App.tsx` utiliza la clase raíz `contact-manager` y variantes de encabezado `app-hero` y `workspace-status`. Tailwind v4 permanece como motor de utilidades. No se modifican las funciones de importación, conciliación, edición ni exportación.

## Alcance y restauración
Este cambio es una propuesta visual en `design/uiux-preview-2026-11-11`. La rama inmutable de referencia para restaurar la versión anterior es `backup/estado-2026-11-11-pre-uiux` (commit `702599d`). No fusionar la propuesta en `main` sin aprobación de la vista previa.

## Límites conocidos
Persisten en código heredado algunas operaciones con `alert()` y acciones sensibles sin diálogo personalizado. Una reestructuración de estos flujos requiere pruebas funcionales y debe abordarse en un PR separado para evitar alterar el comportamiento en una revisión de diseño.
