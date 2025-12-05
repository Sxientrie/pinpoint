import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import http from 'http';
import fs from 'fs';
import os from 'os';

let server: http.Server;
const PORT = 3000;
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

test.beforeAll(async () => {
    // Start a simple HTTP server to serve the fixture
    server = http.createServer((req, res) => {
        const filePath = path.join(FIXTURES_DIR, req.url === '/' ? 'test-page.html' : req.url || 'test-page.html');
        fs.readFile(filePath, (err, content) => {
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

test.describe('Extension E2E Smoke Tests', () => {
    test('should load extension and generate selectors', async () => {
        const pathToExtension = path.resolve(__dirname, '../../dist');
        const userDataDir = path.join(os.tmpdir(), 'pinpoint-test-user-data-' + Date.now());

        const context = await chromium.launchPersistentContext(userDataDir, {
            headless: false, // Force false locally, but config/args control actual behavior
            args: [
                `--disable-extensions-except=${pathToExtension}`,
                `--load-extension=${pathToExtension}`,
                '--headless=new'
            ]
        });

        const page = await context.newPage();

        // Navigate to local server
        await page.goto(`http://localhost:${PORT}/test-page.html`);

        // Wait for page load
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000); // Give extension time to inject content scripts

        // Locate the element inside Shadow DOM
        const shadowBtn = page.locator('#host >> #shadow-btn');
        const box = await shadowBtn.boundingBox();
        if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        }

        // Assertion 1: Verify "Pinpoint Overlay" is visible
        const overlayLocator = page.locator('pinpoint-root >> #pp-overlay');
        await expect(overlayLocator).toBeVisible({ timeout: 5000 });

        // Verify opacity
        const opacity = await overlayLocator.evaluate((el) => {
            return window.getComputedStyle(el).opacity;
        });
        expect(opacity).toBe('1');

        // Assertion 2: Click the element (simulating capture)
        await shadowBtn.click();

        // Assertion 3: Read the text from the extension's side panel
        const panelLocator = page.locator('pinpoint-root >> #pp-panel');
        await expect(panelLocator).toBeVisible();

        // Get the text content which should contain the selector
        const panelText = await panelLocator.textContent();
        expect(panelText).toBeTruthy();

        const generatedSelector = panelText!.trim();
        console.log('Generated Selector:', generatedSelector);

        // Check reasonable content (contains host ID)
        expect(generatedSelector).toContain('host');

        // Dogfood Check: Use the ACTUAL generated selector from the extension
        // This verifies that the extension produces valid Playwright selectors
        const checkLocator = page.locator(generatedSelector);

        // Verify it points to the same element (or at least is visible)
        // Since we clicked a button, checking visibility is good.
        await expect(checkLocator).toBeVisible();

        // Optional: Ensure it matches the clicked element text
        await expect(checkLocator).toHaveText('Shadow Button');

        await context.close();
    });
});
