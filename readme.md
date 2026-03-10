# Chronica: Life in Frames

Visualize your life as a grid of weeks with color-coded events, markers, and linked notes.

Chronica transforms your Obsidian vault into a life timeline — each cell in the grid represents one week of your life, letting you see the big picture at a glance.

---

## Features

- **Life grid visualization** — see your entire life as a grid of week-cells, from birth to your configured lifespan
- **Color-coded events** — create events with custom types and colors (Major Life, Travel, Relationship, Education/Career, or your own)
- **Date ranges** — events can span single weeks or entire date ranges
- **Linked notes** — create Obsidian notes directly from events with configurable templates and folder paths
- **Vault scanning** — automatically detects events from frontmatter in your markdown files
- **Visual markers** — toggle decade, year, month, and birthday dividers on the grid
- **Multiple display modes** — square, circle, or diamond cells in landscape or portrait orientation
- **Statistics panel** — view event breakdowns, seasonal analysis, and timeline charts
- **Manual week filling** — click cells to mark weeks as memorable
- **Sidebar navigation** — collapsible sidebar with legend and event list
- **Mobile support** — works on both desktop and mobile Obsidian

---

## Getting started

1. Install from **Settings > Community plugins > Browse** and search for "Chronica"
2. Enable the plugin
3. Open Chronica from the ribbon icon or the command palette (`Open Chronica timeline`)
4. Set your birthday in the welcome dialog or settings
5. Start adding events to your timeline

---

## Creating events

### From the timeline

Click any cell on the grid and select **Create event** to add a new event at that week.

### From notes (vault scanning)

Add frontmatter to any markdown file in your configured events folder:

```yaml
---
event: Graduation
type: "Major Life"
description: Finished university
startDate: 2025-06-15
endDate: 2025-06-22
---
```

Chronica will automatically detect and display these events on the grid.

---

## Commands

| Command | Description |
|---|---|
| Open Chronica timeline | Opens the life grid view |
| Create weekly note | Creates or opens a note for the current week |
| Rescan Chronica events | Manually re-scans your vault for event notes |

---

## Settings

Configure Chronica under **Settings > Community plugins > Chronica: Life in Frames**:

- **Core setup** — birthday, expected lifespan
- **Folders & note naming** — where event notes and weekly notes are stored
- **File naming templates** — customize how note files are named
- **Appearance** — cell shape, orientation, colors
- **Marker visibility** — toggle decade/year/month/birthday markers
- **Event types** — create and manage custom event categories
- **Week filling** — configure manual fill color
- **Statistics panel** — resize and position the stats panel

---

## Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/neovasky/chronica-life-in-frames/releases)
2. Create a folder: `<your vault>/.obsidian/plugins/chronica-life-in-frames/`
3. Copy the three files into that folder
4. Reload Obsidian and enable the plugin under **Settings > Community plugins**

---

## License

This project is licensed under the [MIT License](LICENSE).
