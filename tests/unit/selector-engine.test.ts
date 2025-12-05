import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Define the Pinpoint global structure type
interface PinpointGlobal {
    Constants: {
        ARIA_ATTRIBUTES: string[];
        MAX_STRUCTURAL_PATH_DEPTH: number;
    };
    ShadowPierce: {
        getPiercingSelector: any;
    };
    Selector: {
        getOptimalSelector?: (el: Element) => string;
        getAllSelectorFormats?: (el: Element) => any;
        getLightDOMSelector?: (el: Element) => string;
        getDomPath?: (el: Element) => Array<{ label: string; depth: number }>;
        getAngularAttributes?: (el: Element) => string;
        getReactComponentName?: (el: Element) => string | null;
    };
}

// Extend Window interface
declare global {
    interface Window {
        Pinpoint: PinpointGlobal;
        CSS: { escape: (s: string) => string };
    }
}

describe('Selector Engine', () => {
    // We use the JSDOM environment provided by Vitest
    
    beforeEach(async () => {
        // Reset modules to ensure the script re-executes
        vi.resetModules();
        
        // Clean up DOM
        document.body.innerHTML = '';
        
        // Polyfill CSS.escape if missing
        if (!window.CSS) {
            (window as any).CSS = {};
        }
        if (!window.CSS.escape) {
            window.CSS.escape = (s: string) => {
                 return s.replace(/([^\w-])/g, '\\$1');
            };
        }

        // Mock the Pinpoint global object
        window.Pinpoint = {
            Constants: {
                ARIA_ATTRIBUTES: ['aria-label', 'role', 'aria-describedby', 'aria-labelledby'],
                MAX_STRUCTURAL_PATH_DEPTH: 10
            },
            ShadowPierce: {
                getPiercingSelector: vi.fn()
            },
            Selector: {}
        };

        // Dynamically import the selector engine
        // This executes the IIFE which attaches methods to window.Pinpoint.Selector
        // We use a query param to bust cache just in case, though resetModules should handle it
        await import('../../modules/selector-engine.js');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (window as any).Pinpoint;
    });

    it('should prioritize ID selector if unique', () => {
        document.body.innerHTML = `
            <div id="target">Target</div>
            <div id="other">Other</div>
        `;
        const target = document.getElementById('target')!;
        const selector = window.Pinpoint.Selector.getOptimalSelector!(target);
        expect(selector).toBe('#target');
    });

    it('should ignore ID selector if not unique', () => {
        document.body.innerHTML = `
            <div id="dup">Target</div>
            <div id="dup">Duplicate</div>
        `;
        const elements = document.querySelectorAll('#dup');
        const target = elements[0]; 
        
        const selector = window.Pinpoint.Selector.getOptimalSelector!(target);
        expect(selector).not.toBe('#dup');
        
        // As per previous analysis, it falls back to structural path using the ID
        expect(selector).toBe('div#dup');
    });

    it('should use data attributes if ID is missing', () => {
        document.body.innerHTML = `
            <div data-testid="unique-element">Target</div>
        `;
        const target = document.querySelector('[data-testid="unique-element"]')!;
        const selector = window.Pinpoint.Selector.getOptimalSelector!(target);
        expect(selector).toBe('[data-testid="unique-element"]');
    });

    it('should use aria attributes if data attributes are missing', () => {
        document.body.innerHTML = `
            <button aria-label="Close Modal">X</button>
        `;
        const target = document.querySelector('button')!;
        const selector = window.Pinpoint.Selector.getOptimalSelector!(target);
        // CSS.escape handles spaces
        expect(selector).toBe('[aria-label="Close\\ Modal"]');
    });

    it('should use class selector if unique and no better attributes', () => {
        document.body.innerHTML = `
            <div class="unique-class">Target</div>
            <div class="common-class">Other</div>
        `;
        const target = document.querySelector('.unique-class')!;
        const selector = window.Pinpoint.Selector.getOptimalSelector!(target);
        expect(selector).toBe('.unique-class');
    });

    it('should handle nested structures with structural path', () => {
         document.body.innerHTML = `
            <div id="container">
                <div>
                    <span>Target</span>
                </div>
            </div>
        `;
        const target = document.querySelector('span')!;
        
        const selector = window.Pinpoint.Selector.getOptimalSelector!(target);
        // Optimization check
        expect(selector).toBe('#container span');
    });

    it('should delegate to ShadowPierce if element is in Shadow DOM', () => {
        // Mock ShadowPierce behavior
        const mockPiercingSelector = { playwright: 'piercing >> selector' };
        window.Pinpoint.ShadowPierce.getPiercingSelector = vi.fn().mockReturnValue(mockPiercingSelector);

        const host = document.createElement('div');
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });
        const target = document.createElement('div');
        shadow.appendChild(target);

        const selector = window.Pinpoint.Selector.getOptimalSelector!(target);

        expect(window.Pinpoint.ShadowPierce.getPiercingSelector).toHaveBeenCalledWith(target);
        expect(selector).toBe('piercing >> selector');
    });

    describe('getDomPath', () => {
        it('should return empty array for body element', () => {
            const path = window.Pinpoint.Selector.getDomPath!(document.body);
            expect(path).toEqual([]);
        });

        it('should build path from element to body', () => {
            document.body.innerHTML = `
                <div id="container">
                    <span class="inner">Target</span>
                </div>
            `;
            const target = document.querySelector('span')!;
            const path = window.Pinpoint.Selector.getDomPath!(target);
            
            expect(path.length).toBe(2);
            // path is ordered from root to target
            expect(path[0].label).toBe('div#container');
            expect(path[1].label).toBe('span.inner');
        });

        it('should include depth for each segment', () => {
            document.body.innerHTML = `
                <div id="level1">
                    <div id="level2">
                        <span id="level3">Target</span>
                    </div>
                </div>
            `;
            const target = document.querySelector('#level3')!;
            const path = window.Pinpoint.Selector.getDomPath!(target);
            
            // depth increases as we go up the tree
            expect(path[0].depth).toBe(2); // level1
            expect(path[1].depth).toBe(1); // level2
            expect(path[2].depth).toBe(0); // level3 (target)
        });

        it('should prioritize ID over class in label', () => {
            document.body.innerHTML = `
                <div id="has-id" class="has-class">Target</div>
            `;
            const target = document.querySelector('div')!;
            const path = window.Pinpoint.Selector.getDomPath!(target);
            
            expect(path[0].label).toBe('div#has-id');
        });

        it('should use first class when no ID', () => {
            document.body.innerHTML = `
                <div class="first-class second-class">Target</div>
            `;
            const target = document.querySelector('div')!;
            const path = window.Pinpoint.Selector.getDomPath!(target);
            
            expect(path[0].label).toBe('div.first-class');
        });

        it('should use tag only when no ID or class', () => {
            document.body.innerHTML = `
                <div><span>Target</span></div>
            `;
            const target = document.querySelector('span')!;
            const path = window.Pinpoint.Selector.getDomPath!(target);
            
            expect(path[1].label).toBe('span');
        });

        it('should ignore pp- prefixed classes', () => {
            document.body.innerHTML = `
                <div class="pp-internal real-class">Target</div>
            `;
            const target = document.querySelector('div')!;
            const path = window.Pinpoint.Selector.getDomPath!(target);
            
            expect(path[0].label).toBe('div.real-class');
        });

        it('should handle deeply nested elements', () => {
            document.body.innerHTML = `
                <div id="a">
                    <div id="b">
                        <div id="c">
                            <div id="d">
                                <span id="target">Deep</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            const target = document.querySelector('#target')!;
            const path = window.Pinpoint.Selector.getDomPath!(target);
            
            expect(path.length).toBe(5);
            expect(path[0].label).toBe('div#a');
            expect(path[4].label).toBe('span#target');
        });
    });

    describe('getAngularAttributes', () => {
        it('should return "none" when no ng attributes', () => {
            document.body.innerHTML = '<div id="test">No Angular</div>';
            const el = document.getElementById('test')!;
            
            const attrs = window.Pinpoint.Selector.getAngularAttributes!(el);
            expect(attrs).toBe('none');
        });

        it('should extract ng-* attributes', () => {
            document.body.innerHTML = '<div ng-if="show" ng-class="cls">Angular</div>';
            const el = document.querySelector('div')!;
            
            const attrs = window.Pinpoint.Selector.getAngularAttributes!(el);
            expect(attrs).toContain('ng-if="show"');
            expect(attrs).toContain('ng-class="cls"');
        });

        it('should extract _ngcontent attributes', () => {
            document.body.innerHTML = '<div _ngcontent-abc="">Angular</div>';
            const el = document.querySelector('div')!;
            
            const attrs = window.Pinpoint.Selector.getAngularAttributes!(el);
            expect(attrs).toContain('_ngcontent-abc');
        });
    });

    describe('getReactComponentName', () => {
        it('should return null for non-React elements', () => {
            document.body.innerHTML = '<div id="plain">Not React</div>';
            const el = document.getElementById('plain')!;
            
            const name = window.Pinpoint.Selector.getReactComponentName!(el);
            expect(name).toBeNull();
        });
    });
});
