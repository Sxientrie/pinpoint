/**
 * Pinpoint - UI Components
 * Creates and manages tooltip and detail panel
 */

/**
 * Creates the hover tooltip element in Shadow DOM
 * @returns {HTMLElement} The tooltip element
 */
function createTooltip() {
  if (!shadowRoot) createShadowRoot();
  
  const element = document.createElement('div');
  element.id = 'pp-tooltip';
  shadowRoot.appendChild(element);
  return element;
}

/**
 * Creates the detail panel with per-field copy buttons
 * @returns {HTMLElement} The detail panel element
 */
function createDetailPanel() {
  if (!shadowRoot) createShadowRoot();
  
  const panel = document.createElement('div');
  panel.id = 'pp-panel';
  panel.innerHTML = getDetailPanelHTML();
  shadowRoot.appendChild(panel);

  attachDetailPanelEventListeners(panel);
  
  return panel;
}

/**
 * Generates the HTML structure for the detail panel
 * @returns {string} HTML string
 */
function getDetailPanelHTML() {
  const copyIcon = `
    <svg viewBox="0 0 24 24">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  `;

  return `
    <div class="pp-panel-header">
      <h3>pinpoint</h3>
      <button id="pp-close">×</button>
    </div>
    <div class="pp-panel-body">
      ${createField('selector', 'pp-selector', copyIcon)}
      ${createField('dimensions', 'pp-dimensions', copyIcon)}
      ${createField('framework attrs', 'pp-angular', copyIcon)}
      ${createField('dom path', 'pp-path', copyIcon)}
    </div>
  `;
}

/**
 * Creates HTML for a single data field with copy button
 * @param {string} label - Field label
 * @param {string} id - Element ID
 * @param {string} copyIcon - SVG icon HTML
 * @returns {string} HTML string
 */
function createField(label, id, copyIcon) {
  return `
    <div class="pp-section">
      <label>${label}</label>
      <div class="pp-field-wrapper">
        <code id="${id}"></code>
        <button class="pp-copy-btn" data-copy-target="${id}">
          ${copyIcon}
        </button>
      </div>
    </div>
  `;
}

/**
 * Attaches event listeners to the detail panel
 * @param {HTMLElement} panel - The panel element
 * @returns {void}
 */
function attachDetailPanelEventListeners(panel) {
  panel.querySelector('#pp-close').addEventListener('click', closePanel);
  
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isDetailPanelOpen) {
      closePanel();
    }
  });

  panel.querySelectorAll('.pp-copy-btn').forEach(button => {
    button.addEventListener('click', () => handleCopyClick(button, panel));
  });
}

/**
 * Handles copy button clicks with visual feedback
 * @param {HTMLElement} button - The clicked copy button
 * @param {HTMLElement} panel - The parent panel
 * @returns {Promise<void>}
 */
async function handleCopyClick(button, panel) {
  const targetId = button.getAttribute('data-copy-target');
  const targetElement = panel.querySelector(`#${targetId}`);
  const textToCopy = targetElement.textContent;
  
  try {
    await navigator.clipboard.writeText(textToCopy);
    showCopySuccess(button);
  } catch (error) {
    // Silent fail
  }
}

/**
 * Shows visual feedback for successful copy
 * @param {HTMLElement} button - The copy button element
 * @returns {void}
 */
function showCopySuccess(button) {
  const checkmarkIcon = `
    <svg viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `;

  button.classList.add('copied');
  button.innerHTML = checkmarkIcon;
  
  setTimeout(() => {
    button.classList.remove('copied');
    button.innerHTML = `
      <svg viewBox="0 0 24 24">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `;
  }, COPY_SUCCESS_DURATION_MS);
}

/**
 * Closes the detail panel and clears highlights
 * @returns {void}
 */
function closePanel() {
  if (!detailPanel) return;
  
  detailPanel.style.display = 'none';
  isDetailPanelOpen = false;
  
  if (hoveredElement) {
    hoveredElement.classList.remove(HIGHLIGHT_CLASS);
  }
}
