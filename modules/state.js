/**
 * Pinpoint - Application State
 * Central state management for the inspection engine
 */

let hoveredElement = null;
let tooltip = null;
let detailPanel = null;
let isDetailPanelOpen = false;
let isActive = false;
let shadowRoot = null;
let shadowHost = null;

let rafPending = false;
let lastMouseEvent = null;
