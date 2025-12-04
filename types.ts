// cartographer - type definitions
// typescript interfaces for chrome extension architecture

// ============================================================================
// MESSAGE PROTOCOL (Background ↔ Content Script)
// ============================================================================

export type MessageAction = 'ACTIVATE' | 'DEACTIVATE';

export interface Message {
  action: MessageAction;
}

export interface MessageResponse {
  success: boolean;
  error?: string;
}

// ============================================================================
// STATE MANAGEMENT (chrome.storage.session)
// ============================================================================

export interface TabStateMap {
  [tabId: number]: boolean;
}

export interface StorageSchema {
  injectedTabs: number[];
  tabState: TabStateMap;
}

// ============================================================================
// SELECTOR GENERATION
// ============================================================================

export type SelectorPriority = 
  | 'id' 
  | 'data-attribute' 
  | 'aria-attribute' 
  | 'class' 
  | 'structural';

export interface SelectorResult {
  selector: string;
  priority: SelectorPriority;
  isUnique: boolean;
}

export interface SelectorOptions {
  /** Prefer data-* attributes over classes */
  preferDataAttributes?: boolean;
  /** Prefer ARIA attributes for semantic selectors */
  preferAria?: boolean;
  /** Maximum structural path depth */
  maxDepth?: number;
  /** Filter out classes matching pattern */
  excludeClassPattern?: RegExp;
}

// ============================================================================
// ELEMENT CAPTURE DATA
// ============================================================================

export interface ElementDimensions {
  width: number;
  height: number;
}

export interface ElementCaptureData {
  selector: string;
  dimensions: ElementDimensions;
  angularAttributes: string;
  domPath: string;
  tagName: string;
  className?: string;
  id?: string;
}

// ============================================================================
// ARIA ATTRIBUTES
// ============================================================================

export interface AriaAttribute {
  name: 'aria-label' | 'role' | 'aria-describedby' | 'aria-labelledby';
  value: string | null;
}

// ============================================================================
// MOUSE EVENT SNAPSHOT (for rAF throttling)
// ============================================================================

export interface MouseEventSnapshot {
  target: HTMLElement;
  clientX: number;
  clientY: number;
  altKey: boolean;
}

// ============================================================================
// CARTOGRAPHER CONFIG
// ============================================================================

export interface CartographerConfig {
  /** Enable console logging */
  debug?: boolean;
  /** Custom selector options */
  selectorOptions?: SelectorOptions;
  /** Highlight color (hex) */
  highlightColor?: string;
  /** Highlight opacity (0-1) */
  highlightOpacity?: number;
  /** Tooltip delay (ms) */
  tooltipDelay?: number;
}

// ============================================================================
// SHADOW DOM REFERENCES
// ============================================================================

export interface ShadowDOMRefs {
  shadowHost: HTMLElement;
  shadowRoot: ShadowRoot;
  tooltip: HTMLElement;
  detailPanel: HTMLElement;
}

// ============================================================================
// CHROME API TYPE EXTENSIONS
// ============================================================================

export interface ChromeTab extends chrome.tabs.Tab {
  id: number; // ensure id is always present
  url: string; // ensure url is always present
}

export interface ChromeMessage extends chrome.runtime.MessageSender {
  tab?: ChromeTab;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Nullable<T> = T | null;

export type AsyncVoid = Promise<void>;

export type EventHandler<T = Event> = (event: T) => void;

export type AsyncEventHandler<T = Event> = (event: T) => AsyncVoid;
