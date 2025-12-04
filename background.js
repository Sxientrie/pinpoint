// pinpoint - background service worker
// handles extension state, action icon clicks, content script messaging

// constants
const RESTRICTED_PROTOCOLS = ['chrome://', 'chrome-extension://', 'edge://', 'about:'];
const ERROR_BADGE_DURATION_MS = 2000;
const BADGE_COLOR_ACTIVE = '#ef4444';
const BADGE_COLOR_ERROR = '#71717a';

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
const connectedPorts = new Map(); // tabId -> port
let stateInitialized = false;

// port management (keepalive connections)

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'pinpoint-keepalive') return;
  
  const tabId = port.sender?.tab?.id;
  if (!tabId) return;
  
  connectedPorts.set(tabId, port);
  
  port.onDisconnect.addListener(async () => {
    connectedPorts.delete(tabId);
    await ensureStateInitialized();
    await removeTabState(tabId);
    chrome.action.setBadgeText({ tabId, text: '' });
  });
});

/**
 * checks if content script is alive via port
 * @param {number} tabId
 * @returns {boolean}
 */
function isScriptAlive(tabId) {
  return connectedPorts.has(tabId);
}

// state management

/**
 * loads state from session storage on sw wake-up
 * validates against actual open tabs to prune orphans
 * @returns {Promise<void>}
 */
async function ensureStateInitialized() {
  if (stateInitialized) return;
  
  const result = await chrome.storage.session.get(['activeTabs', 'injectedTabs']);
  activeTabs = new Set(result.activeTabs || []);
  injectedTabs = new Set(result.injectedTabs || []);
  
  // validate loaded state against actual open tabs
  const openTabs = await chrome.tabs.query({});
  const openTabIds = new Set(openTabs.map(t => t.id));
  
  let pruned = false;
  for (const tabId of activeTabs) {
    if (!openTabIds.has(tabId)) {
      activeTabs.delete(tabId);
      injectedTabs.delete(tabId);
      pruned = true;
    }
  }
  
  if (pruned) {
    await syncStateToStorage();
  }
  
  stateInitialized = true;
}

/**
 * persists in-memory state to storage
 * @returns {Promise<void>}
 */
async function syncStateToStorage() {
  await chrome.storage.session.set({
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
 * @returns {Promise<void>}
 */
async function setTabState(tabId, isActive) {
  isActive ? activeTabs.add(tabId) : activeTabs.delete(tabId);
  await syncStateToStorage();
}

/**
 * clears all state for tab
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function removeTabState(tabId) {
  activeTabs.delete(tabId);
  injectedTabs.delete(tabId);
  await syncStateToStorage();
}

/**
 * marks tab as having injected scripts
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function markTabInjected(tabId) {
  injectedTabs.add(tabId);
  await syncStateToStorage();
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
 * checks if scripts already injected in top frame via global flag
 * @param {number} tabId
 * @returns {Promise<boolean>}
 */
async function isAlreadyInjected(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      func: () => !!window.__PINPOINT_LOADED__
    });
    return result?.result === true;
  } catch {
    return false;
  }
}

/**
 * injects content scripts and css into tab and all iframes (idempotent)
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function injectScript(tabId) {
  const alreadyLoaded = await isAlreadyInjected(tabId);
  if (alreadyLoaded) {
    await markTabInjected(tabId);
    return;
  }
  
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: CONTENT_SCRIPTS
  });
  await chrome.scripting.insertCSS({
    target: { tabId, allFrames: true },
    files: ['styles.css']
  });
  await markTabInjected(tabId);
}

// mode control

/**
 * activates inspection mode for tab and all iframes
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function activateInspectionMode(tabId) {
  await chrome.scripting.insertCSS({
    target: { tabId, allFrames: true },
    files: ['styles.css']
  });
  
  const sent = await sendMessageSafe(tabId, { action: 'ACTIVATE' });
  if (!sent) {
    await removeTabState(tabId);
    return;
  }
  
  await setTabState(tabId, true);
  chrome.action.setBadgeText({ tabId, text: 'ON' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR_ACTIVE });
}

/**
 * deactivates inspection mode for tab and all iframes
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function deactivateInspectionMode(tabId) {
  await sendMessageSafe(tabId, { action: 'DEACTIVATE' });
  await chrome.scripting.removeCSS({
    target: { tabId, allFrames: true },
    files: ['styles.css']
  });
  await setTabState(tabId, false);
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
    
    if (!isScriptAlive(tabId)) {
      await injectScript(tabId);
      await setTabState(tabId, false);
      await activateInspectionMode(tabId);
      return;
    }
    
    getTabState(tabId)
      ? await deactivateInspectionMode(tabId)
      : await activateInspectionMode(tabId);
  } catch {
    await removeTabState(tabId);
    showErrorBadge(tabId);
  } finally {
    releaseLock(tabId);
  }
});

chrome.tabs.onRemoved.addListener(async tabId => {
  connectedPorts.delete(tabId);
  await ensureStateInitialized();
  await removeTabState(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== 'loading') return;
  
  await ensureStateInitialized();
  
  // port will disconnect on navigation, handled by onDisconnect
  // but clear state early for badge update
  if (activeTabs.has(tabId)) {
    await removeTabState(tabId);
    chrome.action.setBadgeText({ tabId, text: '' });
  }
});
