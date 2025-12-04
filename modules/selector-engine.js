// pinpoint - selector engine
// generates stable css selectors: id > data-* > aria > class > structural

const selectorCache = new WeakMap();
const formatCache = new WeakMap();

/**
 * generates optimal selector, cached
 * @param {HTMLElement} el
 * @returns {string}
 */
function getOptimalSelector(el) {
  const cached = selectorCache.get(el);
  if (cached) return cached;
  
  const inShadow = el.getRootNode() instanceof ShadowRoot;
  const selector = inShadow ? getPiercingSelector(el).playwright : getLightDOMSelector(el);
  
  selectorCache.set(el, selector);
  return selector;
}

/**
 * gets all selector formats for ui display
 * @param {HTMLElement} el
 * @returns {Object}
 */
function getAllSelectorFormats(el) {
  const cached = formatCache.get(el);
  if (cached) return cached;
  
  const inShadow = el.getRootNode() instanceof ShadowRoot;
  
  let result;
  if (inShadow) {
    result = getPiercingSelector(el);
  } else {
    const selector = getLightDOMSelector(el);
    result = { playwright: selector, puppeteer: selector, css: selector, custom: selector, depth: 0 };
  }
  
  formatCache.set(el, result);
  return result;
}

/**
 * generates light dom selector using priority algorithm
 * @param {HTMLElement} el
 * @returns {string}
 */
function getLightDOMSelector(el) {
  if (el.id && isUniqueSelector(`#${el.id}`)) return `#${el.id}`;
  
  const dataSelector = getUniqueDataAttributeSelector(el);
  if (dataSelector) return dataSelector;

  const ariaSelector = getUniqueAriaSelector(el);
  if (ariaSelector) return ariaSelector;

  const classSelector = getUniqueClassSelector(el);
  if (classSelector) return classSelector;

  return buildStructuralPath(el);
}

/**
 * @param {string} selector
 * @returns {boolean} true if matches exactly one element
 */
function isUniqueSelector(selector) {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

/**
 * tries data-* attributes for unique selector
 * @param {HTMLElement} el
 * @returns {string|null}
 */
function getUniqueDataAttributeSelector(el) {
  for (const attr of el.attributes) {
    if (!attr.name.startsWith('data-')) continue;
    const selector = `[${attr.name}="${CSS.escape(attr.value)}"]`;
    if (isUniqueSelector(selector)) return selector;
  }
  return null;
}

/**
 * tries aria attributes for unique selector
 * @param {HTMLElement} el
 * @returns {string|null}
 */
function getUniqueAriaSelector(el) {
  for (const attrName of ARIA_ATTRIBUTES) {
    const value = el.getAttribute(attrName);
    if (!value) continue;

    const selector = `[${attrName}="${CSS.escape(value)}"]`;
    if (isUniqueSelector(selector)) return selector;

    const tagSelector = `${el.tagName.toLowerCase()}${selector}`;
    if (isUniqueSelector(tagSelector)) return tagSelector;
  }
  return null;
}

/**
 * tries class names for unique selector
 * @param {HTMLElement} el
 * @returns {string|null}
 */
function getUniqueClassSelector(el) {
  if (typeof el.className !== 'string') return null;
  
  const classes = el.className.trim().split(/\s+/).filter(c => c && !c.startsWith('pp-'));
  if (!classes.length) return null;

  const classSelector = '.' + classes.join('.');
  if (isUniqueSelector(classSelector)) return classSelector;

  const tagClassSelector = el.tagName.toLowerCase() + classSelector;
  if (isUniqueSelector(tagClassSelector)) return tagClassSelector;
  
  return null;
}

/**
 * builds structural path as fallback
 * @param {HTMLElement} el
 * @returns {string}
 */
function buildStructuralPath(el) {
  const path = [];
  let current = el;
  let depth = 0;
  
  while (current && current !== document.body && depth < MAX_STRUCTURAL_PATH_DEPTH) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      path.unshift(selector + `#${current.id}`);
      break;
    }
    
    if (typeof current.className === 'string') {
      const cls = current.className.trim().split(/\s+/).filter(c => c && !c.startsWith('pp-'))[0];
      if (cls) selector += '.' + cls;
    }
    
    path.unshift(selector);
    current = current.parentElement;
    depth++;
  }
  
  return path.join(' > ');
}

/**
 * extracts ng-* attributes from element
 * @param {HTMLElement} el
 * @returns {string}
 */
function getAngularAttributes(el) {
  const attrs = Array.from(el.attributes)
    .filter(a => a.name.includes('ng'))
    .map(a => `${a.name}="${a.value}"`)
    .join(' ');
  return attrs || 'none';
}

/**
 * builds human-readable dom path
 * @param {HTMLElement} el
 * @returns {string}
 */
function getDomPath(el) {
  const path = [];
  let current = el;
  
  while (current && current !== document.body) {
    let part = current.tagName.toLowerCase();
    
    if (current.id) {
      part += `#${current.id}`;
    } else if (typeof current.className === 'string') {
      const cls = current.className.trim().split(/\s+/).filter(c => c && !c.startsWith('pp-'))[0];
      if (cls) part += `.${cls}`;
    }
    
    path.unshift(part);
    current = current.parentElement;
  }
  
  return path.join(' → ');
}
