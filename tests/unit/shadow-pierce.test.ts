import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// pinpoint global type for test
interface PinpointGlobal {
    Constants: Record<string, any>;
    State: Record<string, any>;
    ShadowDOM: Record<string, any>;
    Selector: Record<string, any>;
    ShadowPierce: {
        getPiercingSelector?: (el: Element) => {
            playwright: string;
            puppeteer: string;
            css: string;
            custom: string;
            path: Array<{ selector: string; isShadowBoundary: boolean }>;
            depth: number;
        };
        queryDeep?: (root: Document | ShadowRoot, selector: string) => Element | null;
        queryDeepAll?: (root: Document | ShadowRoot, selector: string) => Element[];
        isInShadowDOM?: (el: Element) => boolean;
        getShadowDepth?: (el: Element) => number;
        findAllShadowRoots?: (root: Document | ShadowRoot) => ShadowRoot[];
    };
}

declare global {
    interface Window {
        Pinpoint: PinpointGlobal;
        CSS: { escape: (s: string) => string };
    }
}

describe('Shadow Pierce', () => {
    beforeEach(async () => {
        vi.resetModules();
        document.body.innerHTML = '';
        
        // polyfill CSS.escape
        if (!window.CSS) {
            (window as any).CSS = {};
        }
        if (!window.CSS.escape) {
            window.CSS.escape = (s: string) => s.replace(/([^\w-])/g, '\\$1');
        }

        // mock pinpoint global
        window.Pinpoint = {
            Constants: {},
            State: {},
            ShadowDOM: {},
            Selector: {},
            ShadowPierce: {}
        };

        // import module
        await import('../../modules/shadow-pierce.js');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (window as any).Pinpoint;
    });

    describe('isInShadowDOM', () => {
        it('should return false for light DOM elements', () => {
            document.body.innerHTML = '<div id="light">Light Element</div>';
            const el = document.getElementById('light')!;
            
            expect(window.Pinpoint.ShadowPierce.isInShadowDOM!(el)).toBe(false);
        });

        it('should return true for shadow DOM elements', () => {
            const host = document.createElement('div');
            document.body.appendChild(host);
            const shadow = host.attachShadow({ mode: 'open' });
            const el = document.createElement('span');
            shadow.appendChild(el);
            
            expect(window.Pinpoint.ShadowPierce.isInShadowDOM!(el)).toBe(true);
        });
    });

    describe('getShadowDepth', () => {
        it('should return 0 for light DOM elements', () => {
            document.body.innerHTML = '<div id="light">Light</div>';
            const el = document.getElementById('light')!;
            
            expect(window.Pinpoint.ShadowPierce.getShadowDepth!(el)).toBe(0);
        });

        it('should return 1 for single shadow boundary', () => {
            const host = document.createElement('div');
            document.body.appendChild(host);
            const shadow = host.attachShadow({ mode: 'open' });
            const el = document.createElement('span');
            shadow.appendChild(el);
            
            expect(window.Pinpoint.ShadowPierce.getShadowDepth!(el)).toBe(1);
        });

        it('should return 2 for nested shadow DOMs', () => {
            // outer host
            const outerHost = document.createElement('div');
            document.body.appendChild(outerHost);
            const outerShadow = outerHost.attachShadow({ mode: 'open' });
            
            // inner host inside outer shadow
            const innerHost = document.createElement('div');
            outerShadow.appendChild(innerHost);
            const innerShadow = innerHost.attachShadow({ mode: 'open' });
            
            // target element in inner shadow
            const el = document.createElement('span');
            innerShadow.appendChild(el);
            
            expect(window.Pinpoint.ShadowPierce.getShadowDepth!(el)).toBe(2);
        });
    });

    describe('getPiercingSelector', () => {
        it('should generate selector for light DOM element', () => {
            document.body.innerHTML = '<div id="target">Target</div>';
            const el = document.getElementById('target')!;
            
            const result = window.Pinpoint.ShadowPierce.getPiercingSelector!(el);
            
            expect(result.depth).toBe(0);
            expect(result.playwright).toBe('#target');
            expect(result.css).toBe('#target');
        });

        it('should generate piercing selector with >> for shadow DOM', () => {
            const host = document.createElement('my-component');
            host.id = 'host';
            document.body.appendChild(host);
            const shadow = host.attachShadow({ mode: 'open' });
            const el = document.createElement('button');
            el.id = 'shadow-btn';
            shadow.appendChild(el);
            
            const result = window.Pinpoint.ShadowPierce.getPiercingSelector!(el);
            
            expect(result.depth).toBe(1);
            // playwright uses >> to cross shadow boundaries
            expect(result.playwright).toContain('my-component#host');
            expect(result.playwright).toContain(' >> ');
            expect(result.playwright).toContain('#shadow-btn');
            // puppeteer uses pierce/ prefix
            expect(result.puppeteer).toContain('pierce/');
        });

        it('should handle nested shadow DOMs', () => {
            // outer host
            const outerHost = document.createElement('my-outer');
            outerHost.id = 'outer';
            document.body.appendChild(outerHost);
            const outerShadow = outerHost.attachShadow({ mode: 'open' });
            
            // inner host
            const innerHost = document.createElement('my-inner');
            innerHost.id = 'inner';
            outerShadow.appendChild(innerHost);
            const innerShadow = innerHost.attachShadow({ mode: 'open' });
            
            // target
            const el = document.createElement('span');
            el.id = 'deep-target';
            innerShadow.appendChild(el);
            
            const result = window.Pinpoint.ShadowPierce.getPiercingSelector!(el);
            
            expect(result.depth).toBe(2);
            // should have two >> separators for 2 shadow boundaries
            const segments = result.playwright.split(' >> ');
            expect(segments.length).toBe(3);
            expect(result.playwright).toContain('#deep-target');
        });

        it('should use data attributes for host without ID', () => {
            const host = document.createElement('div');
            host.setAttribute('data-component', 'card');
            document.body.appendChild(host);
            const shadow = host.attachShadow({ mode: 'open' });
            const el = document.createElement('button');
            el.className = 'btn-primary';
            shadow.appendChild(el);
            
            const result = window.Pinpoint.ShadowPierce.getPiercingSelector!(el);
            
            expect(result.playwright).toContain('data-component');
            expect(result.playwright).toContain('button.btn-primary');
        });

    });

    describe('queryDeep', () => {
        it('should find element in light DOM', () => {
            document.body.innerHTML = '<div id="target">Target</div>';
            
            const result = window.Pinpoint.ShadowPierce.queryDeep!(document, '#target');
            
            expect(result).not.toBeNull();
            expect(result?.id).toBe('target');
        });

        it('should find element inside shadow DOM using >> syntax', () => {
            const host = document.createElement('div');
            host.id = 'host';
            document.body.appendChild(host);
            const shadow = host.attachShadow({ mode: 'open' });
            const el = document.createElement('button');
            el.id = 'shadow-btn';
            el.textContent = 'Click me';
            shadow.appendChild(el);
            
            const result = window.Pinpoint.ShadowPierce.queryDeep!(document, '#host >> #shadow-btn');
            
            expect(result).not.toBeNull();
            expect(result?.textContent).toBe('Click me');
        });

        it('should return null for non-existent element', () => {
            document.body.innerHTML = '<div id="exists">Exists</div>';
            
            const result = window.Pinpoint.ShadowPierce.queryDeep!(document, '#does-not-exist');
            
            expect(result).toBeNull();
        });

        it('should return null if host has no shadow root', () => {
            document.body.innerHTML = '<div id="no-shadow">No Shadow</div>';
            
            const result = window.Pinpoint.ShadowPierce.queryDeep!(document, '#no-shadow >> .inner');
            
            expect(result).toBeNull();
        });
    });

    describe('queryDeepAll', () => {
        it('should find all matching elements in light DOM', () => {
            document.body.innerHTML = `
                <div class="item">1</div>
                <div class="item">2</div>
                <div class="item">3</div>
            `;
            
            const results = window.Pinpoint.ShadowPierce.queryDeepAll!(document, '.item');
            
            expect(results).toHaveLength(3);
        });

        it('should find all matching elements inside shadow DOM', () => {
            const host = document.createElement('div');
            host.id = 'list';
            document.body.appendChild(host);
            const shadow = host.attachShadow({ mode: 'open' });
            
            for (let i = 0; i < 3; i++) {
                const item = document.createElement('li');
                item.className = 'list-item';
                shadow.appendChild(item);
            }
            
            const results = window.Pinpoint.ShadowPierce.queryDeepAll!(document, '#list >> .list-item');
            
            expect(results).toHaveLength(3);
        });
    });

    describe('findAllShadowRoots', () => {
        it('should return empty array for document with no shadows', () => {
            document.body.innerHTML = '<div>No shadows here</div>';
            
            const roots = window.Pinpoint.ShadowPierce.findAllShadowRoots!(document);
            
            expect(roots).toHaveLength(0);
        });

        it('should find all shadow roots in document', () => {
            // create two separate shadow hosts
            const host1 = document.createElement('div');
            document.body.appendChild(host1);
            host1.attachShadow({ mode: 'open' });
            
            const host2 = document.createElement('div');
            document.body.appendChild(host2);
            host2.attachShadow({ mode: 'open' });
            
            const roots = window.Pinpoint.ShadowPierce.findAllShadowRoots!(document);
            
            expect(roots).toHaveLength(2);
        });

        it('should find nested shadow roots', () => {
            const outerHost = document.createElement('div');
            document.body.appendChild(outerHost);
            const outerShadow = outerHost.attachShadow({ mode: 'open' });
            
            const innerHost = document.createElement('div');
            outerShadow.appendChild(innerHost);
            innerHost.attachShadow({ mode: 'open' });
            
            const roots = window.Pinpoint.ShadowPierce.findAllShadowRoots!(document);
            
            expect(roots).toHaveLength(2);
        });
    });
});
