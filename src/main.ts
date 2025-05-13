/**
 * Chronica - Life in Frames Plugin for Obsidian
 *
 * A powerful visualization tool to track your life in weeks, inspired by
 * the "Life in Weeks" concept. Allows tracking of major life events,
 * reflections, and plans across multiple time scales.
 */

import {
  App,
  ItemView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  TAbstractFile,
  WorkspaceLeaf,
  addIcon,
  setIcon,
  AbstractInputSuggest,
} from "obsidian";

// -----------------------------------------------------------------------
// CONSTANTS & TYPE DEFINITIONS
// -----------------------------------------------------------------------

/** Unique identifier for the timeline view */
const TIMELINE_VIEW_TYPE = "chronica-timeline-view";

/** Interface for a single event type definition */
interface ChronicaEventType {
  /** Stable, unique identifier (e.g., 'preset_major_life', 'custom_1678886400000') */
  id: string;
  /** User-editable display name */
  name: string;
  /** User-editable color (hex format) */
  color: string;
  /** Indicates if this was one of the original preset types (cannot be deleted) */
  isPreset: boolean;
}

/** Interface for a single recorded event instance */ interface ChronicaEvent {
  /** The week key (YYYY-WXX) the event starts on */
  weekKey: string;
  /** Optional end week key for range events */
  endWeekKey?: string;
  /** User set name for an event */
  name?: string;
  /** User-provided description/name of the event instance */
  description: string;
  /** The unique ID linking to the ChronicaEventType */
  typeId: string;
  /** Optional: Path to the note associated with this event */
  notePath?: string;
  /** Optional: Precise start date of the event in YYYY-MM-DD format from frontmatter */
  actualStartDate?: string;
  /** Optional: Precise end date of the event in YYYY-MM-DD format from frontmatter, if a range */
  actualEndDate?: string;
}

/** Interface for plugin settings */
interface ChornicaSettings {
  /** User's date of birth in YYYY-MM-DD format */
  birthday: string;
  /** Maximum age to display on timeline (in years) */
  lifespan: number;
  /** Default view mode (remains, but might be less relevant later) */
  defaultView: string;
  /** Cell shape variants */
  cellShape: "square" | "circle" | "diamond";
  /** Grid orientation - landscape (default) or portrait */
  gridOrientation: "landscape" | "portrait";
  /** Color for past weeks */
  pastCellColor: string;
  /** Color for present week */
  presentCellColor: string;
  /** Color for future weeks */
  futureCellColor: string;

  // --- NEW UNIFIED EVENT TYPE STORAGE ---
  /** Array containing all event type definitions (presets and custom) */
  eventTypes: ChronicaEventType[];
  /** Array containing all recorded event instances */
  events: ChronicaEvent[];

  // --- OLD EVENT STORAGE (will be migrated/removed) ---
  /** @deprecated Use events array with typeId instead */
  greenEvents?: string[]; // Marked as optional for migration
  /** @deprecated Use events array with typeId instead */
  blueEvents?: string[]; // Marked as optional for migration
  /** @deprecated Use events array with typeId instead */
  pinkEvents?: string[]; // Marked as optional for migration
  /** @deprecated Use events array with typeId instead */
  purpleEvents?: string[]; // Marked as optional for migration
  /** @deprecated Use eventTypes array instead */
  customEventTypes?: CustomEventType[]; // Marked as optional for migration
  /** @deprecated Use events array with typeId instead */
  customEvents?: Record<string, string[]>; // Marked as optional for migration

  /** Inspirational quote to display at the bottom */
  quote: string;
  /** Folder to store week notes (empty for vault root) */
  notesFolder: string;
  /** Show decade markers */
  showDecadeMarkers: boolean;
  /** Show week markers */
  showWeekMarkers: boolean;
  /** Show month markers */
  showMonthMarkers: boolean;
  /** Show birthday cake marker */
  showBirthdayMarker: boolean;
  /** Month marker frequency */
  monthMarkerFrequency: "all" | "quarter" | "half-year" | "year";
  /** Enable manual fill mode */
  enableManualFill: boolean;
  /** Enable auto-fill mode */
  enableAutoFill: boolean;
  /** Day of week for auto-fill (0-6, where 0 is Sunday) */
  autoFillDay: number;
  /** Weeks that have been filled */
  filledWeeks: string[];
  /** Start week on Monday (vs Sunday) */
  startWeekOnMonday: boolean;
  /** Current zoom level (1.0 is default, higher values = larger cells) */
  zoomLevel: number;
  /** Whether to automatically fit the grid to the screen when opening the view */
  defaultFitToScreen: boolean;
  /** Whether the sidebar is open */
  isSidebarOpen: boolean; // Note: Renamed from class property for clarity
  /** Whether the stats panel is open */
  isStatsOpen: boolean;
  /** Active tab in the stats panel */
  activeStatsTab: string;
  /** Height of the stats panel in pixels */
  statsPanelHeight: number;
  /** Horizontal offset of the stats panel from center (in pixels) */
  statsPanelHorizontalOffset: number;
  /** Width of the stats panel in pixels */
  statsPanelWidth: number;
  /** Custom week note naming template */
  weekNoteTemplate: string;
  /** Custom event note naming template */
  eventNoteTemplate: string;
  /** Custom range event naming template */
  rangeNoteTemplate: string;
  /** Whether to use separate folders for week and event notes */
  useSeparateFolders: boolean;
  /** Folder to store event notes (empty for vault root) */
  eventNotesFolder: string;
  /** Whether the user has seen the welcome screen */
  hasSeenWelcome: boolean;
  /** Whether user has completed folder selection on first cell‐click */
  hasSeenFolders: boolean;
  /** Ability to change color for manual filling cells */
  manualFillColor: string;
  /** Tool tip for hover cell */
  tooltipDetailLevel: "expanded" | "compact";
  /** Enables showing note previews in the tooltip */
  enableTooltipNotePreview: boolean;
  /** Version number to track settings migrations */
  settingsVersion?: number; // Added for migration tracking
}

/** Interface for custom event types */
interface CustomEventType {
  /** Name of the custom event type */
  name: string;

  /** Color code for the event type (hex format) */
  color: string;
}

/**
 * Suggest-modal that lists every vault folder path.
 */
class FolderSuggest extends AbstractInputSuggest<string> {
  public inputEl: HTMLInputElement;
  private plugin: ChornicaTimelinePlugin;

  constructor(
    app: App,
    inputEl: HTMLInputElement,
    plugin: ChornicaTimelinePlugin
  ) {
    super(app, inputEl);
    this.inputEl = inputEl;
    this.plugin = plugin;
  }

  getSuggestions(query: string): string[] {
    const results: string[] = [];
    const traverse = (folder: TFolder) => {
      results.push(folder.path);
      folder.children.forEach((child: TAbstractFile) => {
        if (child instanceof TFolder) {
          traverse(child);
        }
      });
    };
    traverse(this.app.vault.getRoot());
    return results.filter((f) => f.toLowerCase().includes(query.toLowerCase()));
  }

  renderSuggestion(item: string, el: HTMLElement): void {
    el.createEl("div", { text: item });
    el.addEventListener("click", (evt: MouseEvent) => {
      this.onChooseSuggestion(item, evt);
    });
  }

  onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent): void {
    this.inputEl.value = item;
    this.plugin.settings.notesFolder = item;
    this.plugin.saveSettings();
    this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    this.close();
  }
}

/** Month marker information */
interface MonthMarker {
  /** Week number in the timeline */
  weekIndex: number;
  /** Month name abbreviation */
  label: string;
  /** Whether this is the first month of a year */
  isFirstOfYear: boolean;
  /** Whether this is the birth month */
  isBirthMonth: boolean;
  /** Full label with year (for tooltip) */
  fullLabel: string;
  /** Month number for precise positioning */
  monthNumber?: number;
}

/** Default plugin settings */
const DEFAULT_SETTINGS: ChornicaSettings = {
  // --- Core Settings ---
  birthday: "2000-01-01",
  lifespan: 90,
  settingsVersion: 1, // Start versioning settings

  // --- Unified Event Data ---
  eventTypes: [
    {
      id: "preset_major_life",
      name: "Major Life",
      color: "#4CAF50",
      isPreset: true,
    },
    { id: "preset_travel", name: "Travel", color: "#2196F3", isPreset: true },
    {
      id: "preset_relationship",
      name: "Relationship",
      color: "#E91E63",
      isPreset: true,
    },
    {
      id: "preset_education_career",
      name: "Education/Career",
      color: "#D2B55B",
      isPreset: true,
    },
  ],
  events: [], // Start with no events

  // --- Display & Appearance ---
  defaultView: "weeks", // Keep for now
  cellShape: "square",
  gridOrientation: "landscape",
  pastCellColor: "#6A7BA3",
  presentCellColor: "#a882ff",
  futureCellColor: "#d8e2e6",
  quote: "the only true luxury is time.",
  showDecadeMarkers: true,
  showWeekMarkers: true,
  showMonthMarkers: true,
  showBirthdayMarker: true,
  monthMarkerFrequency: "year",
  zoomLevel: 1.0,
  defaultFitToScreen: false,

  // --- Notes & Folders ---
  notesFolder: "",
  useSeparateFolders: true,
  eventNotesFolder: "",
  weekNoteTemplate: "${gggg}-W${ww}", // Example: 2025-W19
  eventNoteTemplate: "${eventName}_${gggg}-W${ww}", // Example: MyEvent_2025-W19
  rangeNoteTemplate:
    "${eventName}_${start_gggg}-W${start_ww}_to_${end_gggg}-W${end_ww}",

  // --- Filling & Interaction ---
  enableManualFill: false,
  enableAutoFill: true,
  autoFillDay: 1, // Monday
  filledWeeks: [],
  startWeekOnMonday: true,

  // --- UI State ---
  isSidebarOpen: false,
  isStatsOpen: false,
  activeStatsTab: "overview",
  statsPanelHeight: 470,
  statsPanelHorizontalOffset: 0,
  statsPanelWidth: 700,

  // --- Onboarding ---
  hasSeenWelcome: false,
  manualFillColor: "#8bc34a",
  tooltipDetailLevel: "expanded",
  enableTooltipNotePreview: true,
  hasSeenFolders: false,
};

/** SVG icon for the Chronica Timeline */
const Chornica_ICON = `<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="4"/>
    <line x1="50" y1="15" x2="50" y2="50" stroke="currentColor" stroke-width="4"/>
    <line x1="50" y1="50" x2="75" y2="60" stroke="currentColor" stroke-width="4"/>
    <circle cx="50" cy="50" r="5" fill="currentColor"/>
  </svg>`;

// Gap between decades (larger than regular gap)
const DECADE_GAP = 6; // px

// Month names for display
const MONTH_NAMES = [
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

class ChornicaFolderSelectionModal extends Modal {
  private plugin: ChornicaTimelinePlugin;

  constructor(app: App, plugin: ChornicaTimelinePlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.titleEl.setText("Select Notes Folders");

    const container = this.contentEl.createDiv({
      cls: "chronica-welcome-setup",
    });

    const weekSection = container.createDiv({
      cls: "chronica-welcome-birthdate",
    });
    weekSection.createEl("label", {
      text: "Weekly Notes Folder:",
      attr: { for: "chronica-week-folder-input" },
      cls: "chronica-welcome-label",
    });
    const weekInput = weekSection.createEl("input", {
      attr: {
        type: "text",
        id: "chronica-week-folder-input",
        value: this.plugin.settings.notesFolder,
        placeholder: "e.g. Weekly Notes",
      },
      cls: "chronica-welcome-input",
    });

    new FolderSuggest(this.app, weekInput, this.plugin);
    // Prevent auto-opening on modal open
    setTimeout(() => weekInput.blur(), 0);

    const eventSection = container.createDiv({
      cls: "chronica-welcome-birthdate",
    });
    eventSection.createEl("label", {
      text: "Event Notes Folder:",
      attr: { for: "chronica-event-folder-input" },
      cls: "chronica-welcome-label",
    });
    const eventInput = eventSection.createEl("input", {
      attr: {
        type: "text",
        id: "chronica-event-folder-input",
        value: this.plugin.settings.eventNotesFolder,
        placeholder: "e.g. Event Notes",
      },
      cls: "chronica-welcome-input",
    });

    new FolderSuggest(this.app, eventInput, this.plugin);
    // Prevent auto-opening on modal open
    setTimeout(() => eventInput.blur(), 0);

    const buttons = container.createDiv({ cls: "chronica-welcome-buttons" });
    const saveBtn = buttons.createEl("button", {
      text: "Save",
      cls: "chronica-welcome-button chronica-welcome-accent-button",
    });
    const cancelBtn = buttons.createEl("button", {
      text: "Cancel",
      cls: "chronica-welcome-button",
    });

    // Reminder: folders can be changed later
    const footerDiv = container.createEl("div", {
      cls: "chronica-welcome-footer",
    });
    footerDiv.createEl("strong", {
      text: "Please create your dedicated folders in your vault before selecting them here.",
      cls: "chronica-modal-emphasis-text", // MODIFIED LINE: Replaced attr: { style: ... } with cls
    });

    container.createEl("div", {
      cls: "chronica-welcome-footer",
      text: "You can change these folders later under Settings → Chronica: Life in Frames. ",
    });
    saveBtn.addEventListener("click", () => {
      const weekVal = (weekInput as HTMLInputElement).value.trim();
      const eventVal = (eventInput as HTMLInputElement).value.trim();

      if (weekVal) {
        if (!this.plugin.app.vault.getAbstractFileByPath(weekVal)) {
          this.plugin.app.vault.createFolder(weekVal);
        }
        this.plugin.settings.notesFolder = weekVal;
      }

      if (eventVal) {
        if (!this.plugin.app.vault.getAbstractFileByPath(eventVal)) {
          this.plugin.app.vault.createFolder(eventVal);
        }
        this.plugin.settings.eventNotesFolder = eventVal;
      }

      this.plugin.settings.hasSeenFolders = true;
      this.plugin.saveSettings().then(() => {
        this.close();
      });
    });

    cancelBtn.addEventListener("click", () => {
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// -----------------------------------------------------------------------
// MAIN PLUGIN CLASS
// -----------------------------------------------------------------------

/**
 * Main plugin class that handles initialization, settings, and view management
 */
export default class ChornicaTimelinePlugin extends Plugin {
  /** Plugin settings */
  settings: ChornicaSettings = DEFAULT_SETTINGS;

  private isPluginFullyLoaded: boolean = false; // Flag to fix race conditions

  // ADDED: New public method for views to check readiness
  public isReady(): boolean {
    return this.isPluginFullyLoaded;
  }

  /**
   * Plugin initialization on load
   */
  async onload(): Promise<void> {
    this.isPluginFullyLoaded = false;

    await this.loadSettings();

    if (this.settings.manualFillColor) {
      document.documentElement.style.setProperty(
        "--manual-fill-color",
        this.settings.manualFillColor
      );
    }

    this.isSyncOperation = false;
    if (this.syncOperationTimer) {
      clearTimeout(this.syncOperationTimer);
      this.syncOperationTimer = null;
    }

    addIcon("chronica-icon", Chornica_ICON);

    this.registerView(
      TIMELINE_VIEW_TYPE,
      (leaf) => new ChornicaTimelineView(leaf, this)
    );

    this.app.workspace.onLayoutReady(async () => {
      new Notice("Chronica: Performing initial event scan...");
      await this.scanVaultForEvents();

      this.isPluginFullyLoaded = true;
      new Notice("Chronica: Event scan complete. Views updated.");

      this.refreshAllViews();

      if (this.checkAndAutoFill()) {
        this.refreshAllViews();
      }
    });

    this.registerEvent(
      this.app.vault.on("create", async (file) => {
        if (!this.isPluginFullyLoaded) return;
        this.registerPotentialSyncOperation();
        if (!this.isChronicaRelatedFile(file) || this.isSyncOperation) return;
        await this.scanVaultForEvents();
        this.refreshAllViewsAfterOperation();
      })
    );
    this.registerEvent(
      this.app.vault.on("modify", async (file) => {
        if (!this.isPluginFullyLoaded) return;
        this.registerPotentialSyncOperation();
        if (this.isSyncOperation || !this.isChronicaRelatedFile(file)) return;
        await this.scanVaultForEvents();
        this.refreshAllViewsAfterOperation();
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", async (file) => {
        if (!this.isPluginFullyLoaded) return;
        if (
          !(file instanceof TFile) ||
          !this.isChronicaRelatedFile(file) ||
          this.isSyncOperation
        )
          return;
        await this.handleFileDelete(file);
        this.refreshAllViewsAfterOperation();
      })
    );

    this.addRibbonIcon("chronica-icon", "Open Chronica Timeline", () =>
      this.activateView()
    );
    this.addCommand({
      id: "open-chronica-timeline",
      name: "Open Chronica Timeline",
      callback: () => this.activateView(),
    });
    this.addCommand({
      id: "create-weekly-note",
      name: "Create/Open Current Week Note",
      callback: () => this.createOrOpenWeekNote(),
    });
    this.addCommand({
      id: "rescan-chronica-events",
      name: "Re-scan Vault for Chronica Events",
      callback: async () => {
        new Notice("Chronica: Re-scanning vault for events...");
        await this.scanVaultForEvents(); // scanVaultForEvents now calls refreshAllViews itself
        new Notice("Chronica: Event scan complete. Views refreshed.");
      },
    });
    this.addSettingTab(new ChornicaSettingTab(this.app, this));

    if (!this.settings.hasSeenWelcome) {
      setTimeout(() => {
        const welcomeModal = new ChronicaWelcomeModal(this.app, this);
        welcomeModal.open();
      }, 1500);
    }

    this.registerInterval(
      window.setInterval(() => {
        if (this.isPluginFullyLoaded && this.checkAndAutoFill()) {
          this.refreshAllViewsAfterOperation();
        }
      }, 1000 * 60 * 60)
    );
  }

  // This method should exist somewhere in your ChornicaTimelinePlugin class
  refreshAllViewsAfterOperation(): void {
    if (this.isSyncOperation) {
      return;
    }
    this.refreshAllViews();
  }

  /**
   * Public method to check if a sync operation is in progress
   * @returns whether a sync operation is currently detected
   */
  public isSyncInProgress(): boolean {
    return this.isSyncOperation;
  }

  /**
   * Check if a file is related to Chronica by examining its name and location
   * @param file - File to check
   * @returns Whether the file is related to Chronica
   */
  private isChronicaRelatedFile(file: TAbstractFile): boolean {
    // 1. Only files (not folders)
    if (!(file instanceof TFile)) {
      return false;
    }

    // 2. If using a separate folder for event notes, include any file there
    if (
      this.settings.useSeparateFolders &&
      this.settings.eventNotesFolder &&
      this.settings.eventNotesFolder.trim() !== ""
    ) {
      let eventFolderPath = this.settings.eventNotesFolder;
      if (!eventFolderPath.endsWith("/")) {
        eventFolderPath += "/";
      }
      if (file.path.startsWith(eventFolderPath)) {
        return true;
      }
    }

    // 3. If a notes‐folder is set, ignore files outside it
    if (this.settings.notesFolder && this.settings.notesFolder.trim() !== "") {
      let folderPath = this.settings.notesFolder;
      if (!folderPath.endsWith("/")) {
        folderPath += "/";
      }
      if (!file.path.startsWith(folderPath)) {
        return false;
      }
    }

    // 4. Match weekly‐note filenames (e.g. "2025-W15" or "2025-W15_to_2025-W20")
    const fileBasename = file.basename;
    const weekPattern = /^\d{4}(-|--)W\d{2}$/;
    const rangePattern = /^\d{4}(-|--)W\d{2}_to_\d{4}(-|--)W\d{2}$/;

    // 5. Also match event‐note filenames (e.g. "Birthday_2025-W15" or "Trip_2025-W15_to_2025-W20")
    const eventPattern = /^[^_]+_\d{4}(-|--)W\d{2}$/;
    const eventRangePattern = /^[^_]+_\d{4}(-|--)W\d{2}_to_\d{4}(-|--)W\d{2}$/;

    return (
      weekPattern.test(fileBasename) ||
      rangePattern.test(fileBasename) ||
      eventPattern.test(fileBasename) ||
      eventRangePattern.test(fileBasename)
    );
  }

  /**
   * Scan vault for notes with event metadata and populate the unified events array.
   */
  async scanVaultForEvents(): Promise<void> {
    if (
      !this.settings ||
      !this.settings.eventTypes ||
      this.settings.eventTypes.length === 0
    ) {
      await this.loadSettings();
      if (
        !this.settings ||
        !this.settings.eventTypes ||
        this.settings.eventTypes.length === 0
      ) {
        return;
      }
    }

    const scannedEvents: ChronicaEvent[] = [];
    const files = this.app.vault.getMarkdownFiles();
    const filesToProcess: TFile[] = [];
    const notesFolderPath = this.settings.notesFolder?.trim();
    const eventNotesFolderPath = this.settings.eventNotesFolder?.trim();
    const useSeparateFolders = this.settings.useSeparateFolders;
    const normalizedNotesFolder = notesFolderPath
      ? notesFolderPath.endsWith("/")
        ? notesFolderPath
        : notesFolderPath + "/"
      : null;
    const normalizedEventFolder = eventNotesFolderPath
      ? eventNotesFolderPath.endsWith("/")
        ? eventNotesFolderPath
        : eventNotesFolderPath + "/"
      : null;

    for (const file of files) {
      let includeFile = false;
      if (!normalizedNotesFolder && !normalizedEventFolder) {
        includeFile = true;
      } else if (useSeparateFolders && normalizedEventFolder) {
        if (file.path.startsWith(normalizedEventFolder)) {
          includeFile = true;
        } else if (
          normalizedNotesFolder &&
          normalizedNotesFolder !== normalizedEventFolder &&
          file.path.startsWith(normalizedNotesFolder)
        ) {
          includeFile = true;
        }
      } else if (normalizedNotesFolder) {
        if (file.path.startsWith(normalizedNotesFolder)) {
          includeFile = true;
        }
      }

      if (includeFile) {
        filesToProcess.push(file);
      }
    }

    const uniqueFilesToProcess = [
      ...new Map(filesToProcess.map((file) => [file.path, file])).values(),
    ];

    for (const file of uniqueFilesToProcess) {
      try {
        const fileCache = this.app.metadataCache.getFileCache(file);
        const frontmatter = fileCache?.frontmatter;

        if (
          !frontmatter ||
          (!frontmatter.type &&
            !frontmatter.event &&
            !frontmatter.name &&
            !frontmatter.startDate)
        ) {
          continue;
        }

        const eventName =
          frontmatter.event || frontmatter.name || file.basename;
        const eventTypeFromName = (frontmatter.type as string) || "Major Life";
        const description = frontmatter.description || eventName;

        let typeId = "";
        const foundType = this.settings.eventTypes.find(
          (et) => et.name.toLowerCase() === eventTypeFromName.toLowerCase()
        );

        if (foundType) {
          typeId = foundType.id;
        } else {
          console.warn(
            `Chronica: Event type "${eventTypeFromName}" in note "${file.path}" not found in settings. Assigning to 'Major Life'.`
          );
          typeId = "preset_major_life";
          if (!this.settings.eventTypes.some((et) => et.id === typeId)) {
            console.error(
              `Chronica: Fallback type ID '${typeId}' does not exist! Skipping event.`
            );
            continue;
          }
        }

        let weekKey: string | null = null;
        let endWeekKey: string | null = null;
        let actualStartDateString: string | undefined = undefined;
        let actualEndDateString: string | undefined = undefined;

        if (frontmatter.startDate) {
          try {
            const startDate = new Date(frontmatter.startDate);
            if (isNaN(startDate.getTime()))
              throw new Error("Invalid start date format from frontmatter");

            weekKey = this.getWeekKeyFromDate(startDate);
            actualStartDateString = startDate.toISOString().split("T")[0];

            if (frontmatter.endDate) {
              const endDate = new Date(frontmatter.endDate);
              if (isNaN(endDate.getTime()))
                throw new Error("Invalid end date format from frontmatter");

              if (endDate >= startDate) {
                endWeekKey = this.getWeekKeyFromDate(endDate);
                actualEndDateString = endDate.toISOString().split("T")[0];
                if (weekKey === endWeekKey) {
                  endWeekKey = null;
                  actualEndDateString = undefined;
                }
              } else {
                endWeekKey = null;
                actualEndDateString = undefined;
              }
            }
          } catch (e: any) {
            weekKey = null;
            endWeekKey = null;
            actualStartDateString = undefined;
            actualEndDateString = undefined;
          }
        }

        if (!weekKey) {
          let normalizedBasename = file.basename.replace(/--W/g, "-W");
          const rangeMatch = normalizedBasename.match(
            /(\d{4}-W\d{2})_to_(\d{4}-W\d{2})/
          );
          const singleWeekMatch = normalizedBasename.match(/(\d{4}-W\d{2})/);

          if (rangeMatch) {
            weekKey = rangeMatch[1];
            endWeekKey = rangeMatch[2];
          } else if (singleWeekMatch) {
            weekKey = singleWeekMatch[1];
          }
        }

        if (!weekKey || !/\d{4}-W\d{2}/.test(weekKey)) {
          continue;
        }

        const newEvent: ChronicaEvent = {
          weekKey: weekKey,
          name: eventName,
          description: description,
          typeId: typeId,
          notePath: file.path,
          actualStartDate: actualStartDateString,
          actualEndDate: actualEndDateString,
        };

        if (endWeekKey && /\d{4}-W\d{2}/.test(endWeekKey)) {
          newEvent.endWeekKey = endWeekKey;
        } else {
          newEvent.endWeekKey = undefined;
          if (
            newEvent.actualStartDate &&
            newEvent.actualEndDate &&
            newEvent.actualStartDate === newEvent.actualEndDate
          ) {
            newEvent.actualEndDate = undefined;
          }
        }
        scannedEvents.push(newEvent);
      } catch (error) {}
    }

    this.settings.events = scannedEvents;
    await this.saveSettings();
    this.refreshAllViews();
  }

  public refreshAllViews(): void {
    // Skip refreshing during likely sync operations
    if (this.isSyncOperation) {
      return;
    }

    this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE).forEach((leaf) => {
      (leaf.view as ChornicaTimelineView).renderView();
    });
  }

  /**
   * Find all Chronica-related files in the vault
   * @param excludeFolder - Optional folder to exclude from search
   * @returns Array of Chronica-related files
   */
  async findChronicaRelatedFiles(excludeFolder?: string): Promise<TFile[]> {
    // Get all markdown files in the vault
    const allFiles = this.app.vault.getMarkdownFiles();

    // Filter to only include Chronica-related files
    const chronicaFiles = allFiles.filter((file) => {
      // Skip files that are already in the exclude folder
      if (excludeFolder && file.path.startsWith(excludeFolder)) {
        return false;
      }

      return this.isChronicaRelatedFile(file);
    });

    return chronicaFiles;
  }

  /**
   * Handle changes to note folder settings
   * @param oldFolder - Previous folder path
   * @param newFolder - New folder path
   * @param isEventFolder - Whether this is for event notes
   */
  async handleFolderChange(
    oldFolder: string,
    newFolder: string,
    isEventFolder: boolean = false
  ): Promise<void> {
    // Skip if no new folder is set
    if (!newFolder || newFolder.trim() === "") {
      return;
    }

    // Normalize folder paths
    newFolder = newFolder.endsWith("/") ? newFolder : newFolder + "/";

    // Find Chronica notes that should be moved
    let filesToMove: TFile[] = [];

    // If this is for week notes (and separate folders enabled)
    if (!isEventFolder || !this.settings.useSeparateFolders) {
      // Find all Chronica files not already in the new folder
      filesToMove = await this.findChronicaRelatedFiles(newFolder);

      // If using separate folders and this is for week notes,
      // exclude event notes if they have their own folder
      if (
        isEventFolder &&
        this.settings.useSeparateFolders &&
        this.settings.eventNotesFolder
      ) {
        const eventFolder = this.settings.eventNotesFolder.endsWith("/")
          ? this.settings.eventNotesFolder
          : this.settings.eventNotesFolder + "/";

        filesToMove = filesToMove.filter(
          (file) => !file.path.startsWith(eventFolder)
        );
      }

      // If handling event notes and separate folders is enabled
      // only include event note files
      if (isEventFolder && this.settings.useSeparateFolders) {
        // Filter files that match the event note pattern
        filesToMove = filesToMove.filter((file) => {
          // Extract basename to check if it's an event note
          const basename = file.basename;
          // Check for event note patterns (like range events)
          return basename.includes("_to_") || this.isEventNote(file);
        });
      } else if (
        !isEventFolder &&
        this.settings.useSeparateFolders &&
        this.settings.eventNotesFolder
      ) {
        // For week notes folder, exclude event notes
        filesToMove = filesToMove.filter((file) => {
          const basename = file.basename;
          // Exclude files that match event note patterns
          return !basename.includes("_to_") && !this.isEventNote(file);
        });
      }
    } else {
      // This is for event notes and separate folders are enabled
      // Get all event notes that aren't already in the event folder
      filesToMove = await this.findChronicaRelatedFiles(newFolder);

      // Filter to only include event notes
      filesToMove = filesToMove.filter((file) => {
        const basename = file.basename;
        // Check for event note patterns (like range events)
        return basename.includes("_to_") || this.isEventNote(file);
      });
    }

    // If no files to move, exit
    if (filesToMove.length === 0) {
      return;
    }

    // Ask user for confirmation
    const confirmation = await this.showFolderChangeConfirmation(
      filesToMove.length,
      newFolder,
      isEventFolder
    );

    if (!confirmation) {
      return;
    }

    // Ensure the target folder exists
    try {
      const folderExists = this.app.vault.getAbstractFileByPath(newFolder);
      if (!folderExists) {
        await this.app.vault.createFolder(newFolder);
      }
    } catch (err) {
      new Notice(`Failed to create folder: ${newFolder}`);
      return;
    }

    // Move files
    let successCount = 0;
    let failCount = 0;

    for (const file of filesToMove) {
      try {
        // Generate new path
        const newPath = newFolder + file.name;

        // Skip if file already exists at destination
        const existingFile = this.app.vault.getAbstractFileByPath(newPath);
        if (existingFile) {
          failCount++;
          continue;
        }

        // Move the file
        await this.app.fileManager.renameFile(file, newPath);
        successCount++;
      } catch (error) {
        console.error(`Error moving file ${file.path}:`, error);
        failCount++;
      }
    }

    // Show result notification
    if (successCount > 0) {
      new Notice(
        `Successfully moved ${successCount} Chronica ${
          isEventFolder ? "event" : "week"
        } notes to ${newFolder}`
      );
    }

    if (failCount > 0) {
      new Notice(`Failed to move ${failCount} files`);
    }
  }

  /**
   * Show confirmation dialog for moving files
   * @param fileCount - Number of files to move
   * @param targetFolder - Folder to move files to
   * @param isEventFolder - Whether this is for event notes
   * @returns Whether the user confirmed the operation
   */
  async showFolderChangeConfirmation(
    fileCount: number,
    targetFolder: string,
    isEventFolder: boolean
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = new Modal(this.app);
      modal.titleEl.setText("Move Chronica Notes");

      const { contentEl } = modal;

      contentEl.createEl("p", {
        text: `Found ${fileCount} Chronica ${
          isEventFolder ? "event" : "week"
        } notes that can be moved to "${targetFolder}".`,
      });

      contentEl.createEl("p", {
        text: "Would you like to move these notes to the new folder?",
      });

      const buttonContainer = contentEl.createDiv({
        cls: "chronica-confirmation-buttons",
      });

      const confirmButton = buttonContainer.createEl("button", {
        text: "Move Files",
        cls: "chronica-confirm-button",
      });

      const cancelButton = buttonContainer.createEl("button", {
        text: "Cancel",
        cls: "chronica-cancel-button",
      });

      confirmButton.addEventListener("click", () => {
        modal.close();
        resolve(true);
      });

      cancelButton.addEventListener("click", () => {
        modal.close();
        resolve(false);
      });

      modal.open();
    });
  }

  /**
   * Check if a file is an event note
   * @param file - File to check
   * @returns Whether the file is an event note
   */
  async isEventNote(file: TFile): Promise<boolean> {
    try {
      // Read file content
      const content = await this.app.vault.read(file);

      // Check for event frontmatter
      const frontmatterMatch = content.match(/^---\s+([\s\S]*?)\s+---/);
      if (!frontmatterMatch) return false;

      const frontmatter = frontmatterMatch[1];

      // Check for event-related fields in frontmatter
      return (
        frontmatter.includes("event:") ||
        frontmatter.includes("type:") ||
        frontmatter.includes("startDate:")
      );
    } catch (error) {
      console.error("Error checking if file is event note:", error);
      return false;
    }
  }

  /**
   * Load settings from storage and perform migration if necessary.
   */
  async loadSettings(): Promise<void> {
    let loadedData = await this.loadData();

    // Check if migration is needed (settingsVersion < 1 or old fields exist)
    const currentSettingsVersion = 1; // Target version for this migration
    let needsSaveAfterLoad = false; // Flag to save at the end if changes were made

    if (!loadedData) {
      // No data saved yet, use defaults
      this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); // Deep copy defaults
      needsSaveAfterLoad = true; // Save the defaults
    } else {
      // Start with default settings structure for merging
      let currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      // Merge loaded data onto defaults (preserves settings not touched by migration)
      currentSettings = Object.assign(currentSettings, loadedData);
      this.settings = currentSettings; // Assign partially merged settings

      // Check if migration to version 1 is needed
      if (
        !this.settings.settingsVersion ||
        this.settings.settingsVersion < currentSettingsVersion
      ) {
        // Ensure new arrays exist (might be redundant due to defaults, but safe)
        this.settings.eventTypes = this.settings.eventTypes || [];
        this.settings.events = this.settings.events || [];

        // --- Migration Logic ---
        const migratedEvents: ChronicaEvent[] = []; // Store migrated events temporarily
        const migratedEventTypes = new Map<string, ChronicaEventType>();

        // Add default presets to map (ensure they exist)
        DEFAULT_SETTINGS.eventTypes.forEach((pt) => {
          if (!this.settings.eventTypes.some((et) => et.id === pt.id)) {
            this.settings.eventTypes.push({ ...pt }); // Add if missing
          }
          migratedEventTypes.set(
            pt.id,
            this.settings.eventTypes.find((et) => et.id === pt.id)!
          );
        });

        const parseEventString = (
          eventStr: string
        ): Omit<ChronicaEvent, "typeId"> | null => {
          const parts = eventStr.split(":");
          if (parts.length === 2 && parts[0].includes("W")) {
            // Use description as name for backward compatibility
            return {
              weekKey: parts[0],
              name: parts[1],
              description: parts[1],
            };
          } else if (
            parts.length === 3 &&
            parts[0].includes("W") &&
            parts[1].includes("W")
          ) {
            return {
              weekKey: parts[0],
              endWeekKey: parts[1],
              name: parts[2],
              description: parts[2],
            };
          }
          console.warn(
            `Chronica Migration: Could not parse event string: ${eventStr}`
          );
          return null;
        };

        // 1. Migrate old preset events
        const oldPresetMap: { [key: string]: string } = {
          greenEvents: "preset_major_life",
          blueEvents: "preset_travel",
          pinkEvents: "preset_relationship",
          purpleEvents: "preset_education_career",
        };
        for (const oldKey in oldPresetMap) {
          const oldDataArray = loadedData[oldKey]; // Access directly from loadedData
          if (oldDataArray && Array.isArray(oldDataArray)) {
            const typeId = oldPresetMap[oldKey];
            oldDataArray.forEach((eventStr: string) => {
              const parsed = parseEventString(eventStr);
              if (parsed) migratedEvents.push({ ...parsed, typeId });
            });
          }
        }

        // 2. Migrate old custom event types
        const customTypeNameToId = new Map<string, string>();
        if (
          loadedData.customEventTypes &&
          Array.isArray(loadedData.customEventTypes)
        ) {
          loadedData.customEventTypes.forEach((oldType: any) => {
            if (oldType.name) {
              // Check if name conflicts with an existing preset ID's name
              const existingPreset = DEFAULT_SETTINGS.eventTypes.find(
                (et) => et.name.toLowerCase() === oldType.name.toLowerCase()
              );
              let finalId = "";
              let finalName = oldType.name;

              if (existingPreset) {
                // Name collision with a preset, map to the preset ID
                finalId = existingPreset.id;
                customTypeNameToId.set(oldType.name, finalId); // Map old name to preset ID
              } else {
                // No collision, create a new custom type if it doesn't exist by name already
                if (
                  !this.settings.eventTypes.some(
                    (et) => et.name.toLowerCase() === oldType.name.toLowerCase()
                  )
                ) {
                  finalId = `custom_${Date.now()}_${Math.random()
                    .toString(36)
                    .substring(2, 7)}`;
                  const newType: ChronicaEventType = {
                    id: finalId,
                    name: finalName,
                    color: oldType.color || "#FF9800",
                    isPreset: false,
                  };
                  this.settings.eventTypes.push(newType);
                  customTypeNameToId.set(oldType.name, finalId);
                } else {
                  // Custom type with this name already exists (maybe from default merge?), find its ID
                  finalId = this.settings.eventTypes.find(
                    (et) => et.name.toLowerCase() === oldType.name.toLowerCase()
                  )!.id;
                  customTypeNameToId.set(oldType.name, finalId);
                }
              }
            }
          });
        }

        // 3. Migrate old custom events
        if (
          loadedData.customEvents &&
          typeof loadedData.customEvents === "object"
        ) {
          for (const oldTypeName in loadedData.customEvents) {
            const eventsArray = loadedData.customEvents[oldTypeName];
            const newTypeId = customTypeNameToId.get(oldTypeName); // Find ID from map
            if (newTypeId && Array.isArray(eventsArray)) {
              eventsArray.forEach((eventStr: string) => {
                const parsed = parseEventString(eventStr);
                if (parsed)
                  migratedEvents.push({ ...parsed, typeId: newTypeId });
              });
            } else {
              console.warn(
                `Chronica Migration: Could not find new type ID for old custom type '${oldTypeName}'. ${
                  eventsArray?.length || 0
                } events not migrated.`
              );
            }
          }
        }

        // Assign migrated events (replace empty default)
        this.settings.events = migratedEvents;

        // Clean up deprecated fields from the object *being saved*
        delete this.settings.greenEvents;
        delete this.settings.blueEvents;
        delete this.settings.pinkEvents;
        delete this.settings.purpleEvents;
        delete this.settings.customEventTypes;
        delete this.settings.customEvents;

        // Update version
        this.settings.settingsVersion = currentSettingsVersion;
        needsSaveAfterLoad = true; // Mark for saving
      } else {
        // Settings are already up-to-date or new, just ensure defaults are present
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
        // Ensure new arrays exist and presets are there
        this.settings.eventTypes = this.settings.eventTypes || [];
        this.settings.events = this.settings.events || [];
        let presetsAdded = false;
        DEFAULT_SETTINGS.eventTypes.forEach((defaultType) => {
          if (
            !this.settings.eventTypes.some(
              (existingType) => existingType.id === defaultType.id
            )
          ) {
            this.settings.eventTypes.push({ ...defaultType });
            presetsAdded = true;
          }
        });
        if (presetsAdded) {
          console.warn("Chronica: Re-added missing preset event types.");
          needsSaveAfterLoad = true;
        }
      }
    }

    // --- Initialize other non-event settings ---
    // (Keep the initialization checks for other settings like showDecadeMarkers, etc.)
    if (this.settings.showDecadeMarkers === undefined)
      this.settings.showDecadeMarkers = DEFAULT_SETTINGS.showDecadeMarkers;
    if (this.settings.showWeekMarkers === undefined)
      this.settings.showWeekMarkers = DEFAULT_SETTINGS.showWeekMarkers;
    if (this.settings.showMonthMarkers === undefined)
      this.settings.showMonthMarkers = DEFAULT_SETTINGS.showMonthMarkers;
    if (this.settings.showBirthdayMarker === undefined)
      this.settings.showBirthdayMarker = DEFAULT_SETTINGS.showBirthdayMarker;
    if (this.settings.monthMarkerFrequency === undefined)
      this.settings.monthMarkerFrequency =
        DEFAULT_SETTINGS.monthMarkerFrequency;
    if (this.settings.enableManualFill === undefined)
      this.settings.enableManualFill = DEFAULT_SETTINGS.enableManualFill;
    // Ensure auto/manual fill are consistent
    if (this.settings.enableAutoFill === undefined)
      this.settings.enableAutoFill = DEFAULT_SETTINGS.enableAutoFill;
    this.settings.enableManualFill = !this.settings.enableAutoFill; // Force manual opposite of auto
    if (this.settings.autoFillDay === undefined)
      this.settings.autoFillDay = DEFAULT_SETTINGS.autoFillDay;
    if (this.settings.filledWeeks === undefined) this.settings.filledWeeks = [];
    if (this.settings.startWeekOnMonday === undefined)
      this.settings.startWeekOnMonday = DEFAULT_SETTINGS.startWeekOnMonday;
    if (this.settings.isStatsOpen === undefined)
      this.settings.isStatsOpen = DEFAULT_SETTINGS.isStatsOpen;
    if (this.settings.activeStatsTab === undefined)
      this.settings.activeStatsTab = DEFAULT_SETTINGS.activeStatsTab;
    if (this.settings.statsPanelHeight === undefined)
      this.settings.statsPanelHeight = DEFAULT_SETTINGS.statsPanelHeight;
    if (this.settings.statsPanelHorizontalOffset === undefined)
      this.settings.statsPanelHorizontalOffset =
        DEFAULT_SETTINGS.statsPanelHorizontalOffset;
    if (this.settings.statsPanelWidth === undefined)
      this.settings.statsPanelWidth = DEFAULT_SETTINGS.statsPanelWidth;
    // Ensure note templates have defaults if missing
    if (this.settings.weekNoteTemplate === undefined)
      this.settings.weekNoteTemplate = DEFAULT_SETTINGS.weekNoteTemplate;
    if (this.settings.eventNoteTemplate === undefined)
      this.settings.eventNoteTemplate = DEFAULT_SETTINGS.eventNoteTemplate;
    if (this.settings.rangeNoteTemplate === undefined)
      this.settings.rangeNoteTemplate = DEFAULT_SETTINGS.rangeNoteTemplate;
    if (this.settings.manualFillColor === undefined)
      this.settings.manualFillColor = DEFAULT_SETTINGS.manualFillColor;
    if (this.settings.tooltipDetailLevel === undefined) {
      this.settings.tooltipDetailLevel = DEFAULT_SETTINGS.tooltipDetailLevel;
      needsSaveAfterLoad = true; // If you're using this flag
    }
    if (this.settings.enableTooltipNotePreview === undefined) {
      this.settings.enableTooltipNotePreview =
        DEFAULT_SETTINGS.enableTooltipNotePreview;
      needsSaveAfterLoad = true;
    }

    // Save if migration happened or defaults were added/fixed
    if (needsSaveAfterLoad) {
      await this.saveSettings();
    }
  }

  /**
   * Check if the current week should be auto-filled
   * @returns true if the current week was filled
   */
  checkAndAutoFill(): boolean {
    if (!this.settings.enableAutoFill) {
      return false;
    }

    // Get current date and day of week
    const now = new Date();
    const currentDay = now.getDay(); // 0-6, 0 is Sunday

    // Only proceed if today is the configured auto-fill day
    if (currentDay !== this.settings.autoFillDay) {
      return false;
    }

    // Get current week key
    const currentWeekKey = this.getWeekKeyFromDate(now);

    // Check if this week is already filled
    if (this.settings.filledWeeks.includes(currentWeekKey)) {
      return false;
    }

    // Add current week to filled weeks
    this.settings.filledWeeks.push(currentWeekKey);
    this.saveSettings();

    return true;
  }

  /**
   * Save settings to storage
   */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * Show or focus the timeline view
   */
  async activateView(): Promise<void> {
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

    // Reveal and focus the leaf
    workspace.revealLeaf(leaf);
  }

  /**
   * Calculate full weeks between birthday and given date
   * @param birthday - Birth date
   * @param today - Current or target date
   * @returns Number of full weeks between dates
   */
  getFullWeekAge(birthday: Date, today: Date): number {
    // First, create copies to avoid modifying the original dates
    const birthdayClone = new Date(birthday.getTime());
    const todayClone = new Date(today.getTime());

    // Normalize both dates to start of day
    birthdayClone.setHours(0, 0, 0, 0);
    todayClone.setHours(0, 0, 0, 0);

    // Calculate milliseconds between dates
    const diffMs = todayClone.getTime() - birthdayClone.getTime();
    const msPerWeek = 1000 * 60 * 60 * 24 * 7;

    // Return full weeks
    return Math.floor(diffMs / msPerWeek);
  }

  /**
   * Get full path for a note, using settings folder if specified
   * @param fileName - Name of the file
   * @param isEvent - Whether this is an event note (for separate folders)
   * @returns Full path including folder if specified
   */
  getFullPath(fileName: string, isEvent: boolean = false): string {
    // Get the appropriate folder based on settings and file type
    let folderPath = this.settings.notesFolder;

    // If using separate folders and this is an event, use the event folder
    if (
      isEvent &&
      this.settings.useSeparateFolders &&
      this.settings.eventNotesFolder
    ) {
      folderPath = this.settings.eventNotesFolder;
    }

    // If there's a folder, append the file name to it
    if (folderPath && folderPath.trim() !== "") {
      if (!folderPath.endsWith("/")) {
        folderPath += "/";
      }
      return `${folderPath}${fileName}`;
    }

    // Otherwise just use the filename
    return fileName;
  }

  /**
   * Generate a filename based on a template and values
   * @param template - The template string with placeholders
   * @param values - Object containing values to replace placeholders
   * @returns Formatted filename
   */
  public formatFileName(template: string, values: Record<string, any>): string {
    let result = template;

    // Replace all placeholders in the template
    for (const [key, value] of Object.entries(values)) {
      // Escape special characters in the key for use in RegExp
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
      const placeholderRegExp = new RegExp(`\\$\\{${escapedKey}\\}`, "g"); // Look for ${key}

      // Ensure value is a string, provide fallback if it's null/undefined
      const valueStr =
        value !== null && value !== undefined ? value.toString() : "";
      result = result.replace(placeholderRegExp, valueStr);
    }

    // Ensure the extension is .md
    if (!result.endsWith(".md")) {
      result += ".md";
    }

    return result;
  }

  /**
   * Create or open a note for the current week using template placeholders.
   */
  async createOrOpenWeekNote(): Promise<void> {
    try {
      if (this.isSyncOperation) {
        new Notice("Sync in progress. Please try again in a moment.");
        return;
      }

      const today = new Date();
      const isoWeekData = this.getISOWeekData(today);

      // Prepare all placeholder values
      const values = {
        gggg: isoWeekData.year.toString(),
        ww: isoWeekData.week.toString().padStart(2, "0"),
        YYYY: today.getFullYear().toString(),
        MM: (today.getMonth() + 1).toString().padStart(2, "0"),
        DD: today.getDate().toString().padStart(2, "0"),
        MMMM: today.toLocaleString("default", { month: "long" }),
        MMM: today.toLocaleString("default", { month: "short" }),
        YY: today.getFullYear().toString().slice(-2),
      };

      const fileName = this.formatFileName(
        this.settings.weekNoteTemplate,
        values
      );
      const fullPath = this.getFullPath(fileName, false);

      // This is the standard weekKey for this note, based on ISO data
      const weekKey = `${values.gggg}-W${values.ww}`; // <<< CORRECTED: Use gggg, ww

      const existingFile = this.app.vault.getAbstractFileByPath(fullPath);

      if (existingFile instanceof TFile) {
        await this.safelyOpenFile(existingFile);
      } else {
        const folderPath = this.settings.notesFolder;
        if (folderPath && folderPath.trim() !== "") {
          try {
            const folderExists =
              this.app.vault.getAbstractFileByPath(folderPath);
            if (!folderExists) {
              await this.app.vault.createFolder(folderPath);
            }
          } catch (err) {
            console.error(`Chronica: Error creating folder ${folderPath}`, err);
          }
        }

        let content = this.formatFrontmatter({});

        // Updated default content to use the correct keys from the 'values' object
        content += `# Week ${values.ww}, ${values.gggg} (Calendar: ${values.MMM} ${values.DD}, ${values.YYYY})\n\n## Reflections\n\n## Tasks\n\n## Notes\n`; // <<< CORRECTED: Use ww, gggg, MMM, DD, YYYY

        const newFile = await this.app.vault.create(fullPath, content);
        await this.safelyOpenFile(newFile);
      }
    } catch (error: any) {
      new Notice(`Error creating/opening week note: ${error.message}`);
      console.error("Error in createOrOpenWeekNote:", error);
    }
  }
  /**
   * Calculate ISO week number and the associated ISO year for a given date
   * @param date - Date to calculate week number for
   * @returns Object with ISO week number (1-53) and ISO year
   */
  getISOWeekYearNumber(date: Date): { week: number; year: number } {
    const workDate = new Date(date.valueOf());

    const dayOfWeek = workDate.getUTCDay() || 7;

    workDate.setUTCDate(workDate.getUTCDate() - dayOfWeek + 4);

    const isoYear = workDate.getUTCFullYear();

    const firstDayOfIsoYear = Date.UTC(isoYear, 0, 1);
    const ordinalDayOfThursday =
      Math.floor((workDate.valueOf() - firstDayOfIsoYear) / 86400000) + 1;

    const isoWeek = Math.floor((ordinalDayOfThursday - 1) / 7) + 1;

    return { week: isoWeek, year: isoYear };
  }

  /**
   * Check if a year has 53 ISO weeks
   * @param year - Calendar year to check
   * @returns True if the year has 53 ISO weeks, false if it has 52
   */
  hasISOWeek53(year: number): boolean {
    // A year has 53 weeks if:
    // 1. The year starts on a Thursday, OR
    // 2. The year starts on a Wednesday and it's a leap year

    const jan1 = new Date(year, 0, 1);
    const jan1DayOfWeek = jan1.getDay(); // 0-6, 0 = Sunday, 4 = Thursday

    // Check if it's a leap year
    const isLeapYear = new Date(year, 1, 29).getMonth() === 1;

    return jan1DayOfWeek === 4 || (jan1DayOfWeek === 3 && isLeapYear);
  }

  /**
   * Get the ISO week and year for a given date following strict ISO 8601 standard
   * @param date - Date to calculate for
   * @returns Object with week number and correct ISO year
   */
  getISOWeekData(date: Date): { week: number; year: number } {
    // Create a copy to avoid modifying the original
    const d = new Date(date.getTime());

    // Get the day of week (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeek = d.getDay();

    // Set to nearest Thursday (current date + 4 - current day number)
    d.setDate(d.getDate() + 4 - (dayOfWeek || 7));

    // Get first day of this ISO year (January 1st)
    const yearStart = new Date(d.getFullYear(), 0, 1);

    // Calculate days between date and first day of year, plus 1 day
    const days = Math.floor((d.getTime() - yearStart.getTime()) / 86400000) + 1;

    // Calculate the ISO week number
    const weekNum = Math.ceil(days / 7);

    // Check for edge cases at year boundaries
    if (weekNum === 0) {
      // Week belongs to the previous year
      // Find the last week of previous year
      const lastDayPrevYear = new Date(d.getFullYear() - 1, 11, 31);
      const lastWeekData = this.getISOWeekData(lastDayPrevYear);
      return lastWeekData;
    } else if (weekNum > 52) {
      // Check if it's actually week 1 of next year
      const dec31 = new Date(d.getFullYear(), 11, 31);
      const dec31Day = dec31.getDay();

      // If Dec 31 is on Wed-Sun, the last days are week 1 of next year
      if (dec31Day >= 3) {
        return { week: 1, year: d.getFullYear() + 1 };
      }
    }

    return { week: weekNum, year: d.getFullYear() };
  }

  /**
   * Calculate ISO week number for a given date
   * @param date - Date to calculate week number for
   * @returns ISO week number (1-53)
   */
  getISOWeekNumber(date: Date): number {
    return this.getISOWeekData(date).week;
  }

  /**
   * Get all ISO week numbers in a year
   * @param year - Calendar year to check
   * @returns Array of all ISO week numbers that appear in the year
   */
  getISOWeeksInYear(year: number): number[] {
    const weeks = new Set<number>();

    // Check every day of the year
    const startDate = new Date(year, 0, 1); // Jan 1
    const endDate = new Date(year, 11, 31); // Dec 31

    // Iterate through each day
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const { week } = this.getISOWeekData(currentDate);
      weeks.add(week);

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return Array.from(weeks).sort((a, b) => a - b);
  }

  /**
   * Get week key in YYYY-WXX format from date with corrected year
   * @param date - Date to get week key for
   * @returns Week key in YYYY-WXX format
   */
  getWeekKeyFromDate(date: Date): string {
    const { week, year } = this.getISOWeekYearNumber(date);
    return `${year}-W${week.toString().padStart(2, "0")}`;
  }

  /**
   * Get all week keys between two dates
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Array of week keys in YYYY-WXX format
   */
  getWeekKeysBetweenDates(startDate: Date, endDate: Date): string[] {
    const weekKeys: string[] = [];
    const currentDate = new Date(startDate);

    // Ensure dates are in order
    if (startDate > endDate) {
      const temp = startDate;
      startDate = endDate;
      endDate = temp;
    }

    // Get week key for starting date
    let currentWeekKey = this.getWeekKeyFromDate(currentDate);
    weekKeys.push(currentWeekKey);

    // Advance by one week until we reach or pass the end date
    while (currentDate < endDate) {
      // Move to next week
      currentDate.setDate(currentDate.getDate() + 7);

      // Check if we've gone past the end date
      if (currentDate > endDate) {
        break;
      }

      // Get week key and add to array
      currentWeekKey = this.getWeekKeyFromDate(currentDate);

      // Only add if not already in the array (avoid duplicates)
      if (!weekKeys.includes(currentWeekKey)) {
        weekKeys.push(currentWeekKey);
      }
    }

    // Ensure the end date's week is included
    const endWeekKey = this.getWeekKeyFromDate(endDate);
    if (!weekKeys.includes(endWeekKey)) {
      weekKeys.push(endWeekKey);
    }

    return weekKeys;
  }

  /**
   * Calculate the horizontal position for a given year, accounting for decade gaps
   * @param year - Year to calculate position for (0-based index from birth)
   * @param cellSize - Size of each cell in pixels
   * @param cellGap - Standard gap between cells in pixels
   * @returns Position in pixels
   */
  calculateYearPosition(
    year: number,
    cellSize: number,
    cellGap: number
  ): number {
    // Add extra space for each completed decade
    const decades = Math.floor(year / 10);
    const extraGap = DECADE_GAP - cellGap; // Additional space for each decade

    return year * (cellSize + cellGap) + decades * extraGap;
  }

  /**
   * Calculate month positions for vertical markers based on birth date
   * @param birthdayDate - User's birth date
   * @param totalYears - Total years to display on timeline
   * @param frequency - How often to show month markers ('all', 'quarter', 'half-year', 'year')
   * @returns Array of objects with month marker data
   */
  calculateMonthMarkers(
    birthdayDate: Date,
    totalYears: number,
    frequency: string = "all"
  ): MonthMarker[] {
    const monthMarkers: MonthMarker[] = [];

    // Clone the birthday date to avoid modifying the original
    const startDate = new Date(birthdayDate.getTime());
    startDate.setHours(0, 0, 0, 0);

    // Calculate the end date (birthday + total years)
    const endDate = new Date(startDate.getTime());
    endDate.setFullYear(endDate.getFullYear() + totalYears);

    // Get the birth month and year for special handling
    const birthMonth = startDate.getMonth();
    const birthYear = startDate.getFullYear();

    // Create a calendar date iterator starting from birthday
    const currentDate = new Date(startDate.getTime());

    // Keep track of previously added month/year to avoid duplicates
    let lastMarkedMonth = -1;
    let lastMarkedYear = -1;

    // Helper to determine if a month should be shown based on frequency
    const shouldShowMonth = (monthNum: number): boolean => {
      // Always show January and birth month
      if (monthNum === 0 || monthNum === birthMonth) return true;

      switch (frequency) {
        case "all":
          return true;
        case "quarter":
          // Show Jan, Apr, Jul, Oct
          return monthNum % 3 === 0;
        case "half-year":
          // Show Jan, Jul
          return monthNum % 6 === 0;
        case "year":
          // Only show January and birth month
          return monthNum === 0 || monthNum === birthMonth;
        default:
          return true;
      }
    };

    // Iterate by weeks until we reach the end date
    while (currentDate < endDate) {
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      // Check if this is a new month that should be shown
      if (
        (currentMonth !== lastMarkedMonth || currentYear !== lastMarkedYear) &&
        shouldShowMonth(currentMonth)
      ) {
        // Calculate exact week index relative to birth date
        const weeksSinceBirth = this.getFullWeekAge(birthdayDate, currentDate);

        // Add marker for this month
        monthMarkers.push({
          weekIndex: weeksSinceBirth,
          label: MONTH_NAMES[currentMonth],
          isFirstOfYear: currentMonth === 0,
          isBirthMonth:
            currentMonth === birthMonth && currentYear === birthYear,
          fullLabel: `${MONTH_NAMES[currentMonth]} ${currentYear}`,
          monthNumber: currentMonth + (currentYear - birthYear) * 12, // Add this line
        });

        // Update last marked month/year
        lastMarkedMonth = currentMonth;
        lastMarkedYear = currentYear;
      }

      // Move forward one week at a time
      currentDate.setDate(currentDate.getDate() + 7);
    }

    // Sort by week index
    monthMarkers.sort((a, b) => a.weekIndex - b.weekIndex);

    return monthMarkers;
  }

  /**
   * Calculate date range for a given week key
   * @param weekKey - Week key in YYYY-WXX format
   * @param adjustedRange - Whether to use adjusted range for cells in 53-week years
   * @returns String with formatted date range
   */
  getWeekDateRange(weekKey: string, adjustedRange: boolean = false): string {
    const parts = weekKey.split("-W");
    if (parts.length !== 2) return "";

    const year = parseInt(parts[0]);
    const week = parseInt(parts[1]);

    // Find January 4th for the given year, which is always in week 1
    const jan4 = new Date(year, 0, 4);

    // Find the Monday of week 1
    const week1Start = this.getStartOfISOWeek(jan4);

    // Calculate the first day of the target week
    const firstDayOfWeek = new Date(week1Start);
    firstDayOfWeek.setDate(week1Start.getDate() + (week - 1) * 7);

    // Calculate the last day of the week (Sunday for standard 7-day week)
    const lastDayOfWeek = new Date(firstDayOfWeek);

    // If using adjusted ranges for 53-week years
    if (adjustedRange && this.hasISOWeek53(year)) {
      // Extend to cover slightly more than 7 days if needed
      // This handles the case of an 8-day cell in 53-week years
      lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 7);

      // Check if this date is actually in the next ISO week
      const nextDayISOWeek = this.getISOWeekYearNumber(lastDayOfWeek);
      const nextWeekStr = `${nextDayISOWeek.year}-W${nextDayISOWeek.week
        .toString()
        .padStart(2, "0")}`;

      // If it's in the next week, adjust back by one day
      if (nextWeekStr !== weekKey) {
        lastDayOfWeek.setDate(lastDayOfWeek.getDate() - 1);
      }
    } else {
      // Standard 7-day week
      lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
    }

    // Format the dates
    const formatDate = (date: Date): string => {
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
      return `${months[date.getMonth()]} ${date.getDate()}`;
    };

    return `${formatDate(firstDayOfWeek)} - ${formatDate(lastDayOfWeek)}`;
  }

  /**
   * Calculate the birthday date for a specific age year
   * @param birthDate - Original birth date
   * @param ageYear - Age year to calculate for (0-based, 0 = birth year)
   * @returns Date object representing the birthday in that age year
   */
  calculateBirthdayInYear(birthDate: Date, ageYear: number): Date {
    const targetDate = new Date(birthDate);
    targetDate.setFullYear(birthDate.getFullYear() + ageYear);
    return targetDate;
  }

  /**
   * Calculate which ISO week number contains the birthday in a specific year
   * @param year - Year to check
   * @returns ISO week number (1-53) containing the birthday
   */
  getBirthdayWeekForYear(year: number): {
    weekNumber: number;
    weekStart: Date;
  } {
    // Get the birthday in this specific year
    const birthdayDate = new Date(this.settings.birthday);
    birthdayDate.setFullYear(year);

    // Calculate the ISO week data
    const { week, year: isoYear } = this.getISOWeekData(birthdayDate);

    // If the ISO year is different than the calendar year
    if (isoYear !== year) {
      // We need to find a date that's definitely in the requested year
      // Let's use January 4th which is always in week 1 of the ISO year
      const jan4 = new Date(year, 0, 4);
      const jan4Data = this.getISOWeekData(jan4);
      const weekStart = this.getStartOfISOWeek(jan4);

      return {
        weekNumber: jan4Data.week,
        weekStart: weekStart,
      };
    }

    // Find the Monday that starts this ISO week
    const weekStart = this.getStartOfISOWeek(birthdayDate);

    return {
      weekNumber: week,
      weekStart: weekStart,
    };
  }
  /**
   * Get the start date (Monday) of the ISO week containing the given date
   * @param date - Date to find the containing week for
   * @returns Date object representing the start of the week (Monday)
   */
  getStartOfISOWeek(date: Date): Date {
    const tempDate = new Date(date.getTime());
    const dayOfWeek = tempDate.getDay() || 7; // Convert Sunday (0) to 7

    // Move to the Monday of the current week (ISO week starts on Monday)
    if (dayOfWeek !== 1) {
      tempDate.setDate(tempDate.getDate() - (dayOfWeek - 1));
    }

    // Reset time to start of day
    tempDate.setHours(0, 0, 0, 0);

    return tempDate;
  }

  /**
   * Get event metadata from a note
   * @param weekKey - Week key in YYYY-WXX format
   * @returns Event metadata if found
   */
  async getEventFromNote(weekKey: string): Promise<{
    event?: string;
    name: string;
    description?: string;
    type?: string;
    color?: string;
    startDate?: string;
    endDate?: string;
  } | null> {
    // First try the week note (old approach)
    const fileName = `${weekKey.replace("W", "-W")}.md`;
    const fullPath = this.getFullPath(fileName);

    // Check if file exists
    let file = this.app.vault.getAbstractFileByPath(fullPath);

    // If we don't find the week note, look for event notes that correspond to this week
    if (!(file instanceof TFile)) {
      // Get all markdown files
      const allFiles = this.app.vault.getMarkdownFiles();

      // Look for event notes that contain the week key in their filename
      // For example: "EventName_2023-W15.md" or "EventName_2023-W15_to_2023-W20.md"
      const eventFile = allFiles.find((f) => {
        // Check for files with the weekKey in their name
        if (f.basename.includes(weekKey)) {
          return true;
        }

        // Check for range files that might contain this week
        if (f.basename.includes("_to_")) {
          const rangeMatch = f.basename.match(
            /(\d{4}-W\d{2})_to_(\d{4}-W\d{2})/
          );
          if (rangeMatch) {
            const startWeekKey = rangeMatch[1];
            const endWeekKey = rangeMatch[2];

            // Parse the week numbers
            const startYear = parseInt(startWeekKey.split("-W")[0], 10);
            const startWeek = parseInt(startWeekKey.split("-W")[1], 10);
            const endYear = parseInt(endWeekKey.split("-W")[0], 10);
            const endWeek = parseInt(endWeekKey.split("-W")[1], 10);

            // Parse current cell week
            const cellYear = parseInt(weekKey.split("-W")[0], 10);
            const cellWeek = parseInt(weekKey.split("-W")[1], 10);

            // Check if the current week falls within the range
            if (
              (cellYear > startYear ||
                (cellYear === startYear && cellWeek >= startWeek)) &&
              (cellYear < endYear ||
                (cellYear === endYear && cellWeek <= endWeek))
            ) {
              return true;
            }
          }
        }

        return false;
      });

      // If we found an event file, use it; otherwise return null
      if (eventFile) {
        file = eventFile;
      } else {
        return null;
      }
    }

    // Ensure file is a TFile before reading
    if (!(file instanceof TFile)) {
      return null;
    }

    // Read file content
    const content = await this.app.vault.read(file);

    // Check for YAML frontmatter
    const frontmatterMatch = content.match(/^---\s+([\s\S]*?)\s+---/);
    if (!frontmatterMatch) {
      return null;
    }

    // Parse YAML frontmatter
    try {
      const frontmatter = frontmatterMatch[1];
      const metadata: Record<string, any> = {};

      // Simple YAML parsing (not using an external parser for simplicity)
      frontmatter.split("\n").forEach((line) => {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
          const [_, key, value] = match;
          metadata[key.trim()] = value.trim().replace(/^"(.*)"$/, "$1");
        }
      });

      return {
        event: metadata.event || metadata.name,
        name: metadata.name || metadata.event,
        description: metadata.description,
        type: metadata.type,
        color: metadata.color,
        startDate: metadata.startDate,
        endDate: metadata.endDate,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Update or add event metadata to a note
   * @param weekKey - Week key in YYYY-WXX format
   * @param metadata - Event metadata to add
   * @returns True if successful
   */
  async updateEventInNote(
    weekKey: string,
    metadata: {
      event: string;
      name: string;
      description?: string;
      type: string;
      color: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<boolean> {
    const fileName = `${weekKey.replace("W", "-W")}.md`;
    const fullPath = this.getFullPath(fileName);

    // Check if file exists
    let file = this.app.vault.getAbstractFileByPath(fullPath);
    let content = "";

    if (file instanceof TFile) {
      // Read existing content
      content = await this.app.vault.read(file);

      // Replace existing frontmatter or add new frontmatter
      const hasFrontmatter = content.match(/^---\s+[\s\S]*?\s+---/);
      if (hasFrontmatter) {
        // Replace existing frontmatter
        content = content.replace(
          /^---\s+[\s\S]*?\s+---/,
          this.formatFrontmatter(metadata)
        );
      } else {
        // Add frontmatter at the beginning
        content = this.formatFrontmatter(metadata) + content;
      }

      // Update file
      await this.app.vault.modify(file, content);
    } else {
      // Create new file with frontmatter and basic template
      content = this.formatFrontmatter(metadata);

      // Add basic template
      const weekNum = parseInt(weekKey.split("-W")[1]);
      const year = parseInt(weekKey.split("-")[0]);

      content += `# Week ${weekNum}, ${year}\n\n## Reflections\n\n## Tasks\n\n## Notes\n\n`;

      // Create folder if needed
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
        } catch (err) {}
      }

      // Create file
      await this.app.vault.create(fullPath, content);
    }

    return true;
  }

  /**
   * Format metadata as YAML frontmatter
   * @param metadata - Event metadata
   * @returns Formatted frontmatter string
   */
  formatFrontmatter(metadata: Record<string, any>): string {
    let frontmatter = "---\n";

    // If both event and name are the same value, only include name
    if (metadata.event && metadata.name && metadata.event === metadata.name) {
      const { event, ...rest } = metadata; // Remove event property
      metadata = rest;
    }

    // Add each metadata field
    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        // If value contains special characters, wrap in quotes
        const needsQuotes = /[:#\[\]{}|>*&!%@,]/.test(String(value));
        const formattedValue = needsQuotes ? `"${value}"` : value;
        frontmatter += `${key}: ${formattedValue}\n`;
      }
    });

    frontmatter += "---\n\n";
    return frontmatter;
  }

  /**
   * Handle file deletion. Removes events linked to the deleted file path.
   * @param file - File that was deleted
   */
  async handleFileDelete(file: TFile): Promise<void> {
    // Ensure settings and events are loaded
    if (!this.settings || !this.settings.events) {
      console.warn(
        "Chronica: Settings or events not loaded during file delete handling."
      );
      return;
    }

    const deletedPath = file.path;
    let eventsRemovedCount = 0;

    // Filter out events whose notePath matches the deleted file's path
    const originalLength = this.settings.events.length;
    this.settings.events = this.settings.events.filter((event) => {
      if (event.notePath === deletedPath) {
        eventsRemovedCount++;
        return false; // Remove this event
      }
      return true; // Keep this event
    });

    // If events were removed, save settings and refresh views
    if (eventsRemovedCount > 0) {
      await this.saveSettings();
      this.refreshAllViews(); // Update timeline to remove visual markers
      new Notice(`Removed ${eventsRemovedCount} event link(s) from timeline.`);
    }
    // If the deleted file was potentially a weekly note itself (not linked via event notePath),
    // a simple refresh might be enough, handled by the generic delete handler in onload.
    // However, explicitly refreshing ensures the view updates if the deleted note *was* the source.
    else {
      this.refreshAllViews();
    }
  }

  /**
   * Get a dedicated leaf for Chronica operations
   * @param createIfNeeded - Whether to create a new leaf if none exists
   * @returns A workspace leaf specifically for Chronica
   */
  private getChronicaLeaf(
    createIfNeeded: boolean = true
  ): WorkspaceLeaf | null {
    // First, check for existing Chronica views
    const leaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);

    if (leaves.length > 0) {
      // Use an existing Chronica leaf
      return leaves[0];
    }

    // If no leaf exists and we're asked to create one
    if (createIfNeeded) {
      // Create a new leaf in a split
      return this.app.workspace.getLeaf("split", "vertical");
    }

    return null;
  }

  /**
   * Safely open a file, respecting files already open in other panes
   * @param file - File to open
   */
  async safelyOpenFile(file: TFile): Promise<void> {
    // First, check if the file is already open in any leaf
    const existingLeaf = this.app.workspace
      .getLeavesOfType("markdown")
      .find((leaf) => {
        const viewState = leaf.getViewState();
        return viewState.state?.file === file.path;
      });

    if (existingLeaf) {
      // File is already open, just focus that leaf
      this.app.workspace.setActiveLeaf(existingLeaf, { focus: true });
      this.app.workspace.revealLeaf(existingLeaf);
    } else {
      // File is not open, use a Chronica leaf
      const leaf = this.getChronicaLeaf();
      if (leaf) {
        await leaf.openFile(file);
        this.app.workspace.revealLeaf(leaf);
      }
    }
  }

  /**
   * Track potential sync operations to prevent interference
   */
  private isSyncOperation: boolean = false;
  private syncOperationTimer: NodeJS.Timeout | null = null;

  /**
   * Register a file event as a potential sync operation
   */
  private registerPotentialSyncOperation(): void {
    // Clear existing timer
    if (this.syncOperationTimer) {
      clearTimeout(this.syncOperationTimer);
    }

    // Mark as being in a sync operation
    this.isSyncOperation = true;

    // Reset after 5 seconds of no file events
    this.syncOperationTimer = setTimeout(() => {
      this.isSyncOperation = false;
      this.syncOperationTimer = null;
    }, 5000);
  }

  /**
   * Removes events from settings whose linked notePath no longer exists.
   */
  public async cleanInvalidEvents(): Promise<void> {
    // Ensure settings and events are loaded
    if (!this.settings || !this.settings.events) {
      console.warn(
        "Chronica: Settings or events not loaded during cleanInvalidEvents."
      );
      return;
    }

    let invalidRemovedCount = 0;
    const originalLength = this.settings.events.length;

    // Keep only events that either have no notePath or whose notePath exists
    this.settings.events = this.settings.events.filter((event) => {
      if (event.notePath) {
        const fileExists = this.app.vault.getAbstractFileByPath(event.notePath);
        if (!fileExists) {
          invalidRemovedCount++;
          return false; // Remove event with invalid path
        }
      }
      return true; // Keep event if no path or path is valid
    });

    // If invalid events were removed, save settings and refresh
    if (invalidRemovedCount > 0) {
      await this.saveSettings();
      this.refreshAllViews();
      new Notice(`Cleaned ${invalidRemovedCount} invalid event link(s).`);
    } else {
    }
  }
}

// -----------------------------------------------------------------------
// EVENT MODAL CLASS
// -----------------------------------------------------------------------

/**
 * Modal dialog for adding life events to the timeline using the unified event structure.
 */

class ChornicaEventModal extends Modal {
  plugin: ChornicaTimelinePlugin;
  selectedWeekKey: string = "";
  selectedEndWeekKey: string = "";
  isDateRange: boolean = false;
  eventDescription: string = "";
  eventName: string = "";
  selectedTypeId: string = "preset_major_life";

  // Input element references
  singleDateInput!: HTMLInputElement;
  startDateInput!: HTMLInputElement;
  endDateInput!: HTMLInputElement;
  eventTypeDropdown!: HTMLSelectElement;
  private eventDescriptionInputEl!: HTMLInputElement;
  private eventNameInputEl!: HTMLInputElement;

  private originalEvent: ChronicaEvent | null = null;
  private isEditMode: boolean = false;

  // ADD THESE NEW PROPERTY DECLARATIONS:
  private initialSingleDateValue: string;
  private initialStartDateValue: string;
  private initialEndDateValue: string;

  constructor(
    app: App,
    plugin: ChornicaTimelinePlugin,
    targetDataOrEvent: string | ChronicaEvent | null
  ) {
    super(app);
    this.plugin = plugin;

    const todayStr = new Date().toISOString().split("T")[0];
    this.initialSingleDateValue = todayStr;
    this.initialStartDateValue = todayStr;
    this.initialEndDateValue = todayStr;

    if (typeof targetDataOrEvent === "string") {
      // ADD MODE from a cell click (targetDataOrEvent is the cell's weekKey)
      this.isEditMode = false;
      this.selectedWeekKey = targetDataOrEvent;
      const firstDayOfCellWeek = this.convertWeekToDate(this.selectedWeekKey);
      this.initialSingleDateValue = firstDayOfCellWeek;
      this.initialStartDateValue = firstDayOfCellWeek;
      this.initialEndDateValue = firstDayOfCellWeek;
      // Default type for new event
      this.selectedTypeId =
        this.plugin.settings.eventTypes.length > 0
          ? this.plugin.settings.eventTypes[0].id
          : "preset_major_life";
    } else if (targetDataOrEvent && typeof targetDataOrEvent === "object") {
      // EDIT MODE (targetDataOrEvent is a ChronicaEvent)
      this.originalEvent = targetDataOrEvent as ChronicaEvent;
      this.isEditMode = true;

      this.selectedWeekKey = this.originalEvent.weekKey;
      this.selectedEndWeekKey = this.originalEvent.endWeekKey || "";
      this.eventName = this.originalEvent.name || "";
      this.eventDescription = this.originalEvent.description;
      this.selectedTypeId = this.originalEvent.typeId;

      // Prioritize actualStartDate and actualEndDate for date inputs
      if (this.originalEvent.actualStartDate) {
        this.initialSingleDateValue = this.originalEvent.actualStartDate;
        this.initialStartDateValue = this.originalEvent.actualStartDate;
        if (
          this.originalEvent.actualEndDate &&
          this.originalEvent.actualStartDate !==
            this.originalEvent.actualEndDate
        ) {
          this.initialEndDateValue = this.originalEvent.actualEndDate;
          this.isDateRange = true;
        } else {
          this.initialEndDateValue = this.originalEvent.actualStartDate;
          this.isDateRange = false;
        }
      } else {
        // Fallback if actualStartDate isn't available (e.g., older data not yet scanned/migrated)
        // This will use the Monday of the weekKey, as before.
        const firstDayOfEventWeek = this.convertWeekToDate(
          this.originalEvent.weekKey
        );
        this.initialSingleDateValue = firstDayOfEventWeek;
        this.initialStartDateValue = firstDayOfEventWeek;
        if (
          this.originalEvent.endWeekKey &&
          this.originalEvent.endWeekKey !== this.originalEvent.weekKey
        ) {
          this.initialEndDateValue = this.convertWeekToDate(
            this.originalEvent.endWeekKey
          );
          this.isDateRange = true;
        } else {
          this.initialEndDateValue = firstDayOfEventWeek;
          this.isDateRange = false;
        }
      }
    } else {
      // ADD MODE (e.g., from "Add Event" button in sidebar, no specific cell/event targeted)
      this.isEditMode = false;
      // Initial values already set to todayStr
      // selectedWeekKey will be determined when the user picks a date in the modal
      this.selectedTypeId =
        this.plugin.settings.eventTypes.length > 0
          ? this.plugin.settings.eventTypes[0].id
          : "preset_major_life";
    }

    if (
      !this.plugin.settings.eventTypes ||
      this.plugin.settings.eventTypes.length === 0
    ) {
      this.selectedTypeId = "";
    } else if (
      !this.plugin.settings.eventTypes.some(
        (et) => et.id === this.selectedTypeId
      )
    ) {
      this.selectedTypeId = this.plugin.settings.eventTypes[0]?.id || ""; // Fallback if current type invalid
    }
  }

  // Keep convertWeekToDate as it's used to set initial input values
  convertWeekToDate(weekKey: string): string {
    const parts = weekKey.split("-W");
    if (parts.length !== 2) return "";
    try {
      const year = parseInt(parts[0]);
      const week = parseInt(parts[1]);

      // Calculate date based on ISO week definition (Monday of the week)
      const simpleDate = new Date(year, 0, 1 + (week - 1) * 7);
      // Adjust to the 4th day (Thursday) which is always in week 1 of the ISO year
      const dayOfWeekJan1 = new Date(year, 0, 1).getDay(); // 0=Sun..6=Sat
      const daysToJan4 =
        dayOfWeekJan1 <= 4 ? 4 - dayOfWeekJan1 : 11 - dayOfWeekJan1; // Days from Jan 1 to Jan 4
      const firstWeekThursday = new Date(year, 0, 1 + daysToJan4);
      const targetWeekMonday = new Date(firstWeekThursday);
      targetWeekMonday.setDate(
        firstWeekThursday.getDate() + (week - 1) * 7 - 3
      ); // Adjust from Thursday to Monday

      return targetWeekMonday.toISOString().split("T")[0];
    } catch (e) {
      console.error("Error converting week key to date:", e);
      return new Date().toISOString().split("T")[0]; // Fallback
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    // Set modal title based on mode
    contentEl.createEl("h2", {
      text: this.isEditMode ? "Edit Life Event" : "Add Life Event",
    });

    // --- Date selection ---
    const dateContainer = contentEl.createDiv({
      cls: "chronica-date-picker-container",
    });
    dateContainer.createEl("h3", { text: "Select Date(s)" });

    const dateTypeContainer = dateContainer.createDiv({
      cls: "date-type-selector",
    });

    // Default to single date mode unless already set for range (e.g. for editing a range event later)
    // For a brand new event from the sidebar, this.isDateRange is false by default.
    // If this.selectedEndWeekKey has a value, it implies a range might be intended or pre-filled.
    if (
      this.selectedWeekKey &&
      this.selectedEndWeekKey &&
      this.selectedEndWeekKey !== this.selectedWeekKey
    ) {
      this.isDateRange = true;
    } else {
      this.isDateRange = false;
    }

    const singleDateOption = dateTypeContainer.createEl("label", {
      cls: "date-option",
    });
    const singleDateRadio = singleDateOption.createEl("input", {
      type: "radio",
      attr: { name: "date-type", value: "single" }, // 'checked' will be set below
    });
    singleDateOption.createEl("span", { text: "Single Date" });

    const rangeDateOption = dateTypeContainer.createEl("label", {
      cls: "date-option",
    });
    const rangeDateRadio = rangeDateOption.createEl("input", {
      type: "radio",
      attr: { name: "date-type", value: "range" }, // 'checked' will be set below
    });
    rangeDateOption.createEl("span", { text: "Date Range" });

    // --- Single Date Container & Input ---
    const singleDateContainer = contentEl.createDiv({
      cls: "single-date-container",
    });
    const singleDateSetting = new Setting(singleDateContainer).setName("Date");
    this.singleDateInput = singleDateSetting.controlEl.createEl("input", {
      type: "date",
      value: this.initialSingleDateValue, // MODIFIED
    });
    this.singleDateInput.addEventListener("change", () => {
      if (!this.isDateRange) {
        const specificDate = this.singleDateInput.value;
        if (specificDate) {
          try {
            this.selectedWeekKey = this.plugin.getWeekKeyFromDate(
              new Date(specificDate)
            );
          } catch (e) {
            console.error("Error parsing single date:", e);
          }
          this.updateWeekInfo(contentEl);
        }
      }
    });

    // --- Range Date Container & Inputs ---
    const rangeDateContainer = contentEl.createDiv({
      cls: "range-date-container",
    });

    const startDateSetting = new Setting(rangeDateContainer).setName(
      "Start Date"
    );
    this.startDateInput = startDateSetting.controlEl.createEl("input", {
      type: "date",
      value: this.initialStartDateValue, // MODIFIED
    });

    const endDateSetting = new Setting(rangeDateContainer).setName("End Date");
    this.endDateInput = endDateSetting.controlEl.createEl("input", {
      type: "date",
      value: this.initialEndDateValue, // MODIFIED
    });
    // Create a small element for validation messages for the date range
    const rangeValidationMessageEl = rangeDateContainer.createEl("small", {
      cls: "chronica-date-validation-message", // Class for styling (color, margin, etc.)
    });
    rangeValidationMessageEl.classList.add("hidden"); // Initially hidden using the class

    // Function to validate the date range and update UI feedback
    const validateDateRange = () => {
      const startDateVal = this.startDateInput.value;
      const endDateVal = this.endDateInput.value;

      const isValid = () => {
        // Helper to avoid multiple returns affecting class toggle
        if (startDateVal && endDateVal) {
          if (new Date(endDateVal) < new Date(startDateVal)) {
            rangeValidationMessageEl.textContent =
              "End date cannot be before start date.";
            return false; // Invalid
          }
        }
        return true; // Valid or not enough info to be definitively invalid
      };

      if (!isValid()) {
        rangeValidationMessageEl.classList.remove("hidden"); // SHOW
      } else {
        rangeValidationMessageEl.classList.add("hidden"); // HIDE
        rangeValidationMessageEl.textContent = ""; // Clear text when hiding
      }
      return isValid(); // Return the actual validation status
    };

    // Set the initial min for the date picker UI, but don't update it aggressively
    if (this.startDateInput.value) {
      this.endDateInput.min = this.startDateInput.value;
    }

    this.startDateInput.addEventListener("change", () => {
      const specificDate = this.startDateInput.value;
      if (specificDate) {
        try {
          this.selectedWeekKey = this.plugin.getWeekKeyFromDate(
            new Date(specificDate)
          );
        } catch (e) {
          console.error("Error parsing start date:", e);
        }

        // If end date is now before new start date, or end date is empty, update end date input value
        if (
          !this.endDateInput.value ||
          new Date(this.endDateInput.value) < new Date(specificDate)
        ) {
          this.endDateInput.value = specificDate;
          try {
            // Also update selectedEndWeekKey if endDateInput was changed
            this.selectedEndWeekKey = this.plugin.getWeekKeyFromDate(
              new Date(this.endDateInput.value)
            );
          } catch (e) {
            console.error("Error parsing end date (on start change):", e);
          }
        }
        // Set the min attribute for the end date picker UI *once* the start date is committed.
        // This helps the picker, but won't overly restrict typing.
        this.endDateInput.min = this.startDateInput.value;
        validateDateRange(); // Validate after potential changes
        this.updateWeekInfo(contentEl);
      }
    });

    this.endDateInput.addEventListener("input", () => {
      // Use 'input' for more immediate feedback while typing
      validateDateRange(); // Check validity as user types or changes
      // Note: We don't try to update selectedEndWeekKey on every 'input' event for performance.
      // It will be updated on 'change' or before saving.
    });

    this.endDateInput.addEventListener("change", () => {
      // 'change' fires on blur or picker selection
      const specificDate = this.endDateInput.value;
      if (specificDate) {
        try {
          this.selectedEndWeekKey = this.plugin.getWeekKeyFromDate(
            new Date(specificDate)
          );
        } catch (e) {
          console.error("Error parsing end date:", e);
        }
      }
      validateDateRange(); // Final validation on committed change
      this.updateWeekInfo(contentEl);
    });

    // Initial validation state
    validateDateRange();

    // Function to set the UI state for date type
    const setDateTypeUI = (isRange: boolean) => {
      this.isDateRange = isRange;
      if (isRange) {
        singleDateRadio.checked = false;
        rangeDateRadio.checked = true;
        singleDateContainer.classList.add("hidden"); // MODIFIED LINE
        rangeDateContainer.classList.remove("hidden"); // MODIFIED LINE
        // ... rest of the if block (ensure startDateInput and endDateInput values are set correctly)
        if (this.singleDateInput.value) {
          // This logic should remain
          if (!this.startDateInput.value)
            this.startDateInput.value = this.singleDateInput.value;
          if (
            !this.endDateInput.value ||
            new Date(this.endDateInput.value) <
              new Date(this.startDateInput.value)
          ) {
            this.endDateInput.value = this.startDateInput.value;
          }
        }
        try {
          this.selectedWeekKey = this.plugin.getWeekKeyFromDate(
            new Date(this.startDateInput.value)
          );
        } catch {}
        try {
          this.selectedEndWeekKey = this.plugin.getWeekKeyFromDate(
            new Date(this.endDateInput.value)
          );
        } catch {}
        validateDateRange(); // This should also remain
      } else {
        singleDateRadio.checked = true;
        rangeDateRadio.checked = false;
        singleDateContainer.classList.remove("hidden"); // MODIFIED LINE
        rangeDateContainer.classList.add("hidden"); // MODIFIED LINE
        // ... rest of the else block (ensure selectedWeekKey is set correctly)
        if (this.singleDateInput.value) {
          // This logic should remain
          try {
            this.selectedWeekKey = this.plugin.getWeekKeyFromDate(
              new Date(this.singleDateInput.value)
            );
          } catch {}
        }
        this.selectedEndWeekKey = ""; // This should remain
        rangeValidationMessageEl.classList.add("hidden");
        rangeValidationMessageEl.textContent = "";
      }
      this.updateWeekInfo(contentEl);
    };

    // Event listeners for radio buttons (should remain the same)
    singleDateRadio.addEventListener("change", () => {
      if (singleDateRadio.checked) {
        setDateTypeUI(false);
      }
    });
    rangeDateRadio.addEventListener("change", () => {
      if (rangeDateRadio.checked) {
        setDateTypeUI(true);
      }
    });

    contentEl.appendChild(singleDateContainer);
    contentEl.appendChild(rangeDateContainer);

    // Set initial state explicitly
    setDateTypeUI(this.isDateRange);

    contentEl.createEl("small", {
      text: "Select the date(s). The system determines the week(s) automatically.",
      cls: "chronica-helper-text",
    });
    contentEl.createDiv({ cls: "chronica-week-info" });
    this.updateWeekInfo(contentEl); // Initial update

    // --- Event Details ---
    new Setting(contentEl)
      .setName("Event Name / Title")
      .setDesc("Short title (used for note name if created)")
      .addText((text) => {
        this.eventNameInputEl = text.inputEl; // Store reference
        text
          .setPlaceholder("e.g., Trip to Paris, Project Launch")
          .setValue(this.eventName) // THIS WILL PRE-FILL (this.eventName is set in constructor for edit mode)
          .onChange((value) => {
            this.eventName = value;
          });
      });
    new Setting(contentEl)
      .setName("Description")
      .setDesc("Details about the event (shown on hover)")
      .addText((text) => {
        this.eventDescriptionInputEl = text.inputEl; // Store reference
        text
          .setPlaceholder("e.g., Explored museums, finished phase 1")
          .setValue(this.eventDescription) // THIS WILL PRE-FILL (this.eventDescription is set in constructor for edit mode)
          .onChange((value) => {
            this.eventDescription = value;
          });
      });

    // --- Event Type Selection (Dropdown) ---
    const typeSetting = new Setting(contentEl)
      .setName("Event Type")
      .setDesc("Choose the category for this event, or create a new one.");

    const controlWrapper = typeSetting.controlEl.createDiv({
      cls: "chronica-event-type-control-wrapper",
    });

    const colorIndicator = controlWrapper.createEl("span", {
      cls: "chronica-event-type-color-indicator",
    });

    this.eventTypeDropdown = controlWrapper.createEl("select", {
      cls: "chronica-select",
    });

    // Helper to update the color indicator span
    const updateColorIndicatorUI = (typeId: string) => {
      // Clear existing preset classes
      const classesToRemove: string[] = [];
      for (let i = 0; i < colorIndicator.classList.length; i++) {
        const cls = colorIndicator.classList[i];
        if (cls.startsWith("indicator-preset-")) {
          classesToRemove.push(cls);
        }
      }
      if (classesToRemove.length > 0) {
        colorIndicator.classList.remove(...classesToRemove);
      }
      // Clear custom color variable
      colorIndicator.style.removeProperty("--event-type-indicator-color");

      if (typeId === "CREATE_NEW_TYPE" || !typeId) {
        // No specific type selected or creating new, ensure transparent/default
        // The removeProperty above already handles this, relying on CSS fallback
        return;
      }

      const selectedType = this.plugin.settings.eventTypes.find(
        (type) => type.id === typeId
      );

      if (selectedType) {
        if (selectedType.isPreset) {
          // For preset types, add the specific class
          const safePresetId = selectedType.id.replace(/[^a-zA-Z0-9-_]/g, "-");
          colorIndicator.classList.add(`indicator-${safePresetId}`);
        } else {
          // For custom types, set the CSS variable
          colorIndicator.style.setProperty(
            "--event-type-indicator-color",
            selectedType.color
          );
        }
      } else {
        // Type not found, ensure transparent/default (already handled by clearing)
      }
    };

    // Helper to populate the dropdown
    // It now also ensures this.selectedTypeId is valid after population
    const repopulateAndSelectType = (targetTypeId?: string) => {
      const currentValue = this.eventTypeDropdown.value;
      this.eventTypeDropdown.empty();

      if (
        this.plugin.settings.eventTypes &&
        this.plugin.settings.eventTypes.length > 0
      ) {
        this.plugin.settings.eventTypes.forEach((type) => {
          const option = this.eventTypeDropdown.createEl("option");
          option.value = type.id;
          option.text = type.name;
        });
      }

      const createNewOption = this.eventTypeDropdown.createEl("option");
      createNewOption.value = "CREATE_NEW_TYPE";
      createNewOption.text = "✨ Create New Type...";

      let idToSelect = targetTypeId;

      if (
        idToSelect &&
        this.eventTypeDropdown.querySelector(`option[value="${idToSelect}"]`)
      ) {
        this.eventTypeDropdown.value = idToSelect;
      } else if (this.plugin.settings.eventTypes.length > 0) {
        idToSelect = this.plugin.settings.eventTypes[0].id;
        this.eventTypeDropdown.value = idToSelect;
      } else {
        idToSelect = "CREATE_NEW_TYPE"; // Fallback if no types exist
        this.eventTypeDropdown.value = idToSelect;
      }

      // CRITICALLY UPDATE this.selectedTypeId based on the actual selection
      // unless it's CREATE_NEW_TYPE, in which case selectedTypeId should be what it was before, or default.
      if (this.eventTypeDropdown.value !== "CREATE_NEW_TYPE") {
        this.selectedTypeId = this.eventTypeDropdown.value;
      }
      // If targetTypeId was explicitly "CREATE_NEW_TYPE" or undefined and it defaulted to it,
      // selectedTypeId should reflect the *actual underlying* type or be null.
      // This logic is tricky; the main goal is selectedTypeId MUST NOT be "CREATE_NEW_TYPE" when saveEvent is called.

      updateColorIndicatorUI(this.selectedTypeId); // Update based on the true selectedTypeId
    };

    // Initialize this.selectedTypeId if it's not already a valid one
    if (
      !this.selectedTypeId ||
      !this.plugin.settings.eventTypes.find(
        (type) => type.id === this.selectedTypeId
      )
    ) {
      if (this.plugin.settings.eventTypes.length > 0) {
        this.selectedTypeId = this.plugin.settings.eventTypes[0].id;
      } else {
        this.selectedTypeId = ""; // No valid types available initially
      }
    }

    repopulateAndSelectType(this.selectedTypeId); // Initial population, trying to select current this.selectedTypeId

    this.eventTypeDropdown.addEventListener("change", () => {
      const dropdownValue = this.eventTypeDropdown.value;

      if (dropdownValue === "CREATE_NEW_TYPE") {
        // Store the ID that was selected *before* user clicked "Create New"
        // this.selectedTypeId should already hold this valid ID from the previous selection or init.
        const idBeforeCreating = this.selectedTypeId;

        new CreateEventTypeModal(this.app, this.plugin, (newType) => {
          if (newType) {
            // Successfully created a new type
            this.selectedTypeId = newType.id; // THIS IS THE KEY: Update the modal's state
            repopulateAndSelectType(newType.id); // Repopulate and select the new one
          } else {
            // Creation cancelled, revert to what was selected before "Create New Type..."
            this.selectedTypeId = idBeforeCreating;
            repopulateAndSelectType(idBeforeCreating);
          }
        }).open();

        // After launching the modal, visually reset the dropdown to what was selected before "Create New"
        // The callback will handle the final state.
        if (
          idBeforeCreating &&
          this.eventTypeDropdown.querySelector(
            `option[value="${idBeforeCreating}"]`
          )
        ) {
          this.eventTypeDropdown.value = idBeforeCreating;
        } else if (this.plugin.settings.eventTypes.length > 0) {
          this.eventTypeDropdown.value = this.plugin.settings.eventTypes[0].id;
        } else {
          this.eventTypeDropdown.value = "CREATE_NEW_TYPE";
        }
        updateColorIndicatorUI(
          this.eventTypeDropdown.value === "CREATE_NEW_TYPE"
            ? ""
            : this.eventTypeDropdown.value
        );
      } else {
        // A regular, existing type was selected
        this.selectedTypeId = dropdownValue; // Update the modal's state
        updateColorIndicatorUI(this.selectedTypeId);
      }
    });

    // --- Save Button ---
    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText(this.isEditMode ? "Update Event" : "Save Event") // Dynamically set button text
        .setCta()
        .onClick(() => {
          this.saveEvent();
        })
    );
  }

  /** Helper to update the displayed week info */
  updateWeekInfo(contentEl: HTMLElement): void {
    const infoEl = contentEl.querySelector(".chronica-week-info");
    if (!infoEl) return;
    if (this.isDateRange) {
      if (this.selectedWeekKey && this.selectedEndWeekKey) {
        infoEl.textContent =
          this.selectedWeekKey === this.selectedEndWeekKey
            ? `Selected week: ${this.selectedWeekKey}`
            : `Selected range: ${this.selectedWeekKey} to ${this.selectedEndWeekKey}`;
      } else {
        infoEl.textContent = "Select start and end dates.";
      }
    } else {
      if (this.selectedWeekKey) {
        infoEl.textContent = `Selected week: ${this.selectedWeekKey}`;
      } else {
        infoEl.textContent = "Select a date.";
      }
    }
  }

  async saveEvent(): Promise<void> {
    const finalEventName = this.eventName.trim();
    const finalDescription = this.eventDescription.trim() || finalEventName;

    if (!finalEventName && !finalDescription) {
      // If both are empty, there's nothing to save as a title/desc
      new Notice("Please add an event name or description.");
      return;
    }
    if (!this.selectedTypeId) {
      new Notice("Please select an event type.");
      return;
    }

    let startDate: Date;
    let endDate: Date | undefined = undefined;

    const rangeValidationMessageEl = this.contentEl.querySelector(
      ".chronica-date-validation-message"
    ) as HTMLElement | null;

    if (this.isDateRange) {
      if (!this.startDateInput.value || !this.endDateInput.value) {
        new Notice("Please select a start and end date for the range.");
        if (rangeValidationMessageEl) {
          rangeValidationMessageEl.textContent =
            "Start and end dates are required.";
          rangeValidationMessageEl.classList.remove("hidden");
        }
        return;
      }
      startDate = new Date(this.startDateInput.value);
      endDate = new Date(this.endDateInput.value);

      if (endDate < startDate) {
        new Notice("End date cannot be before start date. Event not saved.");
        if (rangeValidationMessageEl) {
          rangeValidationMessageEl.textContent =
            "End date cannot be before start date.";
          rangeValidationMessageEl.classList.remove("hidden");
        }
        return;
      }
      if (rangeValidationMessageEl)
        rangeValidationMessageEl.classList.add("hidden");

      try {
        this.selectedWeekKey = this.plugin.getWeekKeyFromDate(startDate);
      } catch {
        new Notice("Invalid start date format.");
        return;
      }
      try {
        this.selectedEndWeekKey = this.plugin.getWeekKeyFromDate(endDate);
      } catch {
        new Notice("Invalid end date format.");
        return;
      }
    } else {
      if (!this.singleDateInput.value) {
        new Notice("Please select a date.");
        return;
      }
      startDate = new Date(this.singleDateInput.value);
      try {
        this.selectedWeekKey = this.plugin.getWeekKeyFromDate(startDate);
      } catch {
        new Notice("Invalid date format.");
        return;
      }
      this.selectedEndWeekKey = ""; // Ensure it's cleared for single dates
    }

    if (!this.selectedWeekKey) {
      new Notice("Could not determine week key.");
      return;
    }

    await this.plugin.loadSettings();

    // Determine the actual event name to use (prioritize modal's eventName field)
    const nameForEventObject = finalEventName || finalDescription;
    // Ensure description is set, defaulting to nameForEventObject if user left description field blank
    const descriptionForEventObject = finalDescription || nameForEventObject;

    if (this.isEditMode && this.originalEvent) {
      // --- EDIT MODE ---
      // Find the event to update by matching its original properties,
      // as the array reference might have changed due to background scans.
      const original = this.originalEvent; // Local const for easier access
      const eventToUpdate = this.plugin.settings.events.find(
        (eventInSettings) => {
          // Match based on key properties that defined the event when it was opened for editing.
          // Note: If events could have identical weekKey, name, description, and typeId,
          // this could still pick the wrong one if multiple such identical events exist.
          // A truly unique event ID would be the best solution for future robustness.
          const periodMatches =
            original.endWeekKey && original.endWeekKey !== original.weekKey
              ? eventInSettings.weekKey === original.weekKey &&
                eventInSettings.endWeekKey === original.endWeekKey
              : eventInSettings.weekKey === original.weekKey &&
                (!eventInSettings.endWeekKey ||
                  eventInSettings.endWeekKey === eventInSettings.weekKey);

          return (
            periodMatches &&
            eventInSettings.name === original.name && // original.name could be undefined
            eventInSettings.description === original.description &&
            eventInSettings.typeId === original.typeId &&
            eventInSettings.notePath === original.notePath
          ); // Also match notePath if it existed
        }
      );

      if (eventToUpdate) {
        // Preserve original notePath unless significant changes necessitate a new note
        // const oldNotePath = eventToUpdate.notePath; // eventToUpdate IS the object from settings

        eventToUpdate.weekKey = this.selectedWeekKey;
        eventToUpdate.name = nameForEventObject;
        eventToUpdate.description = descriptionForEventObject;
        eventToUpdate.typeId = this.selectedTypeId;
        eventToUpdate.endWeekKey =
          this.isDateRange &&
          this.selectedEndWeekKey &&
          this.selectedEndWeekKey !== this.selectedWeekKey
            ? this.selectedEndWeekKey
            : undefined;

        // Logic for updating/creating note
        const noteProcessed = await this.createOrUpdateEventNote(
          eventToUpdate, // Pass the event object from the settings array
          finalEventName,
          startDate,
          endDate
        );
        // eventToUpdate.notePath is updated by createOrUpdateEventNote directly on the object from settings
        if (!noteProcessed && !eventToUpdate.notePath) {
          // If note processing failed AND there's no note path, something might be wrong.
          // However, the event data itself is updated in eventToUpdate.
        }

        await this.plugin.saveSettings();
        new Notice(`Event "${nameForEventObject}" updated.`);
      } else {
        new Notice(
          "Error: Original event not found for update. Could not save changes. The event might have been modified or deleted externally."
        );
        // Do not proceed with adding a new event if edit failed this way.
        this.close();
        this.refreshViews();
        return;
      }
    } else {
      const newEvent: ChronicaEvent = {
        weekKey: this.selectedWeekKey,
        name: nameForEventObject,
        description: descriptionForEventObject,
        typeId: this.selectedTypeId,
      };
      if (
        this.isDateRange &&
        this.selectedEndWeekKey &&
        this.selectedEndWeekKey !== this.selectedWeekKey
      ) {
        newEvent.endWeekKey = this.selectedEndWeekKey;
      }

      // Attempt to create note and link its path
      try {
        await this.createOrUpdateEventNote(
          newEvent,
          finalEventName,
          startDate,
          endDate
        );
        // newEvent.notePath will be set within createOrUpdateEventNote if successful
      } catch (e) {
        console.error("Chronica: Failed to create event note during add.", e);
        new Notice(
          "Event saved to settings, but failed to create linked note."
        );
      }

      this.plugin.settings.events.push(newEvent);
      await this.plugin.saveSettings();
      new Notice(`Event "${nameForEventObject}" added.`);
    }

    this.close();
    this.refreshViews();
  }

  /** Creates an event note if it doesn't exist, or updates frontmatter if it does. */
  async createOrUpdateEventNote(
    event: ChronicaEvent, // This IS the object from this.plugin.settings.events being updated
    eventNameForDisplay: string, // The name/title from the modal, used for generating filename
    startDate: Date, // The actual start date from the modal
    endDate?: Date // The actual end date from the modal, if it's a range
  ): Promise<boolean> {
    const plugin = this.plugin;

    // --- 1. Get Original Note Info (if any) ---
    const originalNotePathFromEvent = event.notePath; // The path stored in the event object *before* this save operation
    let originalFileInstance: TFile | null = null;
    let originalBodyContent = ""; // Default to empty; will be populated if an original note is found

    if (originalNotePathFromEvent) {
      const abstractFile = plugin.app.vault.getAbstractFileByPath(
        originalNotePathFromEvent
      );
      if (abstractFile instanceof TFile) {
        originalFileInstance = abstractFile;
        const rawContent = await plugin.app.vault.read(originalFileInstance);
        // Extract content after frontmatter
        const frontmatterMatch = rawContent.match(
          /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]*/
        );
        originalBodyContent = frontmatterMatch
          ? rawContent.substring(frontmatterMatch[0].length)
          : rawContent;
      } else {
        // The event had a notePath, but the file is missing.
        // The event.notePath will be updated if a new note is created, or remain undefined.
      }
    }

    // --- 2. Generate New Filename and Frontmatter based on current (potentially edited) event state ---
    const eventType = plugin.settings.eventTypes.find(
      (et) => et.id === event.typeId
    );
    if (!eventType) {
      new Notice(
        `Chronica: Event type ID "${event.typeId}" not found. Cannot process note for event "${eventNameForDisplay}".`
      );
      return false;
    }

    const sanitizedEventName = eventNameForDisplay
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, "_");
    const newMetadata: Record<string, any> = {
      event: eventNameForDisplay,
      name: eventNameForDisplay,
      description: event.description,
      type: eventType.name, // Use the user-visible type NAME in frontmatter
      startDate: startDate.toISOString().split("T")[0],
    };

    // Determine if it's effectively a range event for naming and metadata
    const isRangeEvent =
      event.endWeekKey && endDate && event.weekKey !== event.endWeekKey;
    if (isRangeEvent) {
      newMetadata.endDate = endDate!.toISOString().split("T")[0]; // endDate is asserted non-null by isRangeEvent
    }

    let newTargetFileName = "";
    const basePlaceholders = {
      eventName: sanitizedEventName,
      startDate: newMetadata.startDate,
      YYYY: startDate.getFullYear().toString(),
      MM: (startDate.getMonth() + 1).toString().padStart(2, "0"),
      DD: startDate.getDate().toString().padStart(2, "0"),
      MMMM: startDate.toLocaleString("default", { month: "long" }),
      MMM: startDate.toLocaleString("default", { month: "short" }),
      YY: startDate.getFullYear().toString().slice(-2),
    };

    if (isRangeEvent) {
      const rangePlaceholders = {
        ...basePlaceholders,
        endDate: newMetadata.endDate,
        start_gggg: event.weekKey.split("-")[0],
        start_ww: event.weekKey.split("-W")[1],
        end_gggg: event.endWeekKey!.split("-")[0], // event.endWeekKey is non-null due to isRangeEvent
        end_ww: event.endWeekKey!.split("-W")[1],
        startDate_YYYY: startDate.getFullYear().toString(), // Redundant but for clarity if template uses it
        startDate_MM: (startDate.getMonth() + 1).toString().padStart(2, "0"),
        startDate_DD: startDate.getDate().toString().padStart(2, "0"),
        startDate_MMMM: startDate.toLocaleString("default", { month: "long" }),
        startDate_MMM: startDate.toLocaleString("default", { month: "short" }),
        startDate_YY: startDate.getFullYear().toString().slice(-2),
        endDate_YYYY: endDate!.getFullYear().toString(),
        endDate_MM: (endDate!.getMonth() + 1).toString().padStart(2, "0"),
        endDate_DD: endDate!.getDate().toString().padStart(2, "0"),
        endDate_MMMM: endDate!.toLocaleString("default", { month: "long" }),
        endDate_MMM: endDate!.toLocaleString("default", { month: "short" }),
        endDate_YY: endDate!.getFullYear().toString().slice(-2),
      };
      newTargetFileName = plugin.formatFileName(
        plugin.settings.rangeNoteTemplate,
        rangePlaceholders
      );
    } else {
      const singlePlaceholders = {
        ...basePlaceholders,
        gggg: event.weekKey.split("-")[0],
        ww: event.weekKey.split("-W")[1],
      };
      newTargetFileName = plugin.formatFileName(
        plugin.settings.eventNoteTemplate,
        singlePlaceholders
      );
    }

    const newTargetFullPath = plugin.getFullPath(newTargetFileName, true);
    const newFrontmatterString = plugin.formatFrontmatter(newMetadata);

    // Use original body content if available, otherwise a default for new notes
    const finalBodyContentToUse =
      originalFileInstance && originalNotePathFromEvent
        ? originalBodyContent
        : "\n## **Event Notes**\n\n";
    const newConsolidatedContent = newFrontmatterString + finalBodyContentToUse;
    // --- 3. Perform File Operations ---
    if (originalFileInstance) {
      if (originalFileInstance.path === newTargetFullPath) {
        // Filename is the same, just update content if it has changed
        if (
          (await plugin.app.vault.cachedRead(originalFileInstance)) !==
          newConsolidatedContent
        ) {
          await plugin.app.vault.modify(
            originalFileInstance,
            newConsolidatedContent
          );
        }
        event.notePath = originalFileInstance.path; // Ensure event.notePath is correctly set
      } else {
        // Filename needs to change. Check for conflicts at the new path.
        const conflictingFile =
          plugin.app.vault.getAbstractFileByPath(newTargetFullPath);
        if (
          conflictingFile &&
          conflictingFile.path !== originalFileInstance.path
        ) {
          // A *different* file already exists at the new target path.
          // Update original note in place, do not rename, inform user.
          new Notice(
            `Chronica: Cannot rename to "${newTargetFileName}". A different file already exists at that location.`
          );
          new Notice(
            `Chronica: Updating current event note "${originalFileInstance.name}" with new details. Its filename will not reflect the changes.`
          );
          if (
            (await plugin.app.vault.cachedRead(originalFileInstance)) !==
            newConsolidatedContent
          ) {
            await plugin.app.vault.modify(
              originalFileInstance,
              newConsolidatedContent
            );
          }
          event.notePath = originalFileInstance.path; // Keep event linked to the original, un-renamed file
        } else {
          // New path is available or conflictingFile is the originalFile itself (which means no actual conflict for rename)
          try {
            await plugin.app.fileManager.renameFile(
              originalFileInstance,
              newTargetFullPath
            );
            event.notePath = newTargetFullPath; // Update event to point to the new path
            // After renaming, get a fresh handle to the file at the new path to modify its content
            const fileHandleAfterRename =
              plugin.app.vault.getAbstractFileByPath(newTargetFullPath);
            if (fileHandleAfterRename instanceof TFile) {
              if (
                (await plugin.app.vault.cachedRead(fileHandleAfterRename)) !==
                newConsolidatedContent
              ) {
                await plugin.app.vault.modify(
                  fileHandleAfterRename,
                  newConsolidatedContent
                );
              }
            } else {
              // This case should ideally not be reached if renameFile succeeded without error.
              console.error(
                `Chronica: File not found at "${newTargetFullPath}" after a supposedly successful rename from "${originalFileInstance.path}". Cannot update content.`
              );
              new Notice(
                `Chronica: Note renamed to "${newTargetFileName}", but failed to update its content post-rename. Please check the file.`
              );
              // event.notePath is already set to newTargetFullPath. Content might be stale if modify failed.
            }
          } catch (e: any) {
            console.error(
              `Chronica: Error renaming note from "${originalNotePathFromEvent}" to "${newTargetFullPath}". Attempting to update original note. Error: ${e.message}`
            );
            new Notice(
              `Error renaming note. Content with new details saved in original note: "${originalNotePathFromEvent}".`
            );
            // Fallback: update original file's content if rename failed, and ensure event still points to it.
            if (originalFileInstance) {
              // Check if originalFileInstance is still valid
              if (
                (await plugin.app.vault.cachedRead(originalFileInstance)) !==
                newConsolidatedContent
              ) {
                await plugin.app.vault.modify(
                  originalFileInstance,
                  newConsolidatedContent
                );
              }
              event.notePath = originalNotePathFromEvent; // Reaffirm event points to the file that was actually modified
            }
          }
        }
      }
    } else {
      // No original file was linked, or the linked file was missing. Create a new note.
      const folderPathForNewNote = newTargetFullPath.substring(
        0,
        newTargetFullPath.lastIndexOf("/")
      );
      // Ensure the target folder exists before creating the note
      if (folderPathForNewNote && folderPathForNewNote.trim() !== "") {
        const folderShouldBe = plugin.settings.useSeparateFolders
          ? plugin.settings.eventNotesFolder
          : plugin.settings.notesFolder;
        if (
          folderPathForNewNote.replace(/\/$/, "") ===
          folderShouldBe.replace(/\/$/, "")
        ) {
          // Check if target folder is the configured one
          try {
            const folderExists =
              plugin.app.vault.getAbstractFileByPath(folderPathForNewNote);
            if (!folderExists) {
              await plugin.app.vault.createFolder(folderPathForNewNote);
            }
          } catch (err: any) {
            console.warn(
              `Chronica: Could not create folder ${folderPathForNewNote}. Note will be saved in vault root if path is root, or creation might fail. Error: ${err.message}`
            );
          }
        }
      }
      try {
        // Use Obsidian's create method which handles filename conflicts by appending (1), (2), etc.
        const newCreatedFile = await plugin.app.vault.create(
          newTargetFullPath,
          newConsolidatedContent
        );
        event.notePath = newCreatedFile.path; // Path might include (1) if there was an unrelated conflict
      } catch (e: any) {
        console.error(
          `Chronica: Error creating new note at "${newTargetFullPath}". Error: ${e.message}`
        );
        new Notice(
          `Error creating new event note. Event data saved, but note creation failed.`
        );
        event.notePath = undefined; // Ensure notePath is not set if creation fails
        return false; // Indicate failure
      }
    }
    return true; // Indicate success
  }

  refreshViews(): void {
    /* ... keep refresh logic ... */
    this.plugin.app.workspace
      .getLeavesOfType(TIMELINE_VIEW_TYPE)
      .forEach((leaf) => {
        const view = leaf.view as ChornicaTimelineView;
        if (view?.renderView) view.renderView();
      });
  }
  onClose(): void {
    this.contentEl.empty();
  }
} // End of ChornicaEventModal class

/**
 * Modal for creating a new event type from within the event creation flow.
 */
class CreateEventTypeModal extends Modal {
  plugin: ChornicaTimelinePlugin;
  onSubmit: (newType: ChronicaEventType | null) => void; // Callback with the new type or null if cancelled

  newTypeName: string = "";
  newTypeColor: string = "#FF9800"; // Default color

  constructor(
    app: App,
    plugin: ChornicaTimelinePlugin,
    onSubmit: (newType: ChronicaEventType | null) => void
  ) {
    super(app);
    this.plugin = plugin;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("chronica-create-event-type-modal"); // Optional: for specific styling if needed

    contentEl.createEl("h3", { text: "Create New Event Type" });

    new Setting(contentEl)
      .setName("Type Name")
      .setDesc("Enter the name for the new event type.")
      .addText((text) =>
        text
          .setPlaceholder("e.g., Personal Milestone")
          .setValue(this.newTypeName)
          .onChange((value) => {
            this.newTypeName = value.trim();
          })
      );

    new Setting(contentEl)
      .setName("Type Color")
      .setDesc("Choose a color for this event type.")
      .addColorPicker((picker) =>
        picker.setValue(this.newTypeColor).onChange((value) => {
          this.newTypeColor = value;
        })
      );

    // Using a general class for modal buttons if you have one, or just a div
    const buttonContainer = contentEl.createDiv({
      cls: "modal-button-container",
    }); // Or your existing class for button groups

    new Setting(buttonContainer)
      .addButton((btn) =>
        btn
          .setButtonText("Save Type")
          .setCta()
          .onClick(async () => {
            if (!this.newTypeName) {
              new Notice("Please enter a type name.");
              return;
            }
            // Ensure eventTypes array exists
            if (!this.plugin.settings.eventTypes) {
              this.plugin.settings.eventTypes = [];
            }
            if (
              this.plugin.settings.eventTypes.some(
                (type) =>
                  type.name.toLowerCase() === this.newTypeName.toLowerCase()
              )
            ) {
              new Notice(`Event type "${this.newTypeName}" already exists.`);
              return;
            }

            const newId = `custom_${Date.now()}_${Math.random()
              .toString(36)
              .substring(2, 7)}`;
            const newType: ChronicaEventType = {
              id: newId,
              name: this.newTypeName,
              color: this.newTypeColor,
              isPreset: false,
            };

            this.plugin.settings.eventTypes.push(newType);
            await this.plugin.saveSettings();
            this.plugin.refreshAllViews();

            new Notice(`Event type "${this.newTypeName}" created.`);
            this.onSubmit(newType);
            this.close();
          })
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => {
          this.onSubmit(null);
          this.close();
        })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

/**
 * Modal for managing all event types (presets and custom).
 * Handles adding, editing (name/color), and deleting (custom only).
 */
class ManageEventTypesModal extends Modal {
  // ... (full class code as provided before) ...
  plugin: ChornicaTimelinePlugin;
  typesListContainer!: HTMLElement; // Container for the list of types

  constructor(app: App, plugin: ChornicaTimelinePlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("chronica-manage-types-modal");
    contentEl.createEl("h2", { text: "Manage Event Types" });
    contentEl.createEl("h3", { text: "Event Types" });
    contentEl.createEl("p", {
      text: "Edit names/colors. Presets cannot be deleted.",
    });
    this.typesListContainer = contentEl.createDiv({
      cls: "existing-types-list-container",
    });
    this.renderTypesList();
    const addSection = contentEl.createDiv({ cls: "event-type-add-section" });
    addSection.createEl("h3", { text: "Add New Custom Type" });
    const nameSetting = new Setting(addSection)
      .setName("Name")
      .addText((text) => text.setPlaceholder("New type name"));
    const nameInput = nameSetting.controlEl.querySelector(
      "input"
    ) as HTMLInputElement;
    const colorSetting = new Setting(addSection)
      .setName("Color")
      .addColorPicker((picker) => picker.setValue("#FF9800"));
    const colorInput = colorSetting.controlEl.querySelector(
      'input[type="color"]'
    ) as HTMLInputElement;
    new Setting(addSection).addButton((button) =>
      button
        .setButtonText("Add Type")
        .setCta()
        .onClick(async () => {
          if (!nameInput || !colorInput) return;
          const name = nameInput.value.trim();
          const color = colorInput.value;
          if (!name) {
            new Notice("Please enter a name.");
            return;
          }
          if (!this.plugin.settings.eventTypes)
            this.plugin.settings.eventTypes = [];
          if (
            this.plugin.settings.eventTypes.some(
              (type) => type.name.toLowerCase() === name.toLowerCase()
            )
          ) {
            new Notice(`Type "${name}" already exists.`);
            return;
          }
          const newId = `custom_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 7)}`;
          const newType: ChronicaEventType = {
            id: newId,
            name: name,
            color: color,
            isPreset: false,
          };
          this.plugin.settings.eventTypes.push(newType);
          await this.plugin.saveSettings();
          new Notice(`Event type "${name}" added.`);
          this.renderTypesList();
          nameInput.value = "";
          colorInput.value = "#FF9800";
          this.plugin.refreshAllViews();
        })
    );
    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText("Close").onClick(() => {
        this.close();
      })
    );
  }

  renderTypesList(): void {
    const container = this.typesListContainer;
    container.empty();
    if (
      !this.plugin.settings.eventTypes ||
      this.plugin.settings.eventTypes.length === 0
    ) {
      container.createEl("p", {
        text: "No event types found. Resetting to defaults.",
      });
      this.plugin.settings.eventTypes = JSON.parse(
        JSON.stringify(DEFAULT_SETTINGS.eventTypes)
      );
      this.plugin.saveSettings();
    }
    const sortedTypes = [...this.plugin.settings.eventTypes].sort((a, b) => {
      if (a.isPreset && !b.isPreset) return -1;
      if (!a.isPreset && b.isPreset) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const type of sortedTypes) {
      const typeItem = container.createEl("div", {
        cls: `event-type-item ${type.isPreset ? "preset-type" : "custom-type"}`,
      });

      const colorBox = typeItem.createEl("span", { cls: "event-type-color" });
      // Clear any existing preset classes
      const classesToRemove: string[] = [];
      for (let i = 0; i < colorBox.classList.length; i++) {
        const cls = colorBox.classList[i];
        if (cls.startsWith("list-preset-")) {
          classesToRemove.push(cls);
        }
      }
      if (classesToRemove.length > 0) {
        colorBox.classList.remove(...classesToRemove);
      }
      // Clear custom color variable
      colorBox.style.removeProperty("--event-type-list-color");

      if (type.color) {
        if (type.isPreset) {
          // For preset types, add the specific class
          const safePresetId = type.id.replace(/[^a-zA-Z0-9-_]/g, "-");
          colorBox.classList.add(`list-${safePresetId}`);
        } else {
          // For custom types, set the CSS variable
          colorBox.style.setProperty("--event-type-list-color", type.color);
        }
      }
      // If no type.color, it will default to transparent via CSS fallback

      const nameEl = typeItem.createEl("span", {
        text: type.name,
        cls: "event-type-name",
      });
      if (type.isPreset)
        nameEl.setAttribute("title", "Preset type (cannot be deleted)");
      const buttonContainer = typeItem.createEl("div", {
        cls: "event-type-actions",
      });
      const editButton = buttonContainer.createEl("button", {
        text: "",
        cls: "edit-type-button clickable-icon",
        attr: { title: `Edit '${type.name}'` },
      });
      setIcon(editButton, "pencil");
      editButton.addEventListener("click", () => {
        this.showEditTypeModal(type);
      });
      if (!type.isPreset) {
        const deleteButton = buttonContainer.createEl("button", {
          text: "",
          cls: "delete-type-button clickable-icon",
          attr: { title: `Delete '${type.name}'` },
        });
        setIcon(deleteButton, "trash-2");

        deleteButton.addEventListener("click", async () => {
          if (
            confirm(
              `Delete type "${type.name}"?\nEvents using it will be reassigned to "Major Life".`
            )
          ) {
            const defaultTypeId = "preset_major_life";
            let reassignedCount = 0;
            if (!this.plugin.settings.events) this.plugin.settings.events = []; // Ensure exists
            this.plugin.settings.events = this.plugin.settings.events.map(
              (event) => {
                if (event.typeId === type.id) {
                  reassignedCount++;
                  return { ...event, typeId: defaultTypeId };
                }
                return event;
              }
            );
            this.plugin.settings.eventTypes =
              this.plugin.settings.eventTypes.filter((t) => t.id !== type.id);
            await this.plugin.saveSettings();
            new Notice(
              `Type "${type.name}" deleted. ${reassignedCount} event(s) reassigned.`
            );
            this.renderTypesList();
            this.plugin.refreshAllViews();
          }
        });
      }
    }
  }

  showEditTypeModal(type: ChronicaEventType): void {
    const modal = new Modal(this.app);
    modal.contentEl.addClass("chronica-edit-type-modal");
    modal.titleEl.setText(`Edit Type: ${type.name}`);
    let currentName = type.name;
    let currentColor = type.color;
    new Setting(modal.contentEl).setName("Name").addText((text) => {
      text.setValue(currentName).onChange((value) => {
        currentName = value.trim();
      });
    });
    new Setting(modal.contentEl).setName("Color").addColorPicker((picker) => {
      picker.setValue(currentColor).onChange((value) => {
        currentColor = value;
      });
    });
    new Setting(modal.contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Save Changes")
          .setCta()
          .onClick(async () => {
            if (!currentName) {
              new Notice("Name cannot be empty.");
              return;
            }
            if (!this.plugin.settings.eventTypes)
              this.plugin.settings.eventTypes = [];
            if (
              this.plugin.settings.eventTypes.some(
                (t) =>
                  t.id !== type.id &&
                  t.name.toLowerCase() === currentName.toLowerCase()
              )
            ) {
              new Notice(`Type "${currentName}" already exists.`);
              return;
            }
            const typeIndex = this.plugin.settings.eventTypes.findIndex(
              (t) => t.id === type.id
            );
            if (typeIndex !== -1) {
              this.plugin.settings.eventTypes[typeIndex].name = currentName;
              this.plugin.settings.eventTypes[typeIndex].color = currentColor;
              await this.plugin.saveSettings();
              new Notice(`Type "${currentName}" updated.`);
              modal.close();
              this.renderTypesList();
              this.plugin.refreshAllViews();
            } else {
              new Notice(`Error: Could not find type with ID ${type.id}.`);
            }
          })
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => {
          modal.close();
        })
      );
    modal.open();
  }

  onClose(): void {
    this.contentEl.empty();
    this.plugin.refreshAllViews();
  } // Refresh on close
}

/**
 * Welcome modal shown to new users
 */
class ChronicaWelcomeModal extends Modal {
  /** Reference to the main plugin */
  plugin: ChornicaTimelinePlugin;

  /**
   * Create a welcome modal
   * @param app - Obsidian App instance
   * @param plugin - ChornicaTimelinePlugin instance
   */
  constructor(app: App, plugin: ChornicaTimelinePlugin) {
    super(app);
    this.plugin = plugin;
  }

  /**
   * Build the modal UI when opened
   */
  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("chronica-welcome-modal");

    // Create header with logo
    const headerEl = contentEl.createEl("div", {
      cls: "chronica-welcome-header",
    });

    // Add plugin icon
    const iconEl = headerEl.createEl("div", {
      cls: "chronica-welcome-icon",
    });
    // Use setIcon to safely add the custom icon SVG
    setIcon(iconEl, "chronica-icon"); // Assuming Chornica_ICON is registered with addIcon

    // Add title
    headerEl.createEl("h1", {
      text: "Welcome to Chronica",
      cls: "chronica-welcome-title",
    });

    // Introduction section
    contentEl.createEl("div", {
      cls: "chronica-welcome-intro",
      text: "Visualize, navigate, and reflect on your life across multiple time scales.",
    });

    // Create setup section
    const setupSection = contentEl.createEl("div", {
      cls: "chronica-welcome-setup",
    });

    setupSection.createEl("h2", {
      text: "Let's get started",
      cls: "chronica-welcome-subtitle",
    });

    setupSection.createEl("p", {
      text: "To create your personal timeline, Chronica needs your birthdate. Let's set that up first.",
    });

    // Birthdate input
    const birthdateSection = setupSection.createEl("div", {
      cls: "chronica-welcome-birthdate",
    });

    birthdateSection.createEl("label", {
      text: "Your birthdate:",
      attr: { for: "chronica-birthdate-input" },
      cls: "chronica-welcome-label",
    });

    const birthdateInput = birthdateSection.createEl("input", {
      attr: {
        type: "date",
        id: "chronica-birthdate-input",
        value: this.plugin.settings.birthday,
      },
      cls: "chronica-welcome-input",
    });

    // Create buttons section
    const buttonsSection = contentEl.createEl("div", {
      cls: "chronica-welcome-buttons",
    });

    // Open settings button
    const settingsButton = buttonsSection.createEl("button", {
      text: "Open Settings",
      cls: "chronica-welcome-button chronica-welcome-primary-button",
    });

    settingsButton.addEventListener("click", () => {
      // Just show a notice directing the user to settings
      new Notice(
        "Please navigate to Settings > Community Plugins > Chronica: Life in Frames to configure your timeline."
      );

      // Mark as seen and close
      this.plugin.settings.hasSeenWelcome = true;
      this.plugin.saveSettings();
      this.close();
    });

    // Apply birthdate button
    const applyButton = buttonsSection.createEl("button", {
      text: "Save Birthdate",
      cls: "chronica-welcome-button chronica-welcome-accent-button",
    });

    applyButton.addEventListener("click", () => {
      const birthdate = birthdateInput.value;

      if (birthdate) {
        this.plugin.settings.birthday = birthdate;
        this.plugin.settings.hasSeenWelcome = true;
        this.plugin.saveSettings().then(() => {
          new Notice("Birthday saved successfully!");
          this.close();

          // Refresh open views
          this.plugin.refreshAllViews();
        });
      } else {
        new Notice("Please enter your birthdate");
      }
    });

    // Skip button
    const skipButton = buttonsSection.createEl("button", {
      text: "Skip for Now",
      cls: "chronica-welcome-button",
    });

    skipButton.addEventListener("click", () => {
      this.plugin.settings.hasSeenWelcome = true;
      this.plugin.saveSettings();
      this.close();
    });

    // Additional information
    contentEl.createEl("div", {
      cls: "chronica-welcome-footer",
      text: "You can always change these settings later by going to Settings > Chronica Timeline.",
    });
  }

  /**
   * Clean up on modal close
   */
  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// -----------------------------------------------------------------------
// TIMELINE VIEW CLASS
// -----------------------------------------------------------------------

/**
 * Main timeline view that shows the life grid and events
 */
class ChornicaTimelineView extends ItemView {
  /** Reference to the main plugin */
  plugin: ChornicaTimelinePlugin;

  /** Track sidebar open/closed state */
  isSidebarOpen: boolean;
  isStatsOpen: boolean;

  // Properties for managing the custom grid cell tooltip
  private activeGridCellTooltip: HTMLElement | null = null;
  private tooltipTimeoutId: number | null = null; // For hover delay to show
  private clearTooltipTimeoutId: number | null = null; // For fade-out delay before removal

  // Properties for managing snippet fetching on sustained hover
  private snippetTimeoutId: number | null = null;
  private currentHoveredCellForSnippet: HTMLElement | null = null; // Keep track of the cell whose tooltip might get a snippet

  isNarrowViewport(): boolean {
    // This function was also part of your class
    return window.innerWidth <= 768;
  }

  constructor(leaf: WorkspaceLeaf, plugin: ChornicaTimelinePlugin) {
    super(leaf);
    this.plugin = plugin;
    this.isSidebarOpen = this.plugin.settings.isSidebarOpen;
    this.isStatsOpen = this.plugin.settings.isStatsOpen;

    // Initialize CSS variables for stats panel
    document.documentElement.style.setProperty(
      "--stats-panel-height",
      `${this.plugin.settings.statsPanelHeight}px`
    );
    document.documentElement.style.setProperty(
      "--stats-panel-width",
      `${this.plugin.settings.statsPanelWidth}px`
    );

    this.registerDomEvent(window, "resize", () => {
      // Reapply layout rules whenever window size changes
      this.updateStatsPanelLayout();
    });
  }

  /**
   * Setup the horizontal resize functionality for the stats panel
   * @param leftHandle - Left handle element for dragging
   * @param rightHandle - Right handle element for dragging
   * @param statsPanel - Panel to resize
   */
  setupStatsPanelHorizontalResize(
    leftHandle: HTMLElement,
    rightHandle: HTMLElement,
    statsPanel: HTMLElement
  ): void {
    let startX = 0;
    let startWidth = 0;

    // Left handle drag (decreases width)
    const onLeftMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();

      startWidth = this.plugin.settings.statsPanelWidth;
      startX = e.clientX;

      document.addEventListener("mousemove", onLeftMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const onLeftMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX;
      const newWidth = Math.max(400, Math.min(1200, startWidth + deltaX));

      document.documentElement.style.setProperty(
        "--stats-panel-width",
        `${newWidth}px`
      );
      this.plugin.settings.statsPanelWidth = newWidth;
    };

    // Right handle drag (increases width)
    const onRightMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();

      startWidth = this.plugin.settings.statsPanelWidth;
      startX = e.clientX;

      document.addEventListener("mousemove", onRightMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const onRightMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(400, Math.min(1200, startWidth + deltaX));

      document.documentElement.style.setProperty(
        "--stats-panel-width",
        `${newWidth}px`
      );
      this.plugin.settings.statsPanelWidth = newWidth;
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onLeftMouseMove);
      document.removeEventListener("mousemove", onRightMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      this.plugin.saveSettings();
    };

    leftHandle.addEventListener("mousedown", onLeftMouseDown);
    rightHandle.addEventListener("mousedown", onRightMouseDown);
  }

  setupStatsPanelHorizontalDrag(
    headerEl: HTMLElement,
    statsPanel: HTMLElement,
    statsHandle: HTMLElement
  ): void {
    let startX = 0;
    let startOffset = 0;

    const onMouseDown = (e: MouseEvent) => {
      // Only respond to left mouse button
      if (e.button !== 0) return;

      // Skip if clicked on a button or other control
      if (
        (e.target as HTMLElement).tagName === "BUTTON" ||
        (e.target as HTMLElement).closest(".chronica-stats-tab") ||
        (e.target as HTMLElement).closest(".chronica-stats-close")
      ) {
        return;
      }

      e.preventDefault();

      // Get current horizontal offset
      startOffset = this.plugin.settings.statsPanelHorizontalOffset || 0;
      startX = e.clientX;

      // Add event listeners
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      // Calculate horizontal change
      const deltaX = e.clientX - startX;

      // Calculate boundaries
      const windowWidth = window.innerWidth;
      const panelWidth = statsPanel.getBoundingClientRect().width;
      const maxOffset = (windowWidth - panelWidth) / 2;
      const newOffset = Math.max(
        -maxOffset,
        Math.min(maxOffset, startOffset + deltaX)
      );

      // Apply horizontal offset to panel and handle
      statsPanel.style.transform = `translateX(calc(-50% + ${newOffset}px))`;
      statsHandle.style.transform = `translateX(calc(-50% + ${newOffset}px))`;

      // Update setting (but don't save yet)
      this.plugin.settings.statsPanelHorizontalOffset = newOffset;
    };

    const onMouseUp = () => {
      // Remove event listeners
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      // Save settings
      this.plugin.saveSettings();
    };

    // Add initial event listener
    headerEl.addEventListener("mousedown", onMouseDown);
  }

  /**
   * Clear any cached event data and event-specific classes from grid cells.
   */
  clearCachedEventData(): void {
    const cells = this.containerEl.querySelectorAll(".chronica-grid-cell");
    cells.forEach((cell) => {
      const cellEl = cell as HTMLElement;

      // Clear data attributes
      delete cellEl.dataset.eventFile;
      // delete cellEl.dataset.checkingEvents; // This was from an old async pattern, likely safe to remove

      // Clear generic event class and future highlight
      cellEl.classList.remove("event", "future-event-highlight");

      // Remove *any* class starting with "event-type-"
      const classesToRemove: string[] = [];
      for (let i = 0; i < cellEl.classList.length; i++) {
        if (cellEl.classList[i].startsWith("event-type-")) {
          classesToRemove.push(cellEl.classList[i]);
        }
      }
      if (classesToRemove.length > 0) {
        cellEl.classList.remove(...classesToRemove);
      }

      // Clear only event-related inline styles, allowing base past/present/future CSS to take over
      cellEl.style.removeProperty("background-color");
      cellEl.style.removeProperty("border-color");
      cellEl.style.removeProperty("border-width");
      cellEl.style.removeProperty("border-style");
      // Do NOT clear: cell.style.position, top, left, width, height if set by grid rendering
    });
  }

  /**
   * Setup left and right resize handles for the stats panel
   * @param statsPanel - Panel to resize
   */
  setupStatsPanelWidthResize(statsPanel: HTMLElement): void {
    // Create left and right resize handles
    const leftHandle = statsPanel.createEl("div", {
      cls: "chronica-stats-left-handle",
    });
    const rightHandle = statsPanel.createEl("div", {
      cls: "chronica-stats-right-handle",
    });

    let startX = 0;
    let startWidth = 0;

    // Left handle drag (decreases width)
    const onLeftMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();

      startWidth = this.plugin.settings.statsPanelWidth;
      startX = e.clientX;

      document.addEventListener("mousemove", onLeftMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const onLeftMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX;
      const newWidth = Math.max(400, Math.min(1200, startWidth + deltaX));

      document.documentElement.style.setProperty(
        "--stats-panel-width",
        `${newWidth}px`
      );
      statsPanel.style.width = `${newWidth}px`;
      this.plugin.settings.statsPanelWidth = newWidth;
    };

    // Right handle drag (increases width)
    const onRightMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();

      startWidth = this.plugin.settings.statsPanelWidth;
      startX = e.clientX;

      document.addEventListener("mousemove", onRightMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const onRightMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(400, Math.min(1200, startWidth + deltaX));

      document.documentElement.style.setProperty(
        "--stats-panel-width",
        `${newWidth}px`
      );
      statsPanel.style.width = `${newWidth}px`;
      this.plugin.settings.statsPanelWidth = newWidth;
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onLeftMouseMove);
      document.removeEventListener("mousemove", onRightMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      this.plugin.saveSettings();
    };

    leftHandle.addEventListener("mousedown", onLeftMouseDown);
    rightHandle.addEventListener("mousedown", onRightMouseDown);
  }

  /**
   * Get the unique view type
   */
  getViewType(): string {
    return TIMELINE_VIEW_TYPE;
  }

  /**
   * Get display name for the view
   */
  getDisplayText(): string {
    return "Chronica - Life in Frames";
  }

  /**
   * Get icon for the view
   */
  getIcon(): string {
    return "calendar-days";
  }

  /**
   * Initialize the view when opened
   */
  async onOpen(): Promise<void> {
    const contentEl = this.containerEl.children[1];
    contentEl.empty();
    contentEl.addClass("chronica-timeline-container");

    document.documentElement.style.setProperty(
      "--stats-panel-height",
      `${this.plugin.settings.statsPanelHeight}px`
    );
    document.documentElement.style.setProperty(
      "--stats-panel-width",
      `${this.plugin.settings.statsPanelWidth}px`
    );

    // Check if the plugin's initial scan is complete
    if (this.plugin.isReady()) {
      this.renderView(); // Render the full view
      if (this.plugin.settings.defaultFitToScreen) {
        setTimeout(() => {
          if (this.plugin.isReady()) {
            // Double check before fitting
            this.fitToScreen();
          }
        }, 100);
      }
    } else {
      // Plugin is not ready yet, show a loading message
      contentEl.createEl("p", {
        text: "Chronica is initializing and scanning events. Please wait a moment...",
        cls: "chronica-loading-message", // Added class for potential styling
      });
      // The view will be refreshed by the plugin's onload once the scan is complete and isReady() is true.
    }
  }

  /**
   * Clean up when view is closed
   */
  async onClose(): Promise<void> {
    const contentEl = this.containerEl.children[1];
    contentEl.empty();
  }

  /**
   * Render the timeline view with all components using the new event structure.
   */
  renderView(): void {
    const contentEl = this.containerEl.children[1]; // Keep access to contentEl
    if (!contentEl) return; // Safety check if view is closing or not fully setup

    if (!this.plugin.isReady()) {
      if (!contentEl.querySelector(".chronica-loading-message")) {
        contentEl.empty();
        contentEl.addClass("chronica-timeline-container");
        contentEl.createEl("p", {
          text: "Chronica: Loading event data...",
          cls: "chronica-loading-message",
        });
      }
      return;
    }

    // Clear content
    contentEl.empty();
    contentEl.addClass("chronica-timeline-container");

    // Create main container with flexbox layout
    const mainContainer = contentEl.createEl("div", {
      cls: "chronica-main-container",
    });

    // --- Create Sidebar ---
    const sidebarEl = mainContainer.createEl("div", {
      cls: `chronica-sidebar ${this.isSidebarOpen ? "expanded" : "collapsed"}`,
    });
    const sidebarHeader = sidebarEl.createEl("div", {
      cls: "chronica-sidebar-header",
    });
    sidebarHeader.createEl("div", {
      cls: "chronica-title",
      text: "life in frames",
    });
    const sidebarToggle = sidebarHeader.createEl("button", {
      cls: "chronica-sidebar-toggle",
      attr: {
        title: this.isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar",
      },
    });
    setIcon(
      sidebarToggle,
      this.isSidebarOpen ? "chevron-left" : "chevron-right"
    );
    // Sidebar toggle listener (uses hidden class)
    sidebarToggle.addEventListener("click", () => {
      this.isSidebarOpen = !this.isSidebarOpen;
      this.plugin.settings.isSidebarOpen = this.isSidebarOpen;
      this.plugin.saveSettings();
      sidebarEl.classList.toggle("collapsed", !this.isSidebarOpen);
      sidebarEl.classList.toggle("expanded", this.isSidebarOpen);
      setIcon(
        sidebarToggle,
        this.isSidebarOpen ? "chevron-left" : "chevron-right"
      );
      sidebarToggle.setAttribute(
        "title",
        this.isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"
      );
      const collapsedToggle = contentAreaEl?.querySelector(
        ".chronica-collapsed-toggle"
      ) as HTMLElement | null;
      if (collapsedToggle)
        collapsedToggle.classList.toggle("hidden", this.isSidebarOpen);
      this.updateStatsPanelLayout();
    });

    // --- Sidebar Sections ---
    // Data Section
    const dataSection = sidebarEl.createEl("div", {
      cls: "chronica-sidebar-section",
    });
    dataSection.createEl("h3", {
      text: "TIMELINE DATA",
      cls: "section-header",
    });
    const dataContainer = dataSection.createEl("div", {
      cls: "chronica-controls",
    });
    const planEventBtn = dataContainer.createEl("button", {
      text: "Add Event",
      cls: "chronica-btn chronica-btn-primary",
    });
    planEventBtn.addEventListener("click", () => {
      this.showAddEventModal();
    });
    const manageTypesBtn = dataContainer.createEl("button", {
      text: "Manage Event Types",
      cls: "chronica-btn chronica-btn-primary",
    });
    manageTypesBtn.addEventListener("click", () => {
      new ManageEventTypesModal(this.app, this.plugin).open();
    }); // Assumes ManageEventTypesModal class exists

    // Visualization Section
    const viewSection = sidebarEl.createEl("div", {
      cls: "chronica-sidebar-section",
    });
    viewSection.createEl("h3", {
      text: "VISUALIZATION",
      cls: "section-header",
    });
    const viewContainer = viewSection.createEl("div", {
      cls: "chronica-visual-controls",
    });
    // (Keep Zoom controls, Fit to Screen button logic - unchanged)
    const zoomControlsDiv = viewContainer.createEl("div", {
      cls: "chronica-zoom-controls",
    });
    const zoomOutBtn = zoomControlsDiv.createEl("button", {
      cls: "chronica-btn chronica-zoom-button",
      attr: { title: "Zoom Out" },
    });
    setIcon(zoomOutBtn, "zoom-out");
    zoomOutBtn.addEventListener("click", () => {
      this.zoomOut();
    });
    const zoomInput = zoomControlsDiv.createEl("input", {
      cls: "chronica-zoom-input",
      attr: {
        type: "number",
        min: "10",
        max: "500",
        step: "1",
        value: `${Math.round(this.plugin.settings.zoomLevel * 100)}`,
        title: "Enter zoom % and press ↵",
      },
    });
    zoomInput.addEventListener("change", async (e) => {
      const input = e.target as HTMLInputElement;
      let val = parseInt(input.value, 10);
      if (isNaN(val)) val = Math.round(this.plugin.settings.zoomLevel * 100);
      val = Math.min(500, Math.max(10, val));
      this.plugin.settings.zoomLevel = val / 100;
      await this.plugin.saveSettings();
      this.updateZoomLevel();
      input.value = `${Math.round(this.plugin.settings.zoomLevel * 100)}`;
    });
    const zoomInBtn = zoomControlsDiv.createEl("button", {
      cls: "chronica-btn chronica-zoom-button",
      attr: { title: "Zoom In" },
    });
    setIcon(zoomInBtn, "zoom-in");
    zoomInBtn.addEventListener("click", () => {
      this.zoomIn();
    });
    const fitToScreenBtn = viewContainer.createEl("button", {
      cls: "chronica-btn chronica-fit-to-screen",
      text: "Fit to Screen",
      attr: { title: "Automatically adjust zoom to fit entire grid on screen" },
    });
    fitToScreenBtn.addEventListener("click", () => {
      this.fitToScreen();
    });

    // Display Settings Section
    const displaySection = sidebarEl.createEl("div", {
      cls: "chronica-sidebar-section",
    });
    displaySection.createEl("h3", {
      text: "DISPLAY SETTINGS",
      cls: "section-header",
    });
    const displayContainer = displaySection.createEl("div", {
      cls: "chronica-controls",
    });
    // (Keep Cell Shape and Grid Orientation controls - unchanged)
    displayContainer.createEl("h4", {
      cls: "subsection-header",
      text: "Cell Shape",
    });
    const shapeSelect = displayContainer.createEl("select", {
      cls: "chronica-select chronica-dropdown",
    });
    ["square", "circle", "diamond"].forEach((opt) => {
      const option = shapeSelect.createEl("option", {
        attr: { value: opt },
        text: opt.charAt(0).toUpperCase() + opt.slice(1),
      });
      if (this.plugin.settings.cellShape === opt) option.selected = true;
    });
    shapeSelect.addEventListener("change", async () => {
      this.plugin.settings.cellShape = shapeSelect.value as any;
      await this.plugin.saveSettings();
      this.updateZoomLevel();
    });
    displayContainer.createEl("h4", {
      cls: "subsection-header",
      text: "Grid Orientation",
    });
    const orientationBtn = displayContainer.createEl("button", {
      cls: "chronica-btn chronica-orientation-button",
      text:
        this.plugin.settings.gridOrientation === "landscape"
          ? "Switch to Portrait"
          : "Switch to Landscape",
      attr: {
        title:
          this.plugin.settings.gridOrientation === "landscape"
            ? "Display years as rows, weeks as columns"
            : "Display years as columns, weeks as rows",
      },
    });
    orientationBtn.addEventListener("click", async () => {
      this.plugin.settings.gridOrientation =
        this.plugin.settings.gridOrientation === "landscape"
          ? "portrait"
          : "landscape";
      await this.plugin.saveSettings();
      orientationBtn.textContent =
        this.plugin.settings.gridOrientation === "landscape"
          ? "Switch to Portrait"
          : "Switch to Landscape";
      orientationBtn.setAttribute(
        "title",
        this.plugin.settings.gridOrientation === "landscape"
          ? "Display years as rows, weeks as columns"
          : "Display years as columns, weeks as rows"
      );
      this.updateZoomLevel();
    });

    // Legend Section (UPDATED to use new eventTypes)
    const legendSection = sidebarEl.createEl("div", {
      cls: "chronica-sidebar-section",
    });
    legendSection.createEl("h3", { text: "LEGEND", cls: "section-header" });
    const legendEl = legendSection.createEl("div", { cls: "chronica-legend" });

    // Add legend items for all defined event types
    if (
      this.plugin.settings.eventTypes &&
      this.plugin.settings.eventTypes.length > 0
    ) {
      this.plugin.settings.eventTypes.forEach((type) => {
        const itemEl = legendEl.createEl("div", {
          cls: "chronica-legend-item",
        });
        const colorEl = itemEl.createEl("div", {
          cls: "chronica-legend-color",
        });
        colorEl.style.backgroundColor = type.color; // Use color from type definition
        itemEl.createEl("span", { text: type.name }); // Use name from type definition
      });
    } else {
      legendEl.createEl("p", {
        text: "No event types defined.",
        cls: "text-muted",
      });
    }
    // Footer in sidebar
    sidebarEl.createEl("div", {
      cls: "chronica-footer",
      text: this.plugin.settings.quote,
    });

    // --- Create Content Area ---
    const contentAreaEl = mainContainer.createEl("div", {
      cls: "chronica-content-area",
    });
    // Apply class if stats panel should be open initially
    if (this.plugin.settings.isStatsOpen) {
      contentAreaEl.classList.add("stats-expanded");
    }

    // --- Create Collapsed Sidebar Toggle ---
    const collapsedToggle = contentAreaEl.createEl("button", {
      cls: "chronica-collapsed-toggle",
      attr: { title: "Expand Sidebar" },
    });
    setIcon(collapsedToggle, "chevron-right");
    collapsedToggle.classList.toggle("hidden", this.isSidebarOpen); // Use hidden class
    collapsedToggle.addEventListener("click", () => {
      this.isSidebarOpen = true;
      this.plugin.settings.isSidebarOpen = true;
      this.plugin.saveSettings();
      const sidebar = mainContainer.querySelector(
        ".chronica-sidebar"
      ) as HTMLElement | null;
      if (sidebar) {
        sidebar.classList.remove("collapsed");
        sidebar.classList.add("expanded");
        const sideToggle = sidebar.querySelector(".chronica-sidebar-toggle");
        if (sideToggle instanceof HTMLElement) {
          setIcon(sideToggle, "chevron-left");
          sideToggle.setAttribute("title", "Collapse Sidebar");
        }
      }
      collapsedToggle.classList.add("hidden"); // Use hidden class
      this.updateStatsPanelLayout();
    });

    // --- Create Main View and Stats Panel ---
    const viewEl = contentAreaEl.createEl("div", { cls: "chronica-view" });
    this.renderWeeksGrid(viewEl); // Render grid
    this.renderStatsPanel(contentAreaEl); // Render stats panel (which reads new data structure internally now)
  } // End of renderView

  /**
   * Show modal for adding an event.
   * Ensures folder selection has occurred before opening the event modal.
   */
  showAddEventModal(preselectedWeekKey: string | null = null): void {
    // Added optional preselectedWeekKey
    // First, check if folders have been configured
    if (!this.plugin.settings.hasSeenFolders) {
      new Notice("Please select your notes folders first."); // Optional: Inform the user
      const folderModal = new ChornicaFolderSelectionModal(
        this.app,
        this.plugin
      );
      folderModal.open();
      // When ChornicaFolderSelectionModal closes and sets hasSeenFolders,
      // the user would then click "Add Event" again.
      // Alternatively, you could pass a callback to ChornicaFolderSelectionModal
      // to automatically open the event modal after successful folder selection,
      // but for now, this simpler approach requires the user to re-initiate.
      return;
    }

    // If folders are set, proceed to open the event modal
    const eventModal = new ChornicaEventModal(
      this.app,
      this.plugin,
      preselectedWeekKey
    );
    eventModal.open();
  }

  /**
   * Zoom in the grid view
   */
  zoomIn() {
    // Get the current zoom level
    const currentZoom = this.plugin.settings.zoomLevel;

    // Check if the current zoom is already at a multiple of 0.1
    const isMultipleOfTen =
      Math.abs(currentZoom * 10 - Math.round(currentZoom * 10)) < 0.001;

    let nextZoom;
    if (isMultipleOfTen) {
      // If already at a multiple of 0.1, increment by 0.1
      nextZoom = currentZoom + 0.1;
    } else {
      // Otherwise, go to the next multiple of 0.1
      nextZoom = Math.ceil(currentZoom * 10) / 10;
    }

    // Apply the new zoom level, max 3.0
    this.plugin.settings.zoomLevel = Math.min(3.0, nextZoom);
    this.plugin.saveSettings();

    // Update only the grid and zoom level indicator without full re-render
    this.updateZoomLevel();
  }

  /**
   * Zoom out the grid view
   */
  zoomOut() {
    // Get the current zoom level
    const currentZoom = this.plugin.settings.zoomLevel;

    // Check if the current zoom is already at a multiple of 0.1
    const isMultipleOfTen =
      Math.abs(currentZoom * 10 - Math.round(currentZoom * 10)) < 0.001;

    let nextZoom;
    if (isMultipleOfTen) {
      // If already at a multiple of 0.1, decrement by 0.1
      nextZoom = currentZoom - 0.1;
    } else {
      // Otherwise, go to the previous multiple of 0.1
      nextZoom = Math.floor(currentZoom * 10) / 10;
    }

    // Apply the new zoom level, min 0.1 (10%)
    this.plugin.settings.zoomLevel = Math.max(0.1, nextZoom);
    this.plugin.saveSettings();

    // Update only the grid and zoom level indicator without full re-render
    this.updateZoomLevel();
  }

  isGridFitToScreen(): boolean {
    const contentEl = this.containerEl.children[1];
    const contentArea = contentEl.querySelector(
      ".chronica-content-area"
    ) as HTMLElement;
    const viewEl = contentArea.querySelector(".chronica-view") as HTMLElement;
    if (!viewEl || !contentArea) return false;

    // Same math as fitToScreen()
    const cs = getComputedStyle(viewEl);
    const padL = parseInt(cs.paddingLeft) || 0;
    const padR = parseInt(cs.paddingRight) || 0;
    const padT = parseInt(cs.paddingTop) || 0;
    const padB = parseInt(cs.paddingBottom) || 0;
    const availW = viewEl.clientWidth - padL - padR;
    const availH = viewEl.clientHeight - padT - padB;

    const rootStyle = getComputedStyle(document.documentElement);
    const baseSize =
      parseInt(rootStyle.getPropertyValue("--base-cell-size")) || 16;
    const gap = parseInt(rootStyle.getPropertyValue("--cell-gap")) || 2;
    const years = this.plugin.settings.lifespan;
    const weeks = 52;

    const idealW = (availW - (years - 1) * gap) / years;
    const idealH = (availH - (weeks - 1) * gap) / weeks;
    const idealCell = Math.min(idealW, idealH);
    const idealZoom = idealCell / baseSize;

    return Math.abs(this.plugin.settings.zoomLevel - idealZoom) < 0.01;
  }

  /**
   * Automatically adjust zoom level to fit the entire grid on screen
   */
  // Replace the fitToScreen() function in src/main.ts with this improved version:
  fitToScreen(): void {
    // Get relevant containers
    const contentEl = this.containerEl.children[1];
    const contentArea = contentEl.querySelector(
      ".chronica-content-area"
    ) as HTMLElement;
    const viewEl = contentArea.querySelector(".chronica-view") as HTMLElement;
    if (!viewEl || !contentArea) return;

    // Get available space (accounting for sidebar and markers)
    const cs = getComputedStyle(viewEl);
    const padL = parseInt(cs.paddingLeft) || 0;
    const padR = parseInt(cs.paddingRight) || 0;
    const padT = parseInt(cs.paddingTop) || 0;
    const padB = parseInt(cs.paddingBottom) || 0;

    // Account for sidebar width
    const sidebarWidth = this.isSidebarOpen ? 240 : 0;

    const availW = viewEl.clientWidth - padL - padR;
    const availH = viewEl.clientHeight - padT - padB;

    // Get grid parameters
    const rootStyle = getComputedStyle(document.documentElement);
    const baseSize =
      parseInt(rootStyle.getPropertyValue("--base-cell-size")) || 16;
    const gap = parseInt(rootStyle.getPropertyValue("--cell-gap")) || 2;
    const years = this.plugin.settings.lifespan;
    const weeks = 52;

    // Calculate optimal cell size
    const targetWidth = availW * 0.95;
    const targetHeight = availH * 0.95;

    const cellW = targetWidth / years;
    const cellH = targetHeight / weeks;

    // Get the smaller dimension to ensure fit
    let idealCellSize = Math.min(cellW, cellH);

    // Enforce minimum size
    idealCellSize = Math.max(idealCellSize, 8);

    // Convert to zoom ratio
    const newZoom = idealCellSize / baseSize;

    // Apply zoom (clamped to reasonable range)
    this.plugin.settings.zoomLevel = Math.max(0.5, Math.min(2.5, newZoom));
    this.plugin.saveSettings();

    // Update zoom
    this.updateZoomLevel();

    // Reset transforms
    const gridEl = viewEl.querySelector(".chronica-grid") as HTMLElement;
    const decadeMarkers = viewEl.querySelector(
      ".chronica-decade-markers"
    ) as HTMLElement;

    if (gridEl) gridEl.style.transform = "";
    if (decadeMarkers) decadeMarkers.style.transform = "";
  }

  /**
   * Update zoom-affected elements with adjusted positioning
   */
  updateZoomLevel(): void {
    // Get the container element
    const contentEl = this.containerEl.children[1];

    // Use a more robust selector to find the zoom level indicator anywhere in the container
    const zoomInput = this.containerEl.querySelector(
      ".chronica-zoom-input"
    ) as HTMLInputElement;
    if (zoomInput) {
      zoomInput.value = `${Math.round(this.plugin.settings.zoomLevel * 100)}`;
    }

    // Update cell size CSS variable
    const root = document.documentElement;
    const baseSize =
      parseInt(getComputedStyle(root).getPropertyValue("--base-cell-size")) ||
      16;
    const cellSize = Math.round(baseSize * this.plugin.settings.zoomLevel);
    root.style.setProperty("--cell-size", `${cellSize}px`);

    // Reset transforms before rerendering
    const viewEl = contentEl.querySelector(".chronica-view");
    if (viewEl instanceof HTMLElement) {
      const gridEl = viewEl.querySelector(".chronica-grid");
      const decadeMarkers = viewEl.querySelector(".chronica-decade-markers");
      const verticalMarkers = viewEl.querySelector(
        ".chronica-vertical-markers"
      );

      if (gridEl) (gridEl as HTMLElement).style.transform = "";
      if (decadeMarkers) (decadeMarkers as HTMLElement).style.transform = "";
      if (verticalMarkers)
        (verticalMarkers as HTMLElement).style.transform = "";

      // Clear the view and re-render
      viewEl.empty();
      this.renderWeeksGrid(viewEl);
    }
  }

  /**
   * Render the main weeks grid visualization using the new event structure.
   * @param container - Container to render grid in
   */
  renderWeeksGrid(container: HTMLElement): void {
    container.empty(); // Clear previous grid

    // Get necessary settings and calculated values
    const { settings } = this.plugin;
    const {
      birthday,
      lifespan,
      gridOrientation,
      cellShape,
      startWeekOnMonday,
    } = settings;
    const root = document.documentElement;
    const baseSize =
      parseInt(getComputedStyle(root).getPropertyValue("--base-cell-size")) ||
      16;
    const cellSize = Math.round(baseSize * settings.zoomLevel);
    root.style.setProperty("--cell-size", `${cellSize}px`); // Ensure CSS var is set
    const cellGap =
      parseInt(getComputedStyle(root).getPropertyValue("--cell-gap")) || 2;
    const leftOffset =
      parseInt(getComputedStyle(root).getPropertyValue("--left-offset")) || 70;
    const topOffset =
      parseInt(getComputedStyle(root).getPropertyValue("--top-offset")) || 50;
    const regularGap = cellGap;
    const isPortrait = gridOrientation === "portrait";

    // --- Create Markers ---
    // Decade Markers
    if (settings.showDecadeMarkers) {
      const decadeMarkersContainer = container.createEl("div", {
        cls: `chronica-decade-markers ${isPortrait ? "portrait-mode" : ""}`,
      });
      if (!isPortrait) decadeMarkersContainer.style.left = `${leftOffset}px`; // This line is for the container.
      for (let decade = 10; decade <= lifespan; decade += 10) {
        const marker = decadeMarkersContainer.createEl("div", {
          cls: `chronica-decade-marker ${isPortrait ? "portrait-mode" : ""}`,
          text: decade.toString(),
        });
        // position: "absolute" will be handled by CSS for .chronica-decade-marker

        const lastYearOfPrevDecade = decade - 1;
        const decadePosition = this.plugin.calculateYearPosition(
          lastYearOfPrevDecade,
          cellSize,
          regularGap
        );
        const centerPosition = decadePosition + cellSize / 2;

        if (isPortrait) {
          marker.style.setProperty("--marker-top", `${centerPosition}px`);
          marker.style.setProperty("--marker-left", "15px");
          marker.style.setProperty("--marker-transform", "translateY(-50%)");
        } else {
          marker.style.setProperty("--marker-left", `${centerPosition}px`);
          marker.style.setProperty("--marker-top", "15px");
          marker.style.setProperty("--marker-transform", "translateX(-50%)");
        }
      }
    }

    // Vertical Markers (Weeks & Months)
    const markersContainer = container.createEl("div", {
      cls: `chronica-vertical-markers ${isPortrait ? "portrait-mode" : ""}`,
    });
    const weekMarkersContainer = markersContainer.createEl("div", {
      cls: "chronica-week-markers",
    });
    const monthMarkersContainer = markersContainer.createEl("div", {
      cls: "chronica-month-markers",
    });

    // Week Markers (Numbers 10, 20...)
    // Week Markers (Numbers 10, 20...)
    if (settings.showWeekMarkers) {
      for (let week = 10; week <= 50; week += 10) {
        const marker = weekMarkersContainer.createEl("div", {
          cls: `chronica-week-marker ${isPortrait ? "portrait-mode" : ""}`,
          text: week.toString(),
        });
        // position: "absolute" will be handled by CSS for .chronica-week-marker

        const position = (week - 1) * (cellSize + cellGap) + cellSize / 2; // Center on the week line

        if (isPortrait) {
          marker.style.setProperty("--marker-left", `${position + 3}px`);
          marker.style.setProperty("--marker-top", `${topOffset - 25}px`);
          marker.style.setProperty("--marker-transform", "translateX(-50%)");
          marker.style.removeProperty("--marker-right"); // Ensure right is not set
        } else {
          // Landscape
          marker.style.setProperty("--marker-top", `${position}px`);
          marker.style.setProperty("--marker-right", "4px");
          marker.style.setProperty("--marker-transform", "translateY(-50%)");
          marker.style.removeProperty("--marker-left"); // Ensure left is not set
        }
      }
    }

    // Birthday Marker (Cake Icon) - Placed relative to the *grid* start
    if (settings.showBirthdayMarker) {
      const [bYear, bMonth, bDay] = settings.birthday.split("-").map(Number);
      const birthdayDate = new Date(bYear, bMonth - 1, bDay); // Correct: JS month is 0-indexed
      const birthMonthName = MONTH_NAMES[bMonth - 1]; // Correct: Use 0-indexed month
      const birthdayFormatted = `${birthMonthName} ${bDay}, ${bYear}`;

      // The cake icon ALWAYS marks the very first visual week row (grid index 0).
      const birthWeekGridIndex = 0; // This variable is not directly used in your positioning but kept for context

      const birthdayMarkerContainer = container.createEl("div", {
        cls: "chronica-birthday-marker-container",
      });

      // Calculate position based on gridIndex 0 - This variable is not directly used in your positioning logic below but kept for context
      const birthWeekPosition =
        birthWeekGridIndex * (cellSize + cellGap) + cellSize / 2;

      // CSS will handle position: absolute and z-index: 15 for .chronica-birthday-marker-container
      if (isPortrait) {
        // In portrait, weeks are horizontal. Cake should be above the first week column.
        birthdayMarkerContainer.style.setProperty(
          "--birthday-marker-top",
          `${topOffset}px`
        );
        birthdayMarkerContainer.style.setProperty(
          "--birthday-marker-left",
          `${leftOffset - 13}px`
        );
        birthdayMarkerContainer.style.setProperty(
          "--birthday-marker-transform",
          "translateX(-50%)"
        );
      } else {
        // Landscape
        // In landscape, weeks are vertical. Cake should be to the left of the first week row.
        birthdayMarkerContainer.style.setProperty(
          "--birthday-marker-top",
          `${topOffset + 10}px`
        );
        birthdayMarkerContainer.style.setProperty(
          "--birthday-marker-left",
          `${leftOffset - 25}px`
        );
        birthdayMarkerContainer.style.setProperty(
          "--birthday-marker-transform",
          "translateY(-50%)"
        );
      }

      const cakeEl = birthdayMarkerContainer.createEl("div", {
        cls: "birthday-cake-marker",
      });
      setIcon(cakeEl, "cake");
      // REMOVED: cakeEl.setAttribute("title", ...);

      const createBirthdayTooltipContent = () => {
        const tooltipContainer = document.createDocumentFragment();
        tooltipContainer.createEl("span", {
          text: `${birthdayFormatted} (Your Birthday)`,
          cls: "chronica-tooltip-line", // Use existing class for basic line styling
        });
        return {
          fragment: tooltipContainer,
          hintClass: "tooltip-birthday",
          customColor: "",
        };
      };

      cakeEl.addEventListener("mouseenter", (eventMouse) => {
        if (this.clearTooltipTimeoutId) {
          clearTimeout(this.clearTooltipTimeoutId);
          this.clearTooltipTimeoutId = null;
        }
        if (this.tooltipTimeoutId) {
          clearTimeout(this.tooltipTimeoutId);
          this.tooltipTimeoutId = null;
        }
        if (
          this.activeGridCellTooltip &&
          this.activeGridCellTooltip.parentElement
        ) {
          this.activeGridCellTooltip.remove();
          this.activeGridCellTooltip = null;
        }

        this.tooltipTimeoutId = window.setTimeout(() => {
          if (
            this.activeGridCellTooltip &&
            this.activeGridCellTooltip.parentElement
          ) {
            this.activeGridCellTooltip.remove();
          }
          this.activeGridCellTooltip = document.createElement("div");
          this.activeGridCellTooltip.addClass("chronica-grid-cell-tooltip");

          const { fragment, hintClass } = createBirthdayTooltipContent();
          this.activeGridCellTooltip.appendChild(fragment);

          if (hintClass) {
            this.activeGridCellTooltip.addClass(hintClass);
          }

          document.body.appendChild(this.activeGridCellTooltip);

          const markerRect = cakeEl.getBoundingClientRect();
          const tooltipRect =
            this.activeGridCellTooltip.getBoundingClientRect();

          let top = markerRect.bottom + 8;
          let left =
            markerRect.left + markerRect.width / 2 - tooltipRect.width / 2;

          if (left < 5) left = 5;
          if (left + tooltipRect.width > window.innerWidth - 5) {
            left = window.innerWidth - tooltipRect.width - 5;
          }
          if (top + tooltipRect.height > window.innerHeight - 5) {
            top = markerRect.top - tooltipRect.height - 8;
          }
          if (top < 5) top = 5;

          this.activeGridCellTooltip.style.setProperty(
            "--tooltip-left",
            `${left + window.scrollX}px`
          );
          this.activeGridCellTooltip.style.setProperty(
            "--tooltip-top",
            `${top + window.scrollY}px`
          );

          setTimeout(() => {
            this.activeGridCellTooltip?.addClass("visible");
          }, 10);
          this.tooltipTimeoutId = null;
        }, 500);
      });

      cakeEl.addEventListener("mouseleave", (eventMouse) => {
        if (this.tooltipTimeoutId) {
          clearTimeout(this.tooltipTimeoutId);
          this.tooltipTimeoutId = null;
        }
        if (
          this.activeGridCellTooltip &&
          this.activeGridCellTooltip.parentElement
        ) {
          this.activeGridCellTooltip.removeClass("visible");
          if (this.clearTooltipTimeoutId) {
            clearTimeout(this.clearTooltipTimeoutId);
          }
          this.clearTooltipTimeoutId = window.setTimeout(() => {
            if (
              this.activeGridCellTooltip &&
              this.activeGridCellTooltip.parentElement
            ) {
              this.activeGridCellTooltip.remove();
            }
            this.activeGridCellTooltip = null;
            this.clearTooltipTimeoutId = null;
          }, 150);
        }
      });
      // ---- END NEW ----
    }

    // Month Markers (Text labels)
    if (settings.showMonthMarkers) {
      const [bYear, bMonthIdx, bDay] = settings.birthday.split("-").map(Number);
      const birthdayDate = new Date(bYear, bMonthIdx - 1, bDay); // JS month is 0-indexed
      const birthMonthActual = birthdayDate.getMonth(); // 0-11 for comparison
      const birthYearActual = birthdayDate.getFullYear();

      // Calculate birthdayWeekStart (e.g., the Monday of the week the birthday falls into)
      const birthdayWeekStartForGrid = new Date(birthdayDate);
      const birthDayOfWeek = birthdayWeekStartForGrid.getDay(); // 0=Sun, 1=Mon
      const startDayOfWeekNumGrid = settings.startWeekOnMonday ? 1 : 0;
      let daysToSubtractFromBirthday = birthDayOfWeek - startDayOfWeekNumGrid;
      if (daysToSubtractFromBirthday < 0) daysToSubtractFromBirthday += 7;
      birthdayWeekStartForGrid.setDate(
        birthdayWeekStartForGrid.getDate() - daysToSubtractFromBirthday
      );
      birthdayWeekStartForGrid.setHours(0, 0, 0, 0);

      // 1. Get all potential month marker instances
      const allPotentialMonthMarkers = this.plugin.calculateMonthMarkers(
        birthdayDate,
        lifespan,
        settings.monthMarkerFrequency
      );

      // 2. Determine which months (0-11) should be shown based on frequency/birth month
      const monthsToDisplayIndices = new Set<number>();
      for (let m = 0; m < 12; m++) {
        let shouldShow = false;
        switch (settings.monthMarkerFrequency) {
          case "all":
            shouldShow = true;
            break;
          case "quarter":
            if (m % 3 === 0) shouldShow = true;
            break;
          case "half-year":
            if (m % 6 === 0) shouldShow = true;
            break;
          case "year":
            if (m === 0) shouldShow = true;
            break; // January
        }
        if (m === birthMonthActual) shouldShow = true; // Always include birth month
        if (shouldShow) monthsToDisplayIndices.add(m);
      }

      // 3. Find the best instance for each required month and calculate its gridIndex
      // Map key: month index (0-11), Value: The chosen MonthMarker object (weekIndex holds gridIndex)
      const canonicalMonthMarkers = new Map<number, MonthMarker>();
      monthsToDisplayIndices.forEach((monthIdxToDisplay) => {
        let bestMarkerForThisMonth: MonthMarker | null = null;
        for (const potentialMarker of allPotentialMonthMarkers) {
          const potentialMarkerMonthIndex = MONTH_NAMES.indexOf(
            potentialMarker.label
          );
          if (potentialMarkerMonthIndex === monthIdxToDisplay) {
            if (
              !bestMarkerForThisMonth ||
              potentialMarker.weekIndex < bestMarkerForThisMonth.weekIndex
            ) {
              bestMarkerForThisMonth = potentialMarker;
            }
          }
        }

        if (bestMarkerForThisMonth) {
          const markerYear =
            Math.floor(bestMarkerForThisMonth.monthNumber! / 12) +
            birthYearActual;
          const markerMonth = bestMarkerForThisMonth.monthNumber! % 12;
          const firstDayOfThisMarkerMonth = new Date(
            markerYear,
            markerMonth,
            1
          );
          firstDayOfThisMarkerMonth.setHours(0, 0, 0, 0);
          const offsetInMillis =
            firstDayOfThisMarkerMonth.getTime() -
            birthdayWeekStartForGrid.getTime();
          let gridIndexForDisplay = Math.floor(
            offsetInMillis / (1000 * 60 * 60 * 24 * 7)
          );
          gridIndexForDisplay = ((gridIndexForDisplay % 52) + 52) % 52; // Normalize to 0-51

          canonicalMonthMarkers.set(monthIdxToDisplay, {
            ...bestMarkerForThisMonth,
            weekIndex: gridIndexForDisplay, // Store the calculated gridIndex
          });
        }
      });

      // 4. Resolve collisions based on gridIndex and render
      const finalRenderMap = new Map<number, MonthMarker>(); // Key: gridIndex, Value: Marker to Render

      // Iterate 0-11 to ensure consistent priority order (Jan, Feb, ..., BirthMonth, ...)
      for (let monthIdxKey = 0; monthIdxKey < 12; monthIdxKey++) {
        if (!canonicalMonthMarkers.has(monthIdxKey)) continue; // Skip if this month wasn't selected

        const marker = canonicalMonthMarkers.get(monthIdxKey)!;
        const gridIndex = marker.weekIndex; // This is the calculated 0-51 grid index

        if (!finalRenderMap.has(gridIndex)) {
          // If grid index is free, add this marker
          finalRenderMap.set(gridIndex, marker);
        } else {
          // Collision: Decide which marker wins for this grid index
          const existingMarker = finalRenderMap.get(gridIndex)!;
          const existingMonthIndex = MONTH_NAMES.indexOf(existingMarker.label);

          // --- REVISED TIE-BREAKING (Birth Month > Jan > Others) ---
          if (monthIdxKey === birthMonthActual) {
            // Current IS Birth Month -> It wins
            finalRenderMap.set(gridIndex, marker);
          } else if (existingMonthIndex === birthMonthActual) {
            // Existing is Birth Month -> It stays
          } else if (monthIdxKey === 0) {
            // Current is Jan (and not Birth Month) -> It wins
            finalRenderMap.set(gridIndex, marker);
          } else if (existingMonthIndex === 0) {
            // Existing is Jan (and not Birth Month) -> It stays
          }
          // Implicitly: If neither is Jan nor Birth Month, the one processed first stays.
          // --- END REVISED TIE-BREAKING ---
        }
      }

      // 5. Render the markers from the final map
      finalRenderMap.forEach((marker) => {
        // marker.weekIndex is the gridIndex
        const markerGridIndex = marker.weekIndex; // Use the stored gridIndex for positioning
        // Inside finalRenderMap.forEach((marker) => { ... })
        // Inside finalRenderMap.forEach((marker) => { ... })
        const markerEl = monthMarkersContainer.createEl("div", {
          cls: `chronica-month-marker ${isPortrait ? "portrait-mode" : ""} ${
            marker.isFirstOfYear ? "first-of-year" : ""
          } ${marker.isBirthMonth ? "birth-month" : ""}`,
          text: marker.label,
        });
        const position = markerGridIndex * (cellSize + cellGap) + cellSize / 2;
        markerEl.setAttribute("title", marker.fullLabel);

        // position: "absolute" will be handled by CSS for .chronica-month-marker
        if (isPortrait) {
          markerEl.style.setProperty("--marker-left", `${position + 2}px`);
          markerEl.style.setProperty("--marker-top", `${topOffset - 60}px`);
          markerEl.style.setProperty("--marker-transform", "translateX(-50%)");
        } else {
          // Landscape
          markerEl.style.setProperty("--marker-top", `${position}px`);
          markerEl.style.setProperty("--marker-left", "5px");
          markerEl.style.setProperty("--marker-transform", "translateY(-50%)");
        }
      });
    }

    // --- Create Grid ---
    const gridEl = container.createEl("div", { cls: "chronica-grid" });
    gridEl.toggleClass("shape-circle", cellShape === "circle");
    gridEl.toggleClass("shape-diamond", cellShape === "diamond");
    gridEl.style.position = "absolute";
    gridEl.style.top = `${topOffset}px`;
    gridEl.style.left = `${leftOffset}px`;

    const now = new Date();
    const [birthYearNum, birthMonthNum, birthDayNum] = settings.birthday
      .split("-")
      .map(Number);
    const birthdayDate = new Date(birthYearNum, birthMonthNum - 1, birthDayNum);
    const ageInWeeks = this.plugin.getFullWeekAge(birthdayDate, now);
    const currentWeekKey = this.plugin.getWeekKeyFromDate(now);

    // --- Create Cells ---
    for (let yearIndex = 0; yearIndex < lifespan; yearIndex++) {
      const displayYear = birthdayDate.getFullYear() + yearIndex;
      const yearBirthday = new Date(birthdayDate);
      yearBirthday.setFullYear(displayYear);
      const startDayOfWeekNum = startWeekOnMonday ? 1 : 0;
      const birthdayWeekStart = new Date(yearBirthday);
      const birthdayDayOfWeek = birthdayWeekStart.getDay();
      let daysToSubtract = birthdayDayOfWeek - startDayOfWeekNum;
      if (daysToSubtract < 0) daysToSubtract += 7;
      birthdayWeekStart.setDate(birthdayWeekStart.getDate() - daysToSubtract);

      const nextBirthday = new Date(birthdayDate);
      nextBirthday.setFullYear(displayYear + 1);
      const totalDaysInYear = Math.round(
        (nextBirthday.getTime() - birthdayWeekStart.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      for (let cellIndex = 0; cellIndex < 52; cellIndex++) {
        // Always 52 cells visually per year row/column
        const weekIndex = yearIndex * 52 + cellIndex; // Overall index
        const cell = gridEl.createEl("div", { cls: "chronica-grid-cell" });

        // Calculate start/end dates for this specific cell's period
        const cellStartDate = new Date(birthdayWeekStart);
        cellStartDate.setDate(birthdayWeekStart.getDate() + cellIndex * 7);
        const cellEndDate = new Date(cellStartDate);
        cellEndDate.setDate(cellStartDate.getDate() + 6);
        // Adjust last cell's end date if the year has > 364 days relative to birthday week start
        if (cellIndex === 51 && totalDaysInYear > 364) {
          const nextBirthdayWeekStart = new Date(nextBirthday);
          const nextBdayDayOfWeek = nextBirthdayWeekStart.getDay();
          let nextDaysToSub = nextBdayDayOfWeek - startDayOfWeekNum;
          if (nextDaysToSub < 0) nextDaysToSub += 7;
          nextBirthdayWeekStart.setDate(
            nextBirthdayWeekStart.getDate() - nextDaysToSub
          );
          cellEndDate.setTime(
            nextBirthdayWeekStart.getTime() - 24 * 60 * 60 * 1000
          );
        }

        cell.dataset.cellActualStartDate = cellStartDate
          .toISOString()
          .split("T")[0]; // ADDED
        cell.dataset.cellActualEndDate = cellEndDate
          .toISOString()
          .split("T")[0]; // ADDED

        const weekKey = this.plugin.getWeekKeyFromDate(cellStartDate);
        cell.dataset.weekKey = weekKey;

        // Format dates for tooltip
        const formatDate = (date: Date): string => {
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
          return `${months[date.getMonth()]} ${date.getDate()}`;
        };
        const dateRange = `${formatDate(cellStartDate)} - ${formatDate(
          cellEndDate
        )}`;
        const isoWeekInfo = this.plugin.getISOWeekData(cellStartDate);
        cell.dataset.cellWeekNum = isoWeekInfo.week.toString();
        cell.dataset.cellIsoYear = isoWeekInfo.year.toString();
        cell.dataset.cellDateRange = dateRange;

        // ----  Determine and store potential weekly note path ----
        const weeklyNotePlaceholderValues = {
          gggg: isoWeekInfo.year.toString(),
          ww: isoWeekInfo.week.toString().padStart(2, "0"),
          YYYY: cellStartDate.getFullYear().toString(),
          MM: (cellStartDate.getMonth() + 1).toString().padStart(2, "0"),
          DD: cellStartDate.getDate().toString().padStart(2, "0"),
          MMMM: cellStartDate.toLocaleString("default", { month: "long" }),
          MMM: cellStartDate.toLocaleString("default", { month: "short" }),
          YY: cellStartDate.getFullYear().toString().slice(-2),
        };
        const potentialWeeklyNoteName = this.plugin.formatFileName(
          settings.weekNoteTemplate,
          weeklyNotePlaceholderValues
        );
        // Get full path, false indicates it's NOT an event note for folder purposes
        const potentialWeeklyNotePath = this.plugin.getFullPath(
          potentialWeeklyNoteName,
          false
        );
        cell.dataset.weeklyNotePath = potentialWeeklyNotePath;
        // ---- END  ----

        // Positioning
        cell.style.position = "absolute";
        const yearPos = this.plugin.calculateYearPosition(
          yearIndex,
          cellSize,
          regularGap
        );
        const weekPos = cellIndex * (cellSize + regularGap);
        if (isPortrait) {
          cell.style.left = `${weekPos}px`;
          cell.style.top = `${yearPos}px`;
        } else {
          cell.style.left = `${yearPos}px`;
          cell.style.top = `${weekPos}px`;
        }
        cell.style.width = `${cellSize}px`;
        cell.style.height = `${cellSize}px`;

        // --- Styling & Classes ---
        const isCurrentWeek = weekKey === currentWeekKey;
        // Base past/present/future class (CSS handles base background)
        if (isCurrentWeek) cell.addClass("present");
        else if (cellStartDate < now) cell.addClass("past");
        else cell.addClass("future");

        // Apply event styling (reads new structure, applies inline colors/borders)
        this.applyEventStyling(cell, weekKey); // This now uses the refactored logic

        // Apply filled week styling (only if not the current week and manual fill is on)
        if (
          !isCurrentWeek &&
          !settings.enableAutoFill &&
          settings.filledWeeks?.includes(weekKey)
        ) {
          cell.addClass("filled-week");
          // Background for filled is handled by CSS, border might be too
          // If specific styling is needed and NOT overridden by event, add here:
          // if (!cell.classList.contains('event')) { cell.style.backgroundColor = '#8bc34a'; }
        }

        // --- Custom Tooltip Logic (FINAL CORRECTION TO LOCAL VARIABLES & BOLD TITLE) ---
        const createTooltipContent = (hoveredCell: HTMLElement) => {
          const settings = this.plugin.settings;
          const isCompact = settings.tooltipDetailLevel === "compact";
          const tooltipContainer = document.createDocumentFragment();

          const cellWeekNum = hoveredCell.dataset.cellWeekNum || "";
          const cellIsoYear = hoveredCell.dataset.cellIsoYear || "";
          const cellDisplayDateRange = hoveredCell.dataset.cellDateRange || ""; // For general cell info

          const eventNameActual = hoveredCell.dataset.tooltipEventTitle;
          const eventDescriptionActual =
            hoveredCell.dataset.tooltipEventDescription || "";
          const eventTypeNameActual = hoveredCell.dataset.tooltipEventType;
          const eventPeriodActual = hoveredCell.dataset.tooltipEventPeriod; // ISO Week range

          // NEW: Get event's actual YYYY-MM-DD start/end dates
          const eventActualStartDateString =
            hoveredCell.dataset.tooltipEventActualStartDate;
          const eventActualEndDateString =
            hoveredCell.dataset.tooltipEventActualEndDate;
          // NEW: Get cell's actual YYYY-MM-DD start/end dates
          const cellActualStartDateString =
            hoveredCell.dataset.cellActualStartDate;
          const cellActualEndDateString = hoveredCell.dataset.cellActualEndDate;

          let colorHintClass = "";
          let eventTypeColorForBorder = ""; // Renamed for clarity

          if (eventNameActual && eventTypeNameActual) {
            const matchedEventType = settings.eventTypes.find(
              (t) =>
                t.name === eventTypeNameActual || t.id === eventTypeNameActual
            );
            if (matchedEventType) {
              if (matchedEventType.isPreset) {
                colorHintClass = `tooltip-event-type-${matchedEventType.id.replace(
                  /[^a-zA-Z0-9-_]/g,
                  "-"
                )}`;
              } else {
                eventTypeColorForBorder = matchedEventType.color; // Store for custom border
              }
            } else {
              colorHintClass = "tooltip-event-generic"; // Should ideally not happen if type is always set
            }
          }

          if (eventNameActual) {
            tooltipContainer.createEl("span", {
              text: eventNameActual,
              cls: "chronica-tooltip-event-title",
            });
          }

          if (eventDescriptionActual && !isCompact) {
            tooltipContainer.createEl("span", {
              text: eventDescriptionActual,
              cls: "chronica-tooltip-description chronica-tooltip-line",
            });
          }

          if (eventTypeNameActual && !isCompact && eventNameActual) {
            const typeLine = tooltipContainer.createEl("span", {
              cls: "chronica-tooltip-line",
            });
            typeLine.createEl("span", {
              text: "Type:",
              cls: "chronica-tooltip-label",
            });
            typeLine.appendText(eventTypeNameActual);
          }

          // ADDED: Event Date / Event Start Date line
          if (
            eventNameActual &&
            eventActualStartDateString &&
            cellActualStartDateString &&
            cellActualEndDateString
          ) {
            const eventStartDateObj = new Date(
              eventActualStartDateString + "T00:00:00"
            ); // Ensure parsed consistently
            const cellStartDateObj = new Date(
              cellActualStartDateString + "T00:00:00"
            );
            const cellEndDateObj = new Date(
              cellActualEndDateString + "T00:00:00"
            );

            // Normalize to midnight to avoid time comparison issues
            eventStartDateObj.setHours(0, 0, 0, 0);
            cellStartDateObj.setHours(0, 0, 0, 0);
            cellEndDateObj.setHours(0, 0, 0, 0);

            const isRangedEventWithDifferentEnd =
              eventActualEndDateString &&
              eventActualStartDateString !== eventActualEndDateString;
            const eventStartsWithinThisCell =
              eventStartDateObj >= cellStartDateObj &&
              eventStartDateObj <= cellEndDateObj;

            let dateLineLabel = "";
            let dateLineValue = eventActualStartDateString; // Default to showing event's own start date

            if (!isRangedEventWithDifferentEnd || eventStartsWithinThisCell) {
              dateLineLabel = "Event Date:";
            } else {
              // Is a ranged event, and its true start is NOT in this specific cell's period
              dateLineLabel = "Event Start Date:";
            }

            const eventSpecificDateLine = tooltipContainer.createEl("span", {
              cls: "chronica-tooltip-line",
            });
            eventSpecificDateLine.createEl("span", {
              text: dateLineLabel,
              cls: "chronica-tooltip-label",
            });
            eventSpecificDateLine.appendText(dateLineValue);
          }

          if (
            eventPeriodActual &&
            eventPeriodActual.includes("to") &&
            !isCompact &&
            eventNameActual
          ) {
            const periodLine = tooltipContainer.createEl("span", {
              cls: "chronica-tooltip-line",
            });
            periodLine.createEl("span", {
              text: "Period (ISO):",
              cls: "chronica-tooltip-label",
            });
            periodLine.appendText(eventPeriodActual);
          }

          if (cellWeekNum && cellIsoYear && cellDisplayDateRange) {
            if (!eventNameActual || !isCompact) {
              // Show for non-event cells, or for event cells in expanded mode
              const cellInfoLine = tooltipContainer.createEl("span", {
                cls: "chronica-tooltip-line",
              });
              if (!isCompact || !eventNameActual) {
                // Add "Cell:" label if not compact event
                cellInfoLine.createEl("span", {
                  text: "Cell:",
                  cls: "chronica-tooltip-label",
                });
              }
              let formattedCellRange = cellDisplayDateRange;
              const [startDateStr, endDateStr] =
                cellDisplayDateRange.split(" - ");
              if (startDateStr && endDateStr) {
                const startMonth = startDateStr.substring(0, 3);
                const endMonth = endDateStr.substring(0, 3);
                if (
                  startMonth === endMonth &&
                  startDateStr.length > 3 &&
                  endDateStr.includes(" ")
                ) {
                  formattedCellRange = `${startDateStr} - ${endDateStr.substring(
                    endDateStr.lastIndexOf(" ") + 1
                  )}`;
                }
              }
              cellInfoLine.appendText(
                `W${cellWeekNum}, ${cellIsoYear} (${formattedCellRange})`
              );
            }
          }

          if (!eventNameActual) {
            // Determine color hint for non-event cells
            if (hoveredCell.classList.contains("past"))
              colorHintClass = "tooltip-past";
            else if (hoveredCell.classList.contains("present"))
              colorHintClass = "tooltip-present";
            else if (hoveredCell.classList.contains("future"))
              colorHintClass = "tooltip-future";
          }

          if (settings.enableTooltipNotePreview && !isCompact) {
            const eventNotePath = hoveredCell.dataset.eventFile;
            const weeklyNotePath = hoveredCell.dataset.weeklyNotePath;
            let eventNoteDisplayed = false;
            if (eventNotePath) {
              const eventNoteFilename = eventNotePath.substring(
                eventNotePath.lastIndexOf("/") + 1
              );
              const eventNoteLine = tooltipContainer.createEl("span", {
                cls: "chronica-tooltip-line chronica-tooltip-notelink",
              });
              eventNoteLine.createEl("span", {
                text: "Event Note:",
                cls: "chronica-tooltip-label",
              });
              eventNoteLine.appendText(eventNoteFilename);
              eventNoteDisplayed = true;
            }
            if (!eventNoteDisplayed && weeklyNotePath) {
              const weeklyNoteFilename = weeklyNotePath.substring(
                weeklyNotePath.lastIndexOf("/") + 1
              );
              const weeklyNoteLine = tooltipContainer.createEl("span", {
                cls: "chronica-tooltip-line chronica-tooltip-notelink",
              });
              weeklyNoteLine.createEl("span", {
                text: "Weekly Note:",
                cls: "chronica-tooltip-label",
              });
              weeklyNoteLine.appendText(weeklyNoteFilename);
            }
          }

          if (
            tooltipContainer.childElementCount === 0 &&
            cellWeekNum &&
            cellIsoYear &&
            cellDisplayDateRange
          ) {
            // Fallback basic info if nothing else was added
            tooltipContainer.createEl("span", {
              cls: "chronica-tooltip-line",
              text: `Week ${cellWeekNum}, ${cellIsoYear}`,
            });
            tooltipContainer.createEl("span", {
              cls: "chronica-tooltip-line",
              text: cellDisplayDateRange,
            });
          }

          return {
            fragment: tooltipContainer,
            hintClass: colorHintClass,
            customColor: eventTypeColorForBorder, // Use the renamed variable
          };
        };

        cell.addEventListener("mouseenter", (eventMouse) => {
          // 1. Clear any timeout that was set to HIDE a previous tooltip
          if (this.clearTooltipTimeoutId) {
            clearTimeout(this.clearTooltipTimeoutId);
            this.clearTooltipTimeoutId = null;
          }

          // 2. Clear any timeout that was previously set to SHOW a tooltip
          if (this.tooltipTimeoutId) {
            clearTimeout(this.tooltipTimeoutId);
            this.tooltipTimeoutId = null;
          }

          // ---- ADDED: Clear any pending snippet fetching timeout and reset related state ----
          if (this.snippetTimeoutId) {
            clearTimeout(this.snippetTimeoutId);
            this.snippetTimeoutId = null;
          }
          this.currentHoveredCellForSnippet = null;
          // ---- END ADDED ----

          // 3. If a tooltip is currently visible (from another cell), remove it IMMEDIATELY
          if (
            this.activeGridCellTooltip &&
            this.activeGridCellTooltip.parentElement
          ) {
            this.activeGridCellTooltip.remove();
            this.activeGridCellTooltip = null;
          }

          // 4. Set a new timeout to show the tooltip for THIS cell
          this.tooltipTimeoutId = window.setTimeout(() => {
            // Check if mouse hasn't already left the cell or another action cleared things
            if (this.tooltipTimeoutId === null && !this.activeGridCellTooltip) {
              // This check might be too restrictive if tooltipTimeoutId is cleared right after starting the main work.
              // The original check `if (this.activeGridCellTooltip && this.activeGridCellTooltip.parentElement)` was for safety.
              // Let's ensure we only proceed if we are indeed meant to show a tooltip for *this* sequence.
            }

            if (
              this.activeGridCellTooltip &&
              this.activeGridCellTooltip.parentElement
            ) {
              // Re-check for safety, remove if another tooltip became active somehow
              this.activeGridCellTooltip.remove();
              this.activeGridCellTooltip = null;
            }

            this.activeGridCellTooltip = document.createElement("div");
            this.activeGridCellTooltip.addClass("chronica-grid-cell-tooltip");
            this.activeGridCellTooltip.addClass(
              this.plugin.settings.tooltipDetailLevel
            );

            const { fragment, hintClass, customColor } =
              createTooltipContent(cell); // createTooltipContent is defined elsewhere in renderWeeksGrid
            this.activeGridCellTooltip.appendChild(fragment);

            if (hintClass) {
              this.activeGridCellTooltip.addClass(hintClass);
            } else if (customColor) {
              this.activeGridCellTooltip.style.borderLeftColor = customColor;
            }

            document.body.appendChild(this.activeGridCellTooltip);

            const cellRect = cell.getBoundingClientRect();
            const tooltipRect =
              this.activeGridCellTooltip.getBoundingClientRect();
            let top = cellRect.bottom + 8;
            let left =
              cellRect.left + cellRect.width / 2 - tooltipRect.width / 2;

            if (left < 5) left = 5;
            if (left + tooltipRect.width > window.innerWidth - 5) {
              left = window.innerWidth - tooltipRect.width - 5;
            }
            if (top + tooltipRect.height > window.innerHeight - 5) {
              top = cellRect.top - tooltipRect.height - 8;
            }
            if (top < 5) top = 5;

            this.activeGridCellTooltip.style.left = `${
              left + window.scrollX
            }px`;
            this.activeGridCellTooltip.style.top = `${top + window.scrollY}px`;

            setTimeout(() => {
              // This timeout makes the main tooltip visible
              if (this.activeGridCellTooltip) {
                // Check if tooltip still exists (wasn't cleared by a quick mouseleave/click)
                this.activeGridCellTooltip.addClass("visible");

                // ---- NEW: Logic for sustained hover to fetch snippets ----
                this.currentHoveredCellForSnippet = cell; // Mark this cell

                if (
                  this.plugin.settings.enableTooltipNotePreview &&
                  this.plugin.settings.tooltipDetailLevel === "expanded"
                ) {
                  if (this.snippetTimeoutId)
                    clearTimeout(this.snippetTimeoutId);

                  this.snippetTimeoutId = window.setTimeout(() => {
                    // Ensure the tooltip is still for the cell we initiated this for
                    if (
                      this.activeGridCellTooltip &&
                      this.currentHoveredCellForSnippet === cell
                    ) {
                      this.fetchAndDisplaySnippets(
                        this.activeGridCellTooltip,
                        cell
                      );
                    }
                    this.snippetTimeoutId = null; // Clear after execution or if condition fails
                  }, 300); // Sustained hover delay (e.g., 300ms after main tooltip is visible)
                }
                // ---- END NEW ----
              }
            }, 10); // Delay for CSS transition of main tooltip
            this.tooltipTimeoutId = null; // Mark that this main "show" timeout has completed its primary job
          }, 500); // Initial delay to show main tooltip
        });

        cell.addEventListener("mouseleave", (eventMouse) => {
          // Clear pending show of main tooltip
          if (this.tooltipTimeoutId) {
            clearTimeout(this.tooltipTimeoutId);
            this.tooltipTimeoutId = null;
          }

          // ---- ADDED: Clear pending snippet fetching timeout and reset related state ----
          if (this.snippetTimeoutId) {
            clearTimeout(this.snippetTimeoutId);
            this.snippetTimeoutId = null;
          }
          this.currentHoveredCellForSnippet = null;
          // ---- END ADDED ----

          // Logic to hide the main tooltip (already exists and seems correct)
          if (
            this.activeGridCellTooltip &&
            this.activeGridCellTooltip.parentElement
          ) {
            this.activeGridCellTooltip.removeClass("visible");
            if (this.clearTooltipTimeoutId) {
              clearTimeout(this.clearTooltipTimeoutId);
              // this.clearTooltipTimeoutId = null; // Clearing ID here might be premature if we are about to set a new one
            }
            this.clearTooltipTimeoutId = window.setTimeout(() => {
              if (
                this.activeGridCellTooltip &&
                this.activeGridCellTooltip.parentElement
              ) {
                // Check again before removing
                this.activeGridCellTooltip.remove();
              }
              this.activeGridCellTooltip = null;
              this.clearTooltipTimeoutId = null;
            }, 150);
          }
        });
        // --- End Custom Tooltip Logic ---

        // --- Existing Event Handlers ---
        cell.addEventListener("click", async (event) => {
          // ---- Cleanup for tooltips and snippets on click ----
          if (this.tooltipTimeoutId) {
            clearTimeout(this.tooltipTimeoutId);
            this.tooltipTimeoutId = null;
          }
          if (this.clearTooltipTimeoutId) {
            clearTimeout(this.clearTooltipTimeoutId);
            this.clearTooltipTimeoutId = null;
          }

          // ---- ADDED: Also clear pending snippet fetching on click ----
          if (this.snippetTimeoutId) {
            clearTimeout(this.snippetTimeoutId);
            this.snippetTimeoutId = null;
          }
          this.currentHoveredCellForSnippet = null;
          // ---- END ADDED ----

          if (
            this.activeGridCellTooltip &&
            this.activeGridCellTooltip.parentElement
          ) {
            this.activeGridCellTooltip.remove();
          }
          this.activeGridCellTooltip = null;
          // ---- End Cleanup ----

          // Check for folder selection first
          if (!this.plugin.settings.hasSeenFolders) {
            new ChornicaFolderSelectionModal(this.app, this.plugin).open();
            return;
          }

          // Shift+Click to add or edit event
          if (event.shiftKey) {
            const eventTitleFromDataset = cell.dataset.tooltipEventTitle;
            const eventDescriptionFromDataset =
              cell.dataset.tooltipEventDescription;
            const eventTypeFromDataset = cell.dataset.tooltipEventType;
            const eventPeriodFromDataset = cell.dataset.tooltipEventPeriod;

            let eventToEdit: ChronicaEvent | undefined = undefined;

            if (eventTitleFromDataset) {
              // If the cell is styled as part of an event
              eventToEdit = this.plugin.settings.events.find((evt) => {
                // 1. Match Event Type
                const typeNameMatches =
                  this.plugin.settings.eventTypes.find(
                    (et) => et.id === evt.typeId
                  )?.name === eventTypeFromDataset;
                if (!typeNameMatches) return false;

                // 2. Match Event Period
                let currentEventPeriodFormatted: string;
                if (evt.endWeekKey && evt.endWeekKey !== evt.weekKey) {
                  currentEventPeriodFormatted = `${evt.weekKey} to ${evt.endWeekKey}`;
                } else {
                  currentEventPeriodFormatted = evt.weekKey;
                }
                const periodMatches =
                  currentEventPeriodFormatted === eventPeriodFromDataset;
                if (!periodMatches) return false;

                // 3. Match Event Title (considering name can be from evt.name or evt.description)
                const titleMatches =
                  (evt.name || evt.description) === eventTitleFromDataset;
                if (!titleMatches) return false;

                // 4. Match Event Description (considering description can be empty)
                const descriptionMatches =
                  (evt.description || "") ===
                  (eventDescriptionFromDataset || "");
                if (!descriptionMatches) return false;

                // If all conditions pass, this is the event
                return true;
              });
            }

            if (eventToEdit) {
              // EDIT MODE: Found an existing event for this cell
              new ChornicaEventModal(this.app, this.plugin, eventToEdit).open();
            } else {
              // ADD MODE: No specific event found for editing
              new ChornicaEventModal(this.app, this.plugin, weekKey).open();
            }
            return; // Important: return after handling shift-click
          }

          // Check if event styling added a note path to the cell
          const linkedNotePath = cell.dataset.eventFile;

          if (linkedNotePath) {
            const noteFile =
              this.app.vault.getAbstractFileByPath(linkedNotePath);
            if (noteFile instanceof TFile) {
              await this.plugin.safelyOpenFile(noteFile);
              return;
            } else {
              // console.warn was removed by user
              delete cell.dataset.eventFile;
            }
          }

          // If no linked event note, handle as a weekly note
          const values = {
            gggg: isoWeekInfo.year.toString(),
            ww: isoWeekInfo.week.toString().padStart(2, "0"),
            YYYY: cellStartDate.getFullYear().toString(),
            MM: (cellStartDate.getMonth() + 1).toString().padStart(2, "0"),
            DD: cellStartDate.getDate().toString().padStart(2, "0"),
            MMMM: cellStartDate.toLocaleString("default", { month: "long" }),
            MMM: cellStartDate.toLocaleString("default", { month: "short" }),
            YY: cellStartDate.getFullYear().toString().slice(-2),
          };

          const weeklyNoteFileName = this.plugin.formatFileName(
            settings.weekNoteTemplate,
            values
          );
          const fullPath = this.plugin.getFullPath(weeklyNoteFileName, false);
          const existingFile = this.app.vault.getAbstractFileByPath(fullPath);

          if (existingFile instanceof TFile) {
            await this.plugin.safelyOpenFile(existingFile);
          } else {
            const folderPath = settings.notesFolder;
            if (folderPath && folderPath.trim() !== "") {
              try {
                if (!(await this.app.vault.adapter.exists(folderPath)))
                  await this.app.vault.createFolder(folderPath);
              } catch (err) {
                // console.error was removed
              }
            }
            let content = this.plugin.formatFrontmatter({});
            content += `# Week ${isoWeekInfo.week}, ${isoWeekInfo.year}\n\n## Reflections\n\n## Tasks\n\n## Notes\n`;
            const newFile = await this.app.vault.create(fullPath, content);
            await this.plugin.safelyOpenFile(newFile);
          }
        });

        // Context menu for manual fill
        cell.addEventListener("contextmenu", (event) => {
          // Original event arg name is fine here
          if (settings.enableManualFill && cellStartDate >= now) {
            event.preventDefault();

            const filledIndex = settings.filledWeeks.indexOf(weekKey);

            if (filledIndex >= 0) {
              settings.filledWeeks.splice(filledIndex, 1);
              cell.removeClass("filled-week");
            } else {
              settings.filledWeeks.push(weekKey);
              cell.addClass("filled-week");
            }
            this.plugin.saveSettings();
          }
        });
      } // End cellIndex loop
    } // End yearIndex loop
  } // End renderWeeksGrid

  /**
   * Render the statistics panel
   * @param container - Container to render panel in
   */

  renderStatsPanel(container: HTMLElement): void {
    // Create the stats handle (always visible)
    const statsHandle = container.createEl("div", {
      cls: "chronica-stats-handle",
    });

    // Create the icon using setIcon
    const iconEl = statsHandle.createSpan({
      cls: "chronica-stats-handle-icon",
    }); // Create a span for the icon
    setIcon(iconEl, "bar-chart-horizontal"); // Use the appropriate icon name

    // Create the text label separately
    statsHandle.createSpan({ text: "Statistics" });

    statsHandle.setAttribute(
      "title",
      this.isStatsOpen ? "Hide Statistics" : "Show Statistics"
    );

    // Create stats panel container with appropriate classes
    const statsPanel = container.createEl("div", {
      cls: `chronica-stats-panel ${
        this.isStatsOpen ? "expanded" : "collapsed"
      }`,
    });

    // Use CSS variables for height, don't set inline styles
    if (this.isStatsOpen) {
      // Update the content area's class to add padding
      const contentArea = this.containerEl.querySelector(
        ".chronica-content-area"
      );
      if (contentArea) {
        contentArea.classList.add("stats-expanded");
      }
    }

    // Create header
    const statsHeader = statsPanel.createEl("div", {
      cls: "chronica-stats-header",
    });

    // Set up horizontal dragging via header
    this.setupStatsPanelHorizontalDrag(statsHeader, statsPanel, statsHandle);

    // Add drag handle for resizing
    const dragHandle = statsHeader.createEl("div", {
      cls: "chronica-stats-drag-handle",
    });

    // Create tabs container
    const tabsContainer = statsHeader.createEl("div", {
      cls: "chronica-stats-tabs",
    });

    // Define tabs
    const tabs = [
      { id: "overview", label: "Overview" },
      { id: "events", label: "Events" },
      { id: "timeline", label: "Timeline" },
      { id: "charts", label: "Charts" },
    ];

    // Add tab buttons
    tabs.forEach((tab) => {
      const tabButton = tabsContainer.createEl("button", {
        cls: `chronica-stats-tab ${
          this.plugin.settings.activeStatsTab === tab.id ? "active" : ""
        }`,
        text: tab.label,
      });

      tabButton.dataset.tabId = tab.id;

      // Add click event handler
      tabButton.addEventListener("click", () => {
        // Store active tab
        this.plugin.settings.activeStatsTab = tab.id;
        this.plugin.saveSettings();

        // Update UI (use class-based approach like sidebar)
        tabsContainer.querySelectorAll(".chronica-stats-tab").forEach((btn) => {
          btn.classList.toggle(
            "active",
            btn.getAttribute("data-tab-id") === tab.id
          );
        });

        // Update content
        statsPanel
          .querySelectorAll(".chronica-stats-tab-content")
          .forEach((content) => {
            content.classList.toggle(
              "active",
              content.id === `tab-content-${tab.id}`
            );
          });
      });
    });

    // Add content container
    const contentContainer = statsPanel.createEl("div", {
      cls: "chronica-stats-content",
    });

    // Create tab content areas
    tabs.forEach((tab) => {
      const tabContent = contentContainer.createEl("div", {
        cls: `chronica-stats-tab-content ${
          this.plugin.settings.activeStatsTab === tab.id ? "active" : ""
        }`,
        attr: { id: `tab-content-${tab.id}` },
      });

      // Add tab-specific content
      if (tab.id === "overview") {
        this.renderOverviewTab(tabContent);
      } else if (tab.id === "events") {
        this.renderEventsTab(tabContent);
      } else if (tab.id === "timeline") {
        this.renderTimelineTab(tabContent);
      } else if (tab.id === "charts") {
        this.renderChartsTab(tabContent);
      }
    });

    statsHandle.addEventListener("click", () => {
      this.isStatsOpen = !this.isStatsOpen;
      this.plugin.settings.isStatsOpen = this.isStatsOpen;
      this.plugin.saveSettings();

      statsPanel.classList.toggle("expanded", this.isStatsOpen);
      statsPanel.classList.toggle("collapsed", !this.isStatsOpen);

      if (this.isStatsOpen) {
        // Ensure the CSS variable is current, as the .expanded class relies on it.
        document.documentElement.style.setProperty(
          "--stats-panel-height",
          `${this.plugin.settings.statsPanelHeight}px`
        );
        // statsPanel.style.height is now handled by CSS via .expanded class
      } else {
        // statsPanel.style.height is now handled by CSS via .collapsed class
      }

      const contentArea = this.containerEl.querySelector(
        ".chronica-content-area"
      );
      if (contentArea) {
        contentArea.classList.toggle("stats-expanded", this.isStatsOpen);
      }

      statsHandle.setAttribute(
        "title",
        this.isStatsOpen ? "Hide Statistics" : "Show Statistics"
      );
    });
    // Setup resize functionality with simplified approach
    this.setupStatsPanelResize(dragHandle, statsPanel);

    // Setup horizontal resize
    this.setupStatsPanelWidthResize(statsPanel);
  }

  /**
   * Setup the resize functionality for the stats panel
   * @param dragHandle - Handle element for dragging
   * @param statsPanel - Panel to resize
   */
  setupStatsPanelResize(
    dragHandle: HTMLElement,
    statsPanel: HTMLElement
  ): void {
    let startY = 0;
    let startX = 0;
    let startHeight = 0;
    let startOffset = 0;

    const onMouseDown = (e: MouseEvent) => {
      // Only respond to left mouse button
      if (e.button !== 0) return;

      e.preventDefault(); // Prevent text selection

      // Get the current height and horizontal offset
      startHeight = this.plugin.settings.statsPanelHeight;
      startOffset = this.plugin.settings.statsPanelHorizontalOffset || 0;
      startX = e.clientX;
      startY = e.clientY;

      // Add event listeners
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      // Calculate vertical change (dragging up/down)
      const deltaY = startY - e.clientY;
      const newHeight = Math.max(150, Math.min(600, startHeight + deltaY));

      // Calculate horizontal change (dragging left/right)
      const deltaX = e.clientX - startX;

      // Calculate boundaries to keep panel visible
      const windowWidth = window.innerWidth;
      const panelWidth = statsPanel.getBoundingClientRect().width;
      const maxOffset = (windowWidth - panelWidth) / 2;
      const newOffset = Math.max(
        -maxOffset,
        Math.min(maxOffset, startOffset + deltaX)
      );

      // Update CSS variable for height
      document.documentElement.style.setProperty(
        "--stats-panel-height",
        `${newHeight}px`
      );
      // Update panel height and position
      this.plugin.settings.statsPanelHeight = newHeight;

      statsPanel.style.transform = `translateX(calc(-50% + ${newOffset}px))`;

      // Update the handle position to match
      const statsHandle = this.containerEl.querySelector(
        ".chronica-stats-handle"
      ) as HTMLElement;
      if (statsHandle) {
        statsHandle.style.transform = `translateX(calc(-50% + ${newOffset}px))`;
      }

      // Update content area padding for height
      const contentArea = this.containerEl.querySelector(
        ".chronica-content-area"
      );
      if (contentArea && this.isStatsOpen) {
      }

      // Update settings (but don't save yet to avoid performance issues)
      this.plugin.settings.statsPanelHeight = newHeight;
      this.plugin.settings.statsPanelHorizontalOffset = newOffset;
    };

    const onMouseUp = () => {
      // Remove event listeners
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      // Save settings once at the end of resize
      this.plugin.saveSettings();
    };

    // Add initial event listener
    dragHandle.addEventListener("mousedown", onMouseDown);
  }

  updateStatsPanelLayout(): void {
    const statsPanel = this.containerEl.querySelector(
      ".chronica-stats-panel"
    ) as HTMLElement;
    const statsHandle = this.containerEl.querySelector(
      ".chronica-stats-handle"
    ) as HTMLElement;
    const contentArea = this.containerEl.querySelector(
      ".chronica-content-area"
    ) as HTMLElement;
    const sidebar = this.containerEl.querySelector(
      ".chronica-sidebar"
    ) as HTMLElement;

    if (!statsPanel || !contentArea || !statsHandle) return;

    // Ensure CSS variables are up-to-date from settings
    const panelHeightSetting = this.plugin.settings.statsPanelHeight;
    const panelWidthSetting = this.plugin.settings.statsPanelWidth;
    document.documentElement.style.setProperty(
      "--stats-panel-height",
      `${panelHeightSetting}px`
    );
    document.documentElement.style.setProperty(
      "--stats-panel-width",
      `${panelWidthSetting}px`
    );

    const horizontalOffset =
      this.plugin.settings.statsPanelHorizontalOffset || 0;
    const sidebarWidth =
      this.isSidebarOpen && sidebar ? sidebar.getBoundingClientRect().width : 0;
    const offsetX = this.isSidebarOpen ? sidebarWidth / 2 : 0;

    statsPanel.style.left = `calc(50% + ${offsetX}px)`;
    statsHandle.style.left = `calc(50% + ${offsetX}px)`;

    statsPanel.style.transform = `translateX(calc(-50% + ${horizontalOffset}px))`;
    statsHandle.style.transform = `translateX(calc(-50% + ${horizontalOffset}px))`;

    if (this.isStatsOpen) {
      contentArea.classList.add("stats-expanded");
      if (!statsPanel.classList.contains("expanded")) {
        statsPanel.classList.add("expanded");
        statsPanel.classList.remove("collapsed");
      }
    } else {
      contentArea.classList.remove("stats-expanded");
      if (!statsPanel.classList.contains("collapsed")) {
        statsPanel.classList.add("collapsed");
        statsPanel.classList.remove("expanded");
      }
    }
  }

  /**
   * Render the Overview tab content using the new unified event structure.
   * @param container - Container to render tab content in
   */
  renderOverviewTab(container: HTMLElement): void {
    // --- Basic Life Progress Calculations (Unaffected by event structure change) ---
    const now = new Date();
    const [year, month, day] = this.plugin.settings.birthday
      .split("-")
      .map(Number);
    const birthdayDate = new Date(year, month - 1, day);
    const ageInWeeks = this.plugin.getFullWeekAge(birthdayDate, now);
    const totalWeeks = this.plugin.settings.lifespan * 52;
    const livedPercentage = Math.min(
      100,
      Math.max(0, (ageInWeeks / totalWeeks) * 100)
    );
    const remainingWeeks = Math.max(0, totalWeeks - ageInWeeks);
    const yearsLived = Math.floor(ageInWeeks / 52);
    const remainingWeeksInYear = ageInWeeks % 52;
    const decadesLived = Math.floor(yearsLived / 10);
    const yearsIntoCurrentDecade = yearsLived % 10;

    // --- Event Count Calculations (Using NEW structure) ---
    const totalEvents = this.plugin.settings.events.length;
    const eventsByType: { name: string; count: number }[] = [];

    // Count events for each type definition
    this.plugin.settings.eventTypes.forEach((eventType) => {
      const count = this.plugin.settings.events.filter(
        (event) => event.typeId === eventType.id
      ).length;
      if (count > 0) {
        eventsByType.push({ name: eventType.name, count: count });
      }
    });

    // Sort by count for the breakdown string
    eventsByType.sort((a, b) => b.count - a.count);

    // Create breakdown string
    let eventBreakdown = eventsByType
      .map((et) => `${et.count} ${et.name}`)
      .join(", ");
    if (!eventBreakdown) {
      eventBreakdown = "No events added yet";
    }

    // --- Render UI ---
    const overviewGrid = container.createEl("div", {
      cls: "chronica-stats-grid",
    });

    // Life progress card (mostly unchanged)
    const progressSection = overviewGrid.createEl("div", {
      cls: "chronica-stat-section",
    });
    const lifeSummary = progressSection.createEl("div", {
      cls: "chronica-stat-card chronica-stat-card-full",
    });
    lifeSummary.createEl("div", {
      cls: "chronica-stat-title",
      text: "Life Progress",
    });
    const progressContainer = lifeSummary.createEl("div", {
      cls: "chronica-progress-container",
    });
    const circleContainer = progressContainer.createEl("div", {
      cls: "chronica-circular-progress",
    });
    const progressValue = Math.round(livedPercentage);
    // (Keep SVG rendering logic for circular progress bar - unchanged)
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "60");
    svg.setAttribute("height", "60");
    svg.setAttribute("viewBox", "0 0 80 80");
    const bgCircle = document.createElementNS(svgNS, "circle");
    bgCircle.setAttrs({
      cx: "40",
      cy: "40",
      r: "35",
      fill: "none",
      stroke: "var(--background-modifier-border)",
      "stroke-width": "5",
    });
    svg.appendChild(bgCircle);
    const progressCircle = document.createElementNS(svgNS, "circle");
    progressCircle.setAttrs({
      cx: "40",
      cy: "40",
      r: "35",
      fill: "none",
      stroke: "var(--interactive-accent)",
      "stroke-width": "5",
      "stroke-dasharray": "220",
      "stroke-dashoffset": `${220 - (220 * livedPercentage) / 100}`,
      transform: "rotate(-90 40 40)",
    });
    svg.appendChild(progressCircle);
    circleContainer.appendChild(svg);
    circleContainer.createEl("div", {
      cls: "chronica-circular-progress-text",
      text: `${progressValue}%`,
    });
    // Bar container (unchanged)
    const barContainer = progressContainer.createEl("div", {
      cls: "chronica-bar-container",
    });
    const progressBar = barContainer.createEl("div", {
      cls: "chronica-progress-bar",
    });
    const progressFill = progressBar.createEl("div", {
      cls: "chronica-progress-bar-fill",
    });
    progressFill.style.width = `${livedPercentage}%`;
    barContainer.createEl("div", {
      cls: "chronica-stat-subtitle",
      text: `${ageInWeeks} weeks lived, ${remainingWeeks} weeks remaining`,
    });

    // Current age card (unchanged)
    const ageCard = overviewGrid.createEl("div", { cls: "chronica-stat-card" });
    ageCard.createEl("div", {
      cls: "chronica-stat-title",
      text: "Current Age",
    });
    ageCard.createEl("div", {
      cls: "chronica-stat-value",
      text: `${yearsLived} years, ${remainingWeeksInYear} weeks`,
    });
    ageCard.createEl("div", {
      cls: "chronica-stat-subtitle",
      text: `${decadesLived} decades + ${yearsIntoCurrentDecade} years`,
    });

    // Events count card (UPDATED)
    const eventsCard = overviewGrid.createEl("div", {
      cls: "chronica-stat-card",
    });
    eventsCard.createEl("div", {
      cls: "chronica-stat-title",
      text: "Total Events Recorded",
    });
    eventsCard.createEl("div", {
      cls: "chronica-stat-value",
      text: totalEvents.toString(),
    }); // Use new totalEvents
    eventsCard.createEl("div", {
      cls: "chronica-stat-subtitle",
      text: eventBreakdown,
    }); // Use new eventBreakdown string

    // Birthday info card (unchanged)
    const birthdayCard = overviewGrid.createEl("div", {
      cls: "chronica-stat-card",
    });
    birthdayCard.createEl("div", {
      cls: "chronica-stat-title",
      text: "Birthday",
    });
    const formatBirthday = (date: Date): string => {
      /* ... keep formatting logic ... */
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      return `${
        months[date.getMonth()]
      } ${date.getDate()}, ${date.getFullYear()}`;
    };
    birthdayCard.createEl("div", {
      cls: "chronica-stat-value",
      text: formatBirthday(birthdayDate),
    });
    const nextBirthdayDate = new Date(birthdayDate);
    nextBirthdayDate.setFullYear(now.getFullYear());
    if (nextBirthdayDate < now) {
      nextBirthdayDate.setFullYear(now.getFullYear() + 1);
    }
    const daysUntilBirthday = Math.ceil(
      (nextBirthdayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    birthdayCard.createEl("div", {
      cls: "chronica-stat-subtitle",
      text: `Next birthday in ${daysUntilBirthday} days`,
    });
  }

  /**
   * Render the Events tab content with visualizations and event lists using the new unified event structure.
   * @param container - Container to render tab content in
   */
  renderEventsTab(container: HTMLElement): void {
    container.empty(); // Clear previous content
    container.createEl("h3", { text: "Event Analysis" });

    // --- Data Gathering (New Structure) ---
    const allEvents = this.plugin.settings.events || [];
    const eventTypes = this.plugin.settings.eventTypes || [];
    const totalEvents = allEvents.length;

    if (totalEvents === 0) {
      container.createEl("div", {
        cls: "chronica-empty-state",
        text: "No events recorded yet. Add events via the sidebar or by shift-clicking weeks.",
      });
      return;
    }

    // 1. Calculate counts per type for the bar chart
    const countsByType: { name: string; count: number; color: string }[] =
      eventTypes
        .map((type) => {
          const count = allEvents.filter(
            (event) => event.typeId === type.id
          ).length;
          return { name: type.name, count: count, color: type.color };
        })
        .filter((typeCount) => typeCount.count > 0) // Only include types with events
        .sort((a, b) => b.count - a.count); // Sort highest count first

    // 2. Get recent events for the list
    // Helper to convert week key to a sortable number
    const weekKeyToSortable = (weekKey: string): number => {
      try {
        const [year, week] = weekKey.split("-W").map(Number);
        return year * 100 + week; // Simple sortable number (e.g., 2023-W10 -> 202310)
      } catch {
        return 0; // Fallback
      }
    };

    const recentEvents = [...allEvents]
      .sort((a, b) => {
        return weekKeyToSortable(b.weekKey) - weekKeyToSortable(a.weekKey); // Sort descending
      })
      .slice(0, 10); // Get top 10

    // 3. Calculate stats for the table
    const allYears = allEvents.map((e) => parseInt(e.weekKey.split("-W")[0]));
    const uniqueYears = [...new Set(allYears)].filter((y) => !isNaN(y)); // Filter out potential NaN
    const eventsByYear =
      uniqueYears.length > 0
        ? (totalEvents / uniqueYears.length).toFixed(1)
        : "0";
    const rangeEvents = allEvents.filter(
      (e) => e.endWeekKey && e.endWeekKey !== e.weekKey
    ).length;
    const singleEvents = totalEvents - rangeEvents;

    // --- Render UI ---

    // Create grid layout for stats
    const statsGrid = container.createEl("div", { cls: "chronica-stats-grid" });

    // Distribution Chart Card
    const distributionCard = statsGrid.createEl("div", {
      cls: "chronica-stat-card chronica-stat-card-full",
    });
    distributionCard.createEl("div", {
      cls: "chronica-stat-title",
      text: "Event Type Distribution",
    });
    const chartContainer = distributionCard.createEl("div", {
      cls: "chronica-event-chart-container",
    });

    const maxCount = Math.max(...countsByType.map((t) => t.count), 1); // Avoid division by zero

    for (const typeData of countsByType) {
      const barRow = chartContainer.createEl("div", {
        cls: "chronica-chart-row",
      });
      barRow.createEl("div", {
        cls: "chronica-chart-label",
        text: typeData.name,
        attr: { title: typeData.name },
      }); // Add title for long names
      const barContainer = barRow.createEl("div", {
        cls: "chronica-chart-bar-container",
      });
      const barEl = barContainer.createEl("div", { cls: "chronica-chart-bar" });
      barEl.style.width = `${(typeData.count / maxCount) * 100}%`;
      barEl.style.backgroundColor = typeData.color; // Use color from type definition
      barContainer.createEl("div", {
        cls: "chronica-chart-count",
        text: typeData.count.toString(),
      });
    }

    // Recent Events List Card
    const eventListCard = statsGrid.createEl("div", {
      cls: "chronica-stat-card chronica-stat-card-full",
    });
    eventListCard.createEl("div", {
      cls: "chronica-stat-title",
      text: "Recent Events (Max 10)",
    });

    if (recentEvents.length > 0) {
      const eventListEl = eventListCard.createEl("div", {
        cls: "chronica-event-list",
      });
      for (const event of recentEvents) {
        // Find the type definition for this event
        const eventType = eventTypes.find((et) => et.id === event.typeId);
        const typeName = eventType?.name || "Unknown Type";
        const typeColor = eventType?.color || "#888888"; // Fallback color

        const eventItem = eventListEl.createEl("div", {
          cls: "chronica-event-item",
        });

        const colorDot = eventItem.createEl("div", {
          cls: "chronica-event-color-dot",
        });
        colorDot.style.backgroundColor = typeColor; // Use looked-up color

        let dateRange = event.weekKey;
        if (event.endWeekKey && event.endWeekKey !== event.weekKey) {
          dateRange = `${event.weekKey} → ${event.endWeekKey}`;
        }

        const eventInfo = eventItem.createEl("div", {
          cls: "chronica-event-info",
        });
        eventInfo.createEl("div", {
          cls: "chronica-event-name",
          text: event.description,
          attr: { title: event.description },
        });
        eventInfo.createEl("div", {
          cls: "chronica-event-meta",
          text: `${typeName} • ${dateRange}`,
        }); // Use looked-up name

        // Make item clickable to open note if path exists
        if (event.notePath) {
          eventItem.addClass("clickable-event"); // Add class for potential hover/cursor styles
          eventItem.setAttribute("data-note-path", event.notePath);
          eventItem.addEventListener("click", () => {
            const note = this.app.vault.getAbstractFileByPath(event.notePath!);
            if (note instanceof TFile) {
              this.plugin.safelyOpenFile(note);
            } else {
              new Notice("Associated note not found.");
            }
          });
        }
      }
      // Add CSS for clickable events if needed
      // .clickable-event:hover { background-color: var(--background-modifier-hover); cursor: pointer; }
    } else {
      eventListCard.createEl("div", {
        cls: "chronica-empty-list",
        text: "No events found",
      });
    }

    // Event Statistics Table Card
    const eventStatsCard = statsGrid.createEl("div", {
      cls: "chronica-stat-card chronica-stat-card-full",
    });
    eventStatsCard.createEl("div", {
      cls: "chronica-stat-title",
      text: "Event Statistics Summary",
    });

    const statsTable = eventStatsCard.createEl("table", {
      cls: "chronica-stats-table",
    });
    const addStatRow = (label: string, value: string) => {
      const row = statsTable.createEl("tr");
      row.createEl("td", { text: label });
      row.createEl("td", { text: value });
    };

    addStatRow("Total Events", totalEvents.toString());
    addStatRow("Years with Events", uniqueYears.length.toString());
    addStatRow("Average Events/Year", eventsByYear);
    addStatRow("Single-Week Events", singleEvents.toString());
    addStatRow("Multi-Week Events", rangeEvents.toString());
  }

  /**
   * Render the Timeline tab content with life phases and milestone analysis.
   * Updated to use the new unified event structure for event counts.
   * @param container - Container to render tab content in
   */
  renderTimelineTab(container: HTMLElement): void {
    container.empty(); // Clear previous content

    // --- Basic Life Progress Calculations ---
    const now = new Date();
    const [birthYear, birthMonth, birthDay] = this.plugin.settings.birthday
      .split("-")
      .map(Number);
    const birthdayDate = new Date(birthYear, birthMonth - 1, birthDay);
    const ageInWeeks = this.plugin.getFullWeekAge(birthdayDate, now); // Defined here
    const totalWeeks = this.plugin.settings.lifespan * 52;
    const ageInYears = ageInWeeks / 52;
    const pastWeeks = ageInWeeks; // Assign here for use later

    // --- Render UI ---
    const timelineGrid = container.createEl("div", {
      cls: "chronica-stats-grid",
    });

    // --- Life Phases Card (Unaffected by event structure change) ---
    const phasesCard = timelineGrid.createEl("div", {
      cls: "chronica-stat-card chronica-stat-card-full",
    });
    phasesCard.createEl("div", {
      cls: "chronica-stat-title",
      text: "Life Phases",
    });

    let currentPhase = "";
    let phaseColor = "";
    // (Phase calculation logic - unchanged)
    if (ageInYears < 5) {
      currentPhase = "Early Childhood";
      phaseColor = "#8BC34A";
    } else if (ageInYears < 13) {
      currentPhase = "Childhood";
      phaseColor = "#4CAF50";
    } else if (ageInYears < 18) {
      currentPhase = "Adolescence";
      phaseColor = "#009688";
    } else if (ageInYears < 25) {
      currentPhase = "Young Adult";
      phaseColor = "#00BCD4";
    } else if (ageInYears < 40) {
      currentPhase = "Early Adulthood";
      phaseColor = "#03A9F4";
    } else if (ageInYears < 60) {
      currentPhase = "Middle Adulthood";
      phaseColor = "#3F51B5";
    } else {
      currentPhase = "Late Adulthood";
      phaseColor = "#9C27B0";
    }

    // Create phase visualization bar (Rendering logic - unchanged)
    const phaseBar = phasesCard.createEl("div", { cls: "chronica-phase-bar" });
    const phases = [
      { name: "Childhood", end: 18, color: "#4CAF50" },
      { name: "Young Adult", end: 25, color: "#00BCD4" },
      { name: "Early Adult", end: 40, color: "#03A9F4" },
      { name: "Middle Adult", end: 60, color: "#3F51B5" },
      {
        name: "Late Adult",
        end: this.plugin.settings.lifespan,
        color: "#9C27B0",
      },
    ];
    let totalPhaseLength = phases[phases.length - 1].end; // Use end year of last phase
    let currentYear = 0;
    phases.forEach((phase, index) => {
      let phaseStartYear = index === 0 ? 0 : phases[index - 1].end;
      let phaseLengthYears = phase.end - phaseStartYear;
      const relativeWidth = (phaseLengthYears / totalPhaseLength) * 100;

      const phaseSegment = phaseBar.createEl("div", {
        cls: "chronica-phase-segment",
      });
      phaseSegment.style.width = `${relativeWidth}%`;
      phaseSegment.style.backgroundColor = phase.color;
      phaseSegment.createEl("div", {
        cls: "chronica-phase-label",
        text: phase.name,
      });
      phaseSegment.createEl("div", {
        cls: "chronica-phase-age",
        text: phase.end.toString(),
      });

      if (ageInYears >= phaseStartYear && ageInYears < phase.end) {
        const markerPosition =
          ((ageInYears - phaseStartYear) / phaseLengthYears) * 100;
        const currentMarker = phaseSegment.createEl("div", {
          cls: "chronica-current-marker",
        });
        currentMarker.style.left = `${markerPosition}%`;
      }
      currentYear = phase.end; // Keep track for next iteration
    });
    phasesCard.createEl("div", {
      cls: "chronica-current-phase",
      text: `Current phase: ${currentPhase} (${Math.floor(
        ageInYears
      )} years old)`,
    }).style.color = phaseColor;

    // --- Milestones Card (Unaffected by event structure change) ---
    const milestonesCard = timelineGrid.createEl("div", {
      cls: "chronica-stat-card chronica-stat-card-full",
    });
    milestonesCard.createEl("div", {
      cls: "chronica-stat-title",
      text: "Life Milestones",
    });
    const milestoneTable = milestonesCard.createEl("table", {
      cls: "chronica-milestone-table",
    });
    // (Table header rendering logic - unchanged)
    const headerRow = milestoneTable.createEl("tr");
    headerRow.createEl("th", { text: "Milestone" });
    headerRow.createEl("th", { text: "Age" });
    headerRow.createEl("th", { text: "Date" });
    headerRow.createEl("th", { text: "Status" });
    // (addMilestone function and calls - unchanged)
    const formatDate = (date: Date): string => {
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
      return `${
        months[date.getMonth()]
      } ${date.getDate()}, ${date.getFullYear()}`;
    };
    const addMilestone = (name: string, age: number) => {
      const milestoneDate = new Date(birthdayDate);
      milestoneDate.setFullYear(birthdayDate.getFullYear() + age);
      const row = milestoneTable.createEl("tr");
      row.createEl("td", { text: name });
      row.createEl("td", { text: age.toString() });
      row.createEl("td", { text: formatDate(milestoneDate) });
      const isPast = milestoneDate < now;
      const statusCell = row.createEl("td");
      statusCell.addClass(isPast ? "milestone-past" : "milestone-future");
      statusCell.textContent = isPast ? "Passed" : "Upcoming";
    };
    addMilestone("Childhood End", 18);
    addMilestone("Quarter Life", Math.round(this.plugin.settings.lifespan / 4));
    addMilestone("Half Life", Math.round(this.plugin.settings.lifespan / 2));
    addMilestone("Retirement Age", 65);
    addMilestone(
      "Three-Quarter Life",
      Math.round(this.plugin.settings.lifespan * 0.75)
    );

    // --- Week Completion Card (Uses new event count) ---
    const completionCard = timelineGrid.createEl("div", {
      cls: "chronica-stat-card chronica-stat-card-full",
    });
    completionCard.createEl("div", {
      cls: "chronica-stat-title",
      text: "Week Completion & Events",
    });

    // Calculate week completion stats (Unchanged)
    const filledWeeks = this.plugin.settings.filledWeeks?.length || 0;
    // Uses pastWeeks defined earlier
    const completionRate = pastWeeks > 0 ? (filledWeeks / pastWeeks) * 100 : 0;
    completionCard.createEl("div", {
      cls: "chronica-completion-stat",
      text: `${filledWeeks} weeks manually/auto filled out of ${Math.round(
        pastWeeks
      )} past weeks (${completionRate.toFixed(1)}%)`,
    });
    const completionBar = completionCard.createEl("div", {
      cls: "chronica-progress-bar",
    });
    const completionFill = completionBar.createEl("div", {
      cls: "chronica-progress-bar-fill",
    });
    completionFill.style.width = `${completionRate}%`;

    // Calculate event stats using the NEW unified structure
    const totalEvents = this.plugin.settings.events?.length || 0; // Get count directly
    // Uses pastWeeks defined earlier
    const eventsPerWeek = pastWeeks > 0 ? totalEvents / pastWeeks : 0;

    // Display the event count stat (Uses new totalEvents)
    completionCard.createEl("div", {
      cls: "chronica-completion-stat",
      text: `${totalEvents} events recorded (${eventsPerWeek.toFixed(
        3
      )} events/week)`,
    });
  }

  /**
   * Render the Charts tab content with improved visualizations using the new unified event structure.
   * @param container - Container to render tab content in
   */
  renderChartsTab(container: HTMLElement): void {
    container.empty(); // Clear previous content

    // --- Data Gathering (New Structure) ---
    const allEvents = this.plugin.settings.events || [];
    const eventTypes = this.plugin.settings.eventTypes || [];
    const now = new Date();

    // Helper to parse week key safely
    const parseWeekKey = (key: string): { year: number; week: number } => {
      try {
        const parts = key.split("-W");
        if (parts.length !== 2) return { year: 0, week: 0 };
        return { year: parseInt(parts[0], 10), week: parseInt(parts[1], 10) };
      } catch {
        return { year: 0, week: 0 };
      }
    };
    // Helper to get approximate date from week key
    const getDateFromWeekKey = (weekKey: string): Date | null => {
      const { year, week } = parseWeekKey(weekKey);
      if (year <= 0 || week <= 0) return null;
      try {
        const date = new Date(year, 0, 1 + (week - 1) * 7);
        const dayOfWeek = date.getDay();
        const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
        date.setDate(date.getDate() - isoDayOfWeek + 1); // Adjust to Monday
        return date;
      } catch {
        return null;
      }
    };

    // Create main container with grid layout
    const chartsGridContainer = container.createEl("div", {
      cls: "chronica-charts-grid-container",
    });

    // If no events, show empty state
    if (allEvents.length === 0) {
      const emptyState = chartsGridContainer.createEl("div", {
        cls: "chronica-empty-chart-state",
      });
      emptyState.createEl("div", { cls: "chronica-empty-icon", text: "📊" });
      emptyState.createEl("div", {
        cls: "chronica-empty-message",
        text: "No events added yet",
      });
      emptyState.createEl("div", {
        cls: "chronica-empty-submessage",
        text: "Add events to see charts and visualizations",
      });
      return;
    }

    // --- Chart 1: Event Distribution by Type (Donut Chart) ---
    const pieChartCard = chartsGridContainer.createEl("div", {
      cls: "chronica-chart-card",
    });
    pieChartCard.createEl("h3", {
      cls: "chronica-chart-title",
      text: "Event Distribution by Type",
    });

    const eventsByType = eventTypes
      .map((type) => ({
        type: type.name,
        count: allEvents.filter((event) => event.typeId === type.id).length,
        color: type.color,
      }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count);

    const totalEventsForPie = eventsByType.reduce(
      (sum, item) => sum + item.count,
      0
    );

    const pieChartContainer = pieChartCard.createEl("div", {
      cls: "chronica-donut-container",
    });
    const legendContainer = pieChartContainer.createEl("div", {
      cls: "chronica-chart-legend",
    });
    const chartArea = pieChartContainer.createEl("div", {
      cls: "chronica-donut-chart",
    });

    // (Keep SVG rendering logic for donut chart - unchanged, as it uses the calculated eventsByType)
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    chartArea.appendChild(svg);
    const g = document.createElementNS(svgNS, "g");
    g.setAttribute("transform", "translate(50,50)");
    svg.appendChild(g);
    let startAngle = 0;
    eventsByType.forEach((item) => {
      const percentage =
        totalEventsForPie > 0 ? (item.count / totalEventsForPie) * 100 : 0;
      const angleSize = percentage * 3.6;
      const endAngle = startAngle + angleSize;
      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;
      const x1 = 40 * Math.cos(startRad);
      const y1 = 40 * Math.sin(startRad);
      const x2 = 40 * Math.cos(endRad);
      const y2 = 40 * Math.sin(endRad);
      const path = document.createElementNS(svgNS, "path");
      const largeArcFlag = angleSize > 180 ? 1 : 0;
      const d = [
        `M ${x1},${y1}`,
        `A 40,40 0 ${largeArcFlag},1 ${x2},${y2}`,
        `L 0,0`,
        `Z`,
      ].join(" ");
      path.setAttribute("d", d);
      path.setAttribute("fill", item.color);
      path.setAttribute(
        "title",
        `${item.type}: ${item.count} (${percentage.toFixed(1)}%)`
      );
      g.appendChild(path);
      const legendItem = legendContainer.createEl("div", {
        cls: "chronica-legend-item",
      });
      const colorSwatch = legendItem.createEl("div", {
        cls: "chronica-legend-swatch",
      });
      colorSwatch.style.backgroundColor = item.color;
      const legendText = legendItem.createEl("div", {
        cls: "chronica-legend-text",
      });
      legendText.createEl("span", {
        cls: "chronica-legend-type",
        text: item.type,
        attr: { title: item.type },
      });
      legendText.createEl("span", {
        cls: "chronica-legend-count",
        text: `${item.count} (${percentage.toFixed(1)}%)`,
      });
      startAngle = endAngle;
    });
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttrs({
      cx: "0",
      cy: "0",
      r: "25",
      fill: "var(--background-secondary)",
    });
    g.appendChild(circle);
    const totalText = document.createElementNS(svgNS, "text");
    totalText.setAttrs({
      x: "0",
      y: "0",
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      fill: "var(--text-normal)",
      "font-size": "12",
      "font-weight": "bold",
    });
    totalText.textContent = totalEventsForPie.toString();
    g.appendChild(totalText);
    const totalLabel = document.createElementNS(svgNS, "text");
    totalLabel.setAttrs({
      x: "0",
      y: "12",
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      fill: "var(--text-muted)",
      "font-size": "6",
    });
    totalLabel.textContent = "Events";
    g.appendChild(totalLabel);

    // --- Chart 2: Seasonal Pattern Analysis (Radar Chart) ---
    const seasonalCard = chartsGridContainer.createEl("div", {
      cls: "chronica-chart-card",
    });
    seasonalCard.createEl("h3", {
      cls: "chronica-chart-title",
      text: "Seasonal Patterns",
    });

    const seasons = [
      { name: "Winter", months: [11, 0, 1], color: "#90CAF9" },
      { name: "Spring", months: [2, 3, 4], color: "#A5D6A7" },
      { name: "Summer", months: [5, 6, 7], color: "#FFCC80" },
      { name: "Fall", months: [8, 9, 10], color: "#EF9A9A" },
    ];
    const seasonCounts = seasons.map((season) => {
      let count = 0;
      allEvents.forEach((event) => {
        const eventDate = getDateFromWeekKey(event.weekKey);
        if (eventDate && season.months.includes(eventDate.getMonth())) {
          count++;
        }
      });
      return { ...season, count };
    });
    const seasonalChartContainer = seasonalCard.createEl("div", {
      cls: "chronica-seasonal-chart-container",
    });
    // (Keep SVG rendering logic for radar chart - unchanged, as it uses the calculated seasonCounts)
    const seasonalSvg = document.createElementNS(svgNS, "svg");
    seasonalSvg.classList.add("chronica-seasonal-chart");
    const SIZE = 300;
    const CENTER = SIZE / 2;
    const OUTER_RADIUS = 100;
    seasonalSvg.setAttrs({
      viewBox: `0 0 ${SIZE} ${SIZE}`,
      width: SIZE.toString(),
      height: SIZE.toString(),
    });
    seasonalChartContainer.appendChild(seasonalSvg);
    const maxSeasonCount = Math.max(...seasonCounts.map((s) => s.count), 1);
    const totalSeasonEvents = seasonCounts.reduce((sum, s) => sum + s.count, 0);
    if (totalSeasonEvents > 0) {
      /* ... keep logic to draw radar axes, labels, polygon, dots ... */
      // Draw Axes/Background Circles
      const bgCircle = document.createElementNS(svgNS, "circle");
      bgCircle.setAttrs({
        cx: CENTER.toString(),
        cy: CENTER.toString(),
        r: OUTER_RADIUS.toString(),
        fill: "none",
        stroke: "var(--background-modifier-border)",
        "stroke-width": "1",
        opacity: "0.5",
      });
      seasonalSvg.appendChild(bgCircle);
      const midCircle = document.createElementNS(svgNS, "circle");
      midCircle.setAttrs({
        cx: CENTER.toString(),
        cy: CENTER.toString(),
        r: (OUTER_RADIUS / 2).toString(),
        fill: "none",
        stroke: "var(--background-modifier-border)",
        "stroke-width": "1",
        opacity: "0.3",
      });
      seasonalSvg.appendChild(midCircle);
      const centerPoint = document.createElementNS(svgNS, "circle");
      centerPoint.setAttrs({
        cx: CENTER.toString(),
        cy: CENTER.toString(),
        r: "3",
        fill: "var(--background-modifier-border)",
      });
      seasonalSvg.appendChild(centerPoint);
      const axisPoints = [
        { x: CENTER, y: CENTER - OUTER_RADIUS },
        { x: CENTER + OUTER_RADIUS, y: CENTER },
        { x: CENTER, y: CENTER + OUTER_RADIUS },
        { x: CENTER - OUTER_RADIUS, y: CENTER },
      ];
      for (let i = 0; i < 4; i++) {
        const axis = document.createElementNS(svgNS, "line");
        axis.setAttrs({
          x1: CENTER.toString(),
          y1: CENTER.toString(),
          x2: axisPoints[i].x.toString(),
          y2: axisPoints[i].y.toString(),
          stroke: "var(--background-modifier-border)",
          "stroke-width": "1",
          opacity: "0.5",
        });
        seasonalSvg.appendChild(axis);
      }
      // Draw Labels
      const seasonLabels = ["Winter", "Spring", "Summer", "Fall"];
      const labelPoints = [
        { x: CENTER, y: CENTER - OUTER_RADIUS - 20 },
        { x: CENTER + OUTER_RADIUS + 30, y: CENTER },
        { x: CENTER, y: CENTER + OUTER_RADIUS + 20 },
        { x: CENTER - OUTER_RADIUS - 20, y: CENTER },
      ];
      for (let i = 0; i < 4; i++) {
        const label = document.createElementNS(svgNS, "text");
        label.setAttrs({
          x: labelPoints[i].x.toString(),
          y: labelPoints[i].y.toString(),
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          fill: "var(--text-normal)",
          "font-size": "12",
        });
        label.textContent = seasonLabels[i];
        seasonalSvg.appendChild(label);
      }
      // Draw Radar Polygon & Points
      const radarPoints = seasonCounts.map((season, i) => {
        const normalizedValue = season.count / maxSeasonCount;
        const radius = normalizedValue * OUTER_RADIUS;
        const angle = Math.PI / 2 - (i * Math.PI) / 2;
        const x = CENTER + radius * Math.cos(angle);
        const y = CENTER - radius * Math.sin(angle);
        return {
          x,
          y,
          value: season.count,
          percentage:
            totalSeasonEvents > 0
              ? (season.count / totalSeasonEvents) * 100
              : 0,
        };
      });
      if (radarPoints.some((p) => p.value > 0)) {
        const polygon = document.createElementNS(svgNS, "polygon");
        const pointsStr = radarPoints.map((p) => `${p.x},${p.y}`).join(" ");
        polygon.setAttrs({
          points: pointsStr,
          fill: "rgba(102, 126, 234, 0.5)",
          stroke: "var(--interactive-accent)",
          "stroke-width": "2",
        });
        seasonalSvg.appendChild(polygon);
        radarPoints.forEach((point, i) => {
          /* ... keep logic to draw dots and percentage/count labels ... */
          const dot = document.createElementNS(svgNS, "circle");
          dot.setAttrs({
            cx: point.x.toString(),
            cy: point.y.toString(),
            r: "6",
            fill: seasons[i].color,
            stroke: "var(--background-primary)",
            "stroke-width": "1",
          });
          seasonalSvg.appendChild(dot);
          let pctX = 0,
            pctY = 0,
            countX = 0,
            countY = 0;
          switch (i) {
            case 0:
              pctX = point.x;
              pctY = point.y - 20;
              break;
            case 1:
              pctX = point.x + 20;
              pctY = point.y;
              break;
            case 2:
              pctX = point.x;
              pctY = point.y + 20;
              break;
            case 3:
              pctX = point.x - 20;
              pctY = point.y;
              break;
          }
          countX = pctX;
          countY = pctY + (i === 2 ? 12 : 12); // Basic positioning for count near percentage
          const pctLabel = document.createElementNS(svgNS, "text");
          pctLabel.setAttrs({
            x: pctX.toString(),
            y: pctY.toString(),
            "text-anchor": "middle",
            "dominant-baseline": "middle",
            fill: "var(--text-muted)",
            "font-size": "10",
          });
          pctLabel.textContent = `${Math.round(point.percentage)}%`;
          seasonalSvg.appendChild(pctLabel);
          const countLabel = document.createElementNS(svgNS, "text");
          countLabel.setAttrs({
            x: countX.toString(),
            y: countY.toString(),
            "text-anchor": "middle",
            "dominant-baseline": "middle",
            fill: "var(--text-normal)",
            "font-size": "10",
          });
          countLabel.textContent = point.value.toString();
          seasonalSvg.appendChild(countLabel);
        });
      }
      // Draw Total in Center
      const totalCenterContainer = document.createElementNS(svgNS, "circle");
      totalCenterContainer.setAttrs({
        cx: CENTER.toString(),
        cy: CENTER.toString(),
        r: (OUTER_RADIUS / 4).toString(),
        fill: "var(--background-secondary)",
      });
      seasonalSvg.appendChild(totalCenterContainer);
      const totalCenterText = document.createElementNS(svgNS, "text");
      totalCenterText.setAttrs({
        x: CENTER.toString(),
        y: (CENTER - 5).toString(),
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        fill: "var(--text-normal)",
        "font-size": "16",
        "font-weight": "bold",
      });
      totalCenterText.textContent = totalSeasonEvents.toString();
      seasonalSvg.appendChild(totalCenterText);
      const totalCenterLabel = document.createElementNS(svgNS, "text");
      totalCenterLabel.setAttrs({
        x: CENTER.toString(),
        y: (CENTER + 10).toString(),
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        fill: "var(--text-muted)",
        "font-size": "10",
      });
      totalCenterLabel.textContent = "Events";
      seasonalSvg.appendChild(totalCenterLabel);
    } else {
      /* ... keep empty state logic ... */
      const emptyText = document.createElementNS(svgNS, "text");
      emptyText.setAttrs({
        x: CENTER.toString(),
        y: CENTER.toString(),
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        fill: "var(--text-muted)",
        "font-size": "14",
      });
      emptyText.textContent = "No events to analyze";
      seasonalSvg.appendChild(emptyText);
    }

    // --- Chart 3: Future Planning Horizon (Bar Chart) ---
    const futurePlanningCard = chartsGridContainer.createEl("div", {
      cls: "chronica-chart-card chronica-full-width",
    });
    futurePlanningCard.createEl("h3", {
      cls: "chronica-chart-title",
      text: "Future Planning Horizon",
    });

    const futureEvents = allEvents.filter((event) => {
      const eventDate = getDateFromWeekKey(event.weekKey);
      return eventDate && eventDate > now;
    });

    if (futureEvents.length === 0) {
      futurePlanningCard.createEl("div", {
        cls: "chronica-empty-state",
        text: "No future events planned yet",
      });
    } else {
      const horizons = {
        "Next Month": 30,
        "1-3 Months": 90,
        "3-6 Months": 180,
        "6-12 Months": 365,
        "1-2 Years": 730,
        "2+ Years": Infinity,
      };
      const horizonCounts: Record<string, number> = {};
      Object.keys(horizons).forEach((key) => (horizonCounts[key] = 0));

      futureEvents.forEach((event) => {
        const eventDate = getDateFromWeekKey(event.weekKey);
        if (!eventDate) return;
        const daysFromNow = Math.ceil(
          (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        for (const [horizon, days] of Object.entries(horizons)) {
          if (daysFromNow <= days) {
            horizonCounts[horizon]++;
            break;
          }
        }
      });

      const horizonsContainer = futurePlanningCard.createEl("div", {
        cls: "chronica-horizons-container",
      });
      const sortedHorizons = Object.keys(horizonCounts).filter(
        (h) => horizonCounts[h] > 0
      ); // Only show horizons with events
      const maxHorizonCount = Math.max(...Object.values(horizonCounts), 1);

      sortedHorizons.forEach((horizon) => {
        // (Keep rendering logic for horizon bars - unchanged)
        const count = horizonCounts[horizon];
        const horizonRow = horizonsContainer.createEl("div", {
          cls: "chronica-horizon-row",
        });
        horizonRow.createEl("div", {
          cls: "chronica-horizon-label",
          text: horizon,
        });
        const barContainer = horizonRow.createEl("div", {
          cls: "chronica-horizon-bar-container",
        });
        const bar = barContainer.createEl("div", {
          cls: "chronica-horizon-bar",
        });
        bar.style.width = `${(count / maxHorizonCount) * 100}%`;
        barContainer.createEl("div", {
          cls: "chronica-horizon-count",
          text: count.toString(),
        });
      });
      futurePlanningCard.createEl("div", {
        cls: "chronica-horizon-summary",
        text: `${futureEvents.length} events planned in the future`,
      });
    }

    // --- Chart 4: Monthly Distribution (Bar Chart) ---
    const monthlyChartCard = chartsGridContainer.createEl("div", {
      cls: "chronica-chart-card chronica-full-width",
    });
    monthlyChartCard.createEl("h3", {
      cls: "chronica-chart-title",
      text: "Event Distribution by Month",
    });

    const eventsByMonth: number[] = Array(12).fill(0);
    allEvents.forEach((event) => {
      const eventDate = getDateFromWeekKey(event.weekKey);
      if (eventDate) {
        eventsByMonth[eventDate.getMonth()]++;
      }
    });

    const monthlyChartContainer = monthlyChartCard.createEl("div", {
      cls: "chronica-monthly-chart-container",
    });
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
    const maxMonthlyEvents = Math.max(...eventsByMonth, 1);

    monthNames.forEach((month, index) => {
      // (Keep rendering logic for month bars - unchanged)
      const count = eventsByMonth[index];
      const barHeight = Math.max(5, (count / maxMonthlyEvents) * 100);
      const barContainer = monthlyChartContainer.createEl("div", {
        cls: "chronica-bar-wrapper chronica-month-bar-wrapper",
      });
      const bar = barContainer.createEl("div", {
        cls: "chronica-bar chronica-month-bar",
      });
      bar.style.height = `${barHeight}%`;
      barContainer.createEl("div", {
        cls: "chronica-bar-value",
        text: count > 0 ? count.toString() : "",
      });
      barContainer.createEl("div", { cls: "chronica-bar-label", text: month });
      if (index === now.getMonth()) {
        barContainer.addClass("chronica-current-period");
        bar.addClass("chronica-current-bar");
      }
      barContainer.setAttribute("title", `${month}: ${count} events`);
    });
  }

  async fetchAndDisplaySnippets(
    tooltipElement: HTMLElement,
    cellElement: HTMLElement
  ): Promise<void> {
    // Check if this cell is still the one being hovered for snippets
    if (
      this.currentHoveredCellForSnippet !== cellElement ||
      !this.plugin.settings.enableTooltipNotePreview ||
      this.plugin.settings.tooltipDetailLevel !== "expanded"
    ) {
      return;
    }

    const notePathsToFetch: {
      type: "event" | "weekly";
      path: string;
      label: string;
    }[] = [];
    const eventNotePath = cellElement.dataset.eventFile;
    const weeklyNotePath = cellElement.dataset.weeklyNotePath;

    if (eventNotePath) {
      notePathsToFetch.push({
        type: "event",
        path: eventNotePath,
        label: "Event Note Snippet:",
      });
    }
    // Only add weekly note for snippet if it's different from event note, or if no event note
    if (
      weeklyNotePath &&
      (!eventNotePath || weeklyNotePath !== eventNotePath)
    ) {
      notePathsToFetch.push({
        type: "weekly",
        path: weeklyNotePath,
        label: "Weekly Note Snippet:",
      });
    }

    if (notePathsToFetch.length === 0) {
      return;
    }

    // Optional: Add a general loading indicator to the tooltip if not already present
    let loadingIndicator = tooltipElement.querySelector(
      ".chronica-tooltip-snippet-loading"
    );
    if (!loadingIndicator) {
      loadingIndicator = tooltipElement.createDiv({
        cls: "chronica-tooltip-snippet-loading",
        text: "Loading snippets...",
      });
    }

    for (const noteDetail of notePathsToFetch) {
      // Check again before each async operation if the hover context has changed
      if (
        this.currentHoveredCellForSnippet !== cellElement ||
        !this.activeGridCellTooltip
      ) {
        loadingIndicator?.remove();
        return;
      }

      const tFile = this.app.vault.getAbstractFileByPath(noteDetail.path);
      if (tFile instanceof TFile) {
        try {
          const content = await this.app.vault.cachedRead(tFile);

          let actualContentStartIndex = 0;
          const lines = content.split("\n");

          // Try to find the end of the frontmatter block
          if (lines[0]?.trim() === "---") {
            let frontmatterEndFound = false;
            for (let i = 1; i < lines.length; i++) {
              if (lines[i]?.trim() === "---") {
                actualContentStartIndex = i + 1;
                frontmatterEndFound = true;
                break;
              }
            }
            // If opening '---' but no closing '---' is found, it might not be valid frontmatter,
            // or the note is very short. We might default to starting from the first line
            // or a few lines in to avoid picking up a single '---' if it's used as a separator.
            // For now, if closing '---' not found, we'll treat it as if no frontmatter.
            if (!frontmatterEndFound) {
              actualContentStartIndex = 0;
            }
          }

          let snippet = "";
          let linesCount = 0;
          const maxSnippetChars = 150; // Max characters for the total snippet
          const maxSnippetLines = 3; // Max lines for the snippet

          for (let i = actualContentStartIndex; i < lines.length; i++) {
            const trimmedLine = lines[i].trim();
            if (trimmedLine.length > 0) {
              // Consider any non-empty line after frontmatter
              const lineToAdd = (linesCount > 0 ? "\n" : "") + trimmedLine;
              if (snippet.length + lineToAdd.length > maxSnippetChars) {
                const remainingChars =
                  maxSnippetChars - snippet.length - (linesCount > 0 ? 1 : 0);
                if (remainingChars > 3) {
                  // Check if there's enough space for some text and "..."
                  snippet +=
                    (linesCount > 0 ? "\n" : "") +
                    trimmedLine.substring(0, remainingChars - 3) +
                    "...";
                } else if (
                  snippet.length === 0 &&
                  trimmedLine.length > maxSnippetChars
                ) {
                  // First line itself is too long
                  snippet =
                    trimmedLine.substring(0, maxSnippetChars - 3) + "...";
                } else if (snippet.length > 0 && !snippet.endsWith("...")) {
                  // Add "..." if we are cutting off and haven't already
                  snippet += "...";
                }
                linesCount++; // Count this partially added line
                break;
              }
              snippet += lineToAdd;
              linesCount++;
              if (linesCount >= maxSnippetLines) break;
            }
          }

          if (snippet) {
            // Ensure tooltip is still active and for the correct cell before appending
            if (
              this.activeGridCellTooltip === tooltipElement &&
              this.currentHoveredCellForSnippet === cellElement
            ) {
              const snippetLineEl = tooltipElement.createDiv({
                cls: "chronica-tooltip-line chronica-tooltip-notesnippet",
              });
              snippetLineEl.createEl("span", {
                text: noteDetail.label,
                cls: "chronica-tooltip-label",
              });

              // Create a preformatted element for the snippet to respect newlines
              const snippetContentEl = snippetLineEl.createEl("pre", {
                cls: "chronica-snippet-content",
              });
              snippetContentEl.textContent = snippet;
            }
          }
        } catch (err) {
          // console.error(`Error reading note for snippet: ${noteDetail.path}`, err);
          // Optionally add a "failed to load snippet" message to the tooltip
        }
      }
    }

    // Remove loading indicator once all processing is done (or if it exists)
    loadingIndicator?.remove();
  }

  /**
   * Applies styling to a cell if an event exists for the given week key.
   * Reads from the new unified this.settings.events and this.settings.eventTypes.
   * @param cell - The HTML element for the grid cell.
   * @param weekKey - The week key (YYYY-WXX) to check for events.
   * @returns True if an event style was applied, false otherwise.
   */
  applyEventStyling(cell: HTMLElement, weekKey: string): boolean {
    // Ensure events and eventTypes arrays exist
    if (!this.plugin.settings.events || !this.plugin.settings.eventTypes) {
      // Minimal cleanup if essential settings are missing
      cell.classList.remove(
        "event",
        "future-event-highlight",
        "event-type-custom",
        "event-unknown-type"
      );
      // Remove any other event-type-id classes
      for (let i = cell.classList.length - 1; i >= 0; i--) {
        if (cell.classList[i].startsWith("event-type-preset_")) {
          cell.classList.remove(cell.classList[i]);
        }
      }
      cell.style.removeProperty("--custom-event-color");
      delete cell.dataset.eventFile;
      return false;
    }

    let eventApplied = false;
    let appliedNotePath: string | undefined = undefined; // Keep this for dataset

    // Always clean up previous event styling first
    cell.classList.remove(
      "event",
      "future-event-highlight",
      "event-type-custom",
      "event-unknown-type"
    );
    for (let i = cell.classList.length - 1; i >= 0; i--) {
      if (cell.classList[i].startsWith("event-type-preset_")) {
        cell.classList.remove(cell.classList[i]);
      }
    }
    cell.style.removeProperty("--custom-event-color"); // Remove custom color variable

    let matchedEvent: ChronicaEvent | null = null;
    for (const event of this.plugin.settings.events) {
      let isMatch = false;
      if (
        event.weekKey === weekKey &&
        (!event.endWeekKey || event.endWeekKey === event.weekKey)
      ) {
        isMatch = true;
      } else if (
        event.weekKey &&
        event.endWeekKey &&
        event.endWeekKey !== event.weekKey
      ) {
        try {
          const startYear = parseInt(event.weekKey.split("-W")[0], 10);
          const startWeek = parseInt(event.weekKey.split("-W")[1], 10);
          const endYear = parseInt(event.endWeekKey.split("-W")[0], 10);
          const endWeek = parseInt(event.endWeekKey.split("-W")[1], 10);
          const cellYear = parseInt(weekKey.split("-W")[0], 10);
          const cellWeek = parseInt(weekKey.split("-W")[1], 10);

          if (
            ![startYear, startWeek, endYear, endWeek, cellYear, cellWeek].some(
              isNaN
            )
          ) {
            if (cellYear > startYear && cellYear < endYear) isMatch = true;
            else if (
              cellYear === startYear &&
              cellYear < endYear &&
              cellWeek >= startWeek
            )
              isMatch = true;
            else if (
              cellYear > startYear &&
              cellYear === endYear &&
              cellWeek <= endWeek
            )
              isMatch = true;
            else if (
              cellYear === startYear &&
              cellYear === endYear &&
              cellWeek >= startWeek &&
              cellWeek <= endWeek
            )
              isMatch = true;
          }
        } catch (error) {
          /* Silent parse error */
        }
      }
      if (isMatch) {
        matchedEvent = event;
        break;
      }
    }

    if (matchedEvent) {
      const eventType = this.plugin.settings.eventTypes.find(
        (type) => type.id === matchedEvent!.typeId
      );

      cell.classList.add("event"); // Add base event class

      if (eventType) {
        const safeTypeId = eventType.id.replace(/[^a-zA-Z0-9-_]/g, "-");
        if (eventType.isPreset) {
          cell.classList.add(`event-type-${safeTypeId}`);
        } else {
          // Custom type: set CSS variable for color and add a general custom class
          cell.classList.add("event-type-custom");
          cell.style.setProperty("--custom-event-color", eventType.color);
        }
        appliedNotePath = matchedEvent.notePath; // Store for dataset
        eventApplied = true;
      } else {
        // Unknown event type
        console.warn(
          `Chronica: Type definition missing for typeId: ${matchedEvent.typeId}`
        );
        cell.classList.add("event-unknown-type");
        appliedNotePath = matchedEvent.notePath; // Store for dataset
        eventApplied = true; // Still treat as an event for tooltip purposes
      }
    } else {
      // No event found
      delete cell.dataset.eventFile; // Ensure this is cleared if no event
    }

    // Tooltip Management (largely unchanged, but relies on eventApplied and matchedEvent correctly set above)
    if (eventApplied && matchedEvent) {
      const typeId = matchedEvent.typeId;
      const currentEventType = this.plugin.settings.eventTypes.find(
        (type) => type.id === typeId
      );

      let eventTitleForTooltip = matchedEvent.name || matchedEvent.description;
      let eventDescriptionForTooltip = matchedEvent.description || "";
      let eventTypeNameForTooltip = "Unknown Type";
      let eventPeriodForTooltip = matchedEvent.weekKey;

      if (currentEventType) {
        eventTypeNameForTooltip = currentEventType.name;
      }

      if (
        matchedEvent.endWeekKey &&
        matchedEvent.endWeekKey !== matchedEvent.weekKey
      ) {
        eventPeriodForTooltip = `${matchedEvent.weekKey} to ${matchedEvent.endWeekKey}`;
      }

      if (appliedNotePath) {
        cell.dataset.eventFile = appliedNotePath;
      } else {
        delete cell.dataset.eventFile;
      }

      cell.dataset.tooltipEventType = eventTypeNameForTooltip;
      cell.dataset.tooltipEventPeriod = eventPeriodForTooltip;
      cell.dataset.tooltipEventTitle = eventTitleForTooltip;
      cell.dataset.tooltipEventDescription = eventDescriptionForTooltip;

      // ADDED: Store actual start and end dates for tooltip
      if (matchedEvent.actualStartDate) {
        cell.dataset.tooltipEventActualStartDate = matchedEvent.actualStartDate;
      } else {
        delete cell.dataset.tooltipEventActualStartDate;
      }
      if (matchedEvent.actualEndDate) {
        cell.dataset.tooltipEventActualEndDate = matchedEvent.actualEndDate;
      } else {
        delete cell.dataset.tooltipEventActualEndDate;
      }
    } else {
      delete cell.dataset.eventFile;
      delete cell.dataset.tooltipEventType;
      delete cell.dataset.tooltipEventPeriod;
      delete cell.dataset.tooltipEventTitle;
      delete cell.dataset.tooltipEventDescription;
      delete cell.dataset.tooltipEventActualStartDate; // ADDED: Ensure cleanup
      delete cell.dataset.tooltipEventActualEndDate; // ADDED: Ensure cleanup
    }

    // Future Event Highlight (logic remains the same)
    if (eventApplied) {
      const now = new Date();
      let cellDate: Date | null = null;
      try {
        const [y, w] = weekKey.split("-W").map(Number);
        cellDate = new Date(y, 0, 1 + (w - 1) * 7);
      } catch {}
      if (cellDate) {
        const sixMonthsFromNow = new Date(
          now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000
        );
        if (cellDate > now && cellDate < sixMonthsFromNow) {
          cell.classList.add("future-event-highlight");
        } else {
          cell.classList.remove("future-event-highlight");
        }
      } else {
        cell.classList.remove("future-event-highlight");
      }
    } else {
      cell.classList.remove("future-event-highlight");
    }

    return eventApplied;
  }
}

// -----------------------------------------------------------------------
// MARKER SETTINGS MODAL
// -----------------------------------------------------------------------

/**
 * Modal for configuring which timeline markers are visible
 */
class MarkerSettingsModal extends Modal {
  /** Reference to the main plugin */
  plugin: ChornicaTimelinePlugin;

  /** Callback to refresh views when settings change */
  refreshCallback: () => void;

  /**
   * Create a new marker settings modal
   * @param app - Obsidian App instance
   * @param plugin - ChornicaTimelinePlugin instance
   * @param refreshCallback - Callback to refresh views
   */
  constructor(
    app: App,
    plugin: ChornicaTimelinePlugin,
    refreshCallback: () => void
  ) {
    super(app);
    this.plugin = plugin;
    this.refreshCallback = refreshCallback;
  }

  /**
   * Build the modal UI when opened
   */
  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Timeline Marker Settings" });
    contentEl.createEl("p", {
      text: "Choose which timeline markers are visible",
    });

    // Decade markers setting
    new Setting(contentEl)
      .setName("Decade Markers")
      .setDesc("Show decade markers along the top (0, 10, 20, ...)")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showDecadeMarkers)
          .onChange(async (value) => {
            this.plugin.settings.showDecadeMarkers = value;
            await this.plugin.saveSettings();
            this.refreshCallback();
          });
      });

    // Birthday marker setting
    new Setting(contentEl)
      .setName("Birthday Marker")
      .setDesc("Show birthday cake icon at your birth week")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showBirthdayMarker)
          .onChange(async (value) => {
            this.plugin.settings.showBirthdayMarker = value;
            await this.plugin.saveSettings();
            this.refreshCallback();
          })
      );

    // Week markers setting
    new Setting(contentEl)
      .setName("Week Markers")
      .setDesc("Show week markers along the left (10, 20, 30, ...)")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showWeekMarkers)
          .onChange(async (value) => {
            this.plugin.settings.showWeekMarkers = value;
            await this.plugin.saveSettings();
            this.refreshCallback();
          });
      });

    // Month marker frequency dropdown - DEFINE IT FIRST so it's in scope
    const monthMarkerFrequencySetting = new Setting(contentEl)
      .setName("Month Marker Frequency")
      .setDesc(
        "Choose how often month markers appear (requires 'Month Markers' to be ON)"
      )
      // .setClass("month-marker-frequency-setting") // Optional: if you want to target it via a specific class in CSS for other reasons
      .addDropdown((dropdown) => {
        dropdown
          .addOption("all", "Every Month")
          .addOption("quarter", "Every Quarter (Jan, Apr, Jul, Oct)")
          .addOption("half-year", "Every Half Year (Jan, Jul)")
          .addOption("year", "Every Year (Jan only)")
          .setValue(this.plugin.settings.monthMarkerFrequency)
          .onChange(async (value: string) => {
            this.plugin.settings.monthMarkerFrequency = value as
              | "all"
              | "quarter"
              | "half-year"
              | "year";
            await this.plugin.saveSettings();
            this.refreshCallback();
          });
      });

    // Month markers setting (Toggle) - Now define the toggle that controls the frequency setting's visibility
    new Setting(contentEl)
      .setName("Month Markers")
      .setDesc("Show month markers along the left side (Jan, Feb, Mar, ...)")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showMonthMarkers)
          .onChange(async (value) => {
            this.plugin.settings.showMonthMarkers = value;
            await this.plugin.saveSettings();
            // Toggle visibility of the frequency dropdown setting
            monthMarkerFrequencySetting.settingEl.classList.toggle(
              "hidden",
              !value
            ); // MODIFIED
            this.refreshCallback();
          });
      });

    // Initial visibility for the frequency dropdown
    if (!this.plugin.settings.showMonthMarkers) {
      monthMarkerFrequencySetting.settingEl.classList.add("hidden"); // MODIFIED
    }

    // Close button
    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Close")
        .setCta()
        .onClick(() => {
          this.close();
        })
    );
  }

  /**
   * Clean up on modal close
   */
  onClose(): void {
    this.contentEl.empty();
  }
}

// -----------------------------------------------------------------------
// EVENT TYPES MODAL CLASS
// -----------------------------------------------------------------------

// -----------------------------------------------------------------------
// SETTINGS TAB CLASS
// -----------------------------------------------------------------------

/**
 * Settings tab for configuring the plugin
 */
class ChornicaSettingTab extends PluginSettingTab {
  /** Reference to the main plugin */
  plugin: ChornicaTimelinePlugin;

  /**
   * Create a new settings tab
   * @param app - Obsidian App instance
   * @param plugin - ChornicaTimelinePlugin instance
   */
  constructor(app: App, plugin: ChornicaTimelinePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Build the settings UI
   */
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h1", { text: "Chronica Timeline Settings" });
    containerEl.createEl("p", {
      text: "Customize your life timeline visualization.",
    });

    // --- Core Settings ---
    containerEl.createEl("h3", { text: "Core Setup" });

    // Birthday setting
    new Setting(containerEl)
      .setName("Birthday")
      .setDesc("Your date of birth (YYYY-MM-DD)")
      .addText((text) =>
        text
          .setPlaceholder("1990-01-01")
          .setValue(this.plugin.settings.birthday)
          .onChange(async (value) => {
            // Basic validation - check if it looks like a date
            if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
              this.plugin.settings.birthday = value;
              await this.plugin.saveSettings();
              this.refreshAllViews();
            } else {
              // Optionally provide feedback if format is wrong
              new Notice("Please enter birthday in YYYY-MM-DD format.");
            }
          })
      );

    // Lifespan setting
    new Setting(containerEl)
      .setName("Lifespan")
      .setDesc("Maximum age in years to display on the timeline grid.")
      .addSlider((slider) =>
        slider
          .setLimits(50, 120, 5) // Min 50, Max 120, Step 5
          .setValue(this.plugin.settings.lifespan)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.lifespan = value;
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );

    // --- Folders & Notes ---
    containerEl.createEl("h3", { text: "Folders & Note Naming" });

    // Notes folder setting (Main / Weekly)
    new Setting(containerEl)
      .setName("Weekly Notes Folder")
      .setDesc(
        "Folder to store weekly notes (leave blank for vault root). Path will be processed after you finish typing and click outside the box."
      )
      .setClass("chronica-folder-input-setting")
      .addSearch((search) => {
        let initialValueOnFocus = this.plugin.settings.notesFolder;
        search
          .setPlaceholder("Type path or select...")
          .setValue(this.plugin.settings.notesFolder)
          .onChange(async (value) => {
            // Save the setting on every change so the value is up-to-date
            // BUT DO NOT trigger handleFolderChange here.
            this.plugin.settings.notesFolder = value.trim();
            await this.plugin.saveSettings();
          });

        // Store the value when the input gets focus
        search.inputEl.addEventListener("focus", () => {
          initialValueOnFocus = search.inputEl.value;
        });

        // Trigger handleFolderChange only on blur and if value changed
        search.inputEl.addEventListener("blur", () => {
          const finalValue = search.inputEl.value.trim();
          // Only call handleFolderChange if the value actually changed from when it was focused
          if (finalValue !== initialValueOnFocus.trim()) {
            // Use this.plugin.settings.notesFolder as it's already updated by onChange
            if (
              this.plugin.settings.notesFolder &&
              this.plugin.settings.notesFolder !== initialValueOnFocus.trim()
            ) {
              this.plugin.handleFolderChange(
                initialValueOnFocus.trim(),
                this.plugin.settings.notesFolder,
                false
              );
            } else if (
              !this.plugin.settings.notesFolder &&
              initialValueOnFocus.trim()
            ) {
            }
            // Update initialValueOnFocus for the next focus event,
            // or it will always compare to the value when settings tab was opened
            initialValueOnFocus = finalValue;
          }
        });
        new FolderSuggest(this.app, search.inputEl, this.plugin);
      });

    // Separate folders toggle
    const separateFoldersToggle = new Setting(containerEl)
      .setName("Use Separate Event Notes Folder")
      .setDesc(
        "Store event-specific notes in a different folder from weekly notes."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useSeparateFolders)
          .onChange(async (value) => {
            this.plugin.settings.useSeparateFolders = value;
            await this.plugin.saveSettings();
            // Show/hide event folder selector using hidden class
            const eventFolderSettingEl = containerEl.querySelector(
              ".event-folder-selector"
            );
            if (eventFolderSettingEl) {
              eventFolderSettingEl.classList.toggle("hidden", !value);
            }
          })
      );

    // Event notes folder setting (conditionally displayed)
    const eventFolderSetting = new Setting(containerEl)
      .setName("Event Notes Folder")
      .setDesc(
        "Folder for event notes (if separate). Path processed on exiting input."
      )
      .setClass("event-folder-selector")
      .setClass("chronica-folder-input-setting")
      .addSearch((search) => {
        let initialValueOnFocus = this.plugin.settings.eventNotesFolder;

        search
          .setPlaceholder("Type path or select...")
          .setValue(this.plugin.settings.eventNotesFolder)
          .onChange(async (value) => {
            // Save the setting on every change
            this.plugin.settings.eventNotesFolder = value.trim();
            await this.plugin.saveSettings();
          });

        // Store the value when the input gets focus
        search.inputEl.addEventListener("focus", () => {
          initialValueOnFocus = search.inputEl.value;
        });

        // Trigger handleFolderChange only on blur and if value changed
        search.inputEl.addEventListener("blur", () => {
          const finalValue = search.inputEl.value.trim();
          if (finalValue !== initialValueOnFocus.trim()) {
            if (
              this.plugin.settings.useSeparateFolders &&
              this.plugin.settings.eventNotesFolder &&
              this.plugin.settings.eventNotesFolder !==
                initialValueOnFocus.trim()
            ) {
              this.plugin.handleFolderChange(
                initialValueOnFocus.trim(),
                this.plugin.settings.eventNotesFolder,
                true
              );
            } else if (
              !this.plugin.settings.eventNotesFolder &&
              initialValueOnFocus.trim()
            ) {
            }
            initialValueOnFocus = finalValue;
          }
        });
        new FolderSuggest(this.app, search.inputEl, this.plugin);
      });

    // Hide event folder selector initially if separate folders not enabled
    if (!this.plugin.settings.useSeparateFolders) {
      eventFolderSetting.settingEl.classList.add("hidden");
    }

    // --- File Naming Templates Sub-section ---
    containerEl.createEl("h3", { text: "File Naming Templates" });
    const fileNamingDesc = containerEl.createEl("p", {
      text: "Customize how Chronica names your week and event note files.",
      cls: "chronica-template-description",
    });

    // Helper function to create and manage custom tooltips
    let activeCustomTooltip: HTMLElement | null = null;
    const createInfoBubbleWithCustomTooltip = (
      setting: Setting, // The setting to attach the bubble to
      placeholderText: string
    ) => {
      const infoBubble = document.createElement("span");
      infoBubble.addClass("chronica-info-bubble");
      setIcon(infoBubble, "info");

      infoBubble.addEventListener("mouseenter", (event) => {
        if (activeCustomTooltip) {
          activeCustomTooltip.classList.remove("visible"); // Start fade out
          // Allow time for fade-out before removing
          setTimeout(() => {
            activeCustomTooltip?.remove();
            activeCustomTooltip = null; // Clear reference after removal
            // Create new tooltip after old one is gone
            createNewTooltip();
          }, 150); // Match CSS transition time
        } else {
          createNewTooltip();
        }

        function createNewTooltip() {
          activeCustomTooltip = document.createElement("div");
          activeCustomTooltip.addClass("chronica-custom-tooltip");
          activeCustomTooltip.textContent = placeholderText;
          document.body.appendChild(activeCustomTooltip);

          // Position the tooltip
          const iconRect = infoBubble.getBoundingClientRect();
          const tooltipRect = activeCustomTooltip.getBoundingClientRect(); // Get rect after appending

          let top = iconRect.top + iconRect.height / 2 - tooltipRect.height / 2;
          let left = iconRect.left - tooltipRect.width - 10; // 10px gap to the left

          if (left < 5) {
            // Check if off-screen left
            left = iconRect.right + 10; // Position to the right
            if (left + tooltipRect.width > window.innerWidth - 5) {
              // Check if off-screen right
              left = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2; // Center below
              top = iconRect.bottom + 10;
            }
          }
          if (top < 5) {
            // Check if off-screen top
            top = 5;
          }
          if (top + tooltipRect.height > window.innerHeight - 5) {
            // Check if off-screen bottom
            top = window.innerHeight - tooltipRect.height - 5;
          }

          activeCustomTooltip.style.setProperty("--tooltip-left", `${left}px`);
          activeCustomTooltip.style.setProperty("--tooltip-top", `${top}px`);

          // Trigger the animation by adding the visible class after a short delay
          setTimeout(() => {
            activeCustomTooltip?.addClass("visible");
          }, 10); // Small delay to ensure CSS transition applies
        }
      });

      infoBubble.addEventListener("mouseleave", () => {
        if (activeCustomTooltip) {
          activeCustomTooltip.classList.remove("visible"); // Start fade out
          // Allow time for fade-out before removing
          setTimeout(() => {
            activeCustomTooltip?.remove();
            activeCustomTooltip = null; // Clear reference after removal
          }, 150); // Match CSS transition time
        }
      });
      setting.controlEl.prepend(infoBubble);
    };
    // --- Week Note Template Setting ---
    const weekNotePlaceholders = `Available placeholders:
  - \${gggg}: ISO Year (e.g., 2025)
  - \${ww}: ISO Week (01-53)
  - \${YYYY}: Calendar Year (e.g., 2025)
  - \${MM}: Calendar Month (01-12)
  - \${DD}: Calendar Day (01-31)
  - \${MMMM}: Full Month Name (e.g., January)
  - \${MMM}: Short Month Name (e.g., Jan)
  - \${YY}: Short Calendar Year (e.g., 25)`;

    const weekNoteSetting = new Setting(containerEl)
      .setName("Week Note Template")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.weekNoteTemplate)
          .setValue(this.plugin.settings.weekNoteTemplate)
          .onChange(async (value) => {
            this.plugin.settings.weekNoteTemplate =
              value || DEFAULT_SETTINGS.weekNoteTemplate;
            await this.plugin.saveSettings();
          })
      );
    createInfoBubbleWithCustomTooltip(weekNoteSetting, weekNotePlaceholders);

    // --- Event Note Template Setting (Single Events) ---
    const eventNotePlaceholders = `Available placeholders:
  - \${eventName}: Name of the event
  - \${startDate}: Full start date (YYYY-MM-DD)
  - \${gggg}: ISO Year of the event's week
  - \${ww}: ISO Week of the event (01-53)
  - \${YYYY}: Calendar Year of event's start date
  - \${MM}: Calendar Month of start date (01-12)
  - \${DD}: Calendar Day of start date (01-31)
  - \${MMMM}: Full Month Name of start date
  - \${MMM}: Short Month Name of start date
  - \${YY}: Short Calendar Year of start date`;

    const eventNoteSetting = new Setting(containerEl)
      .setName("Event Note Template (Single)")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.eventNoteTemplate)
          .setValue(this.plugin.settings.eventNoteTemplate)
          .onChange(async (value) => {
            this.plugin.settings.eventNoteTemplate =
              value || DEFAULT_SETTINGS.eventNoteTemplate;
            await this.plugin.saveSettings();
          })
      );
    createInfoBubbleWithCustomTooltip(eventNoteSetting, eventNotePlaceholders);

    // --- Range Event Template Setting ---
    const rangeNotePlaceholders = `Available placeholders:
  - \${eventName}: Name of the event
  - \${startDate}: Full start date (YYYY-MM-DD)
  - \${endDate}: Full end date (YYYY-MM-DD)
  - \${start_gggg}: ISO Year of range start week
  - \${start_ww}: ISO Week of range start week
  - \${end_gggg}: ISO Year of range end week
  - \${end_ww}: ISO Week of range end week
  - \${startDate_YYYY}, \${startDate_MM}, \${startDate_DD}, \${startDate_MMMM}, \${startDate_MMM}, \${startDate_YY} (for actual start date)
  - \${endDate_YYYY}, \${endDate_MM}, \${endDate_DD}, \${endDate_MMMM}, \${endDate_MMM}, \${endDate_YY} (for actual end date)`;

    const rangeNoteSetting = new Setting(containerEl)
      .setName("Range Event Template")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.rangeNoteTemplate)
          .setValue(this.plugin.settings.rangeNoteTemplate)
          .onChange(async (value) => {
            this.plugin.settings.rangeNoteTemplate =
              value || DEFAULT_SETTINGS.rangeNoteTemplate;
            await this.plugin.saveSettings();
          })
      );
    createInfoBubbleWithCustomTooltip(rangeNoteSetting, rangeNotePlaceholders);

    // --- Appearance Settings ---
    containerEl.createEl("h3", { text: "Appearance" });

    // Quote setting
    new Setting(containerEl)
      .setName("Footer Quote")
      .setDesc("Inspirational quote for the sidebar footer.")
      .addText((text) =>
        text
          .setPlaceholder("the only true luxury is time.")
          .setValue(this.plugin.settings.quote)
          .onChange(async (value) => {
            this.plugin.settings.quote = value;
            await this.plugin.saveSettings();
            this.refreshAllViews(); // To update footer if view is open
          })
      );

    // Color settings
    new Setting(containerEl)
      .setName("Past Weeks Color")
      .setDesc("Background color for weeks that have passed.")
      .addColorPicker((colorPicker) =>
        colorPicker
          .setValue(this.plugin.settings.pastCellColor)
          .onChange(async (value) => {
            this.plugin.settings.pastCellColor = value;
            // Update CSS variable (if we decide to implement dynamic updates later)
            // document.documentElement.style.setProperty('--past-cell-color', value);
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );
    new Setting(containerEl)
      .setName("Current Week Color")
      .setDesc("Background color for the current week.")
      .addColorPicker((colorPicker) =>
        colorPicker
          .setValue(this.plugin.settings.presentCellColor)
          .onChange(async (value) => {
            this.plugin.settings.presentCellColor = value;
            // document.documentElement.style.setProperty('--present-cell-color', value);
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );
    new Setting(containerEl)
      .setName("Future Weeks Color")
      .setDesc("Background color for weeks in the future.")
      .addColorPicker((colorPicker) =>
        colorPicker
          .setValue(this.plugin.settings.futureCellColor)
          .onChange(async (value) => {
            this.plugin.settings.futureCellColor = value;
            // document.documentElement.style.setProperty('--future-cell-color', value);
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );

    // Cell Shape
    new Setting(containerEl)
      .setName("Cell Shape")
      .setDesc("Visual shape of the week cells.")
      .addDropdown((drop) =>
        drop
          .addOption("square", "Square")
          .addOption("circle", "Circle")
          .addOption("diamond", "Diamond")
          .setValue(this.plugin.settings.cellShape)
          .onChange(async (value) => {
            this.plugin.settings.cellShape = value as
              | "square"
              | "circle"
              | "diamond";
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );

    // Grid Orientation
    new Setting(containerEl)
      .setName("Grid Orientation")
      .setDesc("How years and weeks are arranged.")
      .addDropdown((drop) =>
        drop
          .addOption("landscape", "Landscape (Years as Columns)")
          .addOption("portrait", "Portrait (Years as Rows)")
          .setValue(this.plugin.settings.gridOrientation)
          .onChange(async (value) => {
            this.plugin.settings.gridOrientation = value as
              | "landscape"
              | "portrait";
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );

    // Tooltip Detail Level Setting
    const tooltipDetailSetting = new Setting(containerEl) // No need to store this setting object unless used elsewhere
      .setName("Tooltip Detail Level")
      .setDesc(
        "Choose how much information is shown in the grid cell tooltips."
      );

    // Store a reference to the "Enable Note Preview" setting element to toggle its visibility
    let notePreviewSettingEl: HTMLElement;

    const notePreviewSetting = new Setting(containerEl)
      .setName("Enable Note Preview in Tooltip")
      .setDesc(
        "Show note filenames & snippets in the tooltip. This option is only available when 'Tooltip Detail Level' is 'Expanded'."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableTooltipNotePreview)
          .onChange(async (value) => {
            this.plugin.settings.enableTooltipNotePreview = value;
            await this.plugin.saveSettings();
          })
      );
    notePreviewSettingEl = notePreviewSetting.settingEl; // Get the actual HTML element of the setting

    // Now add the dropdown for Tooltip Detail Level, and make its onChange control the visibility
    tooltipDetailSetting.addDropdown((dropdown) =>
      dropdown
        .addOption("expanded", "Expanded (Default - more details)")
        .addOption("compact", "Compact (Less details)")
        .setValue(this.plugin.settings.tooltipDetailLevel)
        .onChange(async (value) => {
          this.plugin.settings.tooltipDetailLevel = value as
            | "expanded"
            | "compact";
          await this.plugin.saveSettings();

          // Toggle visibility of the note preview setting ----
          if (value === "expanded") {
            notePreviewSettingEl.classList.remove("hidden");
          } else {
            notePreviewSettingEl.classList.add("hidden");
          }
        })
    );

    // Set initial visibility for the note preview setting ----
    if (this.plugin.settings.tooltipDetailLevel === "expanded") {
      notePreviewSettingEl.classList.remove("hidden");
    } else {
      notePreviewSettingEl.classList.add("hidden");
    }

    // --- Marker Visibility Settings ---
    containerEl.createEl("h3", { text: "Marker Visibility" });
    new Setting(containerEl)
      .setName("Decade Markers")
      .setDesc("Show age markers every 10 years.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showDecadeMarkers)
          .onChange(async (value) => {
            this.plugin.settings.showDecadeMarkers = value;
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );
    new Setting(containerEl)
      .setName("Week Markers")
      .setDesc("Show markers for weeks 10, 20, 30, 40, 50.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showWeekMarkers)
          .onChange(async (value) => {
            this.plugin.settings.showWeekMarkers = value;
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );
    const monthMarkersToggle = new Setting(containerEl) // Store ref to toggle
      .setName("Month Markers")
      .setDesc("Show abbreviated month names.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showMonthMarkers)
          .onChange(async (value) => {
            this.plugin.settings.showMonthMarkers = value;
            await this.plugin.saveSettings();
            // Show/hide frequency dropdown using hidden class
            const freqSettingEl = containerEl.querySelector(
              ".month-marker-frequency"
            );
            if (freqSettingEl) {
              freqSettingEl.classList.toggle("hidden", !value);
            }
            this.refreshAllViews();
          })
      );
    const freqSetting = new Setting(containerEl)
      .setName("Month Marker Frequency")
      .setDesc("How often month markers appear (requires Month Markers ON).")
      .setClass("month-marker-frequency") // Class for show/hide
      .addDropdown((dropdown) => {
        dropdown
          .addOption("all", "Every Month")
          .addOption("quarter", "Every Quarter")
          .addOption("half-year", "Every Half Year")
          .addOption("year", "Start of Year Only")
          .setValue(this.plugin.settings.monthMarkerFrequency)
          .onChange(async (value: string) => {
            this.plugin.settings.monthMarkerFrequency = value as
              | "all"
              | "quarter"
              | "half-year"
              | "year";
            await this.plugin.saveSettings();
            this.refreshAllViews();
          });
      });
    // Hide frequency setting initially if month markers are disabled
    if (!this.plugin.settings.showMonthMarkers) {
      freqSetting.settingEl.classList.add("hidden");
    }
    new Setting(containerEl)
      .setName("Birthday Marker")
      .setDesc("Show a cake icon near your birthday week.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showBirthdayMarker)
          .onChange(async (value) => {
            this.plugin.settings.showBirthdayMarker = value;
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );

    // --- Event Type Management ---
    containerEl.createEl("h3", { text: "Event Types" });
    new Setting(containerEl)
      .setName("Manage Event Types")
      .setDesc(
        "Add custom types, or edit the names and colors of any type (including presets)."
      )
      .addButton((button) => {
        button.setButtonText("Manage Types").onClick(() => {
          // Assuming ManageEventTypesModal class exists and is correct
          new ManageEventTypesModal(this.app, this.plugin).open();
        });
      });

    // --- Week Filling Options ---
    containerEl.createEl("h3", { text: "Week Filling Options" });

    // Auto-fill toggle (now controls manual fill indirectly)
    const autoFillToggleSetting = new Setting(containerEl)
      .setName("Enable Auto-Fill")
      .setDesc(
        "Automatically mark past weeks as 'filled' on a chosen day. If OFF, you can mark future weeks manually by right-clicking them."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableAutoFill)
          .onChange(async (value) => {
            this.plugin.settings.enableAutoFill = value;
            this.plugin.settings.enableManualFill = !value; // Manual fill is inverse
            await this.plugin.saveSettings();

            // Show/hide day selector and manual fill color picker based on toggle state
            const daySelectorEl = containerEl.querySelector(
              ".auto-fill-day-selector"
            );
            const manualFillColorEl = containerEl.querySelector(
              ".manual-fill-color-selector" // New class for the color picker setting
            );

            if (daySelectorEl) {
              daySelectorEl.classList.toggle("hidden", !value); // Hidden if auto-fill is OFF
            }
            if (manualFillColorEl) {
              manualFillColorEl.classList.toggle("hidden", value); // Hidden if auto-fill is ON (i.e., manual fill is OFF)
            }

            // Update status indicator text
            let statusIndicator = containerEl.querySelector(
              ".chronica-fill-mode-status"
            );
            const statusText = value
              ? "Auto-fill is active."
              : "Manual fill is active (right-click future weeks).";

            if (statusIndicator) {
              statusIndicator.textContent = statusText;
            } else {
              // If it doesn't exist, create it after the relevant conditional setting
              statusIndicator = containerEl.createEl("div", {
                cls: "chronica-fill-mode-status",
                text: statusText,
              });
              // Place it after the last visible setting in this group
              const lastVisibleSetting = value
                ? daySelectorEl
                : manualFillColorEl;
              if (lastVisibleSetting) {
                lastVisibleSetting.insertAdjacentElement(
                  "afterend",
                  statusIndicator
                );
              } else {
                // Fallback if somehow both are null (shouldn't happen)
                autoFillToggleSetting.settingEl.insertAdjacentElement(
                  "afterend",
                  statusIndicator
                );
              }
            }
            this.refreshAllViews();
          })
      );

    // Auto-fill day selector (conditionally displayed)
    const daySelector = new Setting(containerEl)
      .setName("Auto-Fill Day")
      .setDesc(
        "Day of the week when auto-fill should occur (requires Auto-Fill ON)."
      )
      .setClass("auto-fill-day-selector")
      .addDropdown((dropdown) => {
        const days = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        days.forEach((day, index) => dropdown.addOption(index.toString(), day));
        dropdown
          .setValue(this.plugin.settings.autoFillDay.toString())
          .onChange(async (value) => {
            this.plugin.settings.autoFillDay = parseInt(value);
            await this.plugin.saveSettings();
          });
      });

    // Manual Fill Color Picker (conditionally displayed) - NEW
    const manualFillColorPickerSetting = new Setting(containerEl)
      .setName("Manual Fill Color")
      .setDesc("Color for manually filled weeks (requires Auto-Fill OFF).")
      .setClass("manual-fill-color-selector") // New class for show/hide
      .addColorPicker((colorPicker) =>
        colorPicker
          .setValue(
            this.plugin.settings.manualFillColor ||
              DEFAULT_SETTINGS.manualFillColor
          )
          .onChange(async (value) => {
            this.plugin.settings.manualFillColor = value;
            await this.plugin.saveSettings();
            document.documentElement.style.setProperty(
              // Re-add this line
              "--manual-fill-color",
              value
            );
            this.refreshAllViews(); // Refresh to see color change on grid
          })
      );

    // Create the initial status indicator text element AFTER all related settings
    const initialStatusText = this.plugin.settings.enableAutoFill
      ? "Auto-fill is active."
      : "Manual fill is active (right-click future weeks).";
    const statusEl = containerEl.createEl("div", {
      cls: "chronica-fill-mode-status",
      text: initialStatusText,
    });
    // Insert statusEl after the last setting in this logical group (clear filled weeks button)
    // We'll add the "Clear Filled Weeks" button next, then place statusEl after it.

    // Hide day selector OR manual fill color initially based on auto-fill state
    if (this.plugin.settings.enableAutoFill) {
      manualFillColorPickerSetting.settingEl.classList.add("hidden");
    } else {
      daySelector.settingEl.classList.add("hidden");
    }

    // Clear filled weeks button
    const clearFilledSetting = new Setting(containerEl) // get a reference to this setting
      .setName("Clear Filled Weeks")
      .setDesc(
        "Remove all manual/auto filled week markings (does not delete notes or events)."
      )
      .addButton((button) => {
        button.setButtonText("Clear Filled Markings").onClick(async () => {
          if (
            confirm("Are you sure you want to clear all filled week markings?")
          ) {
            this.plugin.settings.filledWeeks = [];
            await this.plugin.saveSettings();
            this.refreshAllViews();
            new Notice("Cleared all filled weeks.");
          }
        });
      });

    // Now, insert statusEl after the "Clear Filled Weeks" button's setting element
    clearFilledSetting.settingEl.insertAdjacentElement("afterend", statusEl);

    // --- Other Display/Interaction Settings ---
    containerEl.createEl("h3", { text: "Other Display Options" });

    // Week start day setting
    new Setting(containerEl)
      .setName("Start Week On Monday")
      .setDesc("Use Monday as the first day of the week (ISO standard).")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.startWeekOnMonday)
          .onChange(async (value) => {
            this.plugin.settings.startWeekOnMonday = value;
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );

    // Default fit to screen setting
    const fitToggleSetting = new Setting(containerEl) // Store ref to toggle
      .setName("Default Fit to Screen")
      .setDesc("Automatically zoom to fit the grid when opening the view.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.defaultFitToScreen)
          .onChange(async (value) => {
            this.plugin.settings.defaultFitToScreen = value;
            await this.plugin.saveSettings();
            // Show/hide zoom slider using hidden class
            const zoomSettingEl = containerEl.querySelector(
              ".zoom-level-setting"
            );
            if (zoomSettingEl) {
              zoomSettingEl.classList.toggle("hidden", value); // Hide slider if Fit is ON
            }
          })
      );

    // Zoom level setting (conditionally displayed)
    const zoomSetting = new Setting(containerEl)
      .setName("Default Zoom Level")
      .setDesc("Manual zoom level if 'Fit to Screen' is OFF (1 = 100%).")
      .setClass("zoom-level-setting") // Class for show/hide
      .addSlider((slider) =>
        slider
          .setLimits(0.5, 3.0, 0.1) // Finer steps for zoom
          .setValue(this.plugin.settings.zoomLevel)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.zoomLevel = value;
            await this.plugin.saveSettings();
            // No need to refresh views here, zoom applies instantly in view
          })
      );
    // Hide zoom setting initially if fit to screen is enabled
    if (this.plugin.settings.defaultFitToScreen) {
      zoomSetting.settingEl.classList.add("hidden");
    }

    // --- Statistics Panel Settings ---
    containerEl.createEl("h3", { text: "Statistics Panel" });
    new Setting(containerEl)
      .setName("Default Panel State")
      .setDesc("Have the statistics panel open when Chronica view loads.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.isStatsOpen)
          .onChange(async (value) => {
            this.plugin.settings.isStatsOpen = value;
            await this.plugin.saveSettings();
            // Views will read this on next open/render
          })
      );

    new Setting(containerEl)
      .setName("Default Panel Height")
      .setDesc("Initial height of the statistics panel in pixels.")
      .addSlider((slider) =>
        slider
          .setLimits(150, 600, 10) // Finer steps
          .setValue(this.plugin.settings.statsPanelHeight)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.statsPanelHeight = value;
            await this.plugin.saveSettings();
            this.refreshStatsPanelInOpenViews(); // Call to the new method
          })
      );
    new Setting(containerEl)
      .setName("Default Panel Width")
      .setDesc("Initial width of the statistics panel in pixels.")
      .addSlider((slider) =>
        slider
          .setLimits(400, 1200, 20) // Width range
          .setValue(this.plugin.settings.statsPanelWidth)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.statsPanelWidth = value;
            await this.plugin.saveSettings();
            this.refreshStatsPanelInOpenViews(); // Call to the new method
          })
      );

    new Setting(containerEl)
      .setName("Default Panel Tab")
      .setDesc("Which tab the statistics panel opens to.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("overview", "Overview")
          .addOption("events", "Events")
          .addOption("timeline", "Timeline")
          .addOption("charts", "Charts")
          .setValue(this.plugin.settings.activeStatsTab)
          .onChange(async (value) => {
            this.plugin.settings.activeStatsTab = value;
            await this.plugin.saveSettings();
          });
      });

    // --- NEW Data Management Section ---
    containerEl.createEl("h3", { text: "Data Management" });
    // Clear All Events Button
    new Setting(containerEl)
      .setName("Clear All Events")
      .setDesc(
        "Permanently delete all recorded events. This does NOT delete notes. Event type definitions will remain."
      )
      .addButton((button) => {
        button
          .setButtonText("Clear All Events")
          .setWarning() // Make the button look cautionary
          .onClick(async () => {
            if (
              confirm(
                "DANGER: Are you sure you want to delete ALL recorded events from Chronica's settings? This will NOT delete your notes, but the links in Chronica will be gone. This cannot be undone."
              )
            ) {
              this.plugin.settings.events = []; // Clear the new events array
              await this.plugin.saveSettings();
              this.refreshAllViews(); // Update views
              new Notice(
                "All recorded events have been cleared from Chronica settings."
              );
            }
          });
      });
    // Reset Event Types Button
    new Setting(containerEl)
      .setName("Reset Event Types & Events")
      .setDesc(
        "Reset event types to the default presets (Major Life, etc.). This will ALSO CLEAR ALL RECORDED EVENTS because their type links will become invalid."
      )
      .addButton((button) => {
        button
          .setButtonText("Reset Types & Clear Events")
          .setWarning() // Make the button look cautionary
          .onClick(async () => {
            if (
              confirm(
                "DANGER: Are you sure you want to reset event types to default? This will also DELETE ALL recorded events from Chronica's settings. This cannot be undone."
              )
            ) {
              // Reset types to default (deep copy)
              this.plugin.settings.eventTypes = JSON.parse(
                JSON.stringify(DEFAULT_SETTINGS.eventTypes)
              );
              // Clear all events as their typeIds are no longer valid/consistent
              this.plugin.settings.events = [];
              await this.plugin.saveSettings();
              this.refreshAllViews(); // Update views
              new Notice("Event types reset to default. All events cleared.");
            }
          });
      });

    // --- Tips & Shortcuts Section (Keep as is) ---
    containerEl.createEl("h3", { text: "Tips & Shortcuts" });
    const tipsContainer = containerEl.createDiv({
      cls: "chronica-tips-container",
    });
    // (Keep all the <details> sections for tips - unchanged)
    const navigationDetails = tipsContainer.createEl("details", {
      cls: "chronica-tips-details",
    });
    navigationDetails.createEl("summary", {
      text: "Basic Navigation",
      cls: "chronica-tips-summary",
    });
    const navContent = navigationDetails.createDiv({
      cls: "chronica-tips-content",
    });
    navContent.createEl("p", {
      text: "• Click on any week cell to create or open its note.",
    });
    navContent.createEl("p", {
      text: "• Shift+Click on a week cell to quickly add an event for that date.",
    });
    navContent.createEl("p", {
      text: "• Hover over cells for week number and date range.",
    });
    navContent.createEl("p", {
      text: "• Use sidebar zoom controls or 'Fit to Screen'.",
    });
    const eventsDetails = tipsContainer.createEl("details", {
      cls: "chronica-tips-details",
    });
    eventsDetails.createEl("summary", {
      text: "Events & Planning",
      cls: "chronica-tips-summary",
    });
    const eventsContent = eventsDetails.createDiv({
      cls: "chronica-tips-content",
    });
    eventsContent.createEl("p", {
      text: "• Use 'Add Event' button or Shift+Click.",
    });
    eventsContent.createEl("p", {
      text: "• Mark multi-week events using 'Date Range'.",
    });
    eventsContent.createEl("p", {
      text: "• Manage custom event types (names/colors) via the button.",
    });
    eventsContent.createEl("p", {
      text: "• Edit preset type names/colors via 'Manage Types'.",
    });
    eventsContent.createEl("p", {
      text: "• Events create/link to notes with YAML frontmatter.",
    });
    const customizationDetails = tipsContainer.createEl("details", {
      cls: "chronica-tips-details",
    });
    customizationDetails.createEl("summary", {
      text: "Customization",
      cls: "chronica-tips-summary",
    });
    const customContent = customizationDetails.createDiv({
      cls: "chronica-tips-content",
    });
    customContent.createEl("p", {
      text: "• Change cell shapes (square, circle, diamond).",
    });
    customContent.createEl("p", {
      text: "• Switch between Landscape/Portrait grid orientation.",
    });
    customContent.createEl("p", {
      text: "• Toggle visibility of Decade, Week, Month, Birthday markers.",
    });
    customContent.createEl("p", {
      text: "• Adjust colors for Past/Present/Future cells.",
    });
    customContent.createEl("p", { text: "• Customize the footer quote." });
    const statsDetails = tipsContainer.createEl("details", {
      cls: "chronica-tips-details",
    });
    statsDetails.createEl("summary", {
      text: "Statistics Panel",
      cls: "chronica-tips-summary",
    });
    const statsContent = statsDetails.createDiv({
      cls: "chronica-tips-content",
    });
    statsContent.createEl("p", {
      text: "• Click handle at screen bottom to toggle panel.",
    });
    statsContent.createEl("p", {
      text: "• Drag top handle to resize vertically.",
    });
    statsContent.createEl("p", {
      text: "• Drag side handles or header (not buttons) to resize/move horizontally.",
    });
    statsContent.createEl("p", {
      text: "• Explore different data views in the tabs.",
    });
    navigationDetails.setAttribute("open", ""); // Open first tip by default
  } // End of display() method

  refreshStatsPanelInOpenViews(): void {
    this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE).forEach((leaf) => {
      const view = leaf.view as ChornicaTimelineView;
      if (view && typeof view.updateStatsPanelLayout === "function") {
        view.updateStatsPanelLayout();
      }
      // Removed the else if for brevity, assuming updateStatsPanelLayout is sufficient for now
    });
  }

  /**
   * Refresh all timeline views
   */
  refreshAllViews(): void {
    this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE).forEach((leaf) => {
      const view = leaf.view as ChornicaTimelineView;
      // Ensure view exists and has the render method before calling
      if (view && typeof view.renderView === "function") {
        view.renderView();
      }
    });
  }
} // End of ChornicaSettingTab class
