import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// pinpoint global type
interface PinpointGlobal {
    Constants: {
        COPY_SUCCESS_DURATION_MS: number;
    };
    State: {
        shadowRoot?: ShadowRoot | null;
        detailPanel?: HTMLElement | null;
        originalCapturedElement?: Element | null;
        capturedElement?: Element | null;
        activeCrumbIndex?: number;
    };
    ShadowDOM: {
        createShadowRoot?: () => ShadowRoot;
    };
    Selector: {
        getAllSelectorFormats?: (el: Element) => any;
        getDomPath?: (el: Element) => any[];
        getAngularAttributes?: (el: Element) => string;
        getReactComponentName?: (el: Element) => string | null;
    };
    Events: {
        updateHighlight?: (el: Element) => void;
        disconnectObserver?: () => void;
    };
    UI: {
        renderSelector?: (text: string, container: HTMLElement) => void;
        renderPathCrumbs?: (pathData: Array<{label: string; depth: number}>, container: HTMLElement, activeIndex: number) => void;
        handleCrumbClick?: (index: number) => void;
        updateActiveCrumb?: (index: number) => void;
        createTooltip?: () => HTMLElement;
        createDetailPanel?: () => HTMLElement;
        closePanel?: () => void;
        showDetachedWarning?: () => void;
        clearDetachedWarning?: () => void;
    };
}

declare global {
    interface Window {
        Pinpoint: PinpointGlobal;
    }
}

describe('UI Components', () => {
    beforeEach(async () => {
        vi.resetModules();
        document.body.innerHTML = '';

        // mock pinpoint global with dependencies
        window.Pinpoint = {
            Constants: {
                COPY_SUCCESS_DURATION_MS: 1500
            },
            State: {
                shadowRoot: null,
                detailPanel: null,
                originalCapturedElement: null,
                capturedElement: null,
                activeCrumbIndex: 0
            },
            ShadowDOM: {
                createShadowRoot: vi.fn(() => {
                    const host = document.createElement('div');
                    document.body.appendChild(host);
                    const shadow = host.attachShadow({ mode: 'open' });
                    window.Pinpoint.State.shadowRoot = shadow;
                    return shadow;
                })
            },
            Selector: {
                getAllSelectorFormats: vi.fn(() => ({ playwright: '#test', depth: 0 })),
                getDomPath: vi.fn(() => []),
                getAngularAttributes: vi.fn(() => ''),
                getReactComponentName: vi.fn(() => null)
            },
            Events: {
                updateHighlight: vi.fn(),
                disconnectObserver: vi.fn()
            },
            UI: {}
        };

        // import module
        await import('../../modules/ui-components.js');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (window as any).Pinpoint;
    });

    describe('renderSelector (syntax highlighting)', () => {
        let container: HTMLElement;

        beforeEach(() => {
            container = document.createElement('code');
            document.body.appendChild(container);
        });

        it('should render plain text selector without highlighting', () => {
            window.Pinpoint.UI.renderSelector!('div', container);
            
            expect(container.textContent).toBe('div');
            // should be text node, no span wrapper
            expect(container.querySelector('span')).toBeNull();
        });

        it('should highlight ID selector with tok-id class', () => {
            window.Pinpoint.UI.renderSelector!('#my-id', container);
            
            const idSpan = container.querySelector('.tok-id');
            expect(idSpan).not.toBeNull();
            expect(idSpan?.textContent).toBe('#my-id');
        });

        it('should highlight class selector with tok-class class', () => {
            window.Pinpoint.UI.renderSelector!('.my-class', container);
            
            const classSpan = container.querySelector('.tok-class');
            expect(classSpan).not.toBeNull();
            expect(classSpan?.textContent).toBe('.my-class');
        });

        it('should highlight attribute selector with tok-attr class', () => {
            window.Pinpoint.UI.renderSelector!('[data-testid="foo"]', container);
            
            const attrSpan = container.querySelector('.tok-attr');
            expect(attrSpan).not.toBeNull();
            expect(attrSpan?.textContent).toBe('[data-testid="foo"]');
        });

        it('should handle complex selector with multiple tokens', () => {
            window.Pinpoint.UI.renderSelector!('div#main.container[role="main"]', container);
            
            expect(container.querySelector('.tok-id')?.textContent).toBe('#main');
            expect(container.querySelector('.tok-class')?.textContent).toBe('.container');
            expect(container.querySelector('.tok-attr')?.textContent).toBe('[role="main"]');
        });

        it('should preserve non-matching text between tokens', () => {
            window.Pinpoint.UI.renderSelector!('div #id span', container);
            
            // full text should be preserved
            expect(container.textContent).toBe('div #id span');
            // id should be highlighted
            expect(container.querySelector('.tok-id')?.textContent).toBe('#id');
        });

        it('should handle multiple classes', () => {
            window.Pinpoint.UI.renderSelector!('.class-one.class-two', container);
            
            const classSpans = container.querySelectorAll('.tok-class');
            expect(classSpans).toHaveLength(2);
            expect(classSpans[0]?.textContent).toBe('.class-one');
            expect(classSpans[1]?.textContent).toBe('.class-two');
        });

        it('should handle Playwright >> piercing syntax', () => {
            window.Pinpoint.UI.renderSelector!('#host >> #shadow-btn', container);
            
            // both IDs should be highlighted
            const idSpans = container.querySelectorAll('.tok-id');
            expect(idSpans).toHaveLength(2);
            // full text preserved
            expect(container.textContent).toContain('>>');
        });
    });

    describe('renderPathCrumbs', () => {
        let container: HTMLElement;
        const mockPathData = [
            { label: 'html', depth: 3 },
            { label: 'body', depth: 2 },
            { label: 'div#app', depth: 1 },
            { label: 'button.submit', depth: 0 }
        ];

        beforeEach(() => {
            container = document.createElement('div');
            document.body.appendChild(container);
        });

        it('should render correct number of crumbs', () => {
            window.Pinpoint.UI.renderPathCrumbs!(mockPathData, container, 3);
            
            const crumbs = container.querySelectorAll('.pp-crumb');
            expect(crumbs).toHaveLength(4);
        });

        it('should set data-index attribute on each crumb', () => {
            window.Pinpoint.UI.renderPathCrumbs!(mockPathData, container, 3);
            
            const crumbs = container.querySelectorAll('.pp-crumb');
            crumbs.forEach((crumb, i) => {
                expect(crumb.getAttribute('data-index')).toBe(String(i));
            });
        });

        it('should mark active crumb with pp-crumb-current class', () => {
            window.Pinpoint.UI.renderPathCrumbs!(mockPathData, container, 2);
            
            const crumbs = container.querySelectorAll('.pp-crumb');
            expect(crumbs[2].classList.contains('pp-crumb-current')).toBe(true);
            expect(crumbs[0].classList.contains('pp-crumb-current')).toBe(false);
            expect(crumbs[3].classList.contains('pp-crumb-current')).toBe(false);
        });

        it('should add separators between crumbs', () => {
            window.Pinpoint.UI.renderPathCrumbs!(mockPathData, container, 3);
            
            const separators = container.querySelectorAll('.pp-crumb-sep');
            // 4 crumbs = 3 separators
            expect(separators).toHaveLength(3);
            expect(separators[0].textContent).toBe('→');
        });

        it('should set crumb labels from pathData', () => {
            window.Pinpoint.UI.renderPathCrumbs!(mockPathData, container, 0);
            
            const crumbs = container.querySelectorAll('.pp-crumb');
            expect(crumbs[0].textContent).toBe('html');
            expect(crumbs[1].textContent).toBe('body');
            expect(crumbs[2].textContent).toBe('div#app');
            expect(crumbs[3].textContent).toBe('button.submit');
        });

        it('should clear container before rendering', () => {
            container.innerHTML = '<span>existing content</span>';
            
            window.Pinpoint.UI.renderPathCrumbs!(mockPathData, container, 0);
            
            expect(container.querySelector('span:not(.pp-crumb-sep)')).toBeNull();
        });

        it('should handle empty path data', () => {
            window.Pinpoint.UI.renderPathCrumbs!([], container, 0);
            
            expect(container.querySelectorAll('.pp-crumb')).toHaveLength(0);
        });

        it('should handle single crumb (no separators)', () => {
            window.Pinpoint.UI.renderPathCrumbs!([{ label: 'div', depth: 0 }], container, 0);
            
            expect(container.querySelectorAll('.pp-crumb')).toHaveLength(1);
            expect(container.querySelectorAll('.pp-crumb-sep')).toHaveLength(0);
        });
    });

    describe('createTooltip', () => {
        it('should create tooltip element with correct id', () => {
            const tooltip = window.Pinpoint.UI.createTooltip!();
            
            expect(tooltip.id).toBe('pp-tooltip');
        });

        it('should add tooltip to shadow root', () => {
            window.Pinpoint.UI.createTooltip!();
            
            const shadowRoot = window.Pinpoint.State.shadowRoot;
            expect(shadowRoot?.getElementById('pp-tooltip')).not.toBeNull();
        });
    });

    describe('createDetailPanel', () => {
        it('should create panel element with correct id', () => {
            const panel = window.Pinpoint.UI.createDetailPanel!();
            
            expect(panel.id).toBe('pp-panel');
        });

        it('should create backdrop element', () => {
            window.Pinpoint.UI.createDetailPanel!();
            
            const shadowRoot = window.Pinpoint.State.shadowRoot;
            expect(shadowRoot?.getElementById('pp-backdrop')).not.toBeNull();
        });

        it('should include close button', () => {
            const panel = window.Pinpoint.UI.createDetailPanel!();
            
            expect(panel.querySelector('#pp-close')).not.toBeNull();
        });

        it('should include all field sections', () => {
            const panel = window.Pinpoint.UI.createDetailPanel!();
            
            expect(panel.querySelector('#pp-selector')).not.toBeNull();
            expect(panel.querySelector('#pp-dimensions')).not.toBeNull();
            expect(panel.querySelector('#pp-component')).not.toBeNull();
            expect(panel.querySelector('#pp-angular')).not.toBeNull();
            expect(panel.querySelector('#pp-path')).not.toBeNull();
        });
    });

    describe('closePanel', () => {
        beforeEach(() => {
            // setup panel
            const panel = window.Pinpoint.UI.createDetailPanel!();
            window.Pinpoint.State.detailPanel = panel;
            panel.style.display = 'block';
        });

        it('should hide the panel', () => {
            window.Pinpoint.UI.closePanel!();
            
            expect(window.Pinpoint.State.detailPanel?.style.display).toBe('none');
        });

        it('should hide the backdrop', () => {
            const backdrop = window.Pinpoint.State.shadowRoot?.getElementById('pp-backdrop');
            if (backdrop) backdrop.style.display = 'block';
            
            window.Pinpoint.UI.closePanel!();
            
            expect(backdrop?.style.display).toBe('none');
        });

        it('should call disconnectObserver', () => {
            window.Pinpoint.UI.closePanel!();
            
            expect(window.Pinpoint.Events.disconnectObserver).toHaveBeenCalled();
        });
    });

    describe('showDetachedWarning', () => {
        beforeEach(() => {
            const panel = window.Pinpoint.UI.createDetailPanel!();
            window.Pinpoint.State.detailPanel = panel;
        });

        it('should add warning banner to panel', () => {
            window.Pinpoint.UI.showDetachedWarning!();
            
            const warning = window.Pinpoint.State.detailPanel?.querySelector('.pp-detached-warning');
            expect(warning).not.toBeNull();
            expect(warning?.textContent).toContain('element detached');
        });

        it('should add pp-detached class to selector field', () => {
            window.Pinpoint.UI.showDetachedWarning!();
            
            const selector = window.Pinpoint.State.detailPanel?.querySelector('#pp-selector');
            expect(selector?.classList.contains('pp-detached')).toBe(true);
        });
    });

    describe('clearDetachedWarning', () => {
        beforeEach(() => {
            const panel = window.Pinpoint.UI.createDetailPanel!();
            window.Pinpoint.State.detailPanel = panel;
            window.Pinpoint.UI.showDetachedWarning!();
        });

        it('should remove warning banner', () => {
            window.Pinpoint.UI.clearDetachedWarning!();
            
            const warning = window.Pinpoint.State.detailPanel?.querySelector('.pp-detached-warning');
            expect(warning).toBeNull();
        });

        it('should remove pp-detached class from selector field', () => {
            window.Pinpoint.UI.clearDetachedWarning!();
            
            const selector = window.Pinpoint.State.detailPanel?.querySelector('#pp-selector');
            expect(selector?.classList.contains('pp-detached')).toBe(false);
        });
    });
});
