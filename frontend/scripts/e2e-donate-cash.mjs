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

const executablePath = findBrowserExecutable()

if (!executablePath) {
  console.error('No Edge or Chrome executable was found on this machine.')
  process.exit(1)
}

const frontendUrl = process.env.DONATE_CASH_E2E_URL || 'http://127.0.0.1:5173/donate/cash'
const artifactsDir = path.resolve(process.cwd(), '.artifacts')
fs.mkdirSync(artifactsDir, { recursive: true })

const browser = await chromium.launch({
  executablePath,
  headless: true,
})

const context = await browser.newContext()
const page = await context.newPage()

try {
  await page.goto(frontendUrl, { waitUntil: 'networkidle', timeout: 30000 })

  await page.getByLabel('Email Address *').fill('e2e-donate-cash@example.com')
  await page.getByLabel('Cardholder Name *').fill('E2E Donate Cash')
  await page.getByRole('button', { name: /£20/ }).click()
  await page.getByLabel('Card Number *').fill('4242424242424242')
  await page.getByLabel('Expiry Date *').fill('12/29')
  await page.getByLabel('CVV *').fill('123')
  await page.getByRole('button', { name: 'Submit Donation Request' }).click()

  const feedback = page.locator('[role="status"], [role="alert"]').last()
  await feedback.waitFor({ state: 'visible', timeout: 30000 })

  const message = (await feedback.textContent())?.trim() ?? ''
  const screenshotPath = path.join(artifactsDir, 'donate-cash-e2e.png')
  await page.screenshot({ path: screenshotPath, fullPage: true })

  console.log(
    JSON.stringify(
      {
        ok: true,
        url: frontendUrl,
        executablePath,
        message,
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
