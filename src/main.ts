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

<<<<<<< HEAD
// Extend settings interface to support custom events.
=======
// Define the interface for custom event types
interface CustomEventType {
  name: string;
  color: string;
}

// Define the interface for plugin settings
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
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
<<<<<<< HEAD
  customEvents: string[]; // New: stores events created via custom event type. Format: "weekKey:description|color|label"
=======
  // Add custom event types
  customEventTypes: CustomEventType[];
  customEvents: { [key: string]: string[] }; // Key is the event type name, value is array of events
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
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
<<<<<<< HEAD
  customEvents: [],
=======
  customEventTypes: [],
  customEvents: {},
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
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

<<<<<<< HEAD
=======
  // Get the week key (YYYY-WWW) from a specific date
  getWeekKeyFromDate(date: Date): string {
    const year = date.getFullYear();
    const weekNum = this.getISOWeekNumber(date);
    return `${year}-W${weekNum.toString().padStart(2, "0")}`;
  }

  // Helper to check if a week is the first of the month
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
  isFirstWeekOfMonth(date: Date): boolean {
    const checkDate = new Date(date);
    const currentMonth = checkDate.getMonth();
    checkDate.setDate(checkDate.getDate() - 7);
    return checkDate.getMonth() !== currentMonth;
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

<<<<<<< HEAD
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
=======
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
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a

  constructor(
    app: App,
    plugin: ChronosTimelinePlugin,
    preselectedDate: string | null = null
  ) {
    super(app);
    this.plugin = plugin;
<<<<<<< HEAD
    this.selectedDate = selectedDate;
=======

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
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

<<<<<<< HEAD
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
=======
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
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
        cls: "chronos-helper-text",
      });
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

<<<<<<< HEAD
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
=======
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
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
    });
    customTypeSettings.style.display = "none";

<<<<<<< HEAD
    // ── SAVE BUTTON ──
    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText(
          titleText.includes("Plan") ? "Save Future Event" : "Save Event"
        )
=======
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
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
        .setCta()
        .onClick(() => {
          this.saveEvent(customLabelInput.value, customColorInput.value);
        })
    );
  }

<<<<<<< HEAD
  updateSelectedButton(setting: Setting, selectedBtn: HTMLElement) {
    if (setting.settingEl) {
      setting.settingEl.querySelectorAll("button").forEach((btn) => {
        (btn as HTMLElement).style.border = "none";
      });
      selectedBtn.style.border = "2px solid white";
=======
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
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
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

<<<<<<< HEAD
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
=======
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
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
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

    // Save settings and notify
    this.plugin.saveSettings().then(() => {
<<<<<<< HEAD
      const noticeText =
        this.selectedColor === "custom"
          ? `Custom event added: ${this.eventDescription}`
          : `Event added: ${this.eventDescription}`;
      new Notice(noticeText);
=======
      new Notice(`Event added: ${this.eventDescription}`);
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a

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
<<<<<<< HEAD
        let content = "";
        if (eventDate > new Date()) {
          content = `# Future Event: ${this.eventDescription}\n\nPlanned Date: ${eventDateStr}\nType: ${this.selectedColor}\n\n## Planning Notes\n\n`;
        } else {
          content = `# Event: ${this.eventDescription}\n\nDate: ${eventDateStr}\nType: ${this.selectedColor}\n\n## Notes\n\n`;
        }
=======

        // Create the file with event description
        const content = `# Event: ${this.eventDescription}\n\nDate: ${this.selectedDate}\nType: ${this.selectedEventType}\n\n## Notes\n\n`;
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
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
<<<<<<< HEAD
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
=======

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
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
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

<<<<<<< HEAD
    const tipsEl = contentEl.createEl("div", { cls: "chronos-tips" });
    tipsEl.style.fontSize = "12px";
    tipsEl.style.color = "var(--text-muted)";
    tipsEl.style.textAlign = "center";
    tipsEl.style.margin = "10px 0";
    tipsEl.createEl("p", {
      text: "Tip: Click any week to create or open a note. Shift+Click to add an event.",
    });
=======
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
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
    contentEl.createEl("div", {
      cls: "chronos-footer",
      text: this.plugin.settings.quote,
    });
  }

  showAddEventModal() {
    const modal = new ChronosEventModal(this.app, this.plugin);
    modal.open();
  }

<<<<<<< HEAD
  // ── Updated renderWeeksGrid with dynamic grid templates, extra gaps, and proper cell positioning ──
=======
  showManageEventTypesModal() {
    // Show modal to manage custom event types
    const modal = new ManageEventTypesModal(this.app, this.plugin);
    modal.open();
  }

>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
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

<<<<<<< HEAD
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
=======
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
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
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

<<<<<<< HEAD
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
=======
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
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
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
<<<<<<< HEAD
    cell.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const modal = new ChronosEventModal(this.app, this.plugin, weekKey);
      modal.open();
    });
  }
=======

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
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
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

<<<<<<< HEAD
    containerEl.createEl("h3", { text: "Events" });
=======
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
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
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

<<<<<<< HEAD
=======
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
>>>>>>> f250daeeeab362fb9ff174ee143dda0897cb4b3a
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
