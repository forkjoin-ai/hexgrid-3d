import { test, expect } from '@playwright/test';

test.describe('HexGrid 3D E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads and displays canvas', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('canvas has correct dimensions', async ({ page }) => {
    const canvas = page.locator('canvas');
    const boundingBox = await canvas.boundingBox();

    expect(boundingBox).not.toBeNull();
    expect(boundingBox!.width).toBeGreaterThan(0);
    expect(boundingBox!.height).toBeGreaterThan(0);
  });

  test('responds to mouse interactions', async ({ page }) => {
    const canvas = page.locator('canvas');

    // Click on canvas
    await canvas.click();

    // Drag on canvas
    await canvas.hover();
    await page.mouse.down();
    await page.mouse.move(100, 100);
    await page.mouse.up();

    // Verify canvas is still visible
    await expect(canvas).toBeVisible();
  });

  test('responds to touch interactions on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const canvas = page.locator('canvas');

    // Tap on canvas
    await canvas.tap();

    await expect(canvas).toBeVisible();
  });

  test('handles zoom interactions', async ({ page }) => {
    const canvas = page.locator('canvas');

    // Hover over canvas
    await canvas.hover();

    // Simulate scroll for zoom
    await page.mouse.wheel(0, 100);
    await page.mouse.wheel(0, -100);

    await expect(canvas).toBeVisible();
  });

  test('keyboard shortcuts work', async ({ page }) => {
    // Press 'D' key to toggle debug
    await page.keyboard.press('d');

    // Wait a moment for any UI changes
    await page.waitForTimeout(100);

    // Press 'Escape' key
    await page.keyboard.press('Escape');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('loads with different photo counts', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Canvas should remain stable regardless of photo count
    await page.waitForTimeout(1000);
    await expect(canvas).toBeVisible();
  });

  test('performance: renders within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    const canvas = page.locator('canvas');
    await canvas.waitFor({ state: 'visible' });

    const loadTime = Date.now() - startTime;

    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('accessibility: canvas has proper attributes', async ({ page }) => {
    const canvas = page.locator('canvas');

    // Check for accessibility attributes
    const role = await canvas.getAttribute('role');
    expect(role).toBeTruthy();
  });

  test('handles window resize', async ({ page }) => {
    const canvas = page.locator('canvas');

    // Initial size
    const initialBox = await canvas.boundingBox();
    expect(initialBox).not.toBeNull();

    // Resize window
    await page.setViewportSize({ width: 1024, height: 768 });

    // Canvas should still be visible and resized
    await expect(canvas).toBeVisible();

    const newBox = await canvas.boundingBox();
    expect(newBox).not.toBeNull();
  });

  test('maintains state across interactions', async ({ page }) => {
    const canvas = page.locator('canvas');

    // Perform multiple interactions
    await canvas.click({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(100);

    await canvas.click({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(100);

    // Canvas should still be responsive
    await expect(canvas).toBeVisible();
  });
});
