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

// Unique view type identifier
const TIMELINE_VIEW_TYPE = "chronos-timeline-view";

// Extend settings interface to support custom events.
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
  customEvents: string[]; // New: stores events created via custom event type. Format: "weekKey:description|color|label"
  quote: string;
  notesFolder: string;
}

// Update default settings
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
  customEvents: [],
  quote: "the only true luxury is time.",
  notesFolder: "",
};

// ChronOS Timeline icon – unchanged.
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

    addIcon("chronos-icon", chronosIcon);
    await this.loadSettings();

    // Register the timeline view
    this.registerView(
      TIMELINE_VIEW_TYPE,
      (leaf) => new ChronosTimelineView(leaf, this)
    );

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

  isFirstWeekOfMonth(date: Date): boolean {
    const checkDate = new Date(date);
    const currentMonth = checkDate.getMonth();
    checkDate.setDate(checkDate.getDate() - 7);
    return checkDate.getMonth() !== currentMonth;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ChronosEventModal: Updated to use an HTML date input and to allow creation of custom events
// ─────────────────────────────────────────────────────────────────────────────
class ChronosEventModal extends Modal {
  plugin: ChronosTimelinePlugin;
  // Instead of a week key string, we now store a full date (YYYY-MM-DD)
  selectedDate: string | null;
  // For preset event types: "green", "blue", "pink", "purple", or "custom"
  selectedColor: "green" | "blue" | "pink" | "purple" | "custom" = "green";
  // For custom events:
  customEventLabel: string = "";
  customEventColor: string = "#33aaff";
  eventDescription: string = "";
  dateInput!: HTMLInputElement;

  constructor(
    app: App,
    plugin: ChronosTimelinePlugin,
    selectedDate: string | null = null
  ) {
    super(app);
    this.plugin = plugin;
    this.selectedDate = selectedDate;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    // Use a descriptive title based on whether the event is in the future
    const now = new Date();
    let titleText = "Add Life Event";
    if (this.selectedDate) {
      const selDate = new Date(this.selectedDate);
      if (selDate > now) titleText = "Plan Future Event";
    }
    contentEl.createEl("h2", { text: titleText });

    // ── DATE PICKER ──
    // If a date hasn’t been pre-selected, prompt the user using a date picker
    if (!this.selectedDate) {
      const dateContainer = contentEl.createDiv({
        cls: "chronos-date-picker-container",
      });
      dateContainer.createEl("h3", { text: "Select Date" });
      const dateSetting = new Setting(contentEl)
        .setName("Date")
        .setDesc("Select the event date");
      // Use input type="date" for specific date selection
      this.dateInput = dateSetting.controlEl.createEl("input", {
        type: "date",
        placeholder: "YYYY-MM-DD",
      });
      // Button for today’s date
      const todayBtn = dateSetting.controlEl.createEl("button", {
        text: "Today",
      });
      todayBtn.style.marginLeft = "10px";
      todayBtn.addEventListener("click", () => {
        const today = new Date().toISOString().slice(0, 10);
        this.dateInput.value = today;
        this.selectedDate = today;
      });
      // Button for next month
      const nextMonthBtn = dateSetting.controlEl.createEl("button", {
        text: "Next Month",
      });
      nextMonthBtn.style.marginLeft = "10px";
      nextMonthBtn.addEventListener("click", () => {
        const now = new Date();
        now.setMonth(now.getMonth() + 1);
        const nextMonthDate = now.toISOString().slice(0, 10);
        this.dateInput.value = nextMonthDate;
        this.selectedDate = nextMonthDate;
      });
      contentEl.createEl("small", {
        text: "Tip: Use the date picker to select an exact date",
        cls: "chronos-helper-text",
      });
    } else {
      contentEl.createEl("p", { text: `Date: ${this.selectedDate}` });
    }

    // ── EVENT DESCRIPTION ──
    new Setting(contentEl)
      .setName("Description")
      .setDesc("Brief description of this event")
      .addText((text) =>
        text.setPlaceholder("Event description").onChange((value) => {
          this.eventDescription = value;
        })
      );

    // ── EVENT TYPE SELECTION ──
    // Provide preset event type buttons and an option for a custom type.
    const typeSetting = new Setting(contentEl)
      .setName("Event Type")
      .setDesc("Choose a preset type or select 'Custom' to define your own");

    const greenBtn = contentEl.createEl("button", { text: "Major Life" });
    greenBtn.style.backgroundColor = "#4CAF50";
    greenBtn.style.color = "white";
    greenBtn.style.margin = "5px";
    greenBtn.addEventListener("click", () => {
      this.selectedColor = "green";
      this.updateSelectedButton(typeSetting, greenBtn);
    });
    const blueBtn = contentEl.createEl("button", { text: "Travel" });
    blueBtn.style.backgroundColor = "#2196F3";
    blueBtn.style.color = "white";
    blueBtn.style.margin = "5px";
    blueBtn.addEventListener("click", () => {
      this.selectedColor = "blue";
      this.updateSelectedButton(typeSetting, blueBtn);
    });
    const pinkBtn = contentEl.createEl("button", { text: "Relationship" });
    pinkBtn.style.backgroundColor = "#E91E63";
    pinkBtn.style.color = "white";
    pinkBtn.style.margin = "5px";
    pinkBtn.addEventListener("click", () => {
      this.selectedColor = "pink";
      this.updateSelectedButton(typeSetting, pinkBtn);
    });
    const purpleBtn = contentEl.createEl("button", {
      text: "Education/Career",
    });
    purpleBtn.style.backgroundColor = "#9C27B0";
    purpleBtn.style.color = "white";
    purpleBtn.style.margin = "5px";
    purpleBtn.addEventListener("click", () => {
      this.selectedColor = "purple";
      this.updateSelectedButton(typeSetting, purpleBtn);
    });
    // Custom button
    const customBtn = contentEl.createEl("button", { text: "Custom" });
    customBtn.style.margin = "5px";
    customBtn.addEventListener("click", () => {
      this.selectedColor = "custom";
      this.updateSelectedButton(typeSetting, customBtn);
    });
    typeSetting.settingEl.appendChild(greenBtn);
    typeSetting.settingEl.appendChild(blueBtn);
    typeSetting.settingEl.appendChild(pinkBtn);
    typeSetting.settingEl.appendChild(purpleBtn);
    typeSetting.settingEl.appendChild(customBtn);
    // Default selection
    this.updateSelectedButton(typeSetting, greenBtn);

    // If "Custom" is selected, show additional inputs for custom label and color.
    const customContainer = contentEl.createDiv({
      cls: "chronos-custom-event-container",
    });
    customContainer.createEl("label", { text: "Custom Event Label:" });
    const customLabelInput = customContainer.createEl("input", {
      type: "text",
      placeholder: "Enter label",
    });
    customContainer.createEl("label", { text: "Custom Color:" });
    const customColorInput = customContainer.createEl("input", {
      type: "color",
      value: "#33aaff",
    });
    // Save changes to our modal properties when custom inputs change.
    customLabelInput.addEventListener("change", (e) => {
      this.customEventLabel = (e.target as HTMLInputElement).value;
    });
    customColorInput.addEventListener("change", (e) => {
      this.customEventColor = (e.target as HTMLInputElement).value;
    });

    // ── SAVE BUTTON ──
    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText(
          titleText.includes("Plan") ? "Save Future Event" : "Save Event"
        )
        .setCta()
        .onClick(() => {
          this.saveEvent(customLabelInput.value, customColorInput.value);
        })
    );
  }

  updateSelectedButton(setting: Setting, selectedBtn: HTMLElement) {
    if (setting.settingEl) {
      setting.settingEl.querySelectorAll("button").forEach((btn) => {
        (btn as HTMLElement).style.border = "none";
      });
      selectedBtn.style.border = "2px solid white";
    }
  }

  saveEvent(customLabel: string, customColor: string) {
    if (!this.selectedDate && this.dateInput) {
      new Notice("Please select a date");
      return;
    }
    if (!this.eventDescription) {
      new Notice("Please add a description");
      return;
    }
    // Use the selected (or entered) date
    const eventDateStr = this.selectedDate || this.dateInput.value;
    const eventDate = new Date(eventDateStr);
    // Compute the ISO week key in the same format as the timeline grid.
    const eventYear = eventDate.getFullYear();
    const eventWeek = this.plugin.getISOWeekNumber(eventDate);
    const weekKey = `${eventYear}-W${eventWeek.toString().padStart(2, "0")}`;

    // Save event based on selected type:
    switch (this.selectedColor) {
      case "green":
        this.plugin.settings.greenEvents.push(
          `${weekKey}:${this.eventDescription}`
        );
        break;
      case "blue":
        this.plugin.settings.blueEvents.push(
          `${weekKey}:${this.eventDescription}`
        );
        break;
      case "pink":
        this.plugin.settings.pinkEvents.push(
          `${weekKey}:${this.eventDescription}`
        );
        break;
      case "purple":
        this.plugin.settings.purpleEvents.push(
          `${weekKey}:${this.eventDescription}`
        );
        break;
      case "custom":
        // Use the custom label and color provided by the user.
        this.plugin.settings.customEvents.push(
          `${weekKey}:${this.eventDescription}|${customColor}|${customLabel}`
        );
        break;
    }

    // Save settings and notify
    this.plugin.saveSettings().then(() => {
      const noticeText =
        this.selectedColor === "custom"
          ? `Custom event added: ${this.eventDescription}`
          : `Event added: ${this.eventDescription}`;
      new Notice(noticeText);

      // Create a note for this event (file name based on weekKey)
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
        let content = "";
        if (eventDate > new Date()) {
          content = `# Future Event: ${this.eventDescription}\n\nPlanned Date: ${eventDateStr}\nType: ${this.selectedColor}\n\n## Planning Notes\n\n`;
        } else {
          content = `# Event: ${this.eventDescription}\n\nDate: ${eventDateStr}\nType: ${this.selectedColor}\n\n## Notes\n\n`;
        }
        this.app.vault.create(fullPath, content);
      }

      this.close();
      // Refresh the timeline view
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

// ─────────────────────────────────────────────────────────────────────────────
// ChronosTimelineView: Updated grid rendering for proper alignment and gaps
// ─────────────────────────────────────────────────────────────────────────────
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

  renderView() {
    const contentEl = this.containerEl.children[1];
    contentEl.empty();

    // Title at top
    contentEl.createEl("div", { cls: "chronos-title", text: "life in weeks" });

    // Controls bar
    const controlsEl = contentEl.createEl("div", { cls: "chronos-controls" });
    const addEventBtn = controlsEl.createEl("button", { text: "Add Event" });
    addEventBtn.addEventListener("click", () => {
      this.showAddEventModal();
    });
    const todayBtn = controlsEl.createEl("button", { text: "Today" });
    todayBtn.addEventListener("click", () => {
      const todayCell = contentEl.querySelector(".chronos-grid-cell.present");
      if (todayCell) {
        todayCell.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    const futureEventBtn = controlsEl.createEl("button", {
      text: "Plan Future Event",
    });
    futureEventBtn.style.backgroundColor = "#FFC107";
    futureEventBtn.addEventListener("click", () => {
      const modal = new ChronosEventModal(this.app, this.plugin);
      modal.open();
    });
    const nextEventBtn = controlsEl.createEl("button", {
      text: "Next Planned Event",
    });
    nextEventBtn.addEventListener("click", () => {
      const futureEventCell = contentEl.querySelector(
        ".chronos-grid-cell.future-event-highlight"
      );
      if (futureEventCell) {
        futureEventCell.scrollIntoView({ behavior: "smooth", block: "center" });
        const cellEl = futureEventCell as HTMLElement;
        cellEl.style.transition = "transform 0.3s";
        cellEl.style.transform = "scale(1.3)";
        setTimeout(() => {
          cellEl.style.transform = "";
        }, 500);
      } else {
        new Notice(
          "No future events planned yet. Use 'Plan Future Event' to add one!"
        );
      }
    });
    const settingsBtn = controlsEl.createEl("button", { text: "Settings" });
    settingsBtn.addEventListener("click", () => {
      new ChronosSettingTab(this.app, this.plugin).display();
    });

    // Grid view container
    const viewEl = contentEl.createEl("div", { cls: "chronos-view" });
    this.renderWeeksGrid(viewEl);

    // Legend section
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

    const tipsEl = contentEl.createEl("div", { cls: "chronos-tips" });
    tipsEl.style.fontSize = "12px";
    tipsEl.style.color = "var(--text-muted)";
    tipsEl.style.textAlign = "center";
    tipsEl.style.margin = "10px 0";
    tipsEl.createEl("p", {
      text: "Tip: Click any week to create or open a note. Shift+Click to add an event.",
    });
    contentEl.createEl("div", {
      cls: "chronos-footer",
      text: this.plugin.settings.quote,
    });
  }

  showAddEventModal() {
    const modal = new ChronosEventModal(this.app, this.plugin);
    modal.open();
  }

  // ── Updated renderWeeksGrid with dynamic grid templates, extra gaps, and proper cell positioning ──
  renderWeeksGrid(container: HTMLElement) {
    container.empty();

    const now = new Date();
    const birthdayDate = new Date(this.plugin.settings.birthday);
    const lifespan = this.plugin.settings.lifespan;
    // Calculate age in weeks
    const ageInYears =
      (now.getTime() - birthdayDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    const ageInWeeks = ageInYears * 52;

    // Define grid parameters
    const cellSize = 16;
    const weeksCount = 52;
    const totalYears = lifespan;
    const extraCols = Math.floor((totalYears - 1) / 10);
    const totalCols = totalYears + extraCols;
    const extraRows = Math.floor((weeksCount - 1) / 10);
    const totalRows = weeksCount + extraRows;

    // Set grid template using CSS grid properties
    container.style.display = "grid";
    container.style.gridGap = "2px";
    container.style.gridTemplateColumns = new Array(totalCols)
      .fill(`${cellSize}px`)
      .join(" ");
    container.style.gridTemplateRows = new Array(totalRows)
      .fill(`${cellSize}px`)
      .join(" ");

    // Create the grid cells
    for (let year = 0; year < totalYears; year++) {
      // Determine extra gap count for columns
      const colGapCount = Math.floor(year / 10);
      const gridColumn = year + colGapCount + 1;

      for (let week = 0; week < weeksCount; week++) {
        const rowGapCount = Math.floor(week / 10);
        const gridRow = week + rowGapCount + 1;

        const cell = container.createEl("div", { cls: "chronos-grid-cell" });
        cell.style.gridColumn = gridColumn.toString();
        cell.style.gridRow = gridRow.toString();

        // Mark decade-start cells (for additional gap styling)
        if (year % 10 === 0) {
          cell.addClass("decade-start");
        }
        // Mark month-start cells (rough approximation: every 4 weeks)
        if (week % 4 === 0) {
          cell.addClass("month-start");
          const monthNames = [
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
          const monthIndex = Math.floor((week / weeksCount) * 12) % 12;
          cell.setAttribute("data-month", monthNames[monthIndex]);
        }

        // Calculate the week date for this cell
        const weekIndex = year * 52 + week;
        const cellDate = new Date(birthdayDate);
        cellDate.setDate(cellDate.getDate() + weekIndex * 7);
        const cellYear = cellDate.getFullYear();
        const cellWeek = this.plugin.getISOWeekNumber(cellDate);
        const weekKey = `${cellYear}-W${cellWeek.toString().padStart(2, "0")}`;

        // Set cell background color based on past, present, or future
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

        // Apply event styling for preset event types and custom events
        this.applyEventStyling(cell, weekKey);

        // Setup cell click handlers (left-click to open note, shift/right-click to add event)
        this.setupCellClickHandler(cell, weekKey, cellYear, cellWeek);

        container.appendChild(cell);
      }
    }

    // ── Generate Year Labels ──
    const yearLabelsEl = container.parentElement?.querySelector(
      ".chronos-year-labels"
    );
    if (yearLabelsEl) {
      yearLabelsEl.empty();
      for (let i = 0; i < totalYears; i++) {
        const colGap = Math.floor(i / 10);
        const leftOffset = (i + colGap) * cellSize + cellSize / 2;
        const label = yearLabelsEl.createEl("div", {
          cls: "chronos-year-label",
          text: i.toString(),
        });
        label.style.left = `${leftOffset}px`;
        // For demonstration, add a simple month label under each year label
        if (i < totalYears - 1) {
          const monthLabel = yearLabelsEl.createEl("div", {
            cls: "chronos-month-label",
            text: "Jan",
          });
          monthLabel.style.left = `${leftOffset}px`;
        }
      }
    }
  }

  applyEventStyling(cell: HTMLElement, weekKey: string) {
    // Check preset events for green, blue, pink, and purple
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

    // Check custom events. Format: weekKey:description|color|label
    if (this.plugin.settings.customEvents.some((e) => e.startsWith(weekKey))) {
      const eventData = this.plugin.settings.customEvents.find((e) =>
        e.startsWith(weekKey)
      );
      if (eventData) {
        const parts = eventData.split(":")[1].split("|");
        const description = parts[0] || "Custom Event";
        const color = parts[1] || "#33aaff";
        cell.style.backgroundColor = color;
        cell.addClass("event");
        cell.setAttribute("title", description);
      }
    }

    // Highlight future events (if within next ~6 months and marked)
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

  setupCellClickHandler(
    cell: HTMLElement,
    weekKey: string,
    weekYear: number,
    weekNum: number
  ) {
    cell.addEventListener("click", async (event) => {
      if (event.shiftKey) {
        const modal = new ChronosEventModal(this.app, this.plugin, "");
        modal.selectedDate = ""; // Let user choose date
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
        const content = `# Week ${weekNum}, ${weekYear}\n\n## Reflections\n\n## Tasks\n\n## Notes\n`;
        const newFile = await this.app.vault.create(fullPath, content);
        await this.app.workspace.getLeaf().openFile(newFile);
      }
    });
    cell.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const modal = new ChronosEventModal(this.app, this.plugin, weekKey);
      modal.open();
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings Tab (with slight adjustments to include our updates)
// ─────────────────────────────────────────────────────────────────────────────
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

    containerEl.createEl("h3", { text: "Events" });
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
    // Optionally, add a control to clear custom events as well.
    new Setting(containerEl)
      .setName("Custom Events")
      .setDesc("Weeks marked as custom events")
      .addButton((button) =>
        button.setButtonText("Clear All").onClick(async () => {
          this.plugin.settings.customEvents = [];
          await this.plugin.saveSettings();
          this.refreshAllViews();
          new Notice("Cleared all Custom Events");
        })
      );

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
