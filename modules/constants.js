// pinpoint - namespace initialization
// establishes global namespace, prevents scope pollution

window.Pinpoint = window.Pinpoint || {};

(function(P) {
  'use strict';
  
  // sub-namespaces
  P.Constants = {};
  P.State = {};
  P.ShadowDOM = {};
  P.ShadowPierce = {};
  P.Selector = {};
  P.UI = {};
  P.Events = {};
  P.Lifecycle = {};
  
  // constants
  P.Constants.TOOLTIP_OFFSET_X = 10;
  P.Constants.TOOLTIP_OFFSET_Y = 10;
  P.Constants.COPY_SUCCESS_DURATION_MS = 1000;
  P.Constants.HIGHLIGHT_CLASS = 'pp-highlight';
  P.Constants.MAX_STRUCTURAL_PATH_DEPTH = 10;
  P.Constants.ARIA_ATTRIBUTES = ['aria-label', 'role', 'aria-describedby', 'aria-labelledby'];

})(window.Pinpoint);
