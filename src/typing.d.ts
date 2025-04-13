// Custom typings to extend the View interface for our plugin
import { ItemView, WorkspaceLeaf } from "obsidian";

declare module "obsidian" {
  interface App {
    workspace: Workspace;
  }

  interface Workspace {
    getLeavesOfType(viewType: string): WorkspaceLeaf[];
    getLeaf(type?: string, direction?: string): WorkspaceLeaf;
    revealLeaf(leaf: WorkspaceLeaf): void;
  }
}
