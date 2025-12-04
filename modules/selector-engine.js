// pinpoint - selector engine
// generates stable css selectors: id > data-* > aria > class > text > anchor > structural

const selectorCache = new WeakMap();
const formatCache = new WeakMap();

// patterns for dynamic content to avoid in text selectors
const DYNAMIC_TEXT_PATTERNS = [
  /^\d+$/,                    // pure numbers
  /^\d{1,2}[\/\-]\d{1,2}/,   // dates
  /^\$[\d,.]+/,               // currency
  /^\d{1,2}:\d{2}/,          // times
  /^[\d,.]+ (min|sec|hr)/,   // durations
];

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

  // fallback strategies before structural path
  const textSelector = getTextSelector(el);
  if (textSelector) return textSelector;

  const anchorSelector = getAnchoredSelector(el);
  if (anchorSelector) return anchorSelector;

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
 * generates text-based selector for leaf nodes with stable text
 * playwright format: text="Submit" or button:has-text("Submit")
 * @param {HTMLElement} el
 * @returns {string|null}
 */
function getTextSelector(el) {
  // only for leaf-like elements (buttons, links, labels, spans with no children)
  const leafTags = ['button', 'a', 'label', 'span', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'p'];
  const tag = el.tagName.toLowerCase();
  if (!leafTags.includes(tag)) return null;
  
  // get direct text content (not from children)
  const text = getDirectTextContent(el).trim();
  
  // validate text is usable
  if (!text || text.length < 2 || text.length > 30) return null;
  if (DYNAMIC_TEXT_PATTERNS.some(p => p.test(text))) return null;
  
  // try exact text match (playwright format)
  const exactSelector = `${tag}:has-text("${CSS.escape(text)}")`;
  if (isUniqueSelector(exactSelector)) return exactSelector;
  
  // try with parent context
  const parent = el.parentElement;
  if (parent && typeof parent.className === 'string') {
    const parentClass = parent.className.trim().split(/\s+/)[0];
    if (parentClass) {
      const contextSelector = `.${CSS.escape(parentClass)} ${tag}:has-text("${CSS.escape(text)}")`;
      if (isUniqueSelector(contextSelector)) return contextSelector;
    }
  }
  
  return null;
}

/**
 * gets direct text content excluding child elements
 * @param {HTMLElement} el
 * @returns {string}
 */
function getDirectTextContent(el) {
  let text = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    }
  }
  return text;
}

/**
 * finds nearest parent with stable id, creates anchored selector
 * format: #parent-id button or #parent-id > div > button
 * @param {HTMLElement} el
 * @returns {string|null}
 */
function getAnchoredSelector(el) {
  const tag = el.tagName.toLowerCase();
  let current = el.parentElement;
  let stepsFromAnchor = [tag];
  let depth = 0;
  
  while (current && current !== document.body && depth < 5) {
    if (current.id) {
      // try direct descendant first
      const directSelector = `#${CSS.escape(current.id)} ${tag}`;
      if (isUniqueSelector(directSelector)) return directSelector;
      
      // try with minimal path
      const pathSelector = `#${CSS.escape(current.id)} ${stepsFromAnchor.join(' > ')}`;
      if (isUniqueSelector(pathSelector)) return pathSelector;
      
      // try nth-of-type within anchor
      const siblings = current.querySelectorAll(tag);
      if (siblings.length > 1) {
        const index = Array.from(siblings).indexOf(el) + 1;
        if (index > 0) {
          const nthSelector = `#${CSS.escape(current.id)} ${tag}:nth-of-type(${index})`;
          if (isUniqueSelector(nthSelector)) return nthSelector;
        }
      }
      
      break; // found anchor, stop searching
    }
    
    // build path step
    let step = current.tagName.toLowerCase();
    if (typeof current.className === 'string') {
      const cls = current.className.trim().split(/\s+/).filter(c => c && !c.startsWith('pp-'))[0];
      if (cls) step += '.' + cls;
    }
    stepsFromAnchor.unshift(step);
    
    current = current.parentElement;
    depth++;
  }
  
  return null;
}

/**
 * builds structural path as last resort fallback
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
 * builds dom path as array of segments for interactive breadcrumbs
 * @param {HTMLElement} el
 * @returns {Array<{label: string, depth: number}>}
 */
function getDomPath(el) {
  const path = [];
  let current = el;
  let depth = 0;
  
  while (current && current !== document.body) {
    let label = current.tagName.toLowerCase();
    
    if (current.id) {
      label += `#${current.id}`;
    } else if (typeof current.className === 'string') {
      const cls = current.className.trim().split(/\s+/).filter(c => c && !c.startsWith('pp-'))[0];
      if (cls) label += `.${cls}`;
    }
    
    path.unshift({ label, depth });
    current = current.parentElement;
    depth++;
  }
  
  return path;
}

