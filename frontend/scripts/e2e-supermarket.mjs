import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright-core'

const CANDIDATE_BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
]

const findBrowserExecutable = () => CANDIDATE_BROWSERS.find((filePath) => fs.existsSync(filePath))

const isVisibleWithin = async (locator, timeout = 5000) => {
  try {
    await locator.waitFor({ state: 'visible', timeout })
    return true
  } catch {
    return false
  }
}

const parseLowStockNumbers = (text) => {
  const match = text.match(/Current stock:\s*([0-9]+(?:\.[0-9]+)?)\s*(?:[A-Za-z]+)?\s*\(below\s*([0-9]+(?:\.[0-9]+)?)/i)
  if (!match) {
    return null
  }

  return {
    currentStock: Number(match[1]),
    threshold: Number(match[2]),
  }
}

const executablePath = findBrowserExecutable()

if (!executablePath) {
  console.error('No Edge or Chrome executable was found on this machine.')
  process.exit(1)
}

const frontendUrl = process.env.SUPERMARKET_E2E_URL || 'http://127.0.0.1:5173/supermarket'
const email = process.env.SUPERMARKET_E2E_EMAIL || 'supermarket@foodbank.com'
const password = process.env.SUPERMARKET_E2E_PASSWORD || 'supermarket123'
const requestedItemName = process.env.SUPERMARKET_E2E_ITEM_NAME?.trim() || ''
const quantity = Number(process.env.SUPERMARKET_E2E_QUANTITY || '18')
const headless = process.env.SUPERMARKET_E2E_HEADLESS !== 'false'
const artifactsDir = path.resolve(process.cwd(), '.artifacts')

if (!Number.isFinite(quantity) || quantity <= 0) {
  console.error('SUPERMARKET_E2E_QUANTITY must be a number greater than 0.')
  process.exit(1)
}

fs.mkdirSync(artifactsDir, { recursive: true })

const browser = await chromium.launch({
  executablePath,
  headless,
})

const context = await browser.newContext()
const page = await context.newPage()

try {
  await page.goto(frontendUrl, { waitUntil: 'networkidle', timeout: 30000 })

  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 30000 })
  await page.locator('#signin-email').fill(email)
  await page.locator('#signin-password').fill(password)
  await page.locator('form').getByRole('button', { name: 'Sign In' }).click()

  await page.getByRole('heading', { name: 'Restock Submission' }).waitFor({ state: 'visible', timeout: 30000 })

  let selectionMode = 'manual-item'
  let selectedItemName = requestedItemName
  let selectedItemMetrics = null
  const viewFullListButton = page.getByRole('button', { name: 'View Full List' })
  const lowStockOverlay = page.locator('div.fixed.inset-0.z-50')

  if (await isVisibleWithin(viewFullListButton, 8000)) {
    selectionMode = 'low-stock-modal'
    await viewFullListButton.click()
    await lowStockOverlay.waitFor({ state: 'visible', timeout: 10000 })

    const itemCards = lowStockOverlay.locator('div.flex.items-center.justify-between.rounded-lg.p-4')
    const itemCard = requestedItemName
      ? itemCards.filter({
          has: lowStockOverlay.getByRole('heading', { name: requestedItemName, exact: true }),
        }).first()
      : itemCards.first()

    if (!(await itemCard.count())) {
      throw new Error(
        requestedItemName
          ? `Low stock modal does not contain "${requestedItemName}".`
          : 'Low stock modal is open, but no selectable item was found.',
      )
    }

    selectedItemName =
      (await itemCard.getByRole('heading').first().textContent())?.trim() || requestedItemName || 'Unknown item'

    const stockSummary = (await itemCard.locator('p').textContent())?.trim() || ''
    selectedItemMetrics = parseLowStockNumbers(stockSummary)

    await itemCard.getByTitle('Add this inventory item to the form').click()
    await lowStockOverlay.waitFor({ state: 'hidden', timeout: 10000 })
  } else if (!requestedItemName) {
    throw new Error(
      'No visible low stock list was found. Set SUPERMARKET_E2E_ITEM_NAME to run the form in manual item mode.',
    )
  }

  const itemInput = page.locator('input[placeholder="Use low stock list or exact inventory name"]').first()
  const quantityInput = page.locator('input[placeholder="Quantity"]').first()

  await itemInput.waitFor({ state: 'visible', timeout: 10000 })

  if (selectionMode === 'manual-item') {
    await itemInput.fill(selectedItemName)
  }

  if (!selectedItemName) {
    selectedItemName = (await itemInput.inputValue()).trim()
  }

  await quantityInput.fill(String(quantity))

  const dialogPromise = page.waitForEvent('dialog', { timeout: 30000 })
  await page.getByRole('button', { name: 'Submit Restock' }).click()
  const dialog = await dialogPromise
  const message = dialog.message()
  await dialog.accept()

  await page.waitForFunction(
    () => {
      const itemField = document.querySelector('input[placeholder="Use low stock list or exact inventory name"]')
      const quantityField = document.querySelector('input[placeholder="Quantity"]')

      return (
        itemField instanceof HTMLInputElement &&
        quantityField instanceof HTMLInputElement &&
        itemField.value === '' &&
        quantityField.value === ''
      )
    },
    { timeout: 10000 },
  )

  let lowStockCheck = null

  if (selectionMode === 'low-stock-modal' && selectedItemName && selectedItemMetrics) {
    const expectedResolved = selectedItemMetrics.currentStock + quantity >= selectedItemMetrics.threshold
    const lowStockButtonVisible = await isVisibleWithin(viewFullListButton, 3000)
    let isStillListed = false

    if (lowStockButtonVisible) {
      await viewFullListButton.click()
      await lowStockOverlay.waitFor({ state: 'visible', timeout: 10000 })
      const selectedItemHeading = lowStockOverlay.getByRole('heading', { name: selectedItemName, exact: true })
      isStillListed = (await selectedItemHeading.count()) > 0
      await lowStockOverlay.locator('button').first().click()
      await lowStockOverlay.waitFor({ state: 'hidden', timeout: 10000 })
    }

    lowStockCheck = {
      expectedResolved,
      isStillListed,
      passed: expectedResolved ? !isStillListed : isStillListed,
    }

    if (!lowStockCheck.passed) {
      throw new Error(
        expectedResolved
          ? `"${selectedItemName}" should no longer be in the low stock list after submission, but it is still shown.`
          : `"${selectedItemName}" should still be low stock after submission, but it disappeared from the list.`,
      )
    }
  }

  const screenshotPath = path.join(artifactsDir, 'supermarket-e2e.png')
  await page.screenshot({ path: screenshotPath, fullPage: true })

  console.log(
    JSON.stringify(
      {
        ok: true,
        url: frontendUrl,
        executablePath,
        selectionMode,
        selectedItemName,
        quantity,
        message,
        lowStockCheck,
        screenshotPath,
      },
      null,
      2,
    ),
  )
} finally {
  await context.close()
  await browser.close()
}
