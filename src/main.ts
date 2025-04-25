/**
 * ChronOS Timeline Plugin for Obsidian
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
  AbstractInputSuggest,
} from "obsidian";

// -----------------------------------------------------------------------
// CONSTANTS & TYPE DEFINITIONS
// -----------------------------------------------------------------------

/** Unique identifier for the timeline view */
const TIMELINE_VIEW_TYPE = "chronos-timeline-view";

/** Interface for plugin settings */
interface ChronosSettings {
  /** User's date of birth in YYYY-MM-DD format */
  birthday: string;

  /** Maximum age to display on timeline (in years) */
  lifespan: number;

  /** Default view mode */
  defaultView: string;

  /** Cell shape variants */
  cellShape: 'square' | 'circle' | 'diamond';

  /** Grid orientation - landscape (default) or portrait */
  gridOrientation: 'landscape' | 'portrait';

  /** Color for past weeks */
  pastCellColor: string;

  /** Color for present week */
  presentCellColor: string;

  /** Color for future weeks */
  futureCellColor: string;

  /** Major life events */
  greenEvents: string[];

  /** Travel events */
  blueEvents: string[];

  /** Current zoom level (1.0 is default, higher values = larger cells) */
  zoomLevel: number;

  /** Relationship events */
  pinkEvents: string[];

  /** Education/Career events */
  purpleEvents: string[];

  /** Custom event types defined by user */
  customEventTypes: CustomEventType[];

  /** Events organized by custom type */
  customEvents: Record<string, string[]>;

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

  // Add to the class properties at the top of ChronosTimelineView
  isSidebarOpen: boolean;

  /** Whether the stats panel is minimized */
  isStatsPanelMinimized: boolean;
  
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
  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }
  

  // Gather & filter all folder paths
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
    return results.filter((f) =>
      f.toLowerCase().includes(query.toLowerCase())
    );
  }

  // How each suggestion is rendered in the dropdown
  renderSuggestion(item: string, el: HTMLElement): void {
    el.createEl('div', { text: item });
  }

  // What happens when the user picks one
  onChooseSuggestion(item: string): void {
    this.inputEl.value = item;
    this.inputEl.trigger('input');
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
const DEFAULT_SETTINGS: ChronosSettings = {
  birthday: "2003-07-18",
  lifespan: 90,
  defaultView: "weeks",
  pastCellColor: "#27ae60",
  presentCellColor: "#a882ff",
  futureCellColor: "#d8e2e6",
  greenEvents: [],
  blueEvents: [],
  pinkEvents: [],
  purpleEvents: [],
  customEventTypes: [],
  customEvents: {},
  quote: "the only true luxury is time.",
  notesFolder: "",
  showDecadeMarkers: true,
  showWeekMarkers: true,
  showMonthMarkers: false,
  showBirthdayMarker: true,
  monthMarkerFrequency: "all",
  enableManualFill: false,
  enableAutoFill: true,
  autoFillDay: 1, // Monday by default
  filledWeeks: [],
  startWeekOnMonday: true,
  zoomLevel: 1.0,
  isSidebarOpen: false,
  isStatsPanelMinimized: false,
  cellShape: 'square',
  gridOrientation: 'landscape',
};

/** SVG icon for the ChronOS Timeline */
const CHRONOS_ICON = `<svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="4"/>
  <line x1="50" y1="15" x2="50" y2="50" stroke="currentColor" stroke-width="4"/>
  <line x1="50" y1="50" x2="75" y2="60" stroke="currentColor" stroke-width="4"/>
  <circle cx="50" cy="50" r="5" fill="currentColor"/>
</svg>`;

/** SVG icon for birthday cake */
const CAKE_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
  <path fill="currentColor" d="M12,6C13.11,6 14,5.1 14,4C14,3.62 13.9,3.27 13.71,2.97L12,0L10.29,2.97C10.1,3.27 10,3.62 10,4A2,2 0 0,0 12,6M16.6,16L15.53,14.92L14.45,16C13.15,17.29 10.87,17.3 9.56,16L8.5,14.92L7.4,16C6.75,16.64 5.88,17 4.96,17C4.23,17 3.56,16.77 3,16.39V21A1,1 0 0,0 4,22H20A1,1 0 0,0 21,21V16.39C20.44,16.77 19.77,17 19.04,17C18.12,17 17.25,16.64 16.6,16M18,9H13V7H11V9H6A3,3 0 0,0 3,12V13.54C3,14.62 3.88,15.5 4.96,15.5C5.5,15.5 6,15.3 6.34,14.93L8.5,12.8L10.61,14.93C11.35,15.67 12.64,15.67 13.38,14.93L15.5,12.8L17.65,14.93C18,15.3 18.5,15.5 19.03,15.5C20.12,15.5 21,14.62 21,13.54V12A3,3 0 0,0 18,9Z" />
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

// -----------------------------------------------------------------------
// MAIN PLUGIN CLASS
// -----------------------------------------------------------------------

/**
 * Main plugin class that handles initialization, settings, and view management
 */
export default class ChronosTimelinePlugin extends Plugin {
  /** Plugin settings */
  settings: ChronosSettings = DEFAULT_SETTINGS;

  /**
   * Plugin initialization on load
   */
  async onload(): Promise<void> {
    console.log("Loading ChronOS Timeline Plugin");
  
    // 1) Register the timeline view exactly once
    try {
      this.registerView(
        TIMELINE_VIEW_TYPE,
        (leaf) => new ChronosTimelineView(leaf, this)
      );
    } catch (e) {
      // already registered on hot-reload—ignore
    }
  
    // 2) Re-draw whenever a new weekly note appears
    this.registerEvent(
      this.app.vault.on("create", () => this.refreshAllViews())
    );
  
    // 3) On deletion, remove from settings AND re-draw
    this.registerEvent(
      this.app.vault.on("delete", async (file) => {
        if (!(file instanceof TFile)) return;
    
        // 1) Only run on notes named like "2025--W23.md"
        const base = file.basename;                 // e.g. "2025--W23"
        if (!/^\d{4}--W\d{2}$/.test(base)) return;  // skip everything else
    
        // 2) Normalize to "2025-W23" so it matches your settings entries
        const weekKey = base.replace("--", "-");
    
        // 3) Purge it from every array, same as before
        const purge = (arr: string[]) => arr.filter((e) => e.split(":")[0] !== weekKey);
        this.settings.greenEvents  = purge(this.settings.greenEvents);
        this.settings.blueEvents   = purge(this.settings.blueEvents);
        this.settings.pinkEvents   = purge(this.settings.pinkEvents);
        this.settings.purpleEvents = purge(this.settings.purpleEvents);
    
        if (this.settings.customEventTypes) {
          for (const t of this.settings.customEventTypes) {
            const list = this.settings.customEvents[t.name] || [];
            this.settings.customEvents[t.name] = purge(list);
          }
        }
    
        // 4) Save & redraw  
        await this.saveSettings();
        this.refreshAllViews();
      })
    );
    
    
  
    // 4) Now your regular setup
    addIcon("chronos-icon", CHRONOS_ICON);
    await this.loadSettings();
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

    // Command to create/open weekly note
    this.addCommand({
      id: "create-weekly-note",
      name: "Create/Open Current Week Note",
      callback: () => {
        this.createOrOpenWeekNote();
      },
    });

    // Add settings tab
    this.addSettingTab(new ChronosSettingTab(this.app, this));

    // Check for auto-fill on plugin load
    this.checkAndAutoFill();

    // Register interval to check for auto-fill (check every hour)
    this.registerInterval(
      window.setInterval(() => this.checkAndAutoFill(), 1000 * 60 * 60)
    );

  }

  public refreshAllViews(): void {
    this.app.workspace
      .getLeavesOfType(TIMELINE_VIEW_TYPE)
      .forEach((leaf) => {
        (leaf.view as ChronosTimelineView).renderView();
      });
  }

  /**
   * Load settings from storage
   */
  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // Initialize empty arrays/objects if they don't exist
    if (!this.settings.customEventTypes) {
      this.settings.customEventTypes = [];
    }

    if (!this.settings.customEvents) {
      this.settings.customEvents = {};
    }

    // Initialize new marker settings if they don't exist
    if (this.settings.showDecadeMarkers === undefined) {
      this.settings.showDecadeMarkers = DEFAULT_SETTINGS.showDecadeMarkers;
    }

    if (this.settings.showWeekMarkers === undefined) {
      this.settings.showWeekMarkers = DEFAULT_SETTINGS.showWeekMarkers;
    }

    if (this.settings.showMonthMarkers === undefined) {
      this.settings.showMonthMarkers = DEFAULT_SETTINGS.showMonthMarkers;
    }

    if (this.settings.showBirthdayMarker === undefined) {
      this.settings.showBirthdayMarker = DEFAULT_SETTINGS.showBirthdayMarker;
    }

    if (this.settings.monthMarkerFrequency === undefined) {
      this.settings.monthMarkerFrequency =
        DEFAULT_SETTINGS.monthMarkerFrequency;

      // Initialize new fill settings if they don't exist
      if (this.settings.enableManualFill === undefined) {
        this.settings.enableManualFill = DEFAULT_SETTINGS.enableManualFill;
      }
      if (this.settings.enableAutoFill === undefined) {
        this.settings.enableAutoFill = DEFAULT_SETTINGS.enableAutoFill;
      }
      if (this.settings.autoFillDay === undefined) {
        this.settings.autoFillDay = DEFAULT_SETTINGS.autoFillDay;
      }
      if (this.settings.filledWeeks === undefined) {
        this.settings.filledWeeks = DEFAULT_SETTINGS.filledWeeks;
      }
      if (this.settings.startWeekOnMonday === undefined) {
        this.settings.startWeekOnMonday = DEFAULT_SETTINGS.startWeekOnMonday;
      }
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
   * @returns Full path including folder if specified
   */
  getFullPath(fileName: string): string {
    if (this.settings.notesFolder && this.settings.notesFolder.trim() !== "") {
      let folderPath = this.settings.notesFolder;
      if (!folderPath.endsWith("/")) {
        folderPath += "/";
      }
      return `${folderPath}${fileName}`;
    }
    return fileName;
  }

/**
 * Create or open a note for the current week
 */
async createOrOpenWeekNote(): Promise<void> {
  try {
    const date = new Date();
    const year = date.getFullYear();
    const weekNum = this.getISOWeekNumber(date);
    const fileName = `${year}-W${weekNum.toString().padStart(2, "0")}.md`;
    const fullPath = this.getFullPath(fileName);
    const weekKey = `${year}-W${weekNum.toString().padStart(2, "0")}`;

    const existingFile = this.app.vault.getAbstractFileByPath(fullPath);

    if (existingFile instanceof TFile) {
      // Open existing file
      await this.app.workspace.getLeaf().openFile(existingFile);
    } else {
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
        } catch (err) {
          console.log("Error checking/creating folder:", err);
        }
      }

      // Check if any events exist for this week in the plugin settings
      let content = "";
      let eventMeta = null;
      
      // Check built-in event types
      const eventTypes = [
        { events: this.settings.greenEvents, type: "Major Life", color: "#4CAF50" },
        { events: this.settings.blueEvents, type: "Travel", color: "#2196F3" },
        { events: this.settings.pinkEvents, type: "Relationship", color: "#E91E63" },
        { events: this.settings.purpleEvents, type: "Education/Career", color: "#9C27B0" }
      ];
      
      // Check for single events
      for (const { events, type, color } of eventTypes) {
        for (const eventData of events) {
          const parts = eventData.split(':');
          // Check single events (2 parts)
          if (parts.length === 2 && parts[0] === weekKey) {
            eventMeta = {
              event: parts[1],
              description: parts[1],
              type: type,
              color: color,
              startDate: date.toISOString().split('T')[0]
            };
            break;
          }
          // Check range events (3 parts)
          if (parts.length === 3) {
            const [startWeekKey, endWeekKey, description] = parts;
            // Parse week numbers
            const startYear = parseInt(startWeekKey.split('-W')[0]);
            const startWeek = parseInt(startWeekKey.split('-W')[1]);
            const endYear = parseInt(endWeekKey.split('-W')[0]);
            const endWeek = parseInt(endWeekKey.split('-W')[1]);
            
            // Create dates to compare
            const startDate = new Date(startYear, 0, 1);
            startDate.setDate(startDate.getDate() + (startWeek - 1) * 7);
            
            const endDate = new Date(endYear, 0, 1);
            endDate.setDate(endDate.getDate() + (endWeek - 1) * 7 + 6);
            
            // Check if current week falls within range
            if (
              year >= startYear && year <= endYear &&
              ((year === startYear && weekNum >= startWeek) || year > startYear) &&
              ((year === endYear && weekNum <= endWeek) || year < endYear)
            ) {
              eventMeta = {
                event: description,
                description: description,
                type: type,
                color: color,
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
              };
              break;
            }
          }
        }
        if (eventMeta) break;
      }
      
      // Check custom events if no built-in event found
      if (!eventMeta && this.settings.customEventTypes) {
        for (const customType of this.settings.customEventTypes) {
          const events = this.settings.customEvents[customType.name] || [];
          for (const eventData of events) {
            const parts = eventData.split(':');
            // Check single events
            if (parts.length === 2 && parts[0] === weekKey) {
              eventMeta = {
                event: parts[1],
                description: parts[1],
                type: customType.name,
                color: customType.color,
                startDate: date.toISOString().split('T')[0]
              };
              break;
            }
            // Check range events
            if (parts.length === 3) {
              const [startWeekKey, endWeekKey, description] = parts;
              // Parse week numbers
              const startYear = parseInt(startWeekKey.split('-W')[0]);
              const startWeek = parseInt(startWeekKey.split('-W')[1]);
              const endYear = parseInt(endWeekKey.split('-W')[0]);
              const endWeek = parseInt(endWeekKey.split('-W')[1]);
              
              // Check if current week falls within range
              if (
                year >= startYear && year <= endYear &&
                ((year === startYear && weekNum >= startWeek) || year > startYear) &&
                ((year === endYear && weekNum <= endWeek) || year < endYear)
              ) {
                const startDate = new Date(startYear, 0, 1);
                startDate.setDate(startDate.getDate() + (startWeek - 1) * 7);
                
                const endDate = new Date(endYear, 0, 1);
                endDate.setDate(endDate.getDate() + (endWeek - 1) * 7 + 6);
                
                eventMeta = {
                  event: description,
                  description: description,
                  type: customType.name,
                  color: customType.color,
                  startDate: startDate.toISOString().split('T')[0],
                  endDate: endDate.toISOString().split('T')[0]
                };
                break;
              }
            }
          }
          if (eventMeta) break;
        }
      }
      
      // Add frontmatter if event exists
      if (eventMeta) {
        content = this.formatFrontmatter(eventMeta);
      } else {
        // Add empty frontmatter
        content = this.formatFrontmatter({});
      }
      
      // Add note template
      content += `# Week ${weekNum}, ${year}\n\n## Reflections\n\n## Tasks\n\n## Notes\n`;

      const newFile = await this.app.vault.create(fullPath, content);
      await this.app.workspace.getLeaf().openFile(newFile);
    }
  } catch (error) {
    new Notice(`Error creating week note: ${error}`);
  }
}

  /**
   * Calculate ISO week number for a given date
   * @param date - Date to calculate week number for
   * @returns ISO week number (1-53)
   */
  getISOWeekNumber(date: Date): number {
    // Create a copy of the date to avoid modifying the original
    const target = new Date(date.getTime());
    target.setHours(0, 0, 0, 0);
    
    // ISO week starts on Monday
    const dayNumber = target.getDay() || 7; // Convert Sunday (0) to 7
    
    // Move target to Thursday in the same week
    target.setDate(target.getDate() - dayNumber + 4);
    
    // Get January 1st of the target year
    const yearStart = new Date(target.getFullYear(), 0, 1);
    
    // Calculate the number of days since January 1st
    const daysSinceFirstDay = Math.floor((target.getTime() - yearStart.getTime()) / 86400000);
    
    // Calculate the week number
    return 1 + Math.floor(daysSinceFirstDay / 7);
  }

/**
 * Get week key in YYYY-WXX format from date
 * @param date - Date to get week key for
 * @returns Week key in YYYY-WXX format
 */
getWeekKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const weekNum = this.getISOWeekNumber(date);
  return `${year}-W${weekNum.toString().padStart(2, "0")}`;
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
      if ((currentMonth !== lastMarkedMonth || currentYear !== lastMarkedYear) && 
          shouldShowMonth(currentMonth)) {
        
        // Calculate exact week index relative to birth date
        const weeksSinceBirth = this.getFullWeekAge(birthdayDate, currentDate);
        
        // Add marker for this month
        monthMarkers.push({
          weekIndex: weeksSinceBirth,
          label: MONTH_NAMES[currentMonth],
          isFirstOfYear: currentMonth === 0,
          isBirthMonth: currentMonth === birthMonth && currentYear === birthYear,
          fullLabel: `${MONTH_NAMES[currentMonth]} ${currentYear}`,
          monthNumber: currentMonth + (currentYear - birthYear) * 12 // Add this line
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
 * @returns String with formatted date range
 */
getWeekDateRange(weekKey: string): string {
  const parts = weekKey.split("-W");
  if (parts.length !== 2) return "";

  const year = parseInt(parts[0]);
  const week = parseInt(parts[1]);

  // Calculate the first day of the week (Monday of that week for ISO weeks)
  const firstDayOfWeek = new Date(year, 0, 1);
  const dayOffset = firstDayOfWeek.getDay() || 7; // getDay returns 0 for Sunday
  const dayToAdd = 1 + (week - 1) * 7 - (dayOffset - 1);

  firstDayOfWeek.setDate(dayToAdd);

  // Calculate the last day of the week (Sunday if not startWeekOnMonday, otherwise Sunday)
  const lastDayOfWeek = new Date(firstDayOfWeek);
  lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);

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
getBirthdayWeekForYear(year: number): {weekNumber: number, weekStart: Date} {
  // Get the birthday in this specific year
  const birthdayDate = new Date(this.settings.birthday);
  birthdayDate.setFullYear(year);
  
  // Find ISO week number
  const weekNumber = this.getISOWeekNumber(birthdayDate);
  
  // Find the Monday that starts this week
  const tempDate = new Date(birthdayDate.getTime());
  const dayOfWeek = tempDate.getDay() || 7; // Convert Sunday (0) to 7
  
  // Move to the Monday of this week (ISO week starts on Monday)
  tempDate.setDate(tempDate.getDate() - (dayOfWeek - 1));
  tempDate.setHours(0, 0, 0, 0);
  
  // Verify this week actually contains the birthday
  const weekEndDate = new Date(tempDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6); // Sunday
  
  const containsBirthday = birthdayDate >= tempDate && birthdayDate <= weekEndDate;
  
  if (!containsBirthday) {
    // If the calculated week doesn't contain the birthday, something is wrong
    // Let's recalculate more directly
    const correctedDate = new Date(birthdayDate);
    const birthdayDayOfWeek = correctedDate.getDay() || 7;
    correctedDate.setDate(correctedDate.getDate() - (birthdayDayOfWeek - 1));
    correctedDate.setHours(0, 0, 0, 0);
    
    return {
      weekNumber: weekNumber,
      weekStart: correctedDate
    };
  }
  
  return {
    weekNumber: weekNumber,
    weekStart: tempDate
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
  const fileName = `${weekKey.replace("W", "-W")}.md`;
  const fullPath = this.getFullPath(fileName);
  
  // Check if file exists
  const file = this.app.vault.getAbstractFileByPath(fullPath);
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
    frontmatter.split('\n').forEach(line => {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        const [_, key, value] = match;
        metadata[key.trim()] = value.trim().replace(/^"(.*)"$/, '$1');
      }
    });
    
    return {
      event: metadata.event || metadata.name, 
      name: metadata.name || metadata.event,  
      description: metadata.description,
      type: metadata.type,
      color: metadata.color,
      startDate: metadata.startDate,
      endDate: metadata.endDate
    };
  } catch (error) {
    console.log("Error parsing frontmatter:", error);
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
      content = content.replace(/^---\s+[\s\S]*?\s+---/, this.formatFrontmatter(metadata));
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
    const weekNum = parseInt(weekKey.split('-W')[1]);
    const year = parseInt(weekKey.split('-')[0]);
    
    content += `# Week ${weekNum}, ${year}\n\n## Reflections\n\n## Tasks\n\n## Notes\n\n`;
    
    // Create folder if needed
    if (this.settings.notesFolder && this.settings.notesFolder.trim() !== "") {
      try {
        const folderExists = this.app.vault.getAbstractFileByPath(this.settings.notesFolder);
        if (!folderExists) {
          await this.app.vault.createFolder(this.settings.notesFolder);
        }
      } catch (err) {
        console.log("Error checking/creating folder:", err);
      }
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
        if (value !== undefined && value !== null && value !== '') {
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
 * Handle file deletion and remove any associated events
 * @param file - File that was deleted
 */
async handleFileDelete(file: TFile): Promise<void> {
  // Check if the file is a week or event note
  const filePath = file.path;
  const fileName = filePath.split("/").pop() || "";
  
  // Check if it matches our event file naming pattern
  const weekPattern = /(\d{4}-W\d{2})\.md$/;
  const rangePattern = /(\d{4}-W\d{2})_to_(\d{4}-W\d{2})\.md$/;
  
  let weekKeys: string[] = [];
  
  // Single week file
  const weekMatch = fileName.match(weekPattern);
  if (weekMatch) {
    const weekKey = weekMatch[1].replace("-W", "-W");
    weekKeys.push(weekKey);
  }
  
  // Range week file
  const rangeMatch = fileName.match(rangePattern);
  if (rangeMatch) {
    const startWeekKey = rangeMatch[1].replace("-W", "-W");
    const endWeekKey = rangeMatch[2].replace("-W", "-W");
    
    // For range events, we need to get all weeks in the range
    // Parse dates from week keys
    const startYear = parseInt(startWeekKey.split("-W")[0]);
    const startWeek = parseInt(startWeekKey.split("-W")[1]);
    const endYear = parseInt(endWeekKey.split("-W")[0]);
    const endWeek = parseInt(endWeekKey.split("-W")[1]);
    
    // Create actual dates
    const startDate = new Date(startYear, 0, 1);
    startDate.setDate(startDate.getDate() + (startWeek - 1) * 7);
    
    const endDate = new Date(endYear, 0, 1);
    endDate.setDate(endDate.getDate() + (endWeek - 1) * 7 + 6);
    
    // Get all week keys in the range
    weekKeys = this.getWeekKeysBetweenDates(startDate, endDate);
  }
  
  // If no matching week keys found, exit
  if (weekKeys.length === 0) return;
  
  // Check each of our event collections and remove matching events
  let needsSave = false;
  
  // Helper function to filter events
  const filterEvents = (events: string[]): string[] => {
    return events.filter((eventData) => {
      const parts = eventData.split(":");
      
      // Single event (format: weekKey:description)
      if (parts.length === 2) {
        return !weekKeys.includes(parts[0]);
      }
      
      // Range event (format: startWeekKey:endWeekKey:description)
      if (parts.length === 3) {
        const [startKey, endKey] = parts;
        // Skip if either the start or end key matches one of our weeks
        return !(weekKeys.includes(startKey) || weekKeys.includes(endKey));
      }
      
      return true; // Keep any event we don't understand
    });
  };
  
  // Filter standard event types
  const newGreenEvents = filterEvents(this.settings.greenEvents);
  if (newGreenEvents.length !== this.settings.greenEvents.length) {
    this.settings.greenEvents = newGreenEvents;
    needsSave = true;
  }
  
  const newBlueEvents = filterEvents(this.settings.blueEvents);
  if (newBlueEvents.length !== this.settings.blueEvents.length) {
    this.settings.blueEvents = newBlueEvents;
    needsSave = true;
  }
  
  const newPinkEvents = filterEvents(this.settings.pinkEvents);
  if (newPinkEvents.length !== this.settings.pinkEvents.length) {
    this.settings.pinkEvents = newPinkEvents;
    needsSave = true;
  }
  
  const newPurpleEvents = filterEvents(this.settings.purpleEvents);
  if (newPurpleEvents.length !== this.settings.purpleEvents.length) {
    this.settings.purpleEvents = newPurpleEvents;
    needsSave = true;
  }
  
  // Filter custom events
  if (this.settings.customEventTypes && this.settings.customEvents) {
    for (const type of this.settings.customEventTypes) {
      if (this.settings.customEvents[type.name]) {
        const newCustomEvents = filterEvents(this.settings.customEvents[type.name]);
        if (newCustomEvents.length !== this.settings.customEvents[type.name].length) {
          this.settings.customEvents[type.name] = newCustomEvents;
          needsSave = true;
        }
      }
    }
  }
  
  // If we made changes, save settings and refresh views
  if (needsSave) {
    await this.saveSettings();
    
    // Refresh all timeline views
    this.app.workspace
    .getLeavesOfType(TIMELINE_VIEW_TYPE)
    .forEach((leaf) => {
      const view = leaf.view as ChronosTimelineView;
      view.renderView();
    });
    
    new Notice(`Event removed from timeline grid`);
  }
  else {
    // Weekly‐note file was deleted (no settings event removed) — still need to repaint
      this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE).forEach((leaf) => {
            const view = leaf.view as ChronosTimelineView;
              view.renderView();
    });
    }
  }
}


// -----------------------------------------------------------------------
// EVENT MODAL CLASS
// -----------------------------------------------------------------------

/**
 * Modal dialog for adding life events to the timeline
 */
class ChronosEventModal extends Modal {
  /** Reference to the main plugin */
  plugin: ChronosTimelinePlugin;

  /** Selected date/week (YYYY-WXX format) */
  selectedDate: string = "";

  /** Selected end date for range (YYYY-WXX format) */
  selectedEndDate: string = "";

  /** Flag to indicate if using a date range */
  isDateRange: boolean = false;

  /** Selected color for the event */
  selectedColor: string = "#4CAF50";

  /** Description of the event */
  eventDescription: string = "";

  /** Name of the event */
  eventName: string = "";

  /** Currently selected date input field reference */
  singleDateInput!: HTMLInputElement; 

  /** Start date input field reference */
  startDateInput!: HTMLInputElement;

  /** End date input field reference */
  endDateInput!: HTMLInputElement;

  /** Currently selected event type */
  selectedEventType: string = "Major Life";

  /** Name for custom event type */
  customEventName: string = "";

  /** Flag if custom type is selected */
  isCustomType: boolean = false;

  /**
   * Create a new event modal
   * @param app - Obsidian App instance
   * @param plugin - ChronosTimelinePlugin instance
   * @param preselectedDate - Optional date to preselect
   */
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

  /**
   * Convert a week key (YYYY-WXX) to an approximate date (YYYY-MM-DD)
   * @param weekKey - Week key to convert
   * @returns Date string in YYYY-MM-DD format
   */
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

  /**
   * Build the modal UI when opened
   */
  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Add Life Event" });

    // Date picker section
    const dateContainer = contentEl.createDiv({
      cls: "chronos-date-picker-container",
    });

    dateContainer.createEl("h3", { text: "Select Date" });

    // Add an option to toggle between single date and date range
    const dateTypeContainer = dateContainer.createDiv({
      cls: "date-type-selector",
    });

    const singleDateOption = dateTypeContainer.createEl("label", {
      cls: "date-option",
    });
    const singleDateRadio = singleDateOption.createEl("input", {
      type: "radio",
      attr: { name: "date-type", value: "single" },
    });

    singleDateRadio.checked = true;
    singleDateOption.createEl("span", { text: "Single Date" });

    const rangeDateOption = dateTypeContainer.createEl("label", {
      cls: "date-option",
    });
    const rangeDateRadio = rangeDateOption.createEl("input", {
      type: "radio",
      attr: { name: "date-type", value: "range" },
    });
    rangeDateOption.createEl("span", { text: "Date Range" });

    // Container for single date input
    const singleDateContainer = contentEl.createDiv({
      cls: "single-date-container",
    });

    const singleDateSetting = new Setting(singleDateContainer)
      .setName("Date")
      .setDesc("Enter the exact date of the event");

      this.singleDateInput = singleDateSetting.controlEl.createEl("input", {
      type: "date",
      value: this.selectedDate
        ? this.convertWeekToDate(this.selectedDate)
        : new Date().toISOString().split("T")[0],
    });

    

    this.singleDateInput.addEventListener("change", () => {
      const specificDate = this.singleDateInput.value;
      if (specificDate) {
        const date = new Date(specificDate);
        this.selectedDate = this.plugin.getWeekKeyFromDate(date);
    
        // If using date range, initialize end date to same as start if not set
        if (this.isDateRange && !this.endDateInput.value) {
          this.endDateInput.value = specificDate;
          this.selectedEndDate = this.selectedDate;
        }
      }
    });

    // Container for date range inputs
    const rangeDateContainer = contentEl.createDiv({
      cls: "range-date-container",
    });
    rangeDateContainer.style.display = "none";

    const startDateSetting = new Setting(rangeDateContainer)
      .setName("Start Date")
      .setDesc("Enter the first date of the event range");

    this.startDateInput = startDateSetting.controlEl.createEl("input", {
      type: "date",
      value: this.selectedDate
        ? this.convertWeekToDate(this.selectedDate)
        : new Date().toISOString().split("T")[0],
    });

    this.startDateInput.addEventListener("change", () => {
      const specificDate = this.startDateInput.value;
      if (specificDate) {
        const date = new Date(specificDate);
        this.selectedDate = this.plugin.getWeekKeyFromDate(date);
      }
    });

    const endDateSetting = new Setting(rangeDateContainer)
      .setName("End Date")
      .setDesc("Enter the last date of the event range");

    this.endDateInput = endDateSetting.controlEl.createEl("input", {
      type: "date",
      value: this.selectedEndDate
        ? this.convertWeekToDate(this.selectedEndDate)
        : this.startDateInput.value,
    });

    this.endDateInput.addEventListener("change", () => {
      const specificDate = this.endDateInput.value;
      if (specificDate) {
        const date = new Date(specificDate);
        this.selectedEndDate = this.plugin.getWeekKeyFromDate(date);
      }
    });

    // Add listeners to toggle between single date and range inputs
    singleDateRadio.addEventListener("change", () => {
      if (singleDateRadio.checked) {
        this.isDateRange = false;
        singleDateContainer.style.display = "block";
        rangeDateContainer.style.display = "none";
      }
    });

    rangeDateRadio.addEventListener("change", () => {
      if (rangeDateRadio.checked) {
        this.isDateRange = true;
        singleDateContainer.style.display = "none";
        rangeDateContainer.style.display = "block";
      }
    });

    contentEl.appendChild(singleDateContainer);
    contentEl.appendChild(rangeDateContainer);

    contentEl.createEl("small", {
      text: "Select the date(s) of your event. The system determines the week(s) automatically.",
      cls: "chronos-helper-text",
    });
    
    if (this.selectedDate) {
      contentEl.createEl("p", {
        text: this.isDateRange
          ? `This event spans from week ${this.selectedDate} to ${
              this.selectedEndDate || this.selectedDate
            }`
          : `This date falls in week: ${this.selectedDate}`,
      });
    }
    
    // Event name field - This should be OUTSIDE of any conditional blocks
    new Setting(contentEl)
      .setName("Event Name")
      .setDesc("Short title for this event")
      .addText((text) =>
        text.setPlaceholder("Event name").onChange((value) => {
          this.eventName = value;
        })
      );
    
    // Event description field
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

    // Create radio buttons for preset event types
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

    // Append custom settings to content
    contentEl.appendChild(customTypeSettings);

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

  /**
   * Show or hide custom type settings
   * @param contentEl - Modal content element
   * @param show - Whether to show or hide settings
   */
  updateCustomTypeVisibility(contentEl: HTMLElement, show: boolean): void {
    const customSettings = contentEl.querySelector(
      ".chronos-custom-type-settings"
    );

    if (customSettings) {
      (customSettings as HTMLElement).style.display = show ? "block" : "none";
    }
  }

/**
 * Save the event to settings and create a note
 */
async saveEvent(): Promise<void> {
  // Validate inputs
  if (!this.selectedDate && this.startDateInput) {
    new Notice("Please select a date");
    return;
  }
  
  if (!this.eventName) {
    new Notice("Please add an event name");
    return;
  }
  
  // For date range, validate end date
  if (
    this.isDateRange &&
    (!this.selectedEndDate || !this.endDateInput?.value)
  ) {
    new Notice("Please select an end date for the range");
    return;
  }

  // Handle adding custom event type if needed
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

  // If using date range, create events for all weeks in the range
  if (this.isDateRange && this.selectedEndDate) {
    // Get start and end dates
    const startDate = new Date(this.startDateInput.value);
    const endDate = new Date(this.endDateInput.value);

    // Get all week keys in the range
    const weekKeys = this.plugin.getWeekKeysBetweenDates(startDate, endDate);

    // Create filename for the note (use the whole range)
    const startWeekKey = this.plugin.getWeekKeyFromDate(startDate);
    const endWeekKey = this.plugin.getWeekKeyFromDate(endDate);
    const fileName = `${startWeekKey.replace("W", "-W")}_to_${endWeekKey.replace("W", "-W")}.md`;

    // Format date range event data with range markers
    const eventData = `${startWeekKey}:${endWeekKey}:${this.eventDescription}`;

    // Add event to appropriate collection
    this.addEventToCollection(eventData);

    // Create a note for the event (for the range)
    this.createEventNote(fileName, startDate, endDate);
    
    // NEW: Add metadata to the first week's note
    const metadata = {
      event: this.eventName,
      name: this.eventName,
      description: this.eventDescription,
      type: this.selectedEventType,
      color: this.selectedColor,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
    
    await this.plugin.updateEventInNote(startWeekKey, metadata);

    // Save settings
    this.plugin.saveSettings().then(() => {
      new Notice(`Event added: ${this.eventDescription} (${weekKeys.length} weeks)`);
      this.close();
      this.refreshViews();
    });
  } else {
    // Handle single date event (original functionality)
    const eventDate = new Date(this.singleDateInput.value);
    const weekKey = this.plugin.getWeekKeyFromDate(eventDate);
    const eventData = `${weekKey}:${this.eventDescription}`;
    const fileName = `${weekKey.replace("W", "-W")}.md`;
    
    // Add to existing event collections
    this.addEventToCollection(eventData);
    
    // Create a note for the event
    this.createEventNote(fileName, eventDate);
    
    // NEW: Add metadata to the week note
    const metadata = {
      event: this.eventName,
      name: this.eventName,
      description: this.eventDescription,
      type: this.selectedEventType,
      color: this.selectedColor,
      startDate: eventDate.toISOString().split('T')[0]
    };
    
    await this.plugin.updateEventInNote(weekKey, metadata);

    this.plugin.saveSettings().then(() => {
      new Notice(`Event added: ${this.eventDescription}`);
      this.close();
      this.refreshViews();
    });
  }
}

  /**
   * Add event to the appropriate collection based on event type
   * @param eventData - Event data string
   */
  addEventToCollection(eventData: string): void {
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
        // Custom event type
        if (!this.plugin.settings.customEvents[this.selectedEventType]) {
          this.plugin.settings.customEvents[this.selectedEventType] = [];
        }
        this.plugin.settings.customEvents[this.selectedEventType].push(
          eventData
        );
    }
  }

/**
 * Create a note file for the event
 * @param fileName - Name of the file
 * @param startDate - Start date of the event
 * @param endDate - Optional end date for range events
 */
async createEventNote(
  fileName: string,
  startDate: Date,
  endDate?: Date
): Promise<void> {
  const fullPath = this.plugin.getFullPath(fileName);
  const fileExists =
    this.plugin.app.vault.getAbstractFileByPath(fullPath) instanceof TFile;

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
          await this.app.vault.createFolder(
            this.plugin.settings.notesFolder
          );
        }
      } catch (err) {
        console.log("Error checking/creating folder:", err);
      }
    }

    // Create event note file with frontmatter and content
    let content = "";
    
    if (endDate) {
      // Range event
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];
      
      // Get week keys for title
      const startWeekKey = this.plugin.getWeekKeyFromDate(startDate);
      const endWeekKey = this.plugin.getWeekKeyFromDate(endDate);
      const startWeekDisplayName = startWeekKey.replace("W", "-W");
      const endWeekDisplayName = endWeekKey.replace("W", "-W");
      
      // Add frontmatter
      const metadata = {
        event: this.eventName,
        name: this.eventName,
        description: this.eventDescription,
        type: this.selectedEventType,
        color: this.selectedColor,
        startDate: startDateStr,
        endDate: endDateStr
      };
        
      content = this.plugin.formatFrontmatter(metadata);
      
      // Add note content with updated title
      content += `# ${startWeekDisplayName}_to_${endWeekDisplayName} (${this.eventName})\n\nStart Date: ${startDateStr}\nEnd Date: ${endDateStr}\nType: ${this.selectedEventType}\nDescription: ${this.eventDescription}\n\n## Notes\n\n`;
    } else {
      // Single date event
      const dateStr = startDate.toISOString().split("T")[0];
      
      // Get week key for title
      const weekKey = this.plugin.getWeekKeyFromDate(startDate);
      const weekDisplayName = weekKey.replace("W", "-W");
      
      // Add frontmatter
      const metadata = {
        event: this.eventName,
        name: this.eventName,
        description: this.eventDescription,
        type: this.selectedEventType,
        color: this.selectedColor,
        startDate: dateStr
      };
      
      content = this.plugin.formatFrontmatter(metadata);
      
      // Add note content with updated title
      content += `# ${weekDisplayName} (${this.eventName})\n\nDate: ${dateStr}\nType: ${this.selectedEventType}\nDescription: ${this.eventDescription}\n\n## Notes\n\n`;
    }

    await this.app.vault.create(fullPath, content);
  }
}

  /**
   * Refresh all timeline views
   */
  refreshViews(): void {
    this.plugin.app.workspace
      .getLeavesOfType(TIMELINE_VIEW_TYPE)
      .forEach((leaf) => {
        const view = leaf.view as ChronosTimelineView;
        view.renderView();
      });
  }

  /**
   * Clean up on modal close
   */
  onClose(): void {
    this.contentEl.empty();
  }
}

// -----------------------------------------------------------------------
// TIMELINE VIEW CLASS
// -----------------------------------------------------------------------

/**
 * Main timeline view that shows the life grid and events
 */
class ChronosTimelineView extends ItemView {
  /** Reference to the main plugin */
  plugin: ChronosTimelinePlugin;

  /** Track sidebar open/closed state */
  isSidebarOpen: boolean;

  isStatsPanelMinimized: boolean;

  constructor(leaf: WorkspaceLeaf, plugin: ChronosTimelinePlugin) {
    super(leaf);
    this.plugin = plugin;
    this.isSidebarOpen = this.plugin.settings.isSidebarOpen;
    this.isStatsPanelMinimized = false;
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
    return "ChronOS Timeline";
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
    contentEl.addClass("chronos-timeline-container");
    this.renderView();
  }
  toggleStatistics(): void {
    // Always attach to the main view wrapper
    const contentArea = this.containerEl.children[1] as HTMLElement;
    const stats = contentArea.querySelector(".chronos-stats-container");
    if (stats) {
      stats.remove();
      this.plugin.settings.isStatsPanelMinimized = false;
    } else {
      this.createStatisticsPanel(false);
    }
  }

  

  /**
   * Render the view with the life grid and events
   */

  private makeStatsPanelDraggable(
    statsContainer: HTMLElement,
    handle: HTMLElement
  ): void {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;
  
    handle.style.cursor = "move";
  
    handle.addEventListener("mousedown", (e: MouseEvent) => {
      // Skip clicks on buttons inside header
      if ((e.target as HTMLElement).tagName === "BUTTON") return;
      isDragging = true;
      offsetX = e.clientX - statsContainer.getBoundingClientRect().left;
      offsetY = e.clientY - statsContainer.getBoundingClientRect().top;
      e.preventDefault();
    });
  
    document.addEventListener("mousemove", (e: MouseEvent) => {
      if (!isDragging) return;
      
      const viewEl = this.containerEl.querySelector(".chronos-view") as HTMLElement;
      if (!viewEl) return;
      
      const viewRect = viewEl.getBoundingClientRect();
      
      // Calculate new position
      let newLeft = e.clientX - viewRect.left - offsetX;
      let newTop = e.clientY - viewRect.top - offsetY;
      
      // Get panel dimensions
      const panelWidth = statsContainer.offsetWidth;
      const panelHeight = statsContainer.offsetHeight;
      
      // Ensure the panel stays mostly visible within the view
      // Left boundary (at least 30px remains visible)
      newLeft = Math.max(-panelWidth + 30, Math.min(newLeft, viewRect.width - 30));
      
      // Top boundary (at least 30px remains visible)
      newTop = Math.max(0, Math.min(newTop, viewRect.height - 30));
      
      // Apply the new position
      statsContainer.style.left = `${newLeft}px`;
      statsContainer.style.top = `${newTop}px`;
      
      // Make sure the right position is not interfering
      statsContainer.style.right = "auto";
    });
  
    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }

  createStatisticsPanel(isMinimized: boolean = false): void {
    const contentEl = this.containerEl.children[1];
    
    // Remove any existing stats panel first
    const existingPanel = this.containerEl.querySelector(".chronos-stats-container");
    if (existingPanel) existingPanel.remove();
  
    // Create stats container
    const statsContainer = contentEl.createEl("div", {
      cls: `chronos-stats-container ${isMinimized ? "chronos-stats-minimized" : "chronos-stats-expanded"}`,
    });
    
    // Set initial position - centered more visibly in the view
    const viewEl = this.containerEl.querySelector(".chronos-view") as HTMLElement;
    if (viewEl) {
      statsContainer.style.top = "100px";
      statsContainer.style.right = "50px";
    }
  
    // Create header with minimize/maximize toggle
    const headerContainer = statsContainer.createEl("div", {
      cls: "chronos-stats-header-container",
    });
  
    headerContainer.createEl("h3", {
      text: "Life Statistics",
      cls: "chronos-stats-header",
    });
  
    // Add toggle button
    const toggleBtn = headerContainer.createEl("button", {
      cls: "chronos-stats-toggle-btn",
      attr: {
        title: isMinimized ? "Expand" : "Minimize",
        "aria-label": isMinimized ? "Expand statistics panel" : "Minimize statistics panel",
      },
    });
  
    toggleBtn.innerHTML = isMinimized
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`;
  
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.isStatsPanelMinimized = !this.isStatsPanelMinimized;
      this.createStatisticsPanel(this.isStatsPanelMinimized);
    });
  
    // Add close button to header
    const closeBtn = headerContainer.createEl("button", {
      cls: "chronos-stats-close-btn-small",
      attr: {
        title: "Close",
        "aria-label": "Close statistics panel",
      },
    });
  
    closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      statsContainer.remove();
    });
  
    // If minimized, don't add the content
    if (isMinimized) {
      return;
    }
  
    // Content container for statistics
    const contentContainer = statsContainer.createEl("div", {
      cls: "chronos-stats-content",
    });
  
    // Calculate basic statistics
    const now = new Date();
    const birthdayDate = new Date(this.plugin.settings.birthday);
    const ageInWeeks = this.plugin.getFullWeekAge(birthdayDate, now);
    const totalWeeks = this.plugin.settings.lifespan * 52;
    const livedPercentage = ((ageInWeeks / totalWeeks) * 100).toFixed(1);
    const remainingWeeks = totalWeeks - ageInWeeks;
  
    // Create statistics items
    const createStatItem = (label: string, value: string) => {
      const item = contentContainer.createEl("div", {
        cls: "chronos-stat-item",
      });
      item.createEl("span", { text: label, cls: "chronos-stat-label" });
      item.createEl("span", { text: value, cls: "chronos-stat-value" });
      return item;
    };
  
    // Add key statistics
    createStatItem("Weeks Lived", ageInWeeks.toString());
    createStatItem("Weeks Remaining", remainingWeeks.toString());
    createStatItem("Life Progress", `${livedPercentage}%`);
  
    // Calculate decades lived
    const yearsLived = ageInWeeks / 52;
    const decadesLived = Math.floor(yearsLived / 10);
  
    if (decadesLived > 0) {
      contentContainer.createEl("h4", {
        text: "Decade Insights",
        cls: "chronos-stats-subheader",
      });
  
      // Basic decade stats
      createStatItem("Decades Completed", decadesLived.toString());
      createStatItem(
        "Current Decade",
        `${decadesLived * 10}-${decadesLived * 10 + 9}`
      );
  
      // Calculate progress in current decade
      const decadeProgress = ((yearsLived % 10) / 10) * 100;
      createStatItem("Decade Progress", `${decadeProgress.toFixed(1)}%`);
    }
  
    // Add event statistics if available
    const majorLifeEvents = this.plugin.settings.greenEvents.length;
    const travelEvents = this.plugin.settings.blueEvents.length;
    const relationshipEvents = this.plugin.settings.pinkEvents.length;
    const educationCareerEvents = this.plugin.settings.purpleEvents.length;
  
    // Calculate custom event counts
    let customEventCount = 0;
    if (
      this.plugin.settings.customEventTypes &&
      this.plugin.settings.customEvents
    ) {
      for (const eventType of this.plugin.settings.customEventTypes) {
        if (this.plugin.settings.customEvents[eventType.name]) {
          customEventCount +=
            this.plugin.settings.customEvents[eventType.name].length;
        }
      }
    }
  
    const totalEvents =
      majorLifeEvents +
      travelEvents +
      relationshipEvents +
      educationCareerEvents +
      customEventCount;
  
    if (totalEvents > 0) {
      contentContainer.createEl("h4", {
        text: "Event Summary",
        cls: "chronos-stats-subheader",
      });
  
      createStatItem("Total Events", totalEvents.toString());
  
      if (majorLifeEvents > 0) {
        createStatItem("Major Life Events", majorLifeEvents.toString());
      }
  
      if (travelEvents > 0) {
        createStatItem("Travel Events", travelEvents.toString());
      }
  
      if (relationshipEvents > 0) {
        createStatItem("Relationship Events", relationshipEvents.toString());
      }
  
      if (educationCareerEvents > 0) {
        createStatItem("Education/Career", educationCareerEvents.toString());
      }
  
      // Add custom event types stats
      if (customEventCount > 0) {
        for (const eventType of this.plugin.settings.customEventTypes) {
          const count =
            this.plugin.settings.customEvents[eventType.name]?.length || 0;
          if (count > 0) {
            createStatItem(eventType.name, count.toString());
          }
        }
      }
    }
  
    // Make the panel draggable with improved bounds checking
    this.makeStatsPanelDraggable(statsContainer, headerContainer);
  }

  /**
   * Clean up when view is closed
   */
  async onClose(): Promise<void> {
    const contentEl = this.containerEl.children[1];
    contentEl.empty();
  }

  /**
   * Render the timeline view with all components
   */
  renderView(): void {
    // Clear content
    const contentEl = this.containerEl.children[1];
    contentEl.empty();

    // Create main container with flexbox layout
    const mainContainer = contentEl.createEl("div", {
      cls: "chronos-main-container",
    });

    // Create sidebar
    const sidebarEl = mainContainer.createEl("div", {
      cls: `chronos-sidebar ${this.isSidebarOpen ? "expanded" : "collapsed"}`,
    });

    // Add sidebar header with title and toggle
    const sidebarHeader = sidebarEl.createEl("div", {
      cls: "chronos-sidebar-header",
    });

    // Create title in sidebar header
    sidebarHeader.createEl("div", {
      cls: "chronos-title",
      text: "life in weeks",
    });

    // Create sidebar toggle as part of the sidebar itself
    const sidebarToggle = sidebarHeader.createEl("button", {
      cls: "chronos-sidebar-toggle",
      attr: {
        title: this.isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar",
      },
    });

    sidebarToggle.innerHTML = this.isSidebarOpen
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;

    sidebarToggle.addEventListener("click", () => {
      this.isSidebarOpen = !this.isSidebarOpen;

      // Save state to plugin settings
      this.plugin.settings.isSidebarOpen = this.isSidebarOpen;
      this.plugin.saveSettings();

      // Update UI
      sidebarEl.classList.toggle("collapsed", !this.isSidebarOpen);
      sidebarEl.classList.toggle("expanded", this.isSidebarOpen);

      // Update toggle icon
      sidebarToggle.innerHTML = this.isSidebarOpen
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;

      sidebarToggle.setAttribute(
        "title",
        this.isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"
      );

      // Toggle visibility of the collapsed toggle button
      if (collapsedToggle) {
        collapsedToggle.style.display = this.isSidebarOpen ? "none" : "block";
      }
    });

    // Controls section
    const controlsSection = sidebarEl.createEl("div", {
      cls: "chronos-sidebar-section",
    });
    controlsSection.createEl("h3", { text: "CONTROLS", cls: "section-header" });
    const controlsContainer = controlsSection.createEl("div", {
      cls: "chronos-controls",
    });

    // Plan future event button
    const planEventBtn = controlsContainer.createEl("button", {
      text: "Plan Event",
      cls: "chronos-btn chronos-btn-primary",
    });
    planEventBtn.addEventListener("click", () => {
      this.showAddEventModal();
    });

    // Manage event types button
    const manageTypesBtn = controlsContainer.createEl("button", {
      text: "Manage Event Types",
      cls: "chronos-btn chronos-btn-primary", // Same styling as Plan Event
    });
    manageTypesBtn.addEventListener("click", () => {
      const modal = new ManageEventTypesModal(this.app, this.plugin);
      modal.open();
    });

    // Visualization controls section
    const visualSection = sidebarEl.createEl("div", {
      cls: "chronos-sidebar-section",
    });
    visualSection.createEl("h3", {
      text: "VIEW OPTIONS",
      cls: "section-header",
    });

    const visualContainer = visualSection.createEl("div", {
      cls: "chronos-visual-controls",
    });

    // Zoom controls with 3-button layout
    const zoomControlsDiv = visualContainer.createEl("div", {
      cls: "chronos-zoom-controls",
    });

    // Zoom out button with SVG icon
    const zoomOutBtn = zoomControlsDiv.createEl("button", {
      cls: "chronos-btn chronos-zoom-button",
      attr: { title: "Zoom Out" },
    });
    zoomOutBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      <line x1="8" y1="11" x2="14" y2="11"></line>
    </svg>`;
    zoomOutBtn.addEventListener("click", () => {
      this.zoomOut();
    });

    // Add zoom level indicator
    const zoomInput = zoomControlsDiv.createEl("input", {
      cls: "chronos-zoom-input",
      attr: {
        type:   "number",
        min:    "10",
        max:    "500",
        step:   "1",
        value:  `${Math.round(this.plugin.settings.zoomLevel * 100)}`,
        title:  "Enter zoom % and press ↵",
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
      // reflect any clamping back
      input.value = `${Math.round(this.plugin.settings.zoomLevel * 100)}`;
    });

    // Zoom in button with SVG icon
    const zoomInBtn = zoomControlsDiv.createEl("button", {
      cls: "chronos-btn chronos-zoom-button",
      attr: { title: "Zoom In" },
    });
    zoomInBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      <line x1="11" y1="8" x2="11" y2="14"></line>
      <line x1="8" y1="11" x2="14" y2="11"></line>
    </svg>`;
    zoomInBtn.addEventListener("click", () => {
      this.zoomIn();
    });

    const statsButton = visualContainer.createEl("button", {
      cls: "chronos-btn chronos-stats-button",
      text: "Toggle Statistics",
      attr: { title: "Show/Hide Life Statistics" },
    });
    statsButton.addEventListener("click", () => {
      this.toggleStatistics();
    });

    // Fit to screen button
    const fitToScreenBtn = visualContainer.createEl("button", {
      cls: "chronos-btn chronos-fit-to-screen",
      text: "Fit to Screen",
      attr: { title: "Automatically adjust zoom to fit entire grid on screen" },
    });
    fitToScreenBtn.addEventListener("click", () => {
      this.fitToScreen();
    });

        // ── Cell Shape Dropdown ──
    visualContainer.createEl("div", {
      cls: "section-header",
      text: "Cell Shape"
    });
    
    // Select
    const shapeSelect = visualContainer.createEl("select", {
      cls: "chronos-select"
    });
    ["square", "circle", "diamond"].forEach((opt) => {
      const option = shapeSelect.createEl("option", {
        attr: { value: opt },
        text: opt.charAt(0).toUpperCase() + opt.slice(1)
      });
      if (this.plugin.settings.cellShape === opt) {
        option.selected = true;
      }
   });
    shapeSelect.addEventListener("change", async () => {
      this.plugin.settings.cellShape = shapeSelect.value as any;
      await this.plugin.saveSettings();
      // Re-render grid with new shape
      this.updateZoomLevel();
        });

    // ── Grid Orientation Toggle ──
    visualContainer.createEl("div", {
      cls: "section-header",
      text: "Grid Orientation"
    });
    
    // Orientation toggle button
    const orientationBtn = visualContainer.createEl("button", {
      cls: "chronos-btn chronos-orientation-button",
      text: this.plugin.settings.gridOrientation === 'landscape' 
        ? "Switch to Portrait" 
        : "Switch to Landscape",
      attr: { 
        title: this.plugin.settings.gridOrientation === 'landscape'
          ? "Display years as rows, weeks as columns" 
          : "Display years as columns, weeks as rows" 
      },
    });
    
    orientationBtn.addEventListener("click", async () => {
      // Toggle the orientation
      this.plugin.settings.gridOrientation = 
        this.plugin.settings.gridOrientation === 'landscape' ? 'portrait' : 'landscape';
      
      // Save settings
      await this.plugin.saveSettings();
      
      // Update button text
      orientationBtn.textContent = this.plugin.settings.gridOrientation === 'landscape' 
        ? "Switch to Portrait" 
        : "Switch to Landscape";
      
      orientationBtn.setAttribute("title", this.plugin.settings.gridOrientation === 'landscape'
        ? "Display years as rows, weeks as columns" 
        : "Display years as columns, weeks as rows");
      
      // Re-render the grid with new orientation
      this.updateZoomLevel();
    });

    // Legend section (vertical)
    const legendSection = sidebarEl.createEl("div", {
      cls: "chronos-sidebar-section",
    });
    legendSection.createEl("h3", { text: "LEGEND", cls: "section-header" });
    const legendEl = legendSection.createEl("div", { cls: "chronos-legend" });

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

    // Add standard legend items
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

    // Footer in sidebar
    sidebarEl.createEl("div", {
      cls: "chronos-footer",
      text: this.plugin.settings.quote,
    });

    // Create content area
    const contentAreaEl = mainContainer.createEl("div", {
      cls: "chronos-content-area",
    });

    // Always create collapsed sidebar indicator/toggle (but hide it when sidebar is open)
    const collapsedToggle = contentAreaEl.createEl("button", {
      cls: "chronos-collapsed-toggle",
      attr: { title: "Expand Sidebar" },
    });
    collapsedToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;
    collapsedToggle.addEventListener("click", () => {
      this.isSidebarOpen = true;

      // Save state to plugin settings
      this.plugin.settings.isSidebarOpen = true;
      this.plugin.saveSettings();

      // Update the view without full re-render
      sidebarEl.classList.remove("collapsed");
      sidebarEl.classList.add("expanded");
      collapsedToggle.style.display = "none";

      // Update sidebar toggle icon
      const sidebarToggle = sidebarEl.querySelector(".chronos-sidebar-toggle");
      if (sidebarToggle) {
        sidebarToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`;
        sidebarToggle.setAttribute("title", "Collapse Sidebar");
      }
    });

    // Show/hide the toggle button based on sidebar state
    collapsedToggle.style.display = this.isSidebarOpen ? "none" : "block";

    // Create the view container
    const viewEl = contentAreaEl.createEl("div", { cls: "chronos-view" });

    // Render the weeks grid
    this.renderWeeksGrid(viewEl);
  }

  /**
   * Show modal for adding an event
   */
  showAddEventModal(): void {
    const modal = new ChronosEventModal(this.app, this.plugin);
    modal.open();
  }

/**
 * Zoom in the grid view
 */
zoomIn() {
  // Get the current zoom level
  const currentZoom = this.plugin.settings.zoomLevel;
  
  // Check if the current zoom is already at a multiple of 0.1
  const isMultipleOfTen = Math.abs(currentZoom * 10 - Math.round(currentZoom * 10)) < 0.001;
  
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
  const isMultipleOfTen = Math.abs(currentZoom * 10 - Math.round(currentZoom * 10)) < 0.001;
  
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
      ".chronos-content-area"
    ) as HTMLElement;
    const viewEl = contentArea.querySelector(".chronos-view") as HTMLElement;
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
      ".chronos-content-area"
    ) as HTMLElement;
    const viewEl = contentArea.querySelector(".chronos-view") as HTMLElement;
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
    const gridEl = viewEl.querySelector(".chronos-grid") as HTMLElement;
    const decadeMarkers = viewEl.querySelector(
      ".chronos-decade-markers"
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
    const zoomInput = this.containerEl.querySelector(".chronos-zoom-input") as HTMLInputElement;
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
    const viewEl = contentEl.querySelector(".chronos-view");
    if (viewEl instanceof HTMLElement) {
      const gridEl = viewEl.querySelector(".chronos-grid");
      const decadeMarkers = viewEl.querySelector(".chronos-decade-markers");
      const verticalMarkers = viewEl.querySelector(".chronos-vertical-markers");

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
   * Render the main weeks grid visualization
   * @param container - Container to render grid in
   */
  renderWeeksGrid(container: HTMLElement): void {
    container.empty();

    // Get the CSS variables for positioning and styling
    const root = document.documentElement;
    const baseSize =
      parseInt(getComputedStyle(root).getPropertyValue("--base-cell-size")) ||
      16;
    const cellSize = Math.round(baseSize * this.plugin.settings.zoomLevel);
    // Apply the zoomed cell size to the CSS variable
    root.style.setProperty("--cell-size", `${cellSize}px`);
    const cellGap =
      parseInt(getComputedStyle(root).getPropertyValue("--cell-gap")) || 2;
    const leftOffset =
      parseInt(getComputedStyle(root).getPropertyValue("--left-offset")) || 70;
    const topOffset =
      parseInt(getComputedStyle(root).getPropertyValue("--top-offset")) || 50;
    const regularGap = cellGap; // Store the regular gap size



    
// Create decade markers container (horizontal markers above the grid)
if (this.plugin.settings.showDecadeMarkers) {
  const isPortrait = this.plugin.settings.gridOrientation === 'portrait';
  const decadeMarkersContainer = container.createEl("div", {
    cls: `chronos-decade-markers ${isPortrait ? 'portrait-mode' : ''}`,
  });
  
  if (!isPortrait) {
    decadeMarkersContainer.style.left = `${leftOffset}px`;
  }
  
  // Add decade markers starting from 10 (skipping 0)
// Create decade markers container (horizontal markers above the grid)
if (this.plugin.settings.showDecadeMarkers) {
  const isPortrait = this.plugin.settings.gridOrientation === 'portrait';
  const decadeMarkersContainer = container.createEl("div", {
    cls: `chronos-decade-markers ${isPortrait ? 'portrait-mode' : ''}`,
  });
  
  if (!isPortrait) {
    decadeMarkersContainer.style.left = `${leftOffset}px`;
  }
  
// Add decade markers starting from 10 (skipping 0)
for (let decade = 10; decade <= this.plugin.settings.lifespan; decade += 10) {
  const marker = decadeMarkersContainer.createEl("div", {
    cls: `chronos-decade-marker ${isPortrait ? 'portrait-mode' : ''}`, 
    text: decade.toString(),
  });

  // Position each decade marker using the calculateYearPosition method
  marker.style.position = "absolute";
  
  // Calculate the position of last year of previous decade (e.g., year 9 for marker "10")
  const lastYearOfPreviousDecade = decade - 1;
  
  // Get position of this year - this will be the position of the column we want to place the marker above
  const decadePosition = this.plugin.calculateYearPosition(
    lastYearOfPreviousDecade, 
    cellSize, 
    regularGap
  );
  
  // Position marker at the CENTER of the column, not past it
  const leftPosition = decadePosition + cellSize/2;

      if (isPortrait) {
        marker.style.top = `${leftPosition + 40}px`;
        marker.style.left = `${topOffset * 0.85}px`; 
        marker.style.transform = "translate(-50%, -50%)"; // Keep centered
      } else {
        marker.style.left = `${leftPosition}px`;
        marker.style.top = `${topOffset / 2}px`;
        marker.style.transform = "translate(-50%, -50%)";
      }
    }
  }
}
    // Add birthday cake marker (independent of month markers)
    if (this.plugin.settings.showBirthdayMarker) {
      const birthdayDate = new Date(this.plugin.settings.birthday);
      const birthMonth = birthdayDate.getMonth();
      const birthDay = birthdayDate.getDate();
      const birthYear = birthdayDate.getFullYear();
      const birthMonthName = MONTH_NAMES[birthMonth];

      const birthdayMarkerContainer = container.createEl("div", {
        cls: "chronos-birthday-marker-container",
      });

      // Position the container near the grid
      birthdayMarkerContainer.style.position = "absolute";
      birthdayMarkerContainer.style.zIndex = "15"; // Ensure visibility above other elements

      // Create cake icon for birthday
      const cakeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f48fb1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v2"/><path d="M12 8v2"/><path d="M17 8v2"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>`;

      const cakeEl = birthdayMarkerContainer.createEl("div", {
        cls: "birthday-cake-marker",
      });

      cakeEl.innerHTML = cakeSvg;
      cakeEl.setAttribute(
        "title",
        `${birthMonthName} ${birthDay}, ${birthYear} (Your Birthday)`
      );
    }

      // Create markers container with structured layout
      const isPortrait = this.plugin.settings.gridOrientation === 'portrait';
      const markersContainer = container.createEl("div", {
        cls: `chronos-vertical-markers ${isPortrait ? 'portrait-mode' : ''}`,
      });

      // First, create the separate containers for week and month markers
      const weekMarkersContainer = markersContainer.createEl("div", {
        cls: "chronos-week-markers",
      });

      const monthMarkersContainer = markersContainer.createEl("div", {
        cls: "chronos-month-markers",
      });

// Add week markers (10, 20, 30, 40, 50) if enabled
if (this.plugin.settings.showWeekMarkers) {
  for (let week = 0; week <= 50; week += 10) {
    if (week === 0) continue; // Skip 0 to start with 10

    const marker = weekMarkersContainer.createEl("div", {
      cls: `chronos-week-marker ${isPortrait ? 'portrait-mode' : ''}`,
      text: week.toString(),
    });

    // Calculate the exact position - align to grid
    const position = week * (cellSize + cellGap) + cellSize / 2 - (cellSize + cellGap);
    if (isPortrait) {
      marker.style.left = `${position + 10}px`;
      marker.style.top = "- 50px"; // Change this value to move markers down (larger number) or up (smaller number)
      marker.style.right = "auto"; // Adjust right position for portrait mode
      marker.style.transform = "translateY(-110%)";
      marker.style.transformOrigin = "left center";
    } else {
      marker.style.top = `${position}px`;
      marker.style.left = "auto";
      marker.style.right = "4px";
    }
  }

      }

    // Add month markers if enabled
    if (this.plugin.settings.showMonthMarkers) {
      const birthdayDate = new Date(this.plugin.settings.birthday);
      const birthMonth = birthdayDate.getMonth();
      const birthDay = birthdayDate.getDate();
      const birthYear = birthdayDate.getFullYear();
      const birthMonthName = MONTH_NAMES[birthMonth];

      // Calculate which week of the month the birthday falls in
      // First, get first day of birth month
      const firstDayOfBirthMonth = new Date(birthYear, birthMonth, 1);

      // Calculate days between first of month and birthday
      const daysBetween =
        (birthdayDate.getTime() - firstDayOfBirthMonth.getTime()) /
        (1000 * 60 * 60 * 24);

      // Calculate which week of the month (0-indexed) the birthday falls in
      const birthWeekOfMonth = Math.floor(daysBetween / 7);

      // Now calculate the position for the birth month marker
      // If birthday is in week 3 of the month (0-indexed), place month marker at week 51 (second-to-last row)
      // If birthday is in week 2 of the month, place month marker at week 0 (last row)
      // If birthday is in week 1 of the month, place month marker at week 1 (first row)
      const birthMonthMarkerWeek = (52 - birthWeekOfMonth) % 52;

      // Calculate month markers from the plugin
      const monthMarkers = this.plugin.calculateMonthMarkers(
        birthdayDate,
        this.plugin.settings.lifespan,
        this.plugin.settings.monthMarkerFrequency
      );

      // Create a map to store one marker per month
      const monthMarkersMap = new Map<
        number,
        {
          label: string;
          weekIndex: number;
          isFirstOfYear: boolean;
          fullLabel: string;
          monthNumber?: number;
        }
      >();

      // Process all markers to find the best one for each month
      for (const marker of monthMarkers) {
        const monthIndex = MONTH_NAMES.indexOf(marker.label);
        if (monthIndex === -1) continue; // Skip if not a valid month

        // Skip if this is the birth month - we'll handle it separately
        if (monthIndex === birthMonth) continue;

        // Calculate the actual week position within the grid (0-51)
        const weekPosition = marker.weekIndex % 52;

        // Only add this month if we haven't seen it yet
        if (!monthMarkersMap.has(monthIndex)) {
          monthMarkersMap.set(monthIndex, {
            label: marker.label,
            weekIndex: weekPosition,
            isFirstOfYear: marker.isFirstOfYear,
            fullLabel: marker.fullLabel,
            monthNumber: marker.monthNumber
          });
        }
      }

      // Manually add the birth month marker at the calculated position
      monthMarkersMap.set(birthMonth, {
        label: birthMonthName,
        weekIndex: birthMonthMarkerWeek,
        isFirstOfYear: birthMonth === 0, // January = true
        fullLabel: `${birthMonthName} ${birthYear} (Birth Month)`,
        monthNumber: birthMonth
      });

// Render all month markers
for (const [monthIndex, marker] of monthMarkersMap.entries()) {
  // Create marker element
  const markerEl = monthMarkersContainer.createEl("div", {
    cls: `chronos-month-marker ${marker.isFirstOfYear ? "first-of-year" : ""} ${monthIndex === birthMonth ? "birth-month" : ""} ${isPortrait ? 'portrait-mode' : ''}`,
  });
  
  // Add the month name
  markerEl.textContent = marker.label;
  
  // Position the marker based on orientation
  if (isPortrait) {
    if (marker.monthNumber !== undefined) {
      // Calculate position based on month number for even spacing
      const weekPosition = marker.weekIndex % 52;
      markerEl.style.left = `${weekPosition * (cellSize + cellGap) + (cellSize + cellGap) + cellSize / 2}px`;
      markerEl.style.top = `10px`; // Fixed distance from the top
      markerEl.style.transform = "translateX(-50%)"; // Center marker on its position
    }
    else {
      // Original landscape positioning logic
      markerEl.style.top = `${marker.weekIndex * (cellSize + cellGap) + cellSize / 2}px`;
    }

    
    markerEl.style.top = `${leftOffset - 80}px`;
    markerEl.style.transform = "translateX(0)"; // Changed from 110% to prevent overlap
  } else {
    markerEl.style.top = `${marker.weekIndex * (cellSize + cellGap) + cellSize / 2}px`;
  }
  
  // Special styling for birth month
  if (monthIndex === birthMonth && !markerEl.innerHTML.includes("svg")) {
    markerEl.style.color = "#e91e63"; // Pink color
    markerEl.style.fontWeight = "500";
  }
}
    }

    // Create the grid container
    const gridEl = container.createEl("div", { cls: "chronos-grid" });
    gridEl.toggleClass('shape-circle', this.plugin.settings.cellShape === 'circle');
    gridEl.toggleClass('shape-diamond', this.plugin.settings.cellShape === 'diamond');


    // Use display block instead of grid, as we'll manually position each cell
    gridEl.style.display = "block";
    gridEl.style.position = "absolute";
    gridEl.style.top = `${topOffset}px`;
    gridEl.style.left = `${leftOffset}px`;

    const now = new Date();
    const birthdayDate = new Date(this.plugin.settings.birthday);
    const ageInWeeks = this.plugin.getFullWeekAge(birthdayDate, now);
    const currentWeekKey = this.plugin.getWeekKeyFromDate(now);


// For each year of life (column)
for (let year = 0; year < this.plugin.settings.lifespan; year++) {
  // Get calendar year to display (birth year + year)
  const displayYear = birthdayDate.getFullYear() + year;
  
  // Get birthday week information for this year
  const birthdayWeekInfo = this.plugin.getBirthdayWeekForYear(displayYear);
  
  // For each week in this year
  for (let week = 0; week < 52; week++) {
    const weekIndex = year * 52 + week;
    const cell = gridEl.createEl("div", { cls: "chronos-grid-cell" });
    
    // Calculate the date for this week relative to the birthday week start
    const cellDate = new Date(birthdayWeekInfo.weekStart);
    cellDate.setDate(cellDate.getDate() + week * 7);
          
        // Get calendar information for display
        const cellYear = cellDate.getFullYear();
        const cellWeek = this.plugin.getISOWeekNumber(cellDate);
        const weekKey = `${cellYear}-W${cellWeek.toString().padStart(2, "0")}`;
        cell.dataset.weekKey = weekKey;
    
      // Calculate the date range directly from the actual cell date
      const firstDayOfWeek = new Date(cellDate);
      const lastDayOfWeek = new Date(cellDate);
      lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
        
      // Format the dates
      const formatDate = (date: Date): string => {
        const months = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ];
        return `${months[date.getMonth()]} ${date.getDate()}`;
      };
        
      const dateRange = `${formatDate(firstDayOfWeek)} - ${formatDate(lastDayOfWeek)}`;
        
      cell.setAttribute(
        "title",
        `Week ${cellWeek}, ${cellYear}\n${dateRange}`
      );
    
        // Position the cell with absolute positioning
        cell.style.position = "absolute";
    
        // Calculate year position with decade spacing
        const yearPos = this.plugin.calculateYearPosition(
          year,
          cellSize,
          regularGap
        );
    
        // Calculate week position (simple)
        const weekPos = week * (cellSize + regularGap);
    
        // Position based on orientation
        if (this.plugin.settings.gridOrientation === 'landscape') {
          // Landscape mode (default): years as columns, weeks as rows
          cell.style.left = `${yearPos}px`;
          cell.style.top = `${weekPos}px`;
        } else {
          // Portrait mode: years as rows, weeks as columns
          cell.style.left = `${weekPos}px`;
          cell.style.top = `${yearPos}px`;
        }

        // Explicitly set width and height (previously handled by grid)
        cell.style.width = `${cellSize}px`;
        cell.style.height = `${cellSize}px`;

        // Color coding (past, present, future)
        const isCurrentWeek = weekKey === currentWeekKey;
        const hasEvent = this.applyEventStyling(cell, weekKey);
        
        // Add appropriate class regardless of color
        if (isCurrentWeek) {
          cell.addClass("present");
        } else if (cellDate < now) {
          cell.addClass("past");
        } else {
          cell.addClass("future");
        }
        
        // Only apply base color coding if there's no event
        if (!hasEvent) {
          if (isCurrentWeek) {
            cell.style.backgroundColor = this.plugin.settings.presentCellColor;
          } else if (cellDate < now) {
            cell.style.backgroundColor = this.plugin.settings.pastCellColor;
          } else {
            cell.style.backgroundColor = this.plugin.settings.futureCellColor;
          }
        }
      
        // Add click and context menu events to the cell
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

        // Add context menu (right-click) event for manual fill
        cell.addEventListener("contextmenu", (event) => {
          // Only allow manual fill if auto-fill is disabled and for future weeks
          if (this.plugin.settings.enableAutoFill || weekIndex <= ageInWeeks) {
            return;
          }

          // Prevent default context menu
          event.preventDefault();

          // Toggle filled status
          const filledIndex = this.plugin.settings.filledWeeks.indexOf(weekKey);

          if (filledIndex >= 0) {
            // Remove from filled weeks
            this.plugin.settings.filledWeeks.splice(filledIndex, 1);
            cell.removeClass("filled-week");
          } else {
            // Add to filled weeks
            this.plugin.settings.filledWeeks.push(weekKey);
            cell.addClass("filled-week");
            cell.style.backgroundColor = "#8bc34a"; // Light green for filled weeks
          }

          // Save settings
          this.plugin.saveSettings();
        });
      }
    }
  }

/**
 * Apply styling for events to a cell
 * @param cell - Cell element to style
 * @param weekKey - Week key to check for events (YYYY-WXX)
 * @returns Whether an event was applied to this cell
 */
applyEventStyling(cell: HTMLElement, weekKey: string): boolean {
  // Check if we have an event in the note frontmatter (new functionality)
  const checkNoteEvent = async () => {
    try {
      const eventData = await this.plugin.getEventFromNote(weekKey);
      if (eventData && eventData.event) {
        // Apply styling based on note frontmatter
        cell.classList.add("event");
        cell.classList.add("major-life-event");

        // Add specific event type class based on type
        switch (eventData.type) {
          case "Major Life":
            cell.classList.add("major-life-event");
            break;
          case "Travel":
            cell.classList.add("travel-event");
            break;
          case "Relationship":
            cell.classList.add("relationship-event");
            break;
          case "Education/Career":
            cell.classList.add("education-career-event");
            break;
        }
              
        // Apply color if specified in frontmatter
        if (eventData.color) {
          cell.style.backgroundColor = eventData.color;
          cell.style.border = `2px solid ${eventData.color}`;
        } else {
          // Default color based on type
          let defaultColor = "#4CAF50"; // Default to green (Major Life)
          
          switch (eventData.type) {
            case "Major Life":
              defaultColor = "#4CAF50";
              break;
            case "Travel":
              defaultColor = "#2196F3";
              break;
            case "Relationship":
              defaultColor = "#E91E63";
              break;
            case "Education/Career":
              defaultColor = "#9C27B0";
              break;
            default:
              // Check if it's a custom type
              const customType = this.plugin.settings.customEventTypes.find(
                t => t.name === eventData.type
              );
              if (customType) {
                defaultColor = customType.color;
              }
          }
          
          cell.style.backgroundColor = defaultColor;
          cell.style.border = `2px solid ${defaultColor}`;
        }
        
        // Build tooltip
        const eventName = eventData.name || eventData.event;
        const eventDesc = eventData.description ? `: ${eventData.description}` : '';
        const prevTitle = cell.getAttribute("title") || "";
        
        // Include date range info if present
        let dateInfo = "";
        if (eventData.startDate && eventData.endDate) {
          dateInfo = ` (${eventData.startDate} to ${eventData.endDate})`;
        } else if (eventData.startDate) {
          dateInfo = ` (${eventData.startDate})`;
        }
        
        cell.setAttribute(
          "title",
          `${eventName}${eventDesc}${dateInfo}${prevTitle ? '\n' + prevTitle : ''}`
        );
        
        return true;
      }
      return false;
    } catch (error) {
      console.log("Error checking note event:", error);
      return false;
    }
  };

  // Schedule the async check to happen soon (we can't make this method async without breaking a lot of code)
  setTimeout(async () => {
    if (await checkNoteEvent()) {
      // Force a refresh of any display properties
      const currBg = cell.style.backgroundColor;
      cell.style.backgroundColor = "transparent";
      cell.style.backgroundColor = currBg;
    }
  }, 0);

  // Continue with existing functionality (fallback) - helper to check for events and apply styling
  const applyEventStyle = (
    events: string[],
    defaultColor: string,
    defaultDesc: string
  ): boolean => {
    // First, handle single-day events (format: weekKey:description)
    // Single‑week events (format: weekKey:description)
    const singleEvents = events.filter(e => {
      const parts = e.split(":");
      return parts.length === 2 && parts[0].includes("W");
    });

    for (const ev of singleEvents) {
      const [eventWeekKey, description] = ev.split(":");

      // Direct string match: if the event's weekKey equals this cell's weekKey
      if (eventWeekKey === weekKey) {
        // Apply styles
        cell.classList.add("event");
        cell.style.backgroundColor = defaultColor;
        cell.style.border = `2px solid ${defaultColor}`;

        // Build tooltip
        const eventDesc = description || defaultDesc;
        const prevTitle = cell.getAttribute("title") || "";
        cell.setAttribute(
          "title",
          `${eventDesc} (${eventWeekKey})\n${prevTitle}`
        );

        return true;
      }
    }
    
    // Next, handle range events (format: startWeek:endWeek:description)
    const rangeEvents = events.filter(e => {
      const parts = e.split(":");
      return parts.length >= 3 && parts[0].includes("W") && parts[1].includes("W");
    });
    
    for (const rangeEvent of rangeEvents) {
      const [startWeekKey, endWeekKey, description] = rangeEvent.split(":");
      
      // Skip if the format is invalid
      if (!startWeekKey || !endWeekKey) continue;
      
      // Parse the week numbers
      const startYear = parseInt(startWeekKey.split("-W")[0], 10);
      const startWeek = parseInt(startWeekKey.split("-W")[1], 10);
      const endYear = parseInt(endWeekKey.split("-W")[0], 10);
      const endWeek = parseInt(endWeekKey.split("-W")[1], 10);
      
      // Parse current cell week
      const cellYear = parseInt(weekKey.split("-W")[0], 10);
      const cellWeek = parseInt(weekKey.split("-W")[1], 10);
      
      // Create actual dates to compare
      const startDate = new Date(startYear, 0, 1);
      startDate.setDate(startDate.getDate() + (startWeek - 1) * 7);
      
      const endDate = new Date(endYear, 0, 1);
      endDate.setDate(endDate.getDate() + (endWeek - 1) * 7 + 6); // Add 6 to include full end week
      
      const cellDate = new Date(cellYear, 0, 1);
      cellDate.setDate(cellDate.getDate() + (cellWeek - 1) * 7);
      
      // Check if current week falls within the range using actual dates
      const isInRange = cellDate >= startDate && cellDate <= endDate;
      
      if (isInRange) {
        // Apply styles
        cell.addClass("event");
        cell.style.backgroundColor = defaultColor;
        cell.style.borderColor = defaultColor;
        cell.style.borderWidth = "2px";
        cell.style.borderStyle = "solid";
        
        const eventDesc = description || defaultDesc;
        const currentTitle = cell.getAttribute("title") || "";
        cell.setAttribute(
          "title",
          `${eventDesc} (${startWeekKey} to ${endWeekKey})\n${currentTitle}`
        );
        return true;
      }
    }
    
    return false;
  };

  // Apply event styling for each event type
  const hasGreenEvent = applyEventStyle(
    this.plugin.settings.greenEvents,
    "#4CAF50",
    "Major Life Event"
  );
  if (hasGreenEvent) return true;

  const hasBlueEvent = applyEventStyle(
    this.plugin.settings.blueEvents,
    "#2196F3",
    "Travel"
  );
  if (hasBlueEvent) return true;

  const hasPinkEvent = applyEventStyle(
    this.plugin.settings.pinkEvents,
    "#E91E63",
    "Relationship"
  );
  if (hasPinkEvent) return true;

  const hasPurpleEvent = applyEventStyle(
    this.plugin.settings.purpleEvents,
    "#9C27B0",
    "Education/Career"
  );
  if (hasPurpleEvent) return true;

  // Only check custom events if no built-in event was found
  if (this.plugin.settings.customEvents) {
    for (const [typeName, events] of Object.entries(
      this.plugin.settings.customEvents
    )) {
      const customType = this.plugin.settings.customEventTypes.find(
        (type) => type.name === typeName
      );

      if (customType && events.length > 0) {
        const hasCustomEvent = applyEventStyle(events, customType.color, typeName);
        if (hasCustomEvent) return true;
      }
    }
  }

  // Highlight future events within next 6 months
  const now = new Date();
  const cellDate = new Date();
  const [cellYearStr, weekNumStr] = weekKey.split("-W");
  cellDate.setFullYear(parseInt(cellYearStr, 10));
  cellDate.setDate(1 + (parseInt(weekNumStr, 10) - 1) * 7);

  if (
    cellDate > now &&
    cellDate < new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000) &&
    cell.classList.contains("event")
  ) {
    cell.addClass("future-event-highlight");
  }

  // Apply filled week styling if applicable
  if (this.plugin.settings.filledWeeks.includes(weekKey) && weekKey !== this.plugin.getWeekKeyFromDate(new Date())) {
    cell.addClass("filled-week");
    // Only change color if no event is on this week
    if (!cell.classList.contains("event")) {
      cell.style.backgroundColor = "#8bc34a"; // Light green for filled weeks
    }
  }
  return false;
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
  plugin: ChronosTimelinePlugin;

  /** Callback to refresh views when settings change */
  refreshCallback: () => void;

  /**
   * Create a new marker settings modal
   * @param app - Obsidian App instance
   * @param plugin - ChronosTimelinePlugin instance
   * @param refreshCallback - Callback to refresh views
   */
  constructor(
    app: App,
    plugin: ChronosTimelinePlugin,
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

    // Month markers setting
    new Setting(contentEl)
      .setName("Month Markers")
      .setDesc("Show month markers along the left side (Jan, Feb, Mar, ...)")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showMonthMarkers)
          .onChange(async (value) => {
            this.plugin.settings.showMonthMarkers = value;
            await this.plugin.saveSettings();
            this.refreshCallback();
          });
      });

    // Month marker frequency dropdown
    const monthMarkerSetting = new Setting(contentEl)
      .setName("Month Marker Frequency")
      .setDesc("Choose how often month markers appear")
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

    // Show or hide frequency dropdown based on month markers toggle
    monthMarkerSetting.setClass("month-marker-frequency");
    if (!this.plugin.settings.showMonthMarkers) {
      monthMarkerSetting.settingEl.style.display = "none";
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

/**
 * Modal for managing custom event types
 */
class ManageEventTypesModal extends Modal {
  /** Reference to the main plugin */
  plugin: ChronosTimelinePlugin;

  /**
   * Create a new event types modal
   * @param app - Obsidian App instance
   * @param plugin - ChronosTimelinePlugin instance
   */
  constructor(app: App, plugin: ChronosTimelinePlugin) {
    super(app);
    this.plugin = plugin;
  }

  /**
   * Build the modal UI when opened
   */
  onOpen(): void {
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

    // Close button
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

  /**
   * Render list of existing event types
   * @param container - Container element
   */
  renderExistingTypes(container: HTMLElement): void {
    // Remove existing list if present
    const typesList = container.querySelector(".existing-types-list");
    if (typesList) typesList.remove();

    const newList = container.createEl("div", { cls: "existing-types-list" });

    // Built-in types section
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

    // Custom types section
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

  /**
   * Show modal for editing an event type
   * @param type - Custom event type to edit
   */
  showEditTypeModal(type: CustomEventType): void {
    const modal = new Modal(this.app);
    modal.titleEl.setText(`Edit Event Type: ${type.name}`);

    const contentEl = modal.contentEl;

    // Name field
    const nameContainer = contentEl.createDiv({ cls: "edit-name-container" });
    const nameLabel = nameContainer.createEl("label");
    nameLabel.textContent = "Name";
    nameLabel.htmlFor = "edit-type-name";

    const nameInput = nameContainer.createEl("input");
    nameInput.type = "text";
    nameInput.value = type.name;
    nameInput.id = "edit-type-name";

    // Color field
    const colorContainer = contentEl.createDiv({ cls: "edit-color-container" });
    const colorLabel = colorContainer.createEl("label");
    colorLabel.textContent = "Color";
    colorLabel.htmlFor = "edit-type-color";

    const colorInput = colorContainer.createEl("input");
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

      if (
        newName !== type.name &&
        this.plugin.settings.customEventTypes.some((t) => t.name === newName)
      ) {
        new Notice("An event type with this name already exists");
        return;
      }

      // Update name reference in events if changed
      if (newName !== type.name) {
        this.plugin.settings.customEvents[newName] =
          this.plugin.settings.customEvents[type.name] || [];
        delete this.plugin.settings.customEvents[type.name];
      }

      // Update event type
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

  /**
   * Clean up on modal close
   */
  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// -----------------------------------------------------------------------
// SETTINGS TAB CLASS
// -----------------------------------------------------------------------

/**
 * Settings tab for configuring the plugin
 */
class ChronosSettingTab extends PluginSettingTab {
  /** Reference to the main plugin */
  plugin: ChronosTimelinePlugin;

  /**
   * Create a new settings tab
   * @param app - Obsidian App instance
   * @param plugin - ChronosTimelinePlugin instance
   */
  constructor(app: App, plugin: ChronosTimelinePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Build the settings UI
   */
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
    .setName("Notes folder")
    .setDesc("Select the folder where your weekly notes live")
    .addSearch((search) => {
      search
        .setPlaceholder("Pick a folder…")
        .setValue(this.plugin.settings.notesFolder)
        .onChange(async (value) => {
          this.plugin.settings.notesFolder = value;
          await this.plugin.saveSettings();
        });
      new FolderSuggest(this.app, search.inputEl);
    });

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

    // Marker visibility section
    containerEl.createEl("h3", { text: "Marker Visibility" });

    // Decade markers setting
    new Setting(containerEl)
      .setName("Decade Markers")
      .setDesc("Show decade markers along the top (0, 10, 20, ...)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showDecadeMarkers)
          .onChange(async (value) => {
            this.plugin.settings.showDecadeMarkers = value;
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );

    // Week markers setting
    new Setting(containerEl)
      .setName("Week Markers")
      .setDesc("Show week markers along the left (10, 20, 30, ...)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showWeekMarkers)
          .onChange(async (value) => {
            this.plugin.settings.showWeekMarkers = value;
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );

    // Month markers setting
    new Setting(containerEl)
      .setName("Month Markers")
      .setDesc("Show month markers along the left side (Jan, Feb, Mar, ...)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showMonthMarkers)
          .onChange(async (value) => {
            this.plugin.settings.showMonthMarkers = value;
            await this.plugin.saveSettings();
            this.refreshAllViews();

            // Show/hide month marker frequency setting based on toggle state
            const freqSetting = containerEl.querySelector(
              ".month-marker-frequency"
            );
            if (freqSetting) {
              (freqSetting as HTMLElement).style.display = value
                ? "flex"
                : "none";
            }
          })
      );

    // Month marker frequency setting
    const freqSetting = new Setting(containerEl)
      .setName("Month Marker Frequency")
      .setDesc("Choose how often month markers appear")
      .setClass("month-marker-frequency")
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
            this.refreshAllViews();
          });
      });

    // Hide frequency setting if month markers are disabled
    if (!this.plugin.settings.showMonthMarkers) {
      freqSetting.settingEl.style.display = "none";
    }

    // Color settings section
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

    // Find the "Week Filling Options" section in your code
    containerEl.createEl("h3", { text: "Week Filling Options" });

    // Replace the existing toggles with this single toggle that handles both modes
    new Setting(containerEl)
      .setName("Enable Auto-Fill")
      .setDesc(
        "When enabled, automatically marks weeks as completed on a specific day. When disabled, you can manually mark weeks by right-clicking them."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableAutoFill)
          .onChange(async (value) => {
            this.plugin.settings.enableAutoFill = value;
            // If auto-fill is enabled, manual fill should be disabled
            this.plugin.settings.enableManualFill = !value;
            await this.plugin.saveSettings();

            // Show/hide day selector based on toggle state
            const daySelector = containerEl.querySelector(
              ".auto-fill-day-selector"
            );
            if (daySelector) {
              (daySelector as HTMLElement).style.display = value
                ? "flex"
                : "none";
            }

            // Add status indicator text
            const statusIndicator =
              containerEl.querySelector(".fill-mode-status");
            if (statusIndicator) {
              (statusIndicator as HTMLElement).textContent = value
                ? "Auto-fill is active. Weeks will be filled automatically."
                : "Manual fill is active. Right-click on future weeks to mark them as filled.";
            } else {
              const statusEl = containerEl.createEl("div", {
                cls: "fill-mode-status",
                text: value
                  ? "Auto-fill is active. Weeks will be filled automatically."
                  : "Manual fill is active. Right-click on future weeks to mark them as filled.",
              });
              statusEl.style.fontStyle = "italic";
              statusEl.style.marginTop = "5px";
              statusEl.style.color = "var(--text-muted)";
            }

            this.refreshAllViews();
          })
      );

    // Auto-fill day selector (keep this)
    const daySelector = new Setting(containerEl)
      .setName("Auto-Fill Day")
      .setDesc("Day of the week when auto-fill should occur")
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
        days.forEach((day, index) => {
          dropdown.addOption(index.toString(), day);
        });

        dropdown
          .setValue(this.plugin.settings.autoFillDay.toString())
          .onChange(async (value) => {
            this.plugin.settings.autoFillDay = parseInt(value);
            await this.plugin.saveSettings();
          });
      });

    // Hide day selector if auto-fill is disabled
    if (!this.plugin.settings.enableAutoFill) {
      daySelector.settingEl.style.display = "none";
    }

    // Add initial status indicator
    const statusEl = containerEl.createEl("div", {
      cls: "fill-mode-status",
      text: this.plugin.settings.enableAutoFill
        ? "Auto-fill is active. Weeks will be filled automatically."
        : "Manual fill is active. Right-click on future weeks to mark them as filled.",
    });
    statusEl.style.fontStyle = "italic";
    statusEl.style.marginTop = "5px";
    statusEl.style.color = "var(--text-muted)";

    // Event types management section
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

    // Clear event data section
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

    // Custom events clear button (only if there are custom event types)
    if (
      this.plugin.settings.customEventTypes &&
      this.plugin.settings.customEventTypes.length > 0
    ) {
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

      // Manual fill toggle
      new Setting(containerEl)
        .setName("Enable Manual Fill")
        .setDesc(
          "Allow manually marking weeks as filled by right-clicking on them"
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.enableManualFill)
            .onChange(async (value) => {
              this.plugin.settings.enableManualFill = value;
              await this.plugin.saveSettings();
              this.refreshAllViews();
            })
        );

      // Auto-fill toggle
      new Setting(containerEl)
        .setName("Enable Auto-Fill")
        .setDesc(
          "Automatically mark the current week as filled on a specific day"
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.enableAutoFill)
            .onChange(async (value) => {
              this.plugin.settings.enableAutoFill = value;
              await this.plugin.saveSettings();

              // Show/hide day selector based on toggle state
              const daySelector = containerEl.querySelector(
                ".auto-fill-day-selector"
              );
              if (daySelector) {
                (daySelector as HTMLElement).style.display = value
                  ? "flex"
                  : "none";
              }
            })
        );

      // Auto-fill day selector
      const daySelector = new Setting(containerEl)
        .setName("Auto-Fill Day")
        .setDesc("Day of the week when auto-fill should occur")
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
          days.forEach((day, index) => {
            dropdown.addOption(index.toString(), day);
          });

          dropdown
            .setValue(this.plugin.settings.autoFillDay.toString())
            .onChange(async (value) => {
              this.plugin.settings.autoFillDay = parseInt(value);
              await this.plugin.saveSettings();
            });
        });

      // Hide day selector if auto-fill is disabled
      if (!this.plugin.settings.enableAutoFill) {
        daySelector.settingEl.style.display = "none";
      }

      // Week start day setting
      new Setting(containerEl)
        .setName("Start Week On Monday")
        .setDesc("Use Monday as the first day of the week (instead of Sunday)")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.startWeekOnMonday)
            .onChange(async (value) => {
              this.plugin.settings.startWeekOnMonday = value;
              await this.plugin.saveSettings();
              this.refreshAllViews();
            })
        );

      // Clear filled weeks button
      new Setting(containerEl)
        .setName("Clear Filled Weeks")
        .setDesc("Remove all filled week markings")
        .addButton((button) => {
          button.setButtonText("Clear All").onClick(async () => {
            this.plugin.settings.filledWeeks = [];
            await this.plugin.saveSettings();
            this.refreshAllViews();
            new Notice("Cleared all filled weeks");
          });
        });

      // Zoom level setting
      new Setting(containerEl)
        .setName("Default Zoom Level")
        .setDesc(
          "Set the default zoom level for the timeline view (1.0 = 100%)"
        )
        .addSlider((slider) =>
          slider
            .setLimits(0.5, 3.0, 0.25)
            .setValue(this.plugin.settings.zoomLevel)
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.plugin.settings.zoomLevel = value;
              await this.plugin.saveSettings();
              this.refreshAllViews();
            })
        );

        new Setting(containerEl)
      .setName('Grid Orientation')
      .setDesc('Display years as columns/weeks as rows (landscape) or years as rows/weeks as columns (portrait)')
      .addDropdown(drop =>
        drop
          .addOption('landscape', 'Landscape (Default)')
          .addOption('portrait', 'Portrait')
          .setValue(this.plugin.settings.gridOrientation)
          .onChange(async (value) => {
            this.plugin.settings.gridOrientation = value as 'landscape' | 'portrait';
            await this.plugin.saveSettings();
            this.refreshAllViews();
          })
      );

        new Setting(containerEl)
  .setName('Cell Shape')
  .setDesc('Square, circle, or diamond.')
  .addDropdown(drop =>
    drop
      .addOption('square', 'Square')
      .addOption('circle', 'Circle')
      .addOption('diamond', 'Diamond')
      .setValue(this.plugin.settings.cellShape)
             .onChange(async (value) => {
                 this.plugin.settings.cellShape = value as 'square' | 'circle' | 'diamond';
                 await this.plugin.saveSettings();
                 // Re-render each open ChronOS Timeline view so the new shape takes effect
                 this.plugin.app.workspace
                   .getLeavesOfType(TIMELINE_VIEW_TYPE)
                   .forEach((leaf) => {
                     const view = leaf.view as ChronosTimelineView;
                 view.updateZoomLevel();
                  });
              })
            );
    }

    // Help tips section
    containerEl.createEl("h3", { text: "Tips" });
    containerEl.createEl("p", {
      text: "• Click on any week to create or open a note for that week",
    });
    containerEl.createEl("p", {
      text: "• Shift+Click on a week to add an event",
    });
    containerEl.createEl("p", {
      text: "• Use the 'Plan Event' button to mark significant life events (including date ranges)",
    });
    containerEl.createEl("p", {
      text: "• Create custom event types to personalize your timeline",
    });
    containerEl.createEl("p", {
      text: "• Use the 'Marker Settings' button to customize which timeline markers are visible",
    });
  }

  /**
   * Refresh all timeline views
   */
  refreshAllViews(): void {
    this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE).forEach((leaf) => {
      const view = leaf.view as ChronosTimelineView;
      view.renderView();
    });
  }
}
