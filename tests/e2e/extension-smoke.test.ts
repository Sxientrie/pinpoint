import { test, expect, chromium, Page } from '@playwright/test';
import path from 'path';
import http from 'http';
import fs from 'fs';
import os from 'os';

let server: http.Server;
const PORT = 3000;
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');
const DIST_DIR = path.resolve(__dirname, '../../dist');

test.beforeAll(async () => {
    server = http.createServer((req, res) => {
        // Try to serve from dist first (for extension scripts)
        const distPath = path.join(DIST_DIR, req.url || '');
        const fixturePath = path.join(FIXTURES_DIR, req.url === '/' ? 'test-page.html' : req.url || 'test-page.html');
        
        // Check dist folder first
        if (req.url && fs.existsSync(distPath) && fs.statSync(distPath).isFile()) {
            const ext = path.extname(distPath);
            const contentType = ext === '.js' ? 'application/javascript' :
                               ext === '.css' ? 'text/css' : 'text/html';
            fs.readFile(distPath, (err, content) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Error reading file');
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content);
                }
            });
            return;
        }
        
        // Fallback to fixtures
        fs.readFile(fixturePath, (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('Not found');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(content);
            }
        });
    });
    
    return new Promise<void>((resolve) => {
        server.listen(PORT, () => {
            console.log(`Test server running at http://localhost:${PORT}`);
            resolve();
        });
    });
});

test.afterAll(async () => {
    return new Promise<void>((resolve) => {
        server.close(() => resolve());
    });
});

/**
 * Inject extension scripts directly into the page
 */
async function injectExtensionScripts(page: Page) {
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
    
    // Inject each script from our test server
    for (const script of CONTENT_SCRIPTS) {
        await page.addScriptTag({
            url: `http://localhost:${PORT}/${script}`
        });
    }
    
    // Inject CSS
    await page.addStyleTag({
        url: `http://localhost:${PORT}/styles.css`
    });
    
    // Mock chrome.runtime.id for the extension context check
    // Then activate the extension by calling lifecycle.init()
    await page.evaluate(() => {
        // Mock chrome.runtime.id if not present (for test environment)
        if (typeof chrome === 'undefined') {
            (window as any).chrome = {};
        }
        if (!(window as any).chrome.runtime) {
            (window as any).chrome.runtime = {};
        }
        if (!(window as any).chrome.runtime.id) {
            (window as any).chrome.runtime.id = 'test-extension-id';
        }
        
        if ((window as any).Pinpoint?.Lifecycle?.init) {
            (window as any).Pinpoint.Lifecycle.init();
        }
    });
}

test.describe('Extension E2E Smoke Tests', () => {
    test('should load extension and generate selectors', async () => {
        const pathToExtension = path.resolve(__dirname, '../../dist');
        const userDataDir = path.join(os.tmpdir(), 'pinpoint-test-user-data-' + Date.now());

        const context = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            args: [
                `--disable-extensions-except=${pathToExtension}`,
                `--load-extension=${pathToExtension}`,
                '--headless=new'
            ]
        });

        // Open a new page and navigate
        const page = await context.newPage();
        const testUrl = `http://localhost:${PORT}/test-page.html`;
        await page.goto(testUrl);
        await page.waitForLoadState('domcontentloaded');
        
        // Inject extension scripts directly into the page from our server
        await injectExtensionScripts(page);
        
        // Wait for extension UI to initialize
        await page.waitForTimeout(500);
        
        // Verify the shadow host was created
        const shadowHostExists = await page.evaluate(() => {
            return !!document.querySelector('pinpoint-root');
        });
        console.log('Shadow host exists:', shadowHostExists);
        expect(shadowHostExists).toBe(true);
        
        // Hold Alt and move mouse over the shadow button
        const shadowBtn = page.locator('#host >> #shadow-btn');
        const box = await shadowBtn.boundingBox();
        expect(box).not.toBeNull();
        
        if (box) {
            await page.keyboard.down('Alt');
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.waitForTimeout(300);
        }

        // Check overlay is visible
        const overlayLocator = page.locator('pinpoint-root >> #pp-overlay');
        await expect(overlayLocator).toBeVisible({ timeout: 5000 });
        
        // Verify opacity is 1
        const opacity = await overlayLocator.evaluate((el) => {
            return window.getComputedStyle(el).opacity;
        });
        expect(opacity).toBe('1');

        // Click with Alt held to capture element
        await shadowBtn.click({ modifiers: ['Alt'] });
        await page.keyboard.up('Alt');

        // Verify panel is visible
        const panelLocator = page.locator('pinpoint-root >> #pp-panel');
        await expect(panelLocator).toBeVisible({ timeout: 5000 });
        
        // Get selector text from the panel
        const selectorCode = page.locator('pinpoint-root >> #pp-selector');
        const selectorText = await selectorCode.textContent();
        expect(selectorText).toBeTruthy();
        
        console.log('Generated Selector:', selectorText);
        
        // Should contain 'host' (ID of shadow host element)
        expect(selectorText).toContain('host');
        
        await context.close();
    });
});
