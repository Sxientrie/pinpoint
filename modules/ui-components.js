// pinpoint - ui components
// tooltip and detail panel creation

const COPY_ICON = `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
const CHECK_ICON = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

/**
 * creates hover tooltip in shadow dom
 * @returns {HTMLElement}
 */
function createTooltip() {
  if (!shadowRoot) createShadowRoot();
  const el = document.createElement('div');
  el.id = 'pp-tooltip';
  shadowRoot.appendChild(el);
  return el;
}

/**
 * creates detail panel with copy buttons
 * @returns {HTMLElement}
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
 * @returns {string} panel html structure
 */
function getDetailPanelHTML() {
  return `
    <div class="pp-panel-header">
      <h3>pinpoint</h3>
      <button id="pp-close">×</button>
    </div>
    <div class="pp-panel-body">
      ${createField('selector', 'pp-selector')}
      ${createField('dimensions', 'pp-dimensions')}
      ${createField('framework attrs', 'pp-angular')}
      ${createField('dom path', 'pp-path')}
    </div>
  `;
}

/**
 * creates single field with copy button
 * @param {string} label
 * @param {string} id
 * @returns {string}
 */
function createField(label, id) {
  return `
    <div class="pp-section">
      <label>${label}</label>
      <div class="pp-field-wrapper">
        <code id="${id}"></code>
        <button class="pp-copy-btn" data-copy-target="${id}">${COPY_ICON}</button>
      </div>
    </div>
  `;
}

/**
 * attaches event listeners to panel
 * @param {HTMLElement} panel
 */
function attachDetailPanelEventListeners(panel) {
  panel.querySelector('#pp-close').addEventListener('click', closePanel);
  
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isDetailPanelOpen) closePanel();
  });

  panel.querySelectorAll('.pp-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => handleCopyClick(btn, panel));
  });
}

/**
 * handles copy with visual feedback
 * @param {HTMLElement} btn
 * @param {HTMLElement} panel
 */
async function handleCopyClick(btn, panel) {
  const targetId = btn.getAttribute('data-copy-target');
  const text = panel.querySelector(`#${targetId}`).textContent;
  
  try {
    await navigator.clipboard.writeText(text);
    showCopySuccess(btn);
  } catch {}
}

/**
 * shows checkmark feedback on copy
 * @param {HTMLElement} btn
 */
function showCopySuccess(btn) {
  btn.classList.add('copied');
  btn.innerHTML = CHECK_ICON;
  
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = COPY_ICON;
  }, COPY_SUCCESS_DURATION_MS);
}

/**
 * closes detail panel, clears highlight
 */
function closePanel() {
  if (!detailPanel) return;
  detailPanel.style.display = 'none';
  isDetailPanelOpen = false;
  
  const overlay = shadowRoot?.getElementById('pp-overlay');
  if (overlay) overlay.style.opacity = '0';
}
