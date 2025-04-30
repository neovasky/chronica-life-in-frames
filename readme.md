# Chronica: Life in Frames v1.0.0

> Visualize, navigate, and reflect on your life across multiple time scales.

Chronica transforms your Obsidian vault into a customizable life timeline—displaying your weeks as frames in a grid, complete with color-coded eras, milestone markers, and manual or automatic event fills.

---

## 🛠️ Technology

This plugin is built with TypeScript for type safety and documentation. It depends on the latest Obsidian plugin API (`obsidian.d.ts`), which includes TSDoc comments describing available classes and methods.

---

## ⚡ Features

- **Ribbon Icon**: Adds a toolbar icon that opens Chronica’s main view.
- **Commands**: Provides a command in the Command Palette to open the Chronica timeline view.
- **Settings Tab**: Registers a settings pane under Settings → Community Plugins → Chronica: Life in Frames.
- **Global Click Event**: Captures clicks on the grid to toggle manual fills and logs events to the console.
- **Global Interval**: Sets an interval to refresh dates and output logs for debugging.
- **Multiple Visual Modes**: Choose between square, circle, or diamond cells, and landscape or portrait orientation.
- **Color-Coded Eras**: Configure distinct colors for past, present, and future cells.
- **Milestone Markers**: Enable decade, year, month, and birthday dividers at configurable intervals.
- **Custom Events**: Define event categories with names and colors, then map dates or ranges to them.

---

## 🚀 Quick Start for Plugin Developers

1. **Check existing plugins**—avoid reinventing the wheel.
2. **Use this repo as a template**: click “Use this template” on GitHub, fork, then clone your fork locally.
3. **Plugin folder**: place your cloned repo under `~/.obsidian/plugins/chronica-life-in-frames` for live testing.
4. **Install dependencies**:
   npm install
5. **Watch & build**:
   npm run dev
6. **Reload Obsidian** and enable Chronica via Community Plugins.
7. **Iterate**: modify `.ts` files, let the watcher compile, and reload the vault.
8. **Update API**: when the API changes, run:
   npm update obsidian

---

## 📦 Releasing New Versions

1. **Bump version** in `manifest.json` and `package.json` (e.g., to 1.0.1).
2. **Update** `versions.json` with an entry like:
   "1.0.1": "0.15.0"
3. **Create GitHub Release**:
   - Tag: 1.0.1 (no “v” prefix)
   - Attach: `manifest.json`, `main.js`, `styles.css`
4. **Publish** the release.

*Tip:* use `npm version patch|minor|major` to automate JSON bumps and update `versions.json`.

---

## 📑 Adding to the Community Plugin List

1. **Follow** Obsidian’s plugin guidelines (docs).
2. **Publish** an initial GitHub release.
3. Ensure your repo root has a **README.md**.
4. **Submit** a PR to `obsidianmd/obsidian-releases` adding your plugin ID.

---

## ⚙️ How to Use

Clone the repo:
  git clone https://github.com/neovasky/chronica-life-in-frames.git
Install & build:
  npm install
  npm run dev
Reload Obsidian and enable the plugin.

---

## 📂 Manual Installation

1. Build with:
   npm run build
2. Copy `main.js`, `manifest.json`, and `styles.css` into:
   <Vault>/.obsidian/plugins/chronica-life-in-frames/
3. Reload Obsidian and enable Chronica.

---

## 🔍 Improve Code Quality with ESLint (Optional)

Install ESLint globally:
  npm install -g eslint
Run against your code:
  eslint main.ts
  eslint ./src

---

---

## 📚 API Documentation

See Obsidian API docs: https://github.com/obsidianmd/obsidian-api

---

## ℹ️ About

No description, website, or topics provided.

## 📄 License

This project is licensed under the MIT License. See LICENSE for details.

