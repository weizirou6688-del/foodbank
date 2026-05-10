// Playwright script to capture 4-frame public application journey
// Usage: node scripts/capture_journey.js  (from foodbank root)
// Requires: cd frontend && npx playwright ... OR run via npx from frontend/

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:5173';
const OUT  = path.join(__dirname, '..', 'docs', 'final_report', 'image', 'implementation');
const W = 1440, H = 900;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();

  // ── (a) /find-foodbank: enter SY23 3DB and click Search ─────────────────
  await page.goto(`${BASE}/find-foodbank`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[placeholder*="postcode" i], input[type="text"]', { timeout: 10000 });

  // Fill the postcode input (first visible text input on the page)
  const postcodeInput = page.locator('input[placeholder*="postcode" i]').first();
  await postcodeInput.fill('SY23 3DB');

  // Click the search/submit button
  const searchBtn = page.locator('button[type="submit"], button:has-text("Search"), button:has-text("Find")').first();
  await searchBtn.click();

  // Wait a moment so the form shows the filled state before results load
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'journey-public-01-search.png') });
  console.log('✓ (a) search form captured');

  // ── (b) Results list with map ─────────────────────────────────────────────
  // Wait for results / map to appear
  try {
    await page.waitForSelector('.leaflet-container, [class*="map"], [class*="result"], [class*="food-bank"]', { timeout: 15000 });
  } catch (_) {}
  await page.waitForTimeout(2000); // allow map tiles to render
  await page.screenshot({ path: path.join(OUT, 'journey-public-02-results.png') });
  console.log('✓ (b) results + map captured');

  // ── (c) /food-packages: click into a food bank, select 1 package ─────────
  // Try clicking the first food bank result (View packages button or card link)
  try {
    const viewBtn = page.locator('a:has-text("View packages"), a:has-text("View Packages"), button:has-text("View"), a[href*="food-packages"]').first();
    await viewBtn.click({ timeout: 8000 });
  } catch (_) {
    // fallback: click first card link
    await page.locator('a[href*="food-bank"], .food-bank-card a, [class*="card"] a').first().click();
  }

  await page.waitForURL(`${BASE}/food-packages**`, { timeout: 10000 });
  await page.waitForTimeout(1500);

  // Select the first available package (click its checkbox or select button)
  try {
    const selectBtn = page.locator('button:has-text("Select"), button:has-text("Add"), input[type="checkbox"]').first();
    await selectBtn.click({ timeout: 6000 });
    await page.waitForTimeout(600);
  } catch (_) {}

  await page.screenshot({ path: path.join(OUT, 'journey-public-03-select.png') });
  console.log('✓ (c) package selection captured');

  // ── (d) Login and submit → success page with redacted code ───────────────
  // Click Apply / Submit Application button to trigger auth modal or navigate
  try {
    const applyBtn = page.locator('button:has-text("Apply"), button:has-text("Submit"), button:has-text("Request"), a:has-text("Apply")').first();
    await applyBtn.click({ timeout: 6000 });
    await page.waitForTimeout(800);
  } catch (_) {}

  // If login modal appeared, fill credentials
  try {
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 5000 });
    await page.fill('input[type="email"], input[name="email"]', 'user@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'user12345');
    await page.locator('button[type="submit"]:has-text("Sign"), button[type="submit"]:has-text("Log"), button[type="submit"]').last().click();
    await page.waitForTimeout(2000);
  } catch (_) {}

  // After login, try submitting if not yet submitted
  try {
    const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Apply"), button[type="submit"]').first();
    await submitBtn.click({ timeout: 6000 });
    await page.waitForTimeout(2000);
  } catch (_) {}

  // Redact the redemption code: replace any XXXX-XXXX pattern text with ████-████
  await page.evaluate(() => {
    const pattern = /\b[A-Z2-9]{4}-[A-Z2-9]{4}\b/g;
    function redact(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (pattern.test(node.textContent)) {
          node.textContent = node.textContent.replace(pattern, 'XXXX-XXXX');
        }
      } else {
        node.childNodes.forEach(redact);
      }
    }
    redact(document.body);
  });

  await page.screenshot({ path: path.join(OUT, 'journey-public-04-redeemed.png') });
  console.log('✓ (d) success/redemption page captured');

  await browser.close();
  console.log('\nAll 4 frames saved to:', OUT);
}

main().catch(err => { console.error(err); process.exit(1); });
