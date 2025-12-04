// pinpoint - background service worker
// handles extension state, action icon clicks, content script messaging

// constants
const RESTRICTED_PROTOCOLS = ['chrome://', 'chrome-extension://', 'edge://', 'about:'];
const ERROR_BADGE_DURATION_MS = 2000;
const BADGE_COLOR_ACTIVE = '#ef4444';
const BADGE_COLOR_ERROR = '#71717a';
const PING_TIMEOUT_MS = 500;

const CONTENT_SCRIPTS = [
  'modules/constants.js',
  'modules/state.js',
  'modules/shadow-dom.js',
  'modules/shadow-pierce.js',
  'modules/selector-engine.js',
  'modules/ui-components.js',
  'modules/event-handlers.js',
  'modules/lifecycle.js',
  'content.js'
];

// state
let activeTabs = new Set();
let injectedTabs = new Set();
const processingTabs = new Set();
let stateInitialized = false;

// state management

/**
 * loads state from session storage on sw wake-up
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
 * persists in-memory state to storage (fire-and-forget)
 */
function syncStateToStorage() {
  chrome.storage.session.set({
    activeTabs: Array.from(activeTabs),
    injectedTabs: Array.from(injectedTabs),
  });
}

/**
 * @param {number} tabId
 * @returns {boolean} whether tab has inspection mode active
 */
function getTabState(tabId) {
  return activeTabs.has(tabId);
}

/**
 * sets activation state for tab, syncs to storage
 * @param {number} tabId
 * @param {boolean} isActive
 */
function setTabState(tabId, isActive) {
  isActive ? activeTabs.add(tabId) : activeTabs.delete(tabId);
  syncStateToStorage();
}

/**
 * clears all state for tab
 * @param {number} tabId
 */
function removeTabState(tabId) {
  activeTabs.delete(tabId);
  injectedTabs.delete(tabId);
  syncStateToStorage();
}

/**
 * marks tab as having injected scripts
 * @param {number} tabId
 */
function markTabInjected(tabId) {
  injectedTabs.add(tabId);
  syncStateToStorage();
}

// mutex

/**
 * acquires processing lock for tab
 * @param {number} tabId
 * @returns {boolean} true if lock acquired
 */
function acquireLock(tabId) {
  if (processingTabs.has(tabId)) return false;
  processingTabs.add(tabId);
  return true;
}

/**
 * releases processing lock for tab
 * @param {number} tabId
 */
function releaseLock(tabId) {
  processingTabs.delete(tabId);
}

// utilities

/**
 * @param {string} url
 * @returns {boolean} true if url uses restricted protocol
 */
function isRestrictedUrl(url) {
  return RESTRICTED_PROTOCOLS.some(p => url.startsWith(p));
}

/**
 * shows error badge temporarily
 * @param {number} tabId
 */
function showErrorBadge(tabId) {
  chrome.action.setBadgeText({ tabId, text: '✕' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR_ERROR });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }), ERROR_BADGE_DURATION_MS);
}

/**
 * pings content script to verify alive
 * @param {number} tabId
 * @returns {Promise<boolean>}
 */
function checkScriptStatus(tabId) {
  return new Promise(resolve => {
    const timeout = setTimeout(() => resolve(false), PING_TIMEOUT_MS);
    chrome.tabs.sendMessage(tabId, { action: 'PING' }, response => {
      clearTimeout(timeout);
      resolve(!chrome.runtime.lastError && response?.status === 'alive');
    });
  });
}

/**
 * sends message to tab, handles orphaned contexts silently
 * @param {number} tabId
 * @param {Object} message
 * @returns {Promise<boolean>} true if delivered
 */
async function sendMessageSafe(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch (e) {
    const msg = e?.message || '';
    if (msg.includes('context invalidated') || msg.includes('Receiving end does not exist')) {
      return false;
    }
    throw e;
  }
}

// injection

/**
 * injects content scripts and css into tab
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function injectScript(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_SCRIPTS });
  await chrome.scripting.insertCSS({ target: { tabId }, files: ['styles.css'] });
  markTabInjected(tabId);
}

// mode control

/**
 * activates inspection mode for tab
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function activateInspectionMode(tabId) {
  await chrome.scripting.insertCSS({ target: { tabId }, files: ['styles.css'] });
  
  const sent = await sendMessageSafe(tabId, { action: 'ACTIVATE' });
  if (!sent) {
    removeTabState(tabId);
    return;
  }
  
  setTabState(tabId, true);
  chrome.action.setBadgeText({ tabId, text: 'ON' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR_ACTIVE });
}

/**
 * deactivates inspection mode for tab
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function deactivateInspectionMode(tabId) {
  await sendMessageSafe(tabId, { action: 'DEACTIVATE' });
  await chrome.scripting.removeCSS({ target: { tabId }, files: ['styles.css'] });
  setTabState(tabId, false);
  chrome.action.setBadgeText({ tabId, text: '' });
}

// event handlers

chrome.action.onClicked.addListener(async tab => {
  const { id: tabId, url: tabUrl = '' } = tab;
  
  if (isRestrictedUrl(tabUrl)) {
    showErrorBadge(tabId);
    return;
  }
  
  if (!acquireLock(tabId)) return;
  
  try {
    await ensureStateInitialized();
    const isScriptAlive = await checkScriptStatus(tabId);
    
    if (!isScriptAlive) {
      await injectScript(tabId);
      setTabState(tabId, false);
      await activateInspectionMode(tabId);
      return;
    }
    
    getTabState(tabId)
      ? await deactivateInspectionMode(tabId)
      : await activateInspectionMode(tabId);
  } catch {
    removeTabState(tabId);
    showErrorBadge(tabId);
  } finally {
    releaseLock(tabId);
  }
});

chrome.tabs.onRemoved.addListener(async tabId => {
  await ensureStateInitialized();
  removeTabState(tabId);
  chrome.action.setBadgeText({ tabId, text: '' });
});
