"use strict";

var obsidian = require("obsidian");

const TIMELINE_VIEW_TYPE = "chronos-timeline-view";
// Set default settings
const DEFAULT_SETTINGS = {
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

class ChronosTimelinePlugin extends obsidian.Plugin {
  settings = DEFAULT_SETTINGS;
  async onload() {
    console.log("Loading ChronOS Timeline Plugin");
    // Add chronos icon to Obsidian
    obsidian.addIcon("chronos-icon", chronosIcon);
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
    if (!this.settings.customEventTypes) this.settings.customEventTypes = [];
    if (!this.settings.customEvents) this.settings.customEvents = {};
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
  getFullWeekAge(birthday, today) {
    const diffMs = today.getTime() - birthday.getTime();
    const msPerWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diffMs / msPerWeek);
  }
  getFullPath(fileName) {
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
      if (existingFile instanceof obsidian.TFile) {
        // Open existing file
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
        // Create new file with template
        const content = `# Week ${weekNum}, ${year}\n\n## Reflections\n\n## Tasks\n\n## Notes\n`;
        const newFile = await this.app.vault.create(fullPath, content);
        await this.app.workspace.getLeaf().openFile(newFile);
      }
    } catch (error) {
      new obsidian.Notice(`Error creating week note: ${error}`);
    }
  }
  getISOWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Set to nearest Thursday (to match ISO 8601 week start)
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    // Get first day of the year
    const yearStart = new Date(d.getFullYear(), 0, 1);
    // Calculate full weeks between year start and current date
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
  // Get the week key (YYYY-WXX) from a specific date
  getWeekKeyFromDate(date) {
    const year = date.getFullYear();
    const weekNum = this.getISOWeekNumber(date);
    return `${year}-W${weekNum.toString().padStart(2, "0")}`;
  }
}

// Event Modal for adding events
class ChronosEventModal extends obsidian.Modal {
  plugin;
  selectedDate = "";
  selectedColor = "#4CAF50";
  eventDescription = "";
  dateInput;
  selectedEventType = "Major Life";
  customEventName = "";
  isCustomType = false;

  constructor(app, plugin, preselectedDate = null) {
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
  convertWeekToDate(weekKey) {
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
    const dateSetting = new obsidian.Setting(contentEl)
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
    new obsidian.Setting(contentEl)
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
    const typeSettingContainer = new obsidian.Setting(contentEl)
      .setName("Select Event Type")
      .setDesc("Choose a preset type or create your own");
    const radioContainer = typeSettingContainer.controlEl.createDiv({
      cls: "chronos-radio-container",
    });
    for (const type of presetTypes) {
      const radioLabel = radioContainer.createEl("label", {
        cls: "chronos-radio-label",
      });
      const radioBtn = radioLabel.createEl("input");
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
    const customRadio = customLabel.createEl("input");
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
    new obsidian.Setting(customTypeSettings)
      .setName("Custom Type Name")
      .setDesc("Enter a name for your custom event type")
      .addText((text) =>
        text.setPlaceholder("Type name").onChange((value) => {
          this.customEventName = value;
        })
      );
    new obsidian.Setting(customTypeSettings)
      .setName("Custom Color")
      .setDesc("Select a color for this event type")
      .addColorPicker((picker) => {
        picker.setValue("#FF9800").onChange((value) => {
          this.selectedColor = value;
        });
        this.selectedColor = "#FF9800";
      });

    // Save button
    new obsidian.Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Save Event")
        .setCta()
        .onClick(() => {
          this.saveEvent();
        })
    );
  }

  updateCustomTypeVisibility(contentEl, show) {
    const customSettings = contentEl.querySelector(
      ".chronos-custom-type-settings"
    );
    if (customSettings) {
      customSettings.style.display = show ? "block" : "none";
    }
  }

  saveEvent() {
    if (!this.selectedDate && this.dateInput) {
      new obsidian.Notice("Please select a date");
      return;
    }
    if (!this.eventDescription) {
      new obsidian.Notice("Please add a description");
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
      new obsidian.Notice(`Event added: ${this.eventDescription}`);
      const fileName = `${weekKey.replace("W", "-W")}.md`;
      const fullPath = this.plugin.getFullPath(fileName);
      const fileExists =
        this.app.vault.getAbstractFileByPath(fullPath) instanceof
        obsidian.TFile;
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
        const view = leaf.view;
        view.renderView();
      });
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

// Main Timeline View class
class ChronosTimelineView extends obsidian.ItemView {
  plugin;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return TIMELINE_VIEW_TYPE;
  }
  getDisplayText() {
    return "ChronOS Timeline";
  }
  getIcon() {
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
    // Plan future event button
    const futureEventBtn = controlsEl.createEl("button", {
      text: "Plan Future Event",
    });
    futureEventBtn.addEventListener("click", () => {
      this.showAddEventModal();
    });
    // Manage event types button
    const manageTypesBtn = controlsEl.createEl("button", {
      text: "Manage Event Types",
    });
    manageTypesBtn.addEventListener("click", () => {
      const modal = new ManageEventTypesModal(this.app, this.plugin);
      modal.open();
    });
    // Add a button to show settings
    const settingsBtn = controlsEl.createEl("button", { text: "Settings" });
    settingsBtn.addEventListener("click", () => {
      // Open settings directly
      new ChronosSettingTab(this.app, this.plugin).display();
    });
    // Create the view container
    const viewEl = contentEl.createEl("div", { cls: "chronos-view" });
    // We now always use weeks view which is what the poster shows
    this.renderWeeksGrid(viewEl);
    // Create legend
    const legendEl = contentEl.createEl("div", { cls: "chronos-legend" });
    // Standard event types for legend
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
    // Render custom event type legends
    if (this.plugin.settings.customEventTypes) {
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

  renderWeeksGrid(container) {
    container.empty();

    // Get the CSS variables for positioning and styling
    const root = document.documentElement;
    const cellSize =
      parseInt(getComputedStyle(root).getPropertyValue("--cell-size")) || 16;
    const cellGap =
      parseInt(getComputedStyle(root).getPropertyValue("--cell-gap")) || 2;
    const leftOffset =
      parseInt(getComputedStyle(root).getPropertyValue("--left-offset")) || 50;
    const topOffset =
      parseInt(getComputedStyle(root).getPropertyValue("--top-offset")) || 50;

    // Define our new spacing constants
    const decadeGap = 8; // Extra gap between decades (every 10 years)
    const weekGap = 8; // Extra gap after every 10 weeks

    // Create decade markers container (horizontal markers above the grid)
    const decadeMarkersContainer = container.createEl("div", {
      cls: "chronos-decade-markers",
    });

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

      // Position each decade marker
      marker.style.position = "absolute";

      // Special adjustment for the last marker (90 years)
      let leftPosition = decade * (cellSize + cellGap) + cellSize / 2;
      if (decade === 90) {
        // Adjust the 90-year marker position to align properly
        leftPosition -= 18; // More significant correction for the 90-year marker
      }

      marker.style.left = `${leftPosition}px`;
      marker.style.top = `${topOffset / 2}px`;
      marker.style.transform = "translate(-50%, -50%)";
    }

    // Create week markers container (vertical markers to the left of the grid)
    const weekMarkersContainer = container.createEl("div", {
      cls: "chronos-week-markers",
    });

    // Add week markers (10, 20, 30, 40, 50)
    for (let week = 0; week <= 50; week += 10) {
      if (week === 0) continue; // Skip 0 to start with 10
      const marker = weekMarkersContainer.createEl("div", {
        cls: "chronos-week-marker",
        text: week.toString(),
      });

      // Position each week marker
      marker.style.position = "absolute";
      marker.style.right = "10px";

      // Move up by 1 block by subtracting (cellSize + cellGap)
      marker.style.top = `${
        week * (cellSize + cellGap) + cellSize / 2 - (cellSize + cellGap)
      }px`;
      marker.style.transform = "translateY(-50%)";
      marker.style.textAlign = "right";
    }

    // Create the grid with absolute positioning
    const gridEl = container.createEl("div", { cls: "chronos-grid" });
    gridEl.style.display = "grid";
    gridEl.style.gridGap = "var(--cell-gap)";
    gridEl.style.gridTemplateColumns = `repeat(${this.plugin.settings.lifespan}, var(--cell-size))`;
    gridEl.style.gridTemplateRows = `repeat(52, var(--cell-size))`;
    gridEl.style.position = "absolute";
    gridEl.style.top = `${topOffset}px`;
    gridEl.style.left = `${leftOffset}px`;

    const now = new Date();
    const birthdayDate = new Date(this.plugin.settings.birthday);
    const ageInWeeks = this.plugin.getFullWeekAge(birthdayDate, now);

    // Get event data from settings
    const greenEvents = this.plugin.settings.greenEvents || [];
    const blueEvents = this.plugin.settings.blueEvents || [];
    const pinkEvents = this.plugin.settings.pinkEvents || [];
    const purpleEvents = this.plugin.settings.purpleEvents || [];
    const customEvents = this.plugin.settings.customEvents || {};

    // For each year, create a column of weeks
    for (let week = 0; week < 52; week++) {
      for (let year = 0; year < this.plugin.settings.lifespan; year++) {
        const weekIndex = year * 52 + week;
        const cell = gridEl.createEl("div", { cls: "chronos-grid-cell" });

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

        // Apply event styling
        this.applyEventStyling(cell, weekKey);

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
          if (existingFile instanceof obsidian.TFile) {
            // Open existing file
            await this.app.workspace.getLeaf().openFile(existingFile);
          } else {
            // Create new file with template
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
  }

  applyEventStyling(cell, weekKey) {
    // Apply preset event styles
    const applyPreset = (arr, defaultColor, defaultDesc) => {
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

    // For custom events, loop through each event type
    if (this.plugin.settings.customEvents) {
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
    }

    // Highlight future events
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
}

// Modal for Managing Custom Event Types
class ManageEventTypesModal extends obsidian.Modal {
  plugin;

  constructor(app, plugin) {
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
        new obsidian.Notice("Please enter a name for the event type");
        return;
      }
      if (
        this.plugin.settings.customEventTypes.some((type) => type.name === name)
      ) {
        new obsidian.Notice("An event type with this name already exists");
        return;
      }
      this.plugin.settings.customEventTypes.push({
        name: name,
        color: colorInput.value,
      });
      this.plugin.settings.customEvents[name] = [];
      this.plugin.saveSettings().then(() => {
        new obsidian.Notice(`Event type "${name}" added`);
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
        const view = leaf.view;
        view.renderView();
      });
    });
  }

  renderExistingTypes(container) {
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
              new obsidian.Notice(`Event type "${type.name}" deleted`);
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

  showEditTypeModal(type) {
    const modal = new obsidian.Modal(this.app);
    modal.titleEl.setText(`Edit Event Type: ${type.name}`);
    const contentEl = modal.contentEl;
    const nameContainer = contentEl.createDiv({ cls: "edit-name-container" });
    const nameLabel = nameContainer.createEl("label");
    nameLabel.textContent = "Name";
    nameLabel.htmlFor = "edit-type-name";
    const nameInput = nameContainer.createEl("input");
    nameInput.type = "text";
    nameInput.value = type.name;
    nameInput.id = "edit-type-name";
    const colorContainer = contentEl.createDiv({ cls: "edit-color-container" });
    const colorLabel = colorContainer.createEl("label");
    colorLabel.textContent = "Color";
    colorLabel.htmlFor = "edit-type-color";
    const colorInput = colorContainer.createEl("input");
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
        new obsidian.Notice("Please enter a name for the event type");
        return;
      }
      if (
        newName !== type.name &&
        this.plugin.settings.customEventTypes.some((t) => t.name === newName)
      ) {
        new obsidian.Notice("An event type with this name already exists");
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
          new obsidian.Notice(`Event type updated to "${newName}"`);
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
    const { contentEl } = this;
    contentEl.empty();
  }
}

// Settings tab
class ChronosSettingTab extends obsidian.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h1", { text: "ChronOS Timeline Settings" });
    containerEl.createEl("p", {
      text: "Customize your life timeline visualization.",
    });
    // Birthday setting
    new obsidian.Setting(containerEl)
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
    new obsidian.Setting(containerEl)
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
    new obsidian.Setting(containerEl)
      .setName("Notes Folder")
      .setDesc("Where to store week notes (leave empty for vault root)")
      .addText((text) =>
        text
          .setPlaceholder("ChronOS Notes")
          .setValue(this.plugin.settings.notesFolder || "")
          .onChange(async (value) => {
            this.plugin.settings.notesFolder = value;
            await this.plugin.saveSettings();
          })
      );

    // Quote setting
    new obsidian.Setting(containerEl)
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
    new obsidian.Setting(containerEl)
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
    new obsidian.Setting(containerEl)
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
    new obsidian.Setting(containerEl)
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

    // Event types management
    containerEl.createEl("h3", { text: "Event Types" });
    new obsidian.Setting(containerEl)
      .setName("Manage Event Types")
      .setDesc("Create, edit, or delete custom event types")
      .addButton((button) => {
        button.setButtonText("Manage Types").onClick(() => {
          const modal = new ManageEventTypesModal(this.app, this.plugin);
          modal.open();
        });
      });

    // Clear event data section
    containerEl.createEl("h3", { text: "Clear Event Data" });
    // Green events (Major Life Events)
    new obsidian.Setting(containerEl)
      .setName("Major Life Events")
      .setDesc("Weeks marked as Major Life Events")
      .addButton((button) => {
        button.setButtonText("Clear All").onClick(async () => {
          this.plugin.settings.greenEvents = [];
          await this.plugin.saveSettings();
          this.refreshAllViews();
          new obsidian.Notice("Cleared all Major Life Events");
        });
      });
    // Blue events (Travel)
    new obsidian.Setting(containerEl)
      .setName("Travel Events")
      .setDesc("Weeks marked as Travel")
      .addButton((button) => {
        button.setButtonText("Clear All").onClick(async () => {
          this.plugin.settings.blueEvents = [];
          await this.plugin.saveSettings();
          this.refreshAllViews();
          new obsidian.Notice("Cleared all Travel Events");
        });
      });
    // Pink events (Relationships)
    new obsidian.Setting(containerEl)
      .setName("Relationship Events")
      .setDesc("Weeks marked as Relationships")
      .addButton((button) => {
        button.setButtonText("Clear All").onClick(async () => {
          this.plugin.settings.pinkEvents = [];
          await this.plugin.saveSettings();
          this.refreshAllViews();
          new obsidian.Notice("Cleared all Relationship Events");
        });
      });
    // Purple events (Education/Career)
    new obsidian.Setting(containerEl)
      .setName("Education/Career Events")
      .setDesc("Weeks marked as Education/Career")
      .addButton((button) => {
        button.setButtonText("Clear All").onClick(async () => {
          this.plugin.settings.purpleEvents = [];
          await this.plugin.saveSettings();
          this.refreshAllViews();
          new obsidian.Notice("Cleared all Education/Career Events");
        });
      });

    // Custom events clear button
    if (
      this.plugin.settings.customEventTypes &&
      this.plugin.settings.customEventTypes.length > 0
    ) {
      new obsidian.Setting(containerEl)
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
            new obsidian.Notice("Cleared all custom events");
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
      const view = leaf.view;
      view.renderView();
    });
  }
}

module.exports = ChronosTimelinePlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOlsiUGx1Z2luIiwiYWRkSWNvbiIsIlRGaWxlIiwiTm90aWNlIiwiTW9kYWwiLCJTZXR0aW5nIiwiSXRlbVZpZXciLCJQbHVnaW5TZXR0aW5nVGFiIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFhQSxNQUFNLGtCQUFrQixHQUFHLHVCQUF1QixDQUFDO0FBaUJuRDtBQUNBLE1BQU0sZ0JBQWdCLEdBQW9CO0FBQ3hDLElBQUEsUUFBUSxFQUFFLFlBQVk7QUFDdEIsSUFBQSxRQUFRLEVBQUUsRUFBRTtBQUNaLElBQUEsV0FBVyxFQUFFLE9BQU87QUFDcEIsSUFBQSxhQUFhLEVBQUUsU0FBUztBQUN4QixJQUFBLGdCQUFnQixFQUFFLFNBQVM7QUFDM0IsSUFBQSxlQUFlLEVBQUUsU0FBUztBQUMxQixJQUFBLFdBQVcsRUFBRSxFQUFFO0FBQ2YsSUFBQSxVQUFVLEVBQUUsRUFBRTtBQUNkLElBQUEsVUFBVSxFQUFFLEVBQUU7QUFDZCxJQUFBLFlBQVksRUFBRSxFQUFFO0FBQ2hCLElBQUEsS0FBSyxFQUFFLCtCQUErQjtDQUN2QyxDQUFDO0FBRUY7QUFDQSxNQUFNLFdBQVcsR0FBRyxDQUFBOzs7OztXQUtULENBQUM7QUFFUyxNQUFBLHFCQUFzQixTQUFRQSxlQUFNLENBQUE7SUFDdkQsUUFBUSxHQUFvQixnQkFBZ0IsQ0FBQztBQUU3QyxJQUFBLE1BQU0sTUFBTSxHQUFBO0FBQ1YsUUFBQSxPQUFPLENBQUMsR0FBRyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7O0FBRy9DLFFBQUFDLGdCQUFPLENBQUMsY0FBYyxFQUFFLFdBQVcsQ0FBQyxDQUFDOztBQUdyQyxRQUFBLE1BQU0sSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDOztBQUcxQixRQUFBLElBQUksQ0FBQyxZQUFZLENBQ2Ysa0JBQWtCLEVBQ2xCLENBQUMsSUFBSSxLQUFLLElBQUksbUJBQW1CLENB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
