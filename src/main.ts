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

// -----------------------------------------------------------------------------
// Interfaces and Default Settings
// -----------------------------------------------------------------------------

// Define the interface for custom event types
interface CustomEventType {
  name: string;
  color: string;
}

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
  customEventTypes: CustomEventType[];
  customEvents: { [key: string]: string[] }; // Key is the event type name; value is an array of event strings (format: "weekKey:description")
  quote: string;
  notesFolder: string;
}

// Default settings
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
  customEventTypes: [],
  customEvents: {},
  quote: "the only true luxury is time.",
  notesFolder: "",
};

// ChronOS Timeline icon
const chronosIcon = `<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="4"/>
  <line x1="50" y1="15" x2="50" y2="50" stroke="currentColor" stroke-width="4"/>
  <line x1="50" y1="50" x2="75" y2="60" stroke="currentColor" stroke-width="4"/>
  <circle cx="50" cy="50" r="5" fill="currentColor"/>
</svg>`;

// Unique view type identifier
const TIMELINE_VIEW_TYPE = "chronos-timeline-view";

// -----------------------------------------------------------------------------
// Main Plugin Class
// -----------------------------------------------------------------------------

export default class ChronosTimelinePlugin extends Plugin {
  settings: ChronosSettings = DEFAULT_SETTINGS;

  async onload() {
    console.log("Loading ChronOS Timeline Plugin");
    addIcon("chronos-icon", chronosIcon);
    await this.loadSettings();

    // Register the timeline view
    this.registerView(
      TIMELINE_VIEW_TYPE,
      (leaf) => new ChronosTimelineView(leaf, this)
    );

    // Ribbon icon and commands
    this.addRibbonIcon("chronos-icon", "Open ChronOS Timeline", () => {
      this.activateView();
    });
    this.addCommand({
      id: "open-chronos-timeline",
      name: "Open ChronOS Timeline",
      callback: () => {
        this.activateView();
      },
    });
    this.addCommand({
      id: "create-weekly-note",
      name: "Create/Open Current Week Note",
      callback: () => {
        this.createOrOpenWeekNote();
      },
    });

    this.addSettingTab(new ChronosSettingTab(this.app, this));
  }

  onunload() {
    console.log("Unloading ChronOS Timeline Plugin");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!this.settings.customEventTypes) this.settings.customEventTypes = [];
    if (!this.settings.customEvents) this.settings.customEvents = {};
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(TIMELINE_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getLeaf("split", "vertical");
      await leaf.setViewState({
        type: TIMELINE_VIEW_TYPE,
        active: true,
      });
    }
    workspace.revealLeaf(leaf);
  }

  getFullWeekAge(birthday: Date, today: Date): number {
    const diffMs = today.getTime() - birthday.getTime();
    const msPerWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diffMs / msPerWeek);
  }

  getFullPath(fileName: string): string {
    if (this.settings.notesFolder && this.settings.notesFolder.trim() !== "") {
      let folderPath = this.settings.notesFolder;
      if (!folderPath.endsWith("/")) folderPath += "/";
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

      const existingFile = this.app.vault.getAbstractFileByPath(fullPath);
      if (existingFile instanceof TFile) {
        await this.app.workspace.getLeaf().openFile(existingFile);
      } else {
        if (
          this.settings.notesFolder &&
          this.settings.notesFolder.trim() !== ""
        ) {
          try {
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
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  // Get the week key (YYYY-WXX) from a specific date
  getWeekKeyFromDate(date: Date): string {
    const year = date.getFullYear();
    const weekNum = this.getISOWeekNumber(date);
    return `${year}-W${weekNum.toString().padStart(2, "0")}`;
  }

  isFirstWeekOfMonth(date: Date): boolean {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstWeekday = firstDayOfMonth.getDay();
    const dayOfMonth = date.getDate();

    // If the first day of month is later in the week, adjust calculation
    const adjustedDay = dayOfMonth + firstWeekday - 1;

    // Return true if this date is in the first week of the month
    return dayOfMonth <= 7 && adjustedDay < 7;
  }

  getMonthName(date: Date): string {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return months[date.getMonth()];
  }
}

// -----------------------------------------------------------------------------
// ChronosEventModal: Adding Events via a Date Picker and Custom Type Selection
// -----------------------------------------------------------------------------

class ChronosEventModal extends Modal {
  plugin: ChronosTimelinePlugin;
  selectedDate: string = "";
  selectedColor: string = "#4CAF50";
  eventDescription: string = "";
  dateInput!: HTMLInputElement;
  selectedEventType: string = "Major Life";
  customEventName: string = "";
  isCustomType: boolean = false;

  constructor(
    app: App,
    plugin: ChronosTimelinePlugin,
    preselectedDate: string | null = null
  ) {
    super(app);
    this.plugin = plugin;
    if (preselectedDate) {
      if (preselectedDate.includes("W")) {
        this.selectedDate = preselectedDate;
      } else {
        const date = new Date(preselectedDate);
        if (!isNaN(date.getTime())) {
          this.selectedDate = plugin.getWeekKeyFromDate(date);
        }
      }
    }
  }

  // Helper to convert a week key (YYYY-WXX) back to an approximate date (YYYY-MM-DD)
  convertWeekToDate(weekKey: string): string {
    const parts = weekKey.split("-W");
    if (parts.length !== 2) return "";
    const year = parseInt(parts[0]);
    const week = parseInt(parts[1]);
    const date = new Date(year, 0, 1);
    const dayOfWeek = date.getDay();
    let daysToAdd = (week - 1) * 7;
    if (dayOfWeek <= 4) {
      daysToAdd += 1 - dayOfWeek;
    } else {
      daysToAdd += 8 - dayOfWeek;
    }
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString().split("T")[0];
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Add Life Event" });

    // Date picker section
    const dateContainer = contentEl.createDiv({
      cls: "chronos-date-picker-container",
    });
    dateContainer.createEl("h3", { text: "Select Date" });
    const dateSetting = new Setting(contentEl)
      .setName("Date")
      .setDesc("Enter the exact date of the event");
    this.dateInput = dateSetting.controlEl.createEl("input", {
      type: "date",
      value: this.selectedDate
        ? this.convertWeekToDate(this.selectedDate)
        : new Date().toISOString().split("T")[0],
    });
    this.dateInput.addEventListener("change", (e) => {
      const specificDate = this.dateInput.value;
      if (specificDate) {
        const date = new Date(specificDate);
        this.selectedDate = this.plugin.getWeekKeyFromDate(date);
      }
    });
    contentEl.createEl("small", {
      text: "Select the exact date of your event. The system determines its week automatically.",
      cls: "chronos-helper-text",
    });
    if (this.selectedDate) {
      contentEl.createEl("p", {
        text: `This date falls in week: ${this.selectedDate}`,
      });
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

    // Event Type Selection using radio buttons
    const eventTypeContainer = contentEl.createDiv();
    eventTypeContainer.createEl("h3", { text: "Event Type" });
    const presetTypes = [
      { name: "Major Life", color: "#4CAF50" },
      { name: "Travel", color: "#2196F3" },
      { name: "Relationship", color: "#E91E63" },
      { name: "Education/Career", color: "#9C27B0" },
    ];
    const typeSettingContainer = new Setting(contentEl)
      .setName("Select Event Type")
      .setDesc("Choose a preset type or create your own");
    const radioContainer = typeSettingContainer.controlEl.createDiv({
      cls: "chronos-radio-container",
    });
    for (const type of presetTypes) {
      const radioLabel = radioContainer.createEl("label", {
        cls: "chronos-radio-label",
      });
      const radioBtn = radioLabel.createEl("input") as HTMLInputElement;
      radioBtn.type = "radio";
      radioBtn.name = "eventType";
      radioBtn.value = type.name;
      if (type.name === this.selectedEventType) {
        radioBtn.checked = true;
      }
      const colorBox = radioLabel.createEl("span", {
        cls: "chronos-color-box",
      });
      colorBox.style.backgroundColor = type.color;
      radioLabel.createEl("span", { text: type.name });
      radioBtn.addEventListener("change", () => {
        if (radioBtn.checked) {
          this.selectedEventType = type.name;
          this.selectedColor = type.color;
          this.isCustomType = false;
          this.updateCustomTypeVisibility(contentEl, false);
        }
      });
    }
    // Custom event type option
    const customLabel = radioContainer.createEl("label", {
      cls: "chronos-radio-label",
    });
    const customRadio = customLabel.createEl("input") as HTMLInputElement;
    customRadio.type = "radio";
    customRadio.name = "eventType";
    customRadio.value = "custom";
    customLabel.createEl("span", { text: "Custom Type" });
    customRadio.addEventListener("change", () => {
      if (customRadio.checked) {
        this.isCustomType = true;
        this.updateCustomTypeVisibility(contentEl, true);
      }
    });

    // Custom type settings (initially hidden)
    const customTypeSettings = contentEl.createDiv({
      cls: "chronos-custom-type-settings",
    });
    customTypeSettings.style.display = "none";
    new Setting(customTypeSettings)
      .setName("Custom Type Name")
      .setDesc("Enter a name for your custom event type")
      .addText((text) =>
        text.setPlaceholder("Type name").onChange((value) => {
          this.customEventName = value;
        })
      );
    new Setting(customTypeSettings)
      .setName("Custom Color")
      .setDesc("Select a color for this event type")
      .addColorPicker((picker) => {
        picker.setValue("#FF9800").onChange((value) => {
          this.selectedColor = value;
        });
        this.selectedColor = "#FF9800";
      });

    // Save button
    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Save Event")
        .setCta()
        .onClick(() => {
          this.saveEvent();
        })
    );
  }

  updateCustomTypeVisibility(contentEl: HTMLElement, show: boolean) {
    const customSettings = contentEl.querySelector(
      ".chronos-custom-type-settings"
    ) as HTMLElement;
    if (customSettings) {
      customSettings.style.display = show ? "block" : "none";
    }
  }

  saveEvent() {
    if (!this.selectedDate && this.dateInput) {
      new Notice("Please select a date");
      return;
    }
    if (!this.eventDescription) {
      new Notice("Please add a description");
      return;
    }
    const eventDateStr = this.selectedDate || this.dateInput.value;
    const eventDate = new Date(eventDateStr);
    const eventYear = eventDate.getFullYear();
    const eventWeek = this.plugin.getISOWeekNumber(eventDate);
    const weekKey = `${eventYear}-W${eventWeek.toString().padStart(2, "0")}`;

    // If a custom type is chosen and not yet added, add it to settings
    if (this.isCustomType && this.customEventName) {
      const existingIndex = this.plugin.settings.customEventTypes.findIndex(
        (type) => type.name === this.customEventName
      );
      if (existingIndex === -1) {
        this.plugin.settings.customEventTypes.push({
          name: this.customEventName,
          color: this.selectedColor,
        });
        this.plugin.settings.customEvents[this.customEventName] = [];
      }
      this.selectedEventType = this.customEventName;
    }

    const eventData = `${this.selectedDate}:${this.eventDescription}`;

    switch (this.selectedEventType) {
      case "Major Life":
        this.plugin.settings.greenEvents.push(eventData);
        break;
      case "Travel":
        this.plugin.settings.blueEvents.push(eventData);
        break;
      case "Relationship":
        this.plugin.settings.pinkEvents.push(eventData);
        break;
      case "Education/Career":
        this.plugin.settings.purpleEvents.push(eventData);
        break;
      default:
        if (!this.plugin.settings.customEvents[this.selectedEventType]) {
          this.plugin.settings.customEvents[this.selectedEventType] = [];
        }
        this.plugin.settings.customEvents[this.selectedEventType].push(
          eventData
        );
    }

    this.plugin.saveSettings().then(() => {
      new Notice(`Event added: ${this.eventDescription}`);
      const fileName = `${weekKey.replace("W", "-W")}.md`;
      const fullPath = this.plugin.getFullPath(fileName);
      const fileExists =
        this.app.vault.getAbstractFileByPath(fullPath) instanceof TFile;
      if (!fileExists) {
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
        const content = `# Event: ${this.eventDescription}\n\nDate: ${this.selectedDate}\nType: ${this.selectedEventType}\n\n## Notes\n\n`;
        this.app.vault.create(fullPath, content);
      }
      this.close();
      this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE).forEach((leaf) => {
        const view = leaf.view as ChronosTimelineView;
        view.renderView();
      });
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

// -----------------------------------------------------------------------------
// ChronosTimelineView: Rendering the Timeline Grid and Controls
// -----------------------------------------------------------------------------

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
    // Cast the container to HTMLElement so we can use .empty()
    const contentEl = this.containerEl.children[1] as HTMLElement;
    contentEl.empty();
    contentEl.addClass("chronos-timeline-container");
    this.renderView();
  }

  async onClose() {
    const contentEl = this.containerEl.children[1] as HTMLElement;
    contentEl.empty();
  }

  renderView() {
    const contentEl = this.containerEl.children[1] as HTMLElement;
    contentEl.empty();

    // Build controls bar.
    const controlsEl = contentEl.createEl("div", { cls: "chronos-controls" });
    const addEventBtn = controlsEl.createEl("button", { text: "Add Event" });
    addEventBtn.addEventListener("click", () => this.showAddEventModal());
    const todayBtn = controlsEl.createEl("button", { text: "Today" });
    todayBtn.addEventListener("click", () => {
      const todayCell = contentEl.querySelector(
        ".chronos-grid-cell.present"
      ) as HTMLElement;
      if (todayCell) {
        todayCell.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    const futureEventBtn = controlsEl.createEl("button", {
      text: "Plan Future Event",
    });
    futureEventBtn.addEventListener("click", () => this.showAddEventModal());
    const manageTypesBtn = controlsEl.createEl("button", {
      text: "Manage Event Types",
    });
    manageTypesBtn.addEventListener("click", () => {
      const modal = new ManageEventTypesModal(this.app, this.plugin);
      modal.open();
    });
    const settingsBtn = controlsEl.createEl("button", { text: "Settings" });
    settingsBtn.addEventListener("click", () =>
      new ChronosSettingTab(this.app, this.plugin).display()
    );

    // Render the grid container.
    const gridContainer = contentEl.createEl("div", { cls: "chronos-view" });
    this.renderWeeksGrid(gridContainer);

    // Render Legend.
    const legendEl = contentEl.createEl("div", { cls: "chronos-legend" });
    const legendItems = [
      { text: "Major Life Events", color: "#4CAF50" },
      { text: "Travel", color: "#2196F3" },
      { text: "Relationships", color: "#E91E63" },
      { text: "Education/Career", color: "#9C27B0" },
      {
        text: "Upcoming Planned Event",
        color: this.plugin.settings.futureCellColor,
      },
    ];
    legendItems.forEach((item) => {
      const itemEl = legendEl.createEl("div", { cls: "chronos-legend-item" });
      const colorEl = itemEl.createEl("div", { cls: "chronos-legend-color" });
      colorEl.style.backgroundColor = item.color;
      itemEl.createEl("span", { text: item.text });
    });
    // Render custom event type legends.
    this.plugin.settings.customEventTypes.forEach((customType) => {
      const customLegendEl = legendEl.createEl("div", {
        cls: "chronos-legend-item",
      });
      const customColorEl = customLegendEl.createEl("div", {
        cls: "chronos-legend-color",
      });
      customColorEl.style.backgroundColor = customType.color;
      customLegendEl.createEl("span", { text: customType.name });
    });
  }

  // Updated renderWeeksGrid method to fix alignment and remove week gaps
  renderWeeksGrid(container: HTMLElement) {
    container.empty();

    // Get the CSS variables for positioning and styling
    const root = document.documentElement;
    const cellSize = parseInt(
      getComputedStyle(root).getPropertyValue("--cell-size")
    );
    const cellGap = parseInt(
      getComputedStyle(root).getPropertyValue("--cell-gap")
    );
    const decadeGap = parseInt(
      getComputedStyle(root).getPropertyValue("--decade-gap") || "8"
    );
    const leftOffset = parseInt(
      getComputedStyle(root).getPropertyValue("--left-offset")
    );
    const topOffset = parseInt(
      getComputedStyle(root).getPropertyValue("--top-offset")
    );

    // Create decade markers container (horizontal markers above the grid)
    const decadeMarkersContainer = container.createEl("div", {
      cls: "chronos-decade-markers",
    });

    // Position the decade markers container
    decadeMarkersContainer.style.position = "absolute";
    decadeMarkersContainer.style.top = "0";
    decadeMarkersContainer.style.left = `${leftOffset}px`;
    decadeMarkersContainer.style.width = "calc(100% - var(--left-offset))";
    decadeMarkersContainer.style.height = `${topOffset}px`;
    decadeMarkersContainer.style.pointerEvents = "none";

    // Add decade markers (0, 10, 20, etc.)
    for (
      let decade = 0;
      decade <= this.plugin.settings.lifespan;
      decade += 10
    ) {
      const marker = decadeMarkersContainer.createEl("div", {
        cls: "chronos-decade-marker",
        text: decade.toString(),
      });

      // Calculate position accounting for decade gaps
      let decadePosition = 0;
      for (let d = 0; d < decade; d++) {
        decadePosition += cellSize + cellGap;
        // Add extra gap after each decade
        if (d > 0 && d % 10 === 9) {
          decadePosition += decadeGap;
        }
      }

      // Position each decade marker
      marker.style.position = "absolute";
      marker.style.left = `${decadePosition}px`;
      marker.style.top = `${topOffset / 2}px`;
      marker.style.transform = "translate(-50%, -50%)";

      // Add decade separator lines
      if (decade > 0 && decade < this.plugin.settings.lifespan) {
        const separator = container.createEl("div", {
          cls: "decade-separator",
        });
        separator.style.position = "absolute";
        separator.style.top = `${topOffset}px`;
        separator.style.left = `${decadePosition - decadeGap / 2}px`;
        separator.style.height = `calc(52 * (${cellSize}px + ${cellGap}px))`;
      }
    }

    // Create week markers container (vertical markers to the left of the grid)
    const weekMarkersContainer = container.createEl("div", {
      cls: "chronos-week-markers",
    });

    // Position the week markers container
    weekMarkersContainer.style.position = "absolute";
    weekMarkersContainer.style.top = `${topOffset}px`;
    weekMarkersContainer.style.left = "0";
    weekMarkersContainer.style.width = `${leftOffset}px`;
    weekMarkersContainer.style.height = "calc(100% - var(--top-offset))";
    weekMarkersContainer.style.pointerEvents = "none";

    // Add week markers (10, 20, 30, etc.)
    for (let week = 0; week <= 50; week += 10) {
      if (week === 0) continue; // Skip 0 to start with 10
      const marker = weekMarkersContainer.createEl("div", {
        cls: "chronos-week-marker",
        text: week.toString(),
      });

      // Calculate position accounting for cell size and gap only (no week gaps)
      const weekPosition = week * (cellSize + cellGap);

      // Position each week marker
      marker.style.position = "absolute";
      marker.style.right = "10px";
      marker.style.top = `${weekPosition}px`;
      marker.style.transform = "translateY(-50%)";
      marker.style.textAlign = "right";

      // Add week separator lines
      if (week > 0 && week < 50) {
        const separator = container.createEl("div", {
          cls: "week-separator",
        });
        separator.style.position = "absolute";
        separator.style.top = `${weekPosition}px`;
        separator.style.left = `${leftOffset}px`;
        separator.style.width = `calc(${
          this.plugin.settings.lifespan
        } * (${cellSize}px + ${cellGap}px) + ${
          decadeGap * Math.floor(this.plugin.settings.lifespan / 10)
        }px)`;
      }
    }

    // Create the grid container
    const gridContainer = container.createEl("div", { cls: "chronos-grid" });

    // Now add grid cells
    const now = new Date();
    const birthdayDate = new Date(this.plugin.settings.birthday);
    const ageInWeeks = this.plugin.getFullWeekAge(birthdayDate, now);

    for (let week = 0; week < 52; week++) {
      // Calculate Y position based only on week, cell size, and gap
      const yPos = topOffset + week * (cellSize + cellGap);

      for (let year = 0; year < this.plugin.settings.lifespan; year++) {
        // Calculate X position with decade gaps
        let xPos = leftOffset;
        for (let y = 0; y < year; y++) {
          xPos += cellSize + cellGap;
          if (y > 0 && y % 10 === 9) {
            xPos += decadeGap;
          }
        }

        const weekIndex = year * 52 + week;
        const cell = gridContainer.createEl("div", {
          cls: "chronos-grid-cell",
        });

        // Position the cell absolutely
        cell.style.position = "absolute";
        cell.style.left = `${xPos}px`;
        cell.style.top = `${yPos}px`;
        cell.style.width = `${cellSize}px`;
        cell.style.height = `${cellSize}px`;

        // Calculate cell date
        const cellDate = new Date(birthdayDate);
        cellDate.setDate(cellDate.getDate() + weekIndex * 7);
        const cellYear = cellDate.getFullYear();
        const cellWeek = this.plugin.getISOWeekNumber(cellDate);
        const weekKey = `${cellYear}-W${cellWeek.toString().padStart(2, "0")}`;
        cell.dataset.weekKey = weekKey;

        // Color coding (past, present, future)
        if (weekIndex < ageInWeeks) {
          cell.addClass("past");
          cell.style.backgroundColor = this.plugin.settings.pastCellColor;
        } else if (Math.floor(weekIndex) === Math.floor(ageInWeeks)) {
          cell.addClass("present");
          cell.style.backgroundColor = this.plugin.settings.presentCellColor;
        } else {
          cell.addClass("future");
          cell.style.backgroundColor = this.plugin.settings.futureCellColor;
        }

        // Add decade boundary class if applicable
        if (year > 0 && year % 10 === 9) {
          cell.addClass("decade-boundary");
        }

        // Apply any event styling
        this.applyEventStyling(cell, weekKey);

        cell.addEventListener("click", async (event) => {
          if (event.shiftKey) {
            const modal = new ChronosEventModal(this.app, this.plugin, weekKey);
            modal.open();
            return;
          }
          const fileName = `${weekKey.replace("W", "-W")}.md`;
          const fullPath = this.plugin.getFullPath(fileName);
          const existingFile = this.app.vault.getAbstractFileByPath(fullPath);
          if (existingFile instanceof TFile) {
            await this.app.workspace.getLeaf().openFile(existingFile);
          } else {
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
            const content = `# Week ${cellWeek}, ${cellYear}\n\n## Reflections\n\n## Tasks\n\n## Notes\n`;
            const newFile = await this.app.vault.create(fullPath, content);
            await this.app.workspace.getLeaf().openFile(newFile);
          }
        });
      }
    }

    // Add footer with quote
    if (this.plugin.settings.quote) {
      const footerEl = container.createEl("div", {
        cls: "chronos-footer",
        text: this.plugin.settings.quote,
      });
    }
  }

  applyEventStyling(cell: HTMLElement, weekKey: string) {
    // Apply preset event styles.
    const applyPreset = (
      arr: string[],
      defaultColor: string,
      defaultDesc: string
    ) => {
      if (arr.some((event) => event.startsWith(weekKey))) {
        cell.style.backgroundColor = defaultColor;
        cell.addClass("event");
        const event = arr.find((e) => e.startsWith(weekKey));
        if (event) {
          const description = event.split(":")[1] || defaultDesc;
          cell.setAttribute("title", description);
        }
      }
    };
    applyPreset(
      this.plugin.settings.greenEvents,
      "#4CAF50",
      "Major Life Event"
    );
    applyPreset(this.plugin.settings.blueEvents, "#2196F3", "Travel");
    applyPreset(this.plugin.settings.pinkEvents, "#E91E63", "Relationship");
    applyPreset(
      this.plugin.settings.purpleEvents,
      "#9C27B0",
      "Education/Career"
    );

    // For custom events, loop through each event type.
    for (const [typeName, events] of Object.entries(
      this.plugin.settings.customEvents
    )) {
      if (events.some((event) => event.startsWith(weekKey))) {
        const customType = this.plugin.settings.customEventTypes.find(
          (type) => type.name === typeName
        );
        if (customType) {
          cell.style.backgroundColor = customType.color;
          cell.addClass("event");
          const event = events.find((e) => e.startsWith(weekKey));
          if (event) {
            const description = event.split(":")[1] || typeName;
            cell.setAttribute("title", `${description} (${typeName})`);
          }
        }
      }
    }

    // Highlight future events.
    const now = new Date();
    const cellDate = new Date();
    const [cellYearStr, weekNumStr] = weekKey.split("-W");
    cellDate.setFullYear(parseInt(cellYearStr));
    cellDate.setDate(1 + (parseInt(weekNumStr) - 1) * 7);
    if (
      cellDate > now &&
      cellDate < new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000) &&
      cell.classList.contains("event")
    ) {
      cell.addClass("future-event-highlight");
    }
  }

  showAddEventModal() {
    const modal = new ChronosEventModal(this.app, this.plugin);
    modal.open();
  }

  showManageEventTypesModal() {
    const modal = new ManageEventTypesModal(this.app, this.plugin);
    modal.open();
  }
}

// -----------------------------------------------------------------------------
// Modal for Managing Custom Event Types
// -----------------------------------------------------------------------------

class ManageEventTypesModal extends Modal {
  plugin: ChronosTimelinePlugin;

  constructor(app: App, plugin: ChronosTimelinePlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Manage Event Types" });

    // Section for adding a new event type
    const addSection = contentEl.createDiv({ cls: "event-type-add-section" });
    addSection.createEl("h3", { text: "Add New Event Type" });
    const nameInput = addSection.createEl("input", {
      type: "text",
      placeholder: "Event Type Name",
    });
    const colorInput = addSection.createEl("input", {
      type: "color",
      value: "#FF9800",
    });
    const addButton = addSection.createEl("button", {
      text: "Add Type",
      cls: "add-type-button",
    });
    addButton.addEventListener("click", () => {
      const name = nameInput.value.trim();
      if (!name) {
        new Notice("Please enter a name for the event type");
        return;
      }
      if (
        this.plugin.settings.customEventTypes.some((type) => type.name === name)
      ) {
        new Notice("An event type with this name already exists");
        return;
      }
      this.plugin.settings.customEventTypes.push({
        name: name,
        color: colorInput.value,
      });
      this.plugin.settings.customEvents[name] = [];
      this.plugin.saveSettings().then(() => {
        new Notice(`Event type "${name}" added`);
        this.renderExistingTypes(contentEl);
        nameInput.value = "";
      });
    });

    // Section for listing existing custom types
    const existingSection = contentEl.createDiv({
      cls: "event-type-existing-section",
    });
    existingSection.createEl("h3", { text: "Existing Event Types" });
    this.renderExistingTypes(existingSection);

    const closeButton = contentEl.createEl("button", {
      text: "Close",
      cls: "close-button",
    });
    closeButton.addEventListener("click", () => {
      this.close();
      this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE).forEach((leaf) => {
        const view = leaf.view as ChronosTimelineView;
        view.renderView();
      });
    });
  }

  renderExistingTypes(container: HTMLElement) {
    const typesList = container.querySelector(".existing-types-list");
    if (typesList) typesList.remove();
    const newList = container.createEl("div", { cls: "existing-types-list" });
    newList.createEl("p", {
      text: "Built-in types (cannot be edited)",
      cls: "built-in-note",
    });
    const builtInTypes = [
      { name: "Major Life", color: "#4CAF50" },
      { name: "Travel", color: "#2196F3" },
      { name: "Relationship", color: "#E91E63" },
      { name: "Education/Career", color: "#9C27B0" },
    ];
    for (const type of builtInTypes) {
      const typeItem = newList.createEl("div", {
        cls: "event-type-item built-in",
      });
      const colorBox = typeItem.createEl("span", { cls: "event-type-color" });
      colorBox.style.backgroundColor = type.color;
      typeItem.createEl("span", { text: type.name, cls: "event-type-name" });
    }
    if (this.plugin.settings.customEventTypes.length > 0) {
      newList.createEl("p", {
        text: "Your custom types",
        cls: "custom-types-note",
      });
      for (const type of this.plugin.settings.customEventTypes) {
        const typeItem = newList.createEl("div", {
          cls: "event-type-item custom",
        });
        const colorBox = typeItem.createEl("span", { cls: "event-type-color" });
        colorBox.style.backgroundColor = type.color;
        typeItem.createEl("span", { text: type.name, cls: "event-type-name" });
        const editButton = typeItem.createEl("button", {
          text: "Edit",
          cls: "edit-type-button",
        });
        editButton.addEventListener("click", () => {
          this.showEditTypeModal(type);
        });
        const deleteButton = typeItem.createEl("button", {
          text: "Delete",
          cls: "delete-type-button",
        });
        deleteButton.addEventListener("click", () => {
          if (
            confirm(
              `Are you sure you want to delete the event type "${type.name}"? All events of this type will also be deleted.`
            )
          ) {
            this.plugin.settings.customEventTypes =
              this.plugin.settings.customEventTypes.filter(
                (t) => t.name !== type.name
              );
            delete this.plugin.settings.customEvents[type.name];
            this.plugin.saveSettings().then(() => {
              new Notice(`Event type "${type.name}" deleted`);
              this.renderExistingTypes(container);
            });
          }
        });
      }
    } else {
      newList.createEl("p", {
        text: "You haven't created any custom event types yet",
        cls: "no-custom-types",
      });
    }
  }

  showEditTypeModal(type: CustomEventType) {
    const modal = new Modal(this.app);
    modal.titleEl.setText(`Edit Event Type: ${type.name}`);
    const contentEl = modal.contentEl;
    const nameContainer = contentEl.createDiv({ cls: "edit-name-container" });
    const nameLabel = nameContainer.createEl("label");
    nameLabel.textContent = "Name";
    nameLabel.htmlFor = "edit-type-name";
    const nameInput = nameContainer.createEl("input") as HTMLInputElement;
    nameInput.type = "text";
    nameInput.value = type.name;
    nameInput.id = "edit-type-name";
    const colorContainer = contentEl.createDiv({ cls: "edit-color-container" });
    const colorLabel = colorContainer.createEl("label");
    colorLabel.textContent = "Color";
    colorLabel.htmlFor = "edit-type-color";
    const colorInput = colorContainer.createEl("input") as HTMLInputElement;
    colorInput.type = "color";
    colorInput.value = type.color;
    colorInput.id = "edit-type-color";
    const saveButton = contentEl.createEl("button", {
      text: "Save Changes",
      cls: "save-edit-button",
    });
    saveButton.addEventListener("click", () => {
      const newName = nameInput.value.trim();
      if (!newName) {
        new Notice("Please enter a name for the event type");
        return;
      }
      if (
        newName !== type.name &&
        this.plugin.settings.customEventTypes.some((t) => t.name === newName)
      ) {
        new Notice("An event type with this name already exists");
        return;
      }
      if (newName !== type.name) {
        this.plugin.settings.customEvents[newName] =
          this.plugin.settings.customEvents[type.name] || [];
        delete this.plugin.settings.customEvents[type.name];
      }
      const typeIndex = this.plugin.settings.customEventTypes.findIndex(
        (t) => t.name === type.name
      );
      if (typeIndex !== -1) {
        this.plugin.settings.customEventTypes[typeIndex] = {
          name: newName,
          color: colorInput.value,
        };
        this.plugin.saveSettings().then(() => {
          new Notice(`Event type updated to "${newName}"`);
          modal.close();
          this.renderExistingTypes(this.contentEl);
        });
      }
    });
    const cancelButton = contentEl.createEl("button", {
      text: "Cancel",
      cls: "cancel-edit-button",
    });
    cancelButton.addEventListener("click", () => {
      modal.close();
    });
    modal.open();
  }

  onClose() {
    this.contentEl.empty();
  }
}

// -----------------------------------------------------------------------------
// Settings Tab
// -----------------------------------------------------------------------------

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

    containerEl.createEl("h3", { text: "Colors" });

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

    containerEl.createEl("h3", { text: "Event Types" });
    new Setting(containerEl)
      .setName("Manage Event Types")
      .setDesc("Create, edit, or delete custom event types")
      .addButton((button) => {
        button.setButtonText("Manage Types").onClick(() => {
          const modal = new ManageEventTypesModal(this.app, this.plugin);
          modal.open();
        });
      });

    containerEl.createEl("h3", { text: "Clear Event Data" });
    new Setting(containerEl)
      .setName("Major Life Events")
      .setDesc("Weeks marked as Major Life Events")
      .addButton((button) =>
        button.setButtonText("Clear All").onClick(async () => {
          this.plugin.settings.greenEvents = [];
          await this.plugin.saveSettings();
          this.refreshAllViews();
          new Notice("Cleared all Major Life Events");
        })
      );
    new Setting(containerEl)
      .setName("Travel Events")
      .setDesc("Weeks marked as Travel")
      .addButton((button) =>
        button.setButtonText("Clear All").onClick(async () => {
          this.plugin.settings.blueEvents = [];
          await this.plugin.saveSettings();
          this.refreshAllViews();
          new Notice("Cleared all Travel Events");
        })
      );
    new Setting(containerEl)
      .setName("Relationship Events")
      .setDesc("Weeks marked as Relationships")
      .addButton((button) =>
        button.setButtonText("Clear All").onClick(async () => {
          this.plugin.settings.pinkEvents = [];
          await this.plugin.saveSettings();
          this.refreshAllViews();
          new Notice("Cleared all Relationship Events");
        })
      );
    new Setting(containerEl)
      .setName("Education/Career Events")
      .setDesc("Weeks marked as Education/Career")
      .addButton((button) =>
        button.setButtonText("Clear All").onClick(async () => {
          this.plugin.settings.purpleEvents = [];
          await this.plugin.saveSettings();
          this.refreshAllViews();
          new Notice("Cleared all Education/Career Events");
        })
      );
    if (this.plugin.settings.customEventTypes.length > 0) {
      new Setting(containerEl)
        .setName("Custom Events")
        .setDesc("Clear events for custom event types")
        .addButton((button) => {
          button.setButtonText("Clear All Custom Events").onClick(async () => {
            this.plugin.settings.customEvents = {};
            for (const type of this.plugin.settings.customEventTypes) {
              this.plugin.settings.customEvents[type.name] = [];
            }
            await this.plugin.saveSettings();
            this.refreshAllViews();
            new Notice("Cleared all custom events");
          });
        });
    }
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
    containerEl.createEl("p", {
      text: "• Create custom event types to personalize your timeline",
    });
  }

  refreshAllViews() {
    this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE).forEach((leaf) => {
      const view = leaf.view as ChronosTimelineView;
      view.renderView();
    });
  }
}
