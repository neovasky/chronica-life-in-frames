import {
  App,
  ItemView,
  Modal,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  WorkspaceLeaf,
  addIcon,
  Notice,
} from "obsidian";

const TIMELINE_VIEW_TYPE = "chronos-timeline-view";

// Define the interface for plugin settings
interface ChronosSettings {
  birthday: string;
  lifespan: number;
  defaultView: "years" | "months" | "weeks" | "days";
  pastCellColor: string;
  presentCellColor: string;
  futureCellColor: string;
  greenEvents: string[];
  blueEvents: string[];
  pinkEvents: string[];
  purpleEvents: string[];
  quote: string;
  notesFolder: string; // New setting for notes folder
}

// Set default settings
const DEFAULT_SETTINGS: ChronosSettings = {
  birthday: "1990-01-01",
  lifespan: 90,
  defaultView: "weeks",
  pastCellColor: "#88a0a8",
  presentCellColor: "#5dbcd2",
  futureCellColor: "#d8e2e6",
  greenEvents: [],
  blueEvents: [],
  pinkEvents: [],
  purpleEvents: [],
  quote: "the only true luxury is time.",
  notesFolder: "", // Default to root folder
};

// ChronOS Timeline icon
const chronosIcon = `<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="4"/>
        <line x1="50" y1="15" x2="50" y2="50" stroke="currentColor" stroke-width="4"/>
        <line x1="50" y1="50" x2="75" y2="60" stroke="currentColor" stroke-width="4"/>
        <circle cx="50" cy="50" r="5" fill="currentColor"/>
      </svg>`;

export default class ChronosTimelinePlugin extends Plugin {
  settings: ChronosSettings = DEFAULT_SETTINGS;

  async onload() {
    console.log("Loading ChronOS Timeline Plugin");

    // Add chronos icon to Obsidian
    addIcon("chronos-icon", chronosIcon);

    // Load settings
    await this.loadSettings();

    // Register timeline view
    this.registerView(
      TIMELINE_VIEW_TYPE,
      (leaf) => new ChronosTimelineView(leaf, this)
    );

    // Add ribbon icon to open timeline
    this.addRibbonIcon("chronos-icon", "Open ChronOS Timeline", () => {
      this.activateView();
    });

    // Add command to open timeline
    this.addCommand({
      id: "open-chronos-timeline",
      name: "Open ChronOS Timeline",
      callback: () => {
        this.activateView();
      },
    });

    // Command to create weekly note
    this.addCommand({
      id: "create-weekly-note",
      name: "Create/Open Current Week Note",
      callback: () => {
        this.createOrOpenWeekNote();
      },
    });

    // Add settings tab
    this.addSettingTab(new ChronosSettingTab(this.app, this));
  }

  onunload() {
    console.log("Unloading ChronOS Timeline Plugin");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateView() {
    const { workspace } = this.app;

    // Check if view is already open
    let leaf = workspace.getLeavesOfType(TIMELINE_VIEW_TYPE)[0];

    if (!leaf) {
      // Create a new leaf in the right sidebar
      leaf = workspace.getLeaf("split", "vertical");
      await leaf.setViewState({
        type: TIMELINE_VIEW_TYPE,
        active: true,
      });
    }

    // Reveal the leaf
    workspace.revealLeaf(leaf);
  }

  // Helper method to get the full file path with folder
  getFullPath(fileName: string): string {
    if (this.settings.notesFolder && this.settings.notesFolder.trim() !== "") {
      // Ensure the folder path has a trailing slash
      let folderPath = this.settings.notesFolder;
      if (!folderPath.endsWith("/")) {
        folderPath += "/";
      }
      return `${folderPath}${fileName}`;
    }
    return fileName;
  }

  async createOrOpenWeekNote() {
    try {
      const date = new Date();
      const year = date.getFullYear();
      const weekNum = this.getISOWeekNumber(date);
      const fileName = `${year}-W${weekNum.toString().padStart(2, "0")}.md`;
      const fullPath = this.getFullPath(fileName);

      // Check if file exists
      const existingFile = this.app.vault.getAbstractFileByPath(fullPath);

      if (existingFile instanceof TFile) {
        // Open existing file
        await this.app.workspace.getLeaf().openFile(existingFile);
      } else {
        // Create folder if it doesn't exist
        if (
          this.settings.notesFolder &&
          this.settings.notesFolder.trim() !== ""
        ) {
          try {
            // Check if folder exists, create if not
            const folderExists = this.app.vault.getAbstractFileByPath(
              this.settings.notesFolder
            );
            if (!folderExists) {
              await this.app.vault.createFolder(this.settings.notesFolder);
            }
          } catch (err) {
            console.log("Error checking/creating folder:", err);
          }
        }

        // Create new file with template
        const content = `# Week ${weekNum}, ${year}\n\n## Reflections\n\n## Tasks\n\n## Notes\n`;
        const newFile = await this.app.vault.create(fullPath, content);
        await this.app.workspace.getLeaf().openFile(newFile);
      }
    } catch (error) {
      new Notice(`Error creating week note: ${error}`);
    }
  }

  getISOWeekNumber(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Set to nearest Thursday (to match ISO 8601 week start)
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    // Get first day of the year
    const yearStart = new Date(d.getFullYear(), 0, 1);
    // Calculate full weeks between year start and current date
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  // Helper to check if a week is the first of the month
  isFirstWeekOfMonth(date: Date): boolean {
    // Make a copy of the date
    const checkDate = new Date(date);
    // Get the date at the beginning of the week
    checkDate.setDate(checkDate.getDate() - (checkDate.getDay() || 7) + 1);
    // Check if it's the first 7 days of the month
    return checkDate.getDate() <= 7;
  }
}

// Event Modal for adding events
// Enhanced Event Modal for adding events - particularly future events
class ChronosEventModal extends Modal {
  plugin: ChronosTimelinePlugin;
  selectedDate: string | null;
  selectedColor: "green" | "blue" | "pink" | "purple" = "green";
  eventDescription: string = "";
  dateInput!: HTMLInputElement;
  futureEventContainer: HTMLDivElement | null = null;
  isFuture: boolean = false;

  constructor(
    app: App,
    plugin: ChronosTimelinePlugin,
    selectedDate: string | null = null
  ) {
    super(app);
    this.plugin = plugin;
    this.selectedDate = selectedDate;

    // Determine if this is a future date
    if (selectedDate) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentWeek = this.plugin.getISOWeekNumber(now);

      // Parse selected date (format: YYYY-WXX)
      const selectedYear = parseInt(selectedDate.substring(0, 4), 10);
      const selectedWeek = parseInt(selectedDate.substring(6, 8), 10);

      this.isFuture =
        selectedYear > currentYear ||
        (selectedYear === currentYear && selectedWeek > currentWeek);
    }
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    const titleText = this.isFuture ? "Plan Future Event" : "Add Life Event";
    contentEl.createEl("h2", { text: titleText });

    // Date selector (if not already provided)
    if (!this.selectedDate) {
      const dateContainer = contentEl.createDiv({
        cls: "chronos-date-picker-container",
      });
      dateContainer.createEl("h3", { text: "Select Date" });

      // Add date picker for better date selection
      const dateSettingContainer = new Setting(contentEl)
        .setName("Date")
        .setDesc("Enter the date in format YYYY-WXX (e.g., 2025-W15)");

      this.dateInput = dateSettingContainer.controlEl.createEl("input", {
        type: "text",
        placeholder: "YYYY-WW (e.g., 2025-W15)",
        value: this.selectedDate || "",
      });

      // Add a button to select current week
      const currentWeekButton = dateSettingContainer.controlEl.createEl(
        "button",
        {
          text: "Current Week",
        }
      );
      currentWeekButton.style.marginLeft = "10px";
      currentWeekButton.addEventListener("click", () => {
        const now = new Date();
        const year = now.getFullYear();
        const week = this.plugin.getISOWeekNumber(now);
        this.dateInput.value = `${year}-W${week.toString().padStart(2, "0")}`;
        this.selectedDate = this.dateInput.value;

        // Update UI for future/past
        this.isFuture = false;
        this.updateFutureUI();
      });

      // Add a button to select next month
      const nextMonthButton = dateSettingContainer.controlEl.createEl(
        "button",
        {
          text: "Next Month",
        }
      );
      nextMonthButton.style.marginLeft = "10px";
      nextMonthButton.addEventListener("click", () => {
        const now = new Date();
        now.setMonth(now.getMonth() + 1);
        const year = now.getFullYear();
        const week = this.plugin.getISOWeekNumber(now);
        this.dateInput.value = `${year}-W${week.toString().padStart(2, "0")}`;
        this.selectedDate = this.dateInput.value;

        // Update UI for future/past
        this.isFuture = true;
        this.updateFutureUI();
      });

      // Add date change handler
      this.dateInput.addEventListener("change", (e) => {
        this.selectedDate = this.dateInput?.value || "";

        // Check if date is in the future
        if (this.selectedDate) {
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentWeek = this.plugin.getISOWeekNumber(now);

          // Parse selected date (format: YYYY-WXX)
          const selectedYear = parseInt(this.selectedDate.substring(0, 4), 10);
          const selectedWeek = parseInt(this.selectedDate.substring(6, 8), 10);

          this.isFuture =
            selectedYear > currentYear ||
            (selectedYear === currentYear && selectedWeek > currentWeek);

          this.updateFutureUI();
        }
      });

      // Add a small helper note
      contentEl.createEl("small", {
        text: "Tip: You can enter dates in the future to plan ahead",
        cls: "chronos-helper-text",
      });
    } else {
      contentEl.createEl("p", { text: `Date: ${this.selectedDate}` });
    }

    // Event description
    new Setting(contentEl)
      .setName("Description")
      .setDesc("Brief description of this event")
      .addText((text) =>
        text.setPlaceholder("Event description").onChange((value) => {
          this.eventDescription = value;
        })
      );

    // Color selector
    const colorSetting = new Setting(contentEl)
      .setName("Event Type")
      .setDesc("Select the type of event");

    // Green - Major Life Events
    const greenBtn = contentEl.createEl("button", { text: "Major Life" });
    greenBtn.style.backgroundColor = "#4CAF50";
    greenBtn.style.color = "white";
    greenBtn.style.margin = "5px";
    greenBtn.addEventListener("click", () => {
      this.selectedColor = "green";
      this.updateSelectedButton(colorSetting, greenBtn);
    });

    // Blue - Travel
    const blueBtn = contentEl.createEl("button", { text: "Travel" });
    blueBtn.style.backgroundColor = "#2196F3";
    blueBtn.style.color = "white";
    blueBtn.style.margin = "5px";
    blueBtn.addEventListener("click", () => {
      this.selectedColor = "blue";
      this.updateSelectedButton(colorSetting, blueBtn);
    });

    // Pink - Relationships
    const pinkBtn = contentEl.createEl("button", { text: "Relationship" });
    pinkBtn.style.backgroundColor = "#E91E63";
    pinkBtn.style.color = "white";
    pinkBtn.style.margin = "5px";
    pinkBtn.addEventListener("click", () => {
      this.selectedColor = "pink";
      this.updateSelectedButton(colorSetting, pinkBtn);
    });

    // Purple - Education/Career
    const purpleBtn = contentEl.createEl("button", {
      text: "Education/Career",
    });
    purpleBtn.style.backgroundColor = "#9C27B0";
    purpleBtn.style.color = "white";
    purpleBtn.style.margin = "5px";
    purpleBtn.addEventListener("click", () => {
      this.selectedColor = "purple";
      this.updateSelectedButton(colorSetting, purpleBtn);
    });

    colorSetting.settingEl.appendChild(greenBtn);
    colorSetting.settingEl.appendChild(blueBtn);
    colorSetting.settingEl.appendChild(pinkBtn);
    colorSetting.settingEl.appendChild(purpleBtn);

    // Default selection
    this.updateSelectedButton(colorSetting, greenBtn);

    // Add special container for future events
    this.futureEventContainer = contentEl.createDiv({
      cls: "chronos-future-event-container",
    });

    // Initial update for future UI elements
    this.updateFutureUI();

    // Save button
    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText(this.isFuture ? "Save Future Event" : "Save Event")
        .setCta()
        .onClick(() => {
          this.saveEvent();
        })
    );
  }

  // Update UI elements for future events
  updateFutureUI() {
    if (!this.futureEventContainer) return;

    this.futureEventContainer.empty();

    if (this.isFuture) {
      this.futureEventContainer.createEl("h3", {
        text: "Planning Future Event",
        cls: "chronos-future-heading",
      });

      // Add helpful explanation
      const helpText = this.futureEventContainer.createEl("p", {
        text: "You're adding an event in the future. This will be highlighted in your timeline to help you plan ahead.",
      });
      helpText.style.backgroundColor = "rgba(255, 215, 0, 0.2)";
      helpText.style.padding = "10px";
      helpText.style.borderRadius = "5px";

      // Add countdown if date is selected
      if (this.selectedDate) {
        const now = new Date();
        const selectedYear = parseInt(this.selectedDate.substring(0, 4), 10);
        const selectedWeek = parseInt(this.selectedDate.substring(6, 8), 10);

        // Approximate date from year and week
        const selectedDate = new Date(selectedYear, 0, 1);
        selectedDate.setDate(selectedDate.getDate() + (selectedWeek - 1) * 7);

        // Calculate days until event
        const daysUntil = Math.ceil(
          (selectedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        const weeksUntil = Math.ceil(daysUntil / 7);

        this.futureEventContainer.createEl("p", {
          text: `Approximately ${daysUntil} days (${weeksUntil} weeks) until this event`,
          cls: "chronos-countdown",
        });
      }
    }
  }

  updateSelectedButton(setting: Setting, selectedBtn: HTMLElement) {
    // Remove border from all buttons
    if (setting.settingEl) {
      setting.settingEl.querySelectorAll("button").forEach((btn) => {
        btn.style.border = "none";
      });

      // Add border to selected button
      selectedBtn.style.border = "2px solid white";
    }
  }

  saveEvent() {
    if (!this.selectedDate) {
      new Notice("Please select a date");
      return;
    }

    if (!this.eventDescription) {
      new Notice("Please add a description");
      return;
    }

    // Update settings based on color
    switch (this.selectedColor) {
      case "green":
        this.plugin.settings.greenEvents.push(
          `${this.selectedDate}:${this.eventDescription}`
        );
        break;
      case "blue":
        this.plugin.settings.blueEvents.push(
          `${this.selectedDate}:${this.eventDescription}`
        );
        break;
      case "pink":
        this.plugin.settings.pinkEvents.push(
          `${this.selectedDate}:${this.eventDescription}`
        );
        break;
      case "purple":
        this.plugin.settings.purpleEvents.push(
          `${this.selectedDate}:${this.eventDescription}`
        );
        break;
    }

    // Save settings and close
    this.plugin.saveSettings().then(() => {
      const noticeText = this.isFuture
        ? `Future event planned: ${this.eventDescription}`
        : `Event added: ${this.eventDescription}`;

      new Notice(noticeText);

      // Create a note for this event if it doesn't exist
      const fileName = `${this.selectedDate.replace("W", "-W")}.md`;
      const fullPath = this.plugin.getFullPath(fileName);
      const fileExists =
        this.app.vault.getAbstractFileByPath(fullPath) instanceof TFile;

      if (!fileExists) {
        // Create folder if needed
        if (
          this.plugin.settings.notesFolder &&
          this.plugin.settings.notesFolder.trim() !== ""
        ) {
          try {
            const folderExists = this.app.vault.getAbstractFileByPath(
              this.plugin.settings.notesFolder
            );
            if (!folderExists) {
              this.app.vault.createFolder(this.plugin.settings.notesFolder);
            }
          } catch (err) {
            console.log("Error checking/creating folder:", err);
          }
        }

        // Create the file with event description, customized for future events
        let content = "";
        if (this.isFuture) {
          content = `# Future Event: ${this.eventDescription}\n\nPlanned Date: ${this.selectedDate}\nType: ${this.selectedColor}\n\n## Planning Notes\n\n## Preparation Checklist\n- [ ] Item 1\n- [ ] Item 2\n\n## Additional Notes\n\n`;
        } else {
          content = `# Event: ${this.eventDescription}\n\nDate: ${this.selectedDate}\nType: ${this.selectedColor}\n\n## Notes\n\n`;
        }

        this.app.vault.create(fullPath, content);
      }

      this.close();

      // Refresh the view
      this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE).forEach((leaf) => {
        const view = leaf.view as ChronosTimelineView;
        view.renderView();
      });
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class ChronosTimelineView extends ItemView {
  plugin: ChronosTimelinePlugin;

  constructor(leaf: WorkspaceLeaf, plugin: ChronosTimelinePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return TIMELINE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "ChronOS Timeline";
  }

  getIcon(): string {
    return "calendar-days";
  }

  async onOpen() {
    const contentEl = this.containerEl.children[1];
    contentEl.empty();
    contentEl.addClass("chronos-timeline-container");

    this.renderView();
  }

  async onClose() {
    const contentEl = this.containerEl.children[1];
    contentEl.empty();
  }

  // Enhanced renderView method with improved controls
  renderView() {
    // Clear content
    const contentEl = this.containerEl.children[1];
    contentEl.empty();

    // Create title in cursive style
    contentEl.createEl("div", {
      cls: "chronos-title",
      text: "life in weeks",
    });

    // Create controls
    const controlsEl = contentEl.createEl("div", { cls: "chronos-controls" });

    // Add button to add event
    const addEventBtn = controlsEl.createEl("button", { text: "Add Event" });
    addEventBtn.addEventListener("click", () => {
      this.showAddEventModal();
    });

    // Today button
    const todayBtn = controlsEl.createEl("button", { text: "Today" });
    todayBtn.addEventListener("click", () => {
      // Scroll to today's cell
      const todayCell = contentEl.querySelector(".chronos-grid-cell.present");
      if (todayCell) {
        todayCell.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });

    // Enhanced Future Event button
    const futureEventBtn = controlsEl.createEl("button", {
      text: "Plan Future Event",
    });
    futureEventBtn.style.backgroundColor = "#FFC107"; // Make it stand out
    futureEventBtn.addEventListener("click", () => {
      // Open the event modal without a pre-selected date, but with future UI
      const modal = new ChronosEventModal(this.app, this.plugin);
      // Set future mode
      modal.isFuture = true;
      modal.open();
    });

    // Go to next planned event button
    const nextEventBtn = controlsEl.createEl("button", {
      text: "Next Planned Event",
    });
    nextEventBtn.addEventListener("click", () => {
      // Find the next highlighted future event cell
      const futureEventCell = contentEl.querySelector(
        ".chronos-grid-cell.future-event-highlight"
      );
      if (futureEventCell) {
        futureEventCell.scrollIntoView({ behavior: "smooth", block: "center" });

        // Fix for TypeScript errors - cast Element to HTMLElement
        const cellElement = futureEventCell as HTMLElement;
        cellElement.style.transition = "transform 0.3s";
        cellElement.style.transform = "scale(1.3)";

        setTimeout(() => {
          cellElement.style.transform = "";
        }, 500);
      } else {
        new Notice(
          "No future events planned yet. Use 'Plan Future Event' to add one!"
        );
      }
    });

    // Add a button to show settings
    const settingsBtn = controlsEl.createEl("button", { text: "Settings" });
    settingsBtn.addEventListener("click", () => {
      // Open settings directly without using the setting property
      new ChronosSettingTab(this.app, this.plugin).display();
    });

    // Create the view container
    const viewEl = contentEl.createEl("div", { cls: "chronos-view" });

    // We now always use weeks view which is what the poster shows
    this.renderWeeksGrid(viewEl);

    // Create legend
    const legendEl = contentEl.createEl("div", { cls: "chronos-legend" });

    // Green events
    const greenLegendEl = legendEl.createEl("div", {
      cls: "chronos-legend-item",
    });
    const greenColorEl = greenLegendEl.createEl("div", {
      cls: "chronos-legend-color",
    });
    greenColorEl.style.backgroundColor = "#4CAF50";
    greenLegendEl.createEl("span", { text: "Major Life Events" });

    // Blue events
    const blueLegendEl = legendEl.createEl("div", {
      cls: "chronos-legend-item",
    });
    const blueColorEl = blueLegendEl.createEl("div", {
      cls: "chronos-legend-color",
    });
    blueColorEl.style.backgroundColor = "#2196F3";
    blueLegendEl.createEl("span", { text: "Travel" });

    // Pink events
    const pinkLegendEl = legendEl.createEl("div", {
      cls: "chronos-legend-item",
    });
    const pinkColorEl = pinkLegendEl.createEl("div", {
      cls: "chronos-legend-color",
    });
    pinkColorEl.style.backgroundColor = "#E91E63";
    pinkLegendEl.createEl("span", { text: "Relationships" });

    // Purple events
    const purpleLegendEl = legendEl.createEl("div", {
      cls: "chronos-legend-item",
    });
    const purpleColorEl = purpleLegendEl.createEl("div", {
      cls: "chronos-legend-color",
    });
    purpleColorEl.style.backgroundColor = "#9C27B0";
    purpleLegendEl.createEl("span", { text: "Education/Career" });

    // Add future event highlight to legend
    const futureHighlightEl = legendEl.createEl("div", {
      cls: "chronos-legend-item",
    });
    const futureColorEl = futureHighlightEl.createEl("div", {
      cls: "chronos-legend-color future-event-highlight",
    });
    futureColorEl.style.backgroundColor = this.plugin.settings.futureCellColor;
    futureHighlightEl.createEl("span", { text: "Upcoming Planned Event" });

    // Add user tips
    const tipsEl = contentEl.createEl("div", {
      cls: "chronos-tips",
    });
    tipsEl.style.fontSize = "12px";
    tipsEl.style.color = "var(--text-muted)";
    tipsEl.style.textAlign = "center";
    tipsEl.style.margin = "10px 0";

    tipsEl.createEl("p", {
      text: "Tip: Click any week to create a note. Right-click to quickly add an event. Shift-click for the event modal.",
    });

    // Add quote at the bottom
    contentEl.createEl("div", {
      cls: "chronos-footer",
      text: this.plugin.settings.quote,
    });
  }

  showAddEventModal() {
    const modal = new ChronosEventModal(this.app, this.plugin);
    modal.open();
  }

  // Updated renderWeeksGrid function to fix year labels alignment and add month indicators
  renderWeeksGrid(container: HTMLElement) {
    container.empty();

    const now = new Date();
    const birthdayDate = new Date(this.plugin.settings.birthday);
    const lifespan = this.plugin.settings.lifespan;

    // Calculate age in years
    const ageInYears =
      (now.getTime() - birthdayDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    const ageInWeeks = ageInYears * 52;

    // Create year labels at the top
    const yearLabelsEl = container.createEl("div", {
      cls: "chronos-year-labels",
    });

    // Create max columns for years based on lifespan
    const maxYears = lifespan;

    // Calculate column width (cell width + gap)
    const cellWidth = 16;
    const decadeGap = 8; // The decade gap we set in CSS

    // Add year labels with proper alignment
    for (let i = 0; i <= maxYears; i += 5) {
      // Changed from 10 to 5 years for more granularity
      const yearLabel = yearLabelsEl.createEl("div", {
        cls: "chronos-year-label",
        text: i.toString(),
      });

      // Position label properly - accounting for decade gaps
      const decades = Math.floor(i / 10);
      const position = i * cellWidth + decades * decadeGap;
      yearLabel.style.left = `${position}px`;

      // Add month labels for the current year (just January for simplicity)
      if (i < maxYears) {
        const monthLabel = yearLabelsEl.createEl("div", {
          cls: "chronos-month-label",
          text: "Jan",
        });
        monthLabel.style.left = `${position}px`;
      }
    }

    // Create grid for the weeks
    const gridEl = container.createEl("div", { cls: "chronos-grid" });

    // Add week numbers on the left
    const weekLabelsEl = gridEl.createEl("div", { cls: "chronos-week-labels" });
    for (let week = 0; week < 52; week += 10) {
      if (week === 0) continue; // Skip first to align better
      const weekLabel = weekLabelsEl.createEl("div", {
        cls: "chronos-week-label",
        text: week.toString(),
      });
      // Position at the correct week
      weekLabel.style.position = "absolute";
      weekLabel.style.top = `${((week * 18) / 52) * 52}px`; // Position proportionally
    }

    // Get event data from settings
    const greenEvents: string[] = this.plugin.settings.greenEvents;
    const blueEvents: string[] = this.plugin.settings.blueEvents;
    const pinkEvents: string[] = this.plugin.settings.pinkEvents;
    const purpleEvents: string[] = this.plugin.settings.purpleEvents;

    // For each year, create a column of weeks
    for (let year = 0; year < lifespan; year++) {
      // Add a decade marker class if this is the start of a decade
      const isDecadeStart = year % 10 === 0;

      for (let week = 0; week < 52; week++) {
        const weekIndex = year * 52 + week;
        const cell = gridEl.createEl("div", { cls: "chronos-grid-cell week" });

        // Add special classes for visual separation
        if (isDecadeStart) {
          cell.addClass("decade-start");
        }

        // Calculate the date for the current week
        const weekDate = new Date(birthdayDate);
        weekDate.setDate(weekDate.getDate() + weekIndex * 7);

        // Add class for first week of month - enhanced detection
        if (this.isFirstWeekOfMonth(weekDate)) {
          cell.addClass("month-start");
        }

        // Position the cell in the grid (weeks as rows, years as columns)
        // Adjust column position to account for decade gaps
        const decades = Math.floor(year / 10);
        const colPosition = year + 1 + decades;

        cell.style.gridRow = `${week + 1}`;
        cell.style.gridColumn = `${colPosition}`;

        // Determine if this week is past, present, or future
        if (weekIndex < ageInWeeks) {
          cell.addClass("past");
          cell.style.backgroundColor = this.plugin.settings.pastCellColor;
        } else if (weekIndex < ageInWeeks + 1) {
          cell.addClass("present");
          cell.style.backgroundColor = this.plugin.settings.presentCellColor;
        } else {
          cell.addClass("future");
          cell.style.backgroundColor = this.plugin.settings.futureCellColor;
        }

        // Format date for this week - calculate actual date
        const weekYear = weekDate.getFullYear();
        const weekNum = this.plugin.getISOWeekNumber(weekDate);
        const weekKey = `${weekYear}-W${weekNum.toString().padStart(2, "0")}`;

        // Check if this week has any events and apply appropriate styling
        this.applyEventStyling(
          cell,
          weekKey,
          greenEvents,
          blueEvents,
          pinkEvents,
          purpleEvents
        );

        // Add click event to create/open the corresponding weekly note
        this.setupCellClickHandler(cell, weekKey, weekYear, weekNum);
      }
    }
  }

  // New helper method to apply event styling
  applyEventStyling(
    cell: HTMLElement,
    weekKey: string,
    greenEvents: string[],
    blueEvents: string[],
    pinkEvents: string[],
    purpleEvents: string[]
  ) {
    // For green events
    if (greenEvents.some((event) => event.startsWith(weekKey))) {
      cell.style.backgroundColor = "#4CAF50";
      cell.addClass("event");

      // Add tooltip with event description
      const event = greenEvents.find((e) => e.startsWith(weekKey));
      if (event) {
        const description = event.split(":")[1] || "Major Life Event";
        cell.setAttribute("title", description);
      }
    }

    // For blue events
    if (blueEvents.some((event) => event.startsWith(weekKey))) {
      cell.style.backgroundColor = "#2196F3";
      cell.addClass("event");

      // Add tooltip with event description
      const event = blueEvents.find((e) => e.startsWith(weekKey));
      if (event) {
        const description = event.split(":")[1] || "Travel";
        cell.setAttribute("title", description);
      }
    }

    // For pink events
    if (pinkEvents.some((event) => event.startsWith(weekKey))) {
      cell.style.backgroundColor = "#E91E63";
      cell.addClass("event");

      // Add tooltip with event description
      const event = pinkEvents.find((e) => e.startsWith(weekKey));
      if (event) {
        const description = event.split(":")[1] || "Relationship";
        cell.setAttribute("title", description);
      }
    }

    // For purple events
    if (purpleEvents.some((event) => event.startsWith(weekKey))) {
      cell.style.backgroundColor = "#9C27B0";
      cell.addClass("event");

      // Add tooltip with event description
      const event = purpleEvents.find((e) => e.startsWith(weekKey));
      if (event) {
        const description = event.split(":")[1] || "Education/Career";
        cell.setAttribute("title", description);
      }
    }

    // Add special highlight for future events
    const now = new Date();
    const weekDate = new Date();
    weekDate.setFullYear(
      parseInt(weekKey.substring(0, 4)),
      0, // January
      1 // First day of month
    );
    weekDate.setDate(
      weekDate.getDate() + (parseInt(weekKey.substring(6, 8)) - 1) * 7
    );

    // If this is a future event (within next 6 months), add highlight
    if (
      weekDate > now &&
      weekDate < new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000) &&
      (greenEvents.some((e) => e.startsWith(weekKey)) ||
        blueEvents.some((e) => e.startsWith(weekKey)) ||
        pinkEvents.some((e) => e.startsWith(weekKey)) ||
        purpleEvents.some((e) => e.startsWith(weekKey)))
    ) {
      cell.addClass("future-event-highlight");
    }
  }

  // New helper method for cell click handling
  setupCellClickHandler(
    cell: HTMLElement,
    weekKey: string,
    weekYear: number,
    weekNum: number
  ) {
    cell.addEventListener("click", async (event) => {
      // If shift key is pressed, add an event
      if (event.shiftKey) {
        const modal = new ChronosEventModal(this.app, this.plugin, weekKey);
        modal.open();
        return;
      }

      // Otherwise open/create the weekly note
      const fileName = `${weekKey.replace("W", "-W")}.md`;
      const fullPath = this.plugin.getFullPath(fileName);
      const existingFile = this.app.vault.getAbstractFileByPath(fullPath);

      if (existingFile instanceof TFile) {
        // Open existing file
        await this.app.workspace.getLeaf().openFile(existingFile);
      } else {
        // Create folder if needed
        if (
          this.plugin.settings.notesFolder &&
          this.plugin.settings.notesFolder.trim() !== ""
        ) {
          try {
            const folderExists = this.app.vault.getAbstractFileByPath(
              this.plugin.settings.notesFolder
            );
            if (!folderExists) {
              await this.app.vault.createFolder(
                this.plugin.settings.notesFolder
              );
            }
          } catch (err) {
            console.log("Error checking/creating folder:", err);
          }
        }

        // Create new file with template
        const content = `# Week ${weekNum}, ${weekYear}\n\n## Reflections\n\n## Tasks\n\n## Notes\n`;
        const newFile = await this.app.vault.create(fullPath, content);
        await this.app.workspace.getLeaf().openFile(newFile);
      }
    });

    // Add right-click handler for quickly accessing future planning
    cell.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const modal = new ChronosEventModal(this.app, this.plugin, weekKey);
      modal.open();
    });
  }

  // Improved method to check for first week of month
  isFirstWeekOfMonth(date: Date): boolean {
    // Make a copy of the date to avoid modifying the original
    const checkDate = new Date(date);

    // Get current month
    const currentMonth = checkDate.getMonth();

    // Go back 7 days
    checkDate.setDate(checkDate.getDate() - 7);

    // If previous week was in a different month, this is the first week
    return checkDate.getMonth() !== currentMonth;
  }
}

// Settings tab
class ChronosSettingTab extends PluginSettingTab {
  plugin: ChronosTimelinePlugin;

  constructor(app: App, plugin: ChronosTimelinePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h1", { text: "ChronOS Timeline Settings" });
    containerEl.createEl("p", {
      text: "Customize your life timeline visualization.",
    });

    // Birthday setting
    new Setting(containerEl)
      .setName("Birthday")
      .setDesc("Your date of birth (YYYY-MM-DD)")
      .addText((text) =>
        text
          .setPlaceholder("1990-01-01")
          .setValue(this.plugin.settings.birthday)
          .onChange(async (value) => {
            this.plugin.settings.birthday = value;
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );

    // Lifespan setting
    new Setting(containerEl)
      .setName("Lifespan")
      .setDesc("Maximum age in years to display")
      .addSlider((slider) =>
        slider
          .setLimits(50, 120, 5)
          .setValue(this.plugin.settings.lifespan)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.lifespan = value;
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );

    // Notes folder setting
    new Setting(containerEl)
      .setName("Notes Folder")
      .setDesc("Where to store week notes (leave empty for vault root)")
      .addText((text) =>
        text
          .setPlaceholder("ChronOS Notes")
          .setValue(this.plugin.settings.notesFolder)
          .onChange(async (value) => {
            this.plugin.settings.notesFolder = value;
            await this.plugin.saveSettings();
          })
      );

    // Quote setting
    new Setting(containerEl)
      .setName("Footer Quote")
      .setDesc("Inspirational quote to display at the bottom")
      .addText((text) =>
        text
          .setPlaceholder("the only true luxury is time.")
          .setValue(this.plugin.settings.quote)
          .onChange(async (value) => {
            this.plugin.settings.quote = value;
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );

    // Color settings
    containerEl.createEl("h3", { text: "Colors" });

    // Past cells color
    new Setting(containerEl)
      .setName("Past Weeks Color")
      .setDesc("Color for weeks that have passed")
      .addColorPicker((colorPicker) =>
        colorPicker
          .setValue(this.plugin.settings.pastCellColor)
          .onChange(async (value) => {
            this.plugin.settings.pastCellColor = value;
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );

    // Present cell color
    new Setting(containerEl)
      .setName("Current Week Color")
      .setDesc("Color for the current week")
      .addColorPicker((colorPicker) =>
        colorPicker
          .setValue(this.plugin.settings.presentCellColor)
          .onChange(async (value) => {
            this.plugin.settings.presentCellColor = value;
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );

    // Future cells color
    new Setting(containerEl)
      .setName("Future Weeks Color")
      .setDesc("Color for weeks in the future")
      .addColorPicker((colorPicker) =>
        colorPicker
          .setValue(this.plugin.settings.futureCellColor)
          .onChange(async (value) => {
            this.plugin.settings.futureCellColor = value;
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );

    // Events management
    containerEl.createEl("h3", { text: "Events" });

    // Green events (Major Life Events)
    new Setting(containerEl)
      .setName("Major Life Events")
      .setDesc("Weeks marked as Major Life Events")
      .addButton((button) => {
        button.setButtonText("Clear All").onClick(async () => {
          this.plugin.settings.greenEvents = [];
          await this.plugin.saveSettings();
          this.refreshAllViews();
          new Notice("Cleared all Major Life Events");
        });
      });

    // Blue events (Travel)
    new Setting(containerEl)
      .setName("Travel Events")
      .setDesc("Weeks marked as Travel")
      .addButton((button) => {
        button.setButtonText("Clear All").onClick(async () => {
          this.plugin.settings.blueEvents = [];
          await this.plugin.saveSettings();
          this.refreshAllViews();
          new Notice("Cleared all Travel Events");
        });
      });

    // Pink events (Relationships)
    new Setting(containerEl)
      .setName("Relationship Events")
      .setDesc("Weeks marked as Relationships")
      .addButton((button) => {
        button.setButtonText("Clear All").onClick(async () => {
          this.plugin.settings.pinkEvents = [];
          await this.plugin.saveSettings();
          this.refreshAllViews();
          new Notice("Cleared all Relationship Events");
        });
      });

    // Purple events (Education/Career)
    new Setting(containerEl)
      .setName("Education/Career Events")
      .setDesc("Weeks marked as Education/Career")
      .addButton((button) => {
        button.setButtonText("Clear All").onClick(async () => {
          this.plugin.settings.purpleEvents = [];
          await this.plugin.saveSettings();
          this.refreshAllViews();
          new Notice("Cleared all Education/Career Events");
        });
      });

    // Help text
    containerEl.createEl("h3", { text: "Tips" });
    containerEl.createEl("p", {
      text: "• Click on any week to create or open a note for that week",
    });
    containerEl.createEl("p", {
      text: "• Shift+Click on a week to add an event",
    });
    containerEl.createEl("p", {
      text: "• Use the 'Add Event' button to mark significant life events",
    });
    containerEl.createEl("p", {
      text: "• Use the 'Plan Future Event' button to add events in the future",
    });
  }

  refreshAllViews() {
    this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE).forEach((leaf) => {
      const view = leaf.view as ChronosTimelineView;
      view.renderView();
    });
  }
}
