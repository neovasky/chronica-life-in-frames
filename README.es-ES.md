

# Chronica: Life in Frames

Visualiza tu vida como una cuadrícula de semanas con eventos codificados por colores, marcadores y notas vinculadas.

Chronica transforma tu bóveda de Obsidian en una línea de tiempo de vida: cada celda de la cuadrícula representa una semana de tu vida, permitiéndote ver el panorama general de un vistazo.

---

## Características

- **Visualización de cuadrícula de vida** — ve tu vida completa como una cuadrícula de celdas de semanas, desde tu nacimiento hasta la esperanza de vida configurada
- **Eventos codificados por colores** — crea eventos con tipos y colores personalizados (Evento importante, Viajes, Relaciones, Educación/Carrera, o los tuyos propios)
- **Rangos de fechas** — los eventos pueden abarcar una sola semana o rangos de fechas completos
- **Notas vinculadas** — crea notas de Obsidian directamente desde los eventos con plantillas y rutas de carpetas configurables
- **Escaneo de bóveda** — detecta automáticamente eventos desde el frontmatter de tus archivos markdown
- **Marcadores visuales** — activa o desactiva los divisores de década, año, mes y cumpleaños en la cuadrícula
- **Múltiples modos de visualización** — celdas cuadradas, circulares o en forma de diamante en orientación horizontal o vertical
- **Panel de estadísticas** — visualiza desgloses de eventos, análisis estacionales y gráficos de línea de tiempo
- **Relleno manual de semanas** — haz clic en las celdas para marcar semanas como memorables
- **Navegación lateral** — barra lateral colapsable con leyenda y lista de eventos
- **Soporte para dispositivos móviles** — funciona tanto en Obsidian de escritorio como en móvil

---

## Primeros pasos

1. Instala desde **Configuración > Complementos de la comunidad > Explorar** y busca "Chronica"
2. Habilita el complemento
3. Abre Chronica desde el icono de la cinta o la paleta de comandos (`Open Chronica timeline`)
4. Establece tu fecha de nacimiento en el diálogo de bienvenida o en la configuración
5. Comienza a agregar eventos a tu línea de tiempo

---

## Creación de eventos

### Desde la línea de tiempo

Haz clic en cualquier celda de la cuadrícula y selecciona **Crear evento** para agregar un nuevo evento en esa semana.

### Desde notas (escaneo de bóveda)

Agrega frontmatter a cualquier archivo markdown en tu carpeta de eventos configurada:

```yaml
---
event: Graduation
type: "Major Life"
description: Finished university
startDate: 2025-06-15
endDate: 2025-06-22
---
```

Chronica detectará y mostrará automáticamente estos eventos en la cuadrícula.

---

## Comandos

| Comando | Descripción |
|---|---|
| Open Chronica timeline | Abre la vista de cuadrícula de vida |
| Create weekly note | Crea o abre una nota para la semana actual |
| Rescan Chronica events | Vuelve a escanear manualmente tu bóveda en busca de notas de eventos |

---

## Configuración

Configura Chronica en **Configuración > Complementos de la comunidad > Chronica: Life in Frames**:

- **Configuración principal** — fecha de nacimiento, esperanza de vida esperada
- **Carpetas y nomenclatura de notas** — dónde se almacenan las notas de eventos y las notas semanales
- **Plantillas de nomenclatura de archivos** — personaliza cómo se nombran los archivos de notas
- **Apariencia** — forma de la celda, orientación, colores
- **Visibilidad de marcadores** — activa o desactiva marcadores de década/año/mes/cumpleaños
- **Tipos de evento** — crea y gestiona categorías de eventos personalizadas
- **Relleno de semanas** — configura el color de relleno manual
- **Panel de estadísticas** — redimensiona y posiciona el panel de estadísticas

---

## Instalación manual

1. Descarga `main.js`, `manifest.json`, y `styles.css` desde la [última versión](https://github.com/neovasky/chronica-life-in-frames/releases)
2. Crea una carpeta: `<your vault>/.obsidian/plugins/chronica-life-in-frames/`
3. Copia los tres archivos en esa carpeta
4. Recarga Obsidian y habilita el complemento en **Configuración > Complementos de la comunidad**

---

## Licencia

Este proyecto está licenciado bajo la [Licencia MIT](LICENSE).
