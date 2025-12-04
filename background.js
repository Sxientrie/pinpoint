/**
 * Pinpoint - Background Service Worker
 * 
 * Manages extension state, handles user interactions with the browser action icon,
 * and coordinates with content scripts via message passing. State is persisted in
 * chrome.storage.session to survive service worker termination.
 * 
 * @module background
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const RESTRICTED_PROTOCOLS = ['chrome://', 'chrome-extension://', 'edge://', 'about:'];
const ERROR_BADGE_DURATION_MS = 2000;
const BADGE_COLOR_ACTIVE = '#ef4444';
const BADGE_COLOR_ERROR = '#71717a';
const PING_TIMEOUT_MS = 500;

// ============================================================================
// IN-MEMORY STATE (with async storage backup)
// ============================================================================

/** @type {Set<number>} tabs with active inspection mode */
let activeTabs = new Set();

/** @type {Set<number>} tabs with injected content scripts */
let injectedTabs = new Set();

/** @type {Set<number>} tabs currently processing a click (mutex) */
const processingTabs = new Set();

/** @type {boolean} whether state has been initialized from storage */
let stateInitialized = false;

/**
 * Initializes in-memory state from chrome.storage.session.
 * Called on first access or after SW wake-up.
 * @returns {Promise<void>}
 */
async function ensureStateInitialized() {
  if (stateInitialized) return;
  
  const result = await chrome.storage.session.get(['activeTabs', 'injectedTabs']);
  activeTabs = new Set(result.activeTabs || []);
  injectedTabs = new Set(result.injectedTabs || []);
  stateInitialized = true;
}

/**
 * Persists current in-memory state to storage (fire-and-forget)
 * @returns {void}
 */
function syncStateToStorage() {
  chrome.storage.session.set({
    activeTabs: Array.from(activeTabs),
    injectedTabs: Array.from(injectedTabs),
  });
}

/**
 * Returns whether a tab has inspection mode active
 * @param {number} tabId - Chrome tab ID
 * @returns {boolean}
 */
function getTabState(tabId) {
  return activeTabs.has(tabId);
}

/**
 * Sets the activation state for a tab (sync update, async backup)
 * @param {number} tabId - Chrome tab ID
 * @param {boolean} isActive - Activation state
 * @returns {void}
 */
function setTabState(tabId, isActive) {
  if (isActive) {
    activeTabs.add(tabId);
  } else {
    activeTabs.delete(tabId);
  }
  syncStateToStorage();
}

/**
 * Removes all state for a tab
 * @param {number} tabId - Chrome tab ID
 * @returns {void}
 */
function removeTabState(tabId) {
  activeTabs.delete(tabId);
  injectedTabs.delete(tabId);
  syncStateToStorage();
}

/**
 * Marks a tab as having an injected script
 * @param {number} tabId - Chrome tab ID
 * @returns {void}
 */
function markTabInjected(tabId) {
  injectedTabs.add(tabId);
  syncStateToStorage();
}

/**
 * Acquires a processing lock for a tab (mutex)
 * @param {number} tabId - Chrome tab ID
 * @returns {boolean} True if lock acquired, false if already processing
 */
function acquireLock(tabId) {
  if (processingTabs.has(tabId)) return false;
  processingTabs.add(tabId);
  return true;
}

/**
 * Releases the processing lock for a tab
 * @param {number} tabId - Chrome tab ID
 * @returns {void}
 */
function releaseLock(tabId) {
  processingTabs.delete(tabId);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Checks if a URL uses a restricted protocol
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is restricted
 */
function isRestrictedUrl(url) {
  return RESTRICTED_PROTOCOLS.some(protocol => url.startsWith(protocol));
}

/**
 * Shows an error badge temporarily on the extension icon
 * @param {number} tabId - Chrome tab ID
 * @returns {void}
 */
function showErrorBadge(tabId) {
  chrome.action.setBadgeText({ tabId, text: '✕' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR_ERROR });
  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: '' });
  }, ERROR_BADGE_DURATION_MS);
}

/**
 * Sends a PING to the content script to verify it is alive
 * @param {number} tabId - Chrome tab ID
 * @returns {Promise<boolean>} True if content script responded
 */
function checkScriptStatus(tabId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), PING_TIMEOUT_MS);
    
    chrome.tabs.sendMessage(tabId, { action: 'PING' }, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError || !response || response.status !== 'alive') {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Injects content script and CSS into a tab (unconditional)
 * Loads modules in dependency order
 * @param {number} tabId - Chrome tab ID
 * @returns {Promise<void>}
 */
async function injectScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [
      'modules/constants.js',
      'modules/state.js',
      'modules/shadow-dom.js',
      'modules/shadow-pierce.js',
      'modules/selector-engine.js',
      'modules/ui-components.js',
      'modules/event-handlers.js',
      'modules/lifecycle.js',
      'content.js'
    ],
  });
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['styles.css'],
  });
  markTabInjected(tabId);
}

/**
 * Activates inspection mode for a tab
 * @param {number} tabId - Chrome tab ID
 * @returns {Promise<void>}
 */
async function activateInspectionMode(tabId) {
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['styles.css'],
  });
  
  await chrome.tabs.sendMessage(tabId, { action: 'ACTIVATE' });
  setTabState(tabId, true);
  
  chrome.action.setBadgeText({ tabId, text: 'ON' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR_ACTIVE });
}

/**
 * Deactivates inspection mode for a tab
 * @param {number} tabId - Chrome tab ID
 * @returns {Promise<void>}
 */
async function deactivateInspectionMode(tabId) {
  await chrome.tabs.sendMessage(tabId, { action: 'DEACTIVATE' });
  
  await chrome.scripting.removeCSS({
    target: { tabId },
    files: ['styles.css'],
  });
  
  setTabState(tabId, false);
  chrome.action.setBadgeText({ tabId, text: '' });
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handles clicks on the extension icon, toggling inspection mode
 * @param {chrome.tabs.Tab} tab - The active tab
 * @returns {Promise<void>}
 */
chrome.action.onClicked.addListener(async (tab) => {
  const tabId = tab.id;
  const tabUrl = tab.url || '';
  
  if (isRestrictedUrl(tabUrl)) {
    showErrorBadge(tabId);
    return;
  }
  
  if (!acquireLock(tabId)) {
    return;
  }
  
  try {
    await ensureStateInitialized();
    
    const isScriptAlive = await checkScriptStatus(tabId);
    
    if (!isScriptAlive) {
      await injectScript(tabId);
      setTabState(tabId, false);
      await activateInspectionMode(tabId);
      return;
    }
    
    const isActive = getTabState(tabId);
    
    if (isActive) {
      await deactivateInspectionMode(tabId);
    } else {
      await activateInspectionMode(tabId);
    }
  } catch (error) {
    removeTabState(tabId);
    showErrorBadge(tabId);
  } finally {
    releaseLock(tabId);
  }
});

/**
 * Cleans up state when a tab is closed
 * @param {number} tabId - ID of the closed tab
 * @returns {Promise<void>}
 */
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await ensureStateInitialized();
  removeTabState(tabId);
  chrome.action.setBadgeText({ tabId, text: '' });
});
