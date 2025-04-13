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
  // Add custom event types
  customEventTypes: CustomEventType[];
  customEvents: { [key: string]: string[] }; // Key is the event type name, value is array of events
  quote: string;
  notesFolder: string;
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

    // Make sure customEvents exists (for backward compatibility)
    if (!this.settings.customEventTypes) {
      this.settings.customEventTypes = [];
    }
    if (!this.settings.customEvents) {
      this.settings.customEvents = {};
    }
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

  // Get the week key (YYYY-WWW) from a specific date
  getWeekKeyFromDate(date: Date): string {
    const year = date.getFullYear();
    const weekNum = this.getISOWeekNumber(date);
    return `${year}-W${weekNum.toString().padStart(2, "0")}`;
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

  // Helper to determine if a row should have a gap (every 10th week)
  shouldHaveRowGap(weekIndex: number): boolean {
    return weekIndex % 10 === 0 && weekIndex > 0;
  }

  // Get month name from a date
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

// Event Modal for adding events
class ChronosEventModal extends Modal {
  plugin: ChronosTimelinePlugin;
  selectedDate: string = "";
  selectedColor: string = "#4CAF50";
  eventDescription: string = "";
  dateInput!: HTMLInputElement;
  selectedEventType: string = "Major Life";
  customEventName: string = "";
  // Removed colorPicker property as we're just tracking the color value now
  isCustomType: boolean = false;

  constructor(
    app: App,
    plugin: ChronosTimelinePlugin,
    preselectedDate: string | null = null
  ) {
    super(app);
    this.plugin = plugin;

    // If we have a preselected date, we need to format it properly
    if (preselectedDate) {
      // Check if it's in week format (YYYY-WWW)
      if (preselectedDate.includes("W")) {
        this.selectedDate = preselectedDate;
      } else {
        // Assume it's a regular date in YYYY-MM-DD format
        const date = new Date(preselectedDate);
        if (!isNaN(date.getTime())) {
          this.selectedDate = plugin.getWeekKeyFromDate(date);
        }
      }
    }
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Add Life Event" });

    // Date selector
    const dateContainer = contentEl.createDiv({
      cls: "chronos-date-picker-container",
    });
    dateContainer.createEl("h3", { text: "Select Date" });

    // Use date picker for specific date selection (YYYY-MM-DD)
    const dateSettingContainer = new Setting(contentEl)
      .setName("Date")
      .setDesc("Enter the specific date of the event");

    this.dateInput = dateSettingContainer.controlEl.createEl("input", {
      type: "date",
      value: this.selectedDate
        ? this.convertWeekToDate(this.selectedDate)
        : new Date().toISOString().split("T")[0],
    });

    // Add date change handler
    this.dateInput.addEventListener("change", (e) => {
      const specificDate = this.dateInput.value;
      if (specificDate) {
        const date = new Date(specificDate);
        this.selectedDate = this.plugin.getWeekKeyFromDate(date);
      }
    });

    // Add a small helper note
    contentEl.createEl("small", {
      text: "Select the exact date of your event. The system will automatically determine which week it belongs to.",
      cls: "chronos-helper-text",
    });

    // If date was preselected, show which week it corresponds to
    if (this.selectedDate) {
      contentEl.createEl("p", {
        text: `This date falls in week: ${this.selectedDate}`,
        cls: "chronos-helper-text",
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

    // Event Type Selection
    const eventTypeContainer = contentEl.createDiv();
    eventTypeContainer.createEl("h3", { text: "Event Type" });

    // Create radio buttons for event type selection
    const presetTypes = [
      { name: "Major Life", color: "#4CAF50" },
      { name: "Travel", color: "#2196F3" },
      { name: "Relationship", color: "#E91E63" },
      { name: "Education/Career", color: "#9C27B0" },
    ];

    // Preset types radio buttons
    const typeSettingContainer = new Setting(contentEl)
      .setName("Select Event Type")
      .setDesc("Choose from preset types or create your own");

    const radioContainer = typeSettingContainer.controlEl.createDiv({
      cls: "chronos-radio-container",
    });

    // Add preset types
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

      radioLabel.createEl("span", {
        text: type.name,
      });

      radioBtn.addEventListener("change", () => {
        if (radioBtn.checked) {
          this.selectedEventType = type.name;
          this.selectedColor = type.color;
          this.isCustomType = false;
          this.updateCustomTypeVisibility(contentEl, false);
        }
      });
    }

    // Add custom type option
    const customLabel = radioContainer.createEl("label", {
      cls: "chronos-radio-label",
    });

    const customRadio = customLabel.createEl("input") as HTMLInputElement;
    customRadio.type = "radio";
    customRadio.name = "eventType";
    customRadio.value = "custom";

    customLabel.createEl("span", {
      text: "Custom Type",
    });

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

    // Custom type name
    new Setting(customTypeSettings)
      .setName("Custom Type Name")
      .setDesc("Enter a name for your custom event type")
      .addText((text) =>
        text.setPlaceholder("Type name").onChange((value) => {
          this.customEventName = value;
        })
      );

    // Color picker for custom type
    new Setting(customTypeSettings)
      .setName("Custom Color")
      .setDesc("Select a color for this event type")
      .addColorPicker((picker) => {
        picker.setValue("#FF9800").onChange((value) => {
          this.selectedColor = value;
        });

        // We'll just store the color value instead of trying to access the element
        this.selectedColor = "#FF9800";
      });

    // Existing custom types
    if (this.plugin.settings.customEventTypes.length > 0) {
      const existingTypesContainer = contentEl.createDiv();
      existingTypesContainer.createEl("h3", { text: "Your Custom Types" });

      const typeList = existingTypesContainer.createEl("div", {
        cls: "chronos-custom-types-list",
      });

      for (const customType of this.plugin.settings.customEventTypes) {
        const typeItem = typeList.createEl("div", {
          cls: "chronos-custom-type-item",
        });

        const radioBtn = typeItem.createEl("input") as HTMLInputElement;
        radioBtn.type = "radio";
        radioBtn.name = "eventType";
        radioBtn.value = customType.name;

        const colorBox = typeItem.createEl("span", {
          cls: "chronos-color-box",
        });
        colorBox.style.backgroundColor = customType.color;

        typeItem.createEl("span", {
          text: customType.name,
        });

        radioBtn.addEventListener("change", () => {
          if (radioBtn.checked) {
            this.selectedEventType = customType.name;
            this.selectedColor = customType.color;
            this.isCustomType = false;
            this.updateCustomTypeVisibility(contentEl, false);
          }
        });
      }
    }

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

  // Helper to convert from week format to a date
  convertWeekToDate(weekKey: string): string {
    // Parse YYYY-WWW format
    const parts = weekKey.split("-W");
    if (parts.length !== 2) return "";

    const year = parseInt(parts[0]);
    const week = parseInt(parts[1]);

    // Create a date for Jan 1 of that year
    const date = new Date(year, 0, 1);

    // Get day of week for Jan 1
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Calculate days to add to get to the first day of the week
    // If first day is Monday (ISO standard)
    let daysToAdd = (week - 1) * 7;
    if (dayOfWeek <= 4) {
      // Thu or earlier
      daysToAdd += 1 - dayOfWeek; // Days since Monday
    } else {
      // Fri, Sat, Sun
      daysToAdd += 8 - dayOfWeek; // Days until next Monday
    }

    date.setDate(date.getDate() + daysToAdd);

    // Format as YYYY-MM-DD
    return date.toISOString().split("T")[0];
  }

  updateCustomTypeVisibility(contentEl: HTMLElement, show: boolean) {
    const customSettings = contentEl.querySelector(
      ".chronos-custom-type-settings"
    );
    if (customSettings) {
      customSettings.style.display = show ? "block" : "none";
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

    // If it's a custom type that doesn't exist yet, add it to settings
    if (this.isCustomType && this.customEventName) {
      // Check if this custom type already exists
      const existingTypeIndex = this.plugin.settings.customEventTypes.findIndex(
        (type) => type.name === this.customEventName
      );

      if (existingTypeIndex === -1) {
        // Add new custom type
        this.plugin.settings.customEventTypes.push({
          name: this.customEventName,
          color: this.selectedColor,
        });

        // Initialize empty event array for this type
        this.plugin.settings.customEvents[this.customEventName] = [];
      }

      // Set selected event type to the custom name
      this.selectedEventType = this.customEventName;
    }

    // Add event to appropriate array based on event type
    const eventData = `${this.selectedDate}:${this.eventDescription}`;

    // For preset types
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
        // For custom types
        if (!this.plugin.settings.customEvents[this.selectedEventType]) {
          this.plugin.settings.customEvents[this.selectedEventType] = [];
        }
        this.plugin.settings.customEvents[this.selectedEventType].push(
          eventData
        );
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
        const content = `# Event: ${this.eventDescription}\n\nDate: ${this.selectedDate}\nType: ${this.selectedEventType}\n\n## Notes\n\n`;
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

    // Add button to manage custom event types
    const manageTypesBtn = controlsEl.createEl("button", {
      text: "Manage Event Types",
    });
    manageTypesBtn.addEventListener("click", () => {
      // Open modal to manage custom event types
      this.showManageEventTypesModal();
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

    // Add custom event types to legend
    for (const customType of this.plugin.settings.customEventTypes) {
      const customLegendEl = legendEl.createEl("div", {
        cls: "chronos-legend-item",
      });
      const customColorEl = customLegendEl.createEl("div", {
        cls: "chronos-legend-color",
      });
      customColorEl.style.backgroundColor = customType.color;
      customLegendEl.createEl("span", { text: customType.name });
    }

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

  showManageEventTypesModal() {
    // Show modal to manage custom event types
    const modal = new ManageEventTypesModal(this.app, this.plugin);
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

    // Adjust the year labels to align with grid cells (fix alignment issue)
    for (let i = 0; i <= maxYears; i += 10) {
      const yearLabel = yearLabelsEl.createEl("div", {
        cls: "chronos-year-label",
        text: i.toString(),
      });

      // Position label properly to align with grid cells
      yearLabel.style.position = "absolute";
      // Adjust positioning - add offset for decade gaps
      const decadesPassed = Math.floor(i / 10);
      const decadeGapWidth = 18; // Width of gap between decades
      yearLabel.style.left = `${
        i * 18 + decadesPassed * decadeGapWidth + 40
      }px`;
    }

    // Create grid for the weeks
    const gridEl = container.createEl("div", { cls: "chronos-grid" });

    // Apply grid template styles with proper gaps
    gridEl.style.gridTemplateColumns = `repeat(${lifespan}, 18px)`;
    gridEl.style.gridTemplateRows = `repeat(52, 18px)`;
    gridEl.style.columnGap = "0px"; // We'll handle gaps with margins
    gridEl.style.rowGap = "0px"; // We'll handle gaps with margins

    // Add week numbers on the left
    const weekLabelsEl = container.createEl("div", {
      cls: "chronos-week-labels",
    });
    for (let week = 0; week < 52; week += 10) {
      if (week === 0) continue; // Skip first to align better
      const weekLabel = weekLabelsEl.createEl("div", {
        cls: "chronos-week-label",
        text: week.toString(),
      });
      // Position at the correct week
      weekLabel.style.position = "absolute";
      // Account for row gaps
      const rowGapsPassed = Math.floor(week / 10);
      const rowGapHeight = 8; // Height of gap between 10-week sections
      weekLabel.style.top = `${
        week * 18 + rowGapsPassed * rowGapHeight + 10
      }px`;
    }

    // Get event data from settings
    const greenEvents: string[] = this.plugin.settings.greenEvents;
    const blueEvents: string[] = this.plugin.settings.blueEvents;
    const pinkEvents: string[] = this.plugin.settings.pinkEvents;
    const purpleEvents: string[] = this.plugin.settings.purpleEvents;
    const customEvents = this.plugin.settings.customEvents;

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

        // Add class for first week of month and show month name
        if (this.plugin.isFirstWeekOfMonth(weekDate)) {
          cell.addClass("month-start");

          // Add month name as tooltip
          const monthName = this.plugin.getMonthName(weekDate);
          cell.setAttribute("title", `${monthName} ${weekDate.getFullYear()}`);

          // Add a small month indicator
          const monthIndicator = cell.createEl("div", {
            cls: "month-indicator",
            text: this.plugin.getMonthName(weekDate).substring(0, 1),
          });
          monthIndicator.style.position = "absolute";
          monthIndicator.style.fontSize = "8px";
          monthIndicator.style.top = "1px";
          monthIndicator.style.left = "1px";
          monthIndicator.style.opacity = "0.7";
        }

        // Apply gap classes for visual organization
        if (this.plugin.shouldHaveRowGap(week)) {
          cell.addClass("row-gap");
        }

        // Position the cell in the grid (weeks as rows, years as columns)
        cell.style.gridRow = `${week + 1}`;
        cell.style.gridColumn = `${year + 1}`;

        // Apply extra margin for decade columns
        if (isDecadeStart) {
          cell.style.marginLeft = "18px"; // Add extra gap for decade separation
        }

        // Apply extra margin for every 10th week
        if (this.plugin.shouldHaveRowGap(week)) {
          cell.style.marginTop = "8px"; // Add extra gap for 10-week separation
        }

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

        // For custom events
        for (const [typeName, events] of Object.entries(customEvents)) {
          if (events.some((event) => event.startsWith(weekKey))) {
            // Find the color for this custom event type
            const customType = this.plugin.settings.customEventTypes.find(
              (type) => type.name === typeName
            );

            if (customType) {
              cell.style.backgroundColor = customType.color;
              cell.addClass("event");

              // Add tooltip with event description
              const event = events.find((e) => e.startsWith(weekKey));
              if (event) {
                const description = event.split(":")[1] || typeName;
                cell.setAttribute("title", `${description} (${typeName})`);
              }
            }
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

// Modal for managing custom event types
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

    // Section for adding new event type
    const addSection = contentEl.createDiv({
      cls: "event-type-add-section",
    });

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

      // Check if this name already exists
      if (
        this.plugin.settings.customEventTypes.some((type) => type.name === name)
      ) {
        new Notice("An event type with this name already exists");
        return;
      }

      // Add new type
      this.plugin.settings.customEventTypes.push({
        name: name,
        color: colorInput.value,
      });

      // Initialize empty event array
      this.plugin.settings.customEvents[name] = [];

      this.plugin.saveSettings().then(() => {
        new Notice(`Event type "${name}" added`);

        // Refresh the list
        this.renderExistingTypes(contentEl);

        // Clear inputs
        nameInput.value = "";
      });
    });

    // Section for existing types
    const existingSection = contentEl.createDiv({
      cls: "event-type-existing-section",
    });

    existingSection.createEl("h3", { text: "Existing Event Types" });

    this.renderExistingTypes(existingSection);

    // Close button
    const closeButton = contentEl.createEl("button", {
      text: "Close",
      cls: "close-button",
    });

    closeButton.addEventListener("click", () => {
      this.close();

      // Refresh the timeline view
      this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE).forEach((leaf) => {
        const view = leaf.view as ChronosTimelineView;
        view.renderView();
      });
    });
  }

  renderExistingTypes(container: HTMLElement) {
    // Clear existing list
    const typesList = container.querySelector(".existing-types-list");
    if (typesList) {
      typesList.remove();
    }

    // Create new list
    const newList = container.createEl("div", {
      cls: "existing-types-list",
    });

    // Add built-in types with note that they can't be edited
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

      const colorBox = typeItem.createEl("span", {
        cls: "event-type-color",
      });
      colorBox.style.backgroundColor = type.color;

      typeItem.createEl("span", {
        text: type.name,
        cls: "event-type-name",
      });
    }

    // Add custom types
    if (this.plugin.settings.customEventTypes.length > 0) {
      newList.createEl("p", {
        text: "Your custom types",
        cls: "custom-types-note",
      });

      for (const type of this.plugin.settings.customEventTypes) {
        const typeItem = newList.createEl("div", {
          cls: "event-type-item custom",
        });

        const colorBox = typeItem.createEl("span", {
          cls: "event-type-color",
        });
        colorBox.style.backgroundColor = type.color;

        typeItem.createEl("span", {
          text: type.name,
          cls: "event-type-name",
        });

        // Edit button
        const editButton = typeItem.createEl("button", {
          text: "Edit",
          cls: "edit-type-button",
        });

        editButton.addEventListener("click", () => {
          this.showEditTypeModal(type);
        });

        // Delete button
        const deleteButton = typeItem.createEl("button", {
          text: "Delete",
          cls: "delete-type-button",
        });

        deleteButton.addEventListener("click", () => {
          // Confirm deletion
          if (
            confirm(
              `Are you sure you want to delete the event type "${type.name}"? All events of this type will also be deleted.`
            )
          ) {
            // Remove type from settings
            this.plugin.settings.customEventTypes =
              this.plugin.settings.customEventTypes.filter(
                (t) => t.name !== type.name
              );

            // Remove events for this type
            delete this.plugin.settings.customEvents[type.name];

            this.plugin.saveSettings().then(() => {
              new Notice(`Event type "${type.name}" deleted`);

              // Refresh the list
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

    // Name input
    const nameContainer = contentEl.createDiv({
      cls: "edit-name-container",
    });

    const nameLabel = nameContainer.createEl("label");
    nameLabel.textContent = "Name";
    nameLabel.htmlFor = "edit-type-name";

    const nameInput = nameContainer.createEl("input") as HTMLInputElement;
    nameInput.type = "text";
    nameInput.value = type.name;
    nameInput.id = "edit-type-name";

    // Color input
    const colorContainer = contentEl.createDiv({
      cls: "edit-color-container",
    });

    const colorLabel = colorContainer.createEl("label");
    colorLabel.textContent = "Color";
    colorLabel.htmlFor = "edit-type-color";

    const colorInput = colorContainer.createEl("input") as HTMLInputElement;
    colorInput.type = "color";
    colorInput.value = type.color;
    colorInput.id = "edit-type-color";

    // Save button
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

      // Check if this name already exists and isn't the current name
      if (
        newName !== type.name &&
        this.plugin.settings.customEventTypes.some((t) => t.name === newName)
      ) {
        new Notice("An event type with this name already exists");
        return;
      }

      // If name changed, need to update events array
      if (newName !== type.name) {
        // Create array for new name
        this.plugin.settings.customEvents[newName] =
          this.plugin.settings.customEvents[type.name] || [];

        // Delete old array
        delete this.plugin.settings.customEvents[type.name];
      }

      // Update type in settings
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

          // Refresh the types list
          this.renderExistingTypes(this.contentEl);
        });
      }
    });

    // Cancel button
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
    const { contentEl } = this;
    contentEl.empty();
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

    // Event Types Management
    containerEl.createEl("h3", { text: "Event Types" });

    // Button to manage event types
    new Setting(containerEl)
      .setName("Manage Event Types")
      .setDesc("Create, edit, or delete custom event types")
      .addButton((button) => {
        button.setButtonText("Manage Types").onClick(() => {
          const modal = new ManageEventTypesModal(this.app, this.plugin);
          modal.open();
        });
      });

    // Events management
    containerEl.createEl("h3", { text: "Clear Event Data" });

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

    // Clear Custom Events
    if (this.plugin.settings.customEventTypes.length > 0) {
      new Setting(containerEl)
        .setName("Custom Events")
        .setDesc("Clear events for custom event types")
        .addButton((button) => {
          button.setButtonText("Clear All Custom Events").onClick(async () => {
            // Reset all custom events but keep the types
            this.plugin.settings.customEvents = {};

            // Re-initialize empty arrays for each type
            for (const type of this.plugin.settings.customEventTypes) {
              this.plugin.settings.customEvents[type.name] = [];
            }

            await this.plugin.saveSettings();
            this.refreshAllViews();
            new Notice("Cleared all custom events");
          });
        });
    }

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
