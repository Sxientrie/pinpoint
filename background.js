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
// STATE MANAGEMENT (chrome.storage.session)
// ============================================================================

/**
 * Retrieves the set of tab IDs that have content scripts injected
 * @returns {Promise<Set<number>>} Set of tab IDs with injected scripts
 */
async function getInjectedTabs() {
  const result = await chrome.storage.session.get('injectedTabs');
  return new Set(result.injectedTabs || []);
}

/**
 * Persists the set of tab IDs with injected content scripts
 * @param {Set<number>} tabsSet - Set of tab IDs to persist
 * @returns {Promise<void>}
 */
async function setInjectedTabs(tabsSet) {
  await chrome.storage.session.set({ injectedTabs: Array.from(tabsSet) });
}

/**
 * Retrieves the activation state for a specific tab
 * @param {number} tabId - Chrome tab ID
 * @returns {Promise<boolean>} True if inspection mode is active for the tab
 */
async function getTabState(tabId) {
  const result = await chrome.storage.session.get('tabState');
  const tabState = result.tabState || {};
  return tabState[tabId] || false;
}

/**
 * Sets the activation state for a specific tab
 * @param {number} tabId - Chrome tab ID
 * @param {boolean} isActive - Activation state to set
 * @returns {Promise<void>}
 */
async function setTabState(tabId, isActive) {
  const result = await chrome.storage.session.get('tabState');
  const tabState = result.tabState || {};
  tabState[tabId] = isActive;
  await chrome.storage.session.set({ tabState });
}

/**
 * Removes the activation state for a specific tab
 * @param {number} tabId - Chrome tab ID
 * @returns {Promise<void>}
 */
async function removeTabState(tabId) {
  const result = await chrome.storage.session.get('tabState');
  const tabState = result.tabState || {};
  delete tabState[tabId];
  await chrome.storage.session.set({ tabState });
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
 * @param {number} tabId - Chrome tab ID
 * @returns {Promise<void>}
 */
async function injectScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['styles.css'],
  });
  
  const injectedTabs = await getInjectedTabs();
  injectedTabs.add(tabId);
  await setInjectedTabs(injectedTabs);
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
  await setTabState(tabId, true);
  
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
  
  await setTabState(tabId, false);
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
  
  try {
    const isScriptAlive = await checkScriptStatus(tabId);
    
    if (!isScriptAlive) {
      await injectScript(tabId);
      await setTabState(tabId, false);
      await activateInspectionMode(tabId);
      return;
    }
    
    const isActive = await getTabState(tabId);
    
    if (isActive) {
      await deactivateInspectionMode(tabId);
    } else {
      await activateInspectionMode(tabId);
    }
  } catch (error) {
    const injectedTabs = await getInjectedTabs();
    injectedTabs.delete(tabId);
    await setInjectedTabs(injectedTabs);
    await setTabState(tabId, false);
    showErrorBadge(tabId);
  }
});

/**
 * Cleans up state when a tab is closed
 * @param {number} tabId - ID of the closed tab
 * @returns {Promise<void>}
 */
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const injectedTabs = await getInjectedTabs();
  injectedTabs.delete(tabId);
  await setInjectedTabs(injectedTabs);
  await removeTabState(tabId);
  chrome.action.setBadgeText({ tabId, text: '' });
});
