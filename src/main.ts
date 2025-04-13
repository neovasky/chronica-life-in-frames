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
class ChronosEventModal extends Modal {
  plugin: ChronosTimelinePlugin;
  selectedDate: string | null;
  selectedColor: "green" | "blue" | "pink" | "purple" = "green";
  eventDescription: string = "";
  dateInput!: HTMLInputElement; // Using definite assignment assertion

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

    contentEl.createEl("h2", { text: "Add Life Event" });

    // Date selector (if not already provided)
    if (!this.selectedDate) {
      const dateContainer = contentEl.createDiv({
        cls: "chronos-date-picker-container",
      });
      dateContainer.createEl("h3", { text: "Select Date" });

      // Add date picker for better date selection
      const dateSettingContainer = new Setting(contentEl)
        .setName("Date")
        .setDesc("Enter the date or select from calendar");

      this.dateInput = dateSettingContainer.controlEl.createEl("input", {
        type: "text",
        placeholder: "YYYY-WW (e.g., 2025-W15)",
        value: this.selectedDate || "",
      });

      // Add date change handler
      this.dateInput.addEventListener("change", (e) => {
        this.selectedDate = this.dateInput?.value || "";
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
      new Notice(`Event added: ${this.eventDescription}`);

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

        // Create the file with event description
        const content = `# Event: ${this.eventDescription}\n\nDate: ${this.selectedDate}\nType: ${this.selectedColor}\n\n## Notes\n\n`;
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

    // Add Future Event button
    const futureEventBtn = controlsEl.createEl("button", {
      text: "Plan Future Event",
    });
    futureEventBtn.addEventListener("click", () => {
      // Open the event modal without a pre-selected date
      this.showAddEventModal();
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

    // Create max 90 columns for years (as in the example image)
    const maxYears = lifespan;

    // Add year labels
    for (let i = 0; i <= maxYears; i += 10) {
      const yearLabel = yearLabelsEl.createEl("div", {
        cls: "chronos-year-label",
        text: i.toString(),
      });
      // Position label properly (every 10 years)
      yearLabel.style.position = "absolute";
      yearLabel.style.left = `${i * (16 + 4) + 40}px`; // 16px per year + 4px for decade spacing + offset
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

    // Calculate total cells (52 weeks * lifespan years)
    const totalWeeks = 52 * lifespan;

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

        // Add class for first week of month
        if (this.plugin.isFirstWeekOfMonth(weekDate)) {
          cell.addClass("month-start");
        }

        // Position the cell in the grid (weeks as rows, years as columns)
        cell.style.gridRow = `${week + 1}`;
        cell.style.gridColumn = `${year + 1}`;

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

        // Check if this week has any events
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

        // Add click event to create/open the corresponding weekly note
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
      }
    }
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
