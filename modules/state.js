// pinpoint - state
// shared mutable state for inspection engine

let hoveredElement = null;
let tooltip = null;
let detailPanel = null;
let isDetailPanelOpen = false;
let isActive = false;
let shadowRoot = null;
let shadowHost = null;
let rafPending = false;
let lastMouseEvent = null;

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let panelOffsetX = 0;
let panelOffsetY = 0;
let dragRafPending = false;

let viewportWidth = 0;
let viewportHeight = 0;
let tooltipWidth = 0;
let tooltipHeight = 0;
