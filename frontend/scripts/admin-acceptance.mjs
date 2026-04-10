import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { chromium } from 'playwright-core'

const CANDIDATE_BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
]

const executablePath = CANDIDATE_BROWSERS.find((filePath) => fs.existsSync(filePath))

if (!executablePath) {
  console.error('No Edge or Chrome executable was found on this machine.')
  process.exit(1)
}

const FRONTEND_URL = process.env.ADMIN_ACCEPTANCE_URL || 'http://localhost:5173'
const BACKEND_URL = process.env.ADMIN_ACCEPTANCE_API || 'http://127.0.0.1:8000'
const headless = process.env.ADMIN_ACCEPTANCE_HEADLESS !== 'false'
const artifactsDir = path.resolve(process.cwd(), '.artifacts', 'admin-acceptance')
const cleanupScriptPath = path.resolve(process.cwd(), '..', 'scripts', 'cleanup_admin_acceptance.py')

fs.mkdirSync(artifactsDir, { recursive: true })

const timestamp = `${Date.now()}`
const cleanupState = {
  publicUsers: [],
  packageRestores: {},
  goodsDonationEmails: [],
}

const safeJsonParse = (value) => {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const normalizeApiUrl = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl)
    if (!parsed.pathname.startsWith('/api/v1/')) {
      return null
    }
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return null
  }
}

const attachApiTrafficRecorder = (page, roleKey) => {
  const pending = new Map()
  const completed = []
  let requestCounter = 0

  const onRequest = (request) => {
    const url = normalizeApiUrl(request.url())
    if (!url) {
      return
    }

    requestCounter += 1
    pending.set(request, {
      id: `${roleKey}-${requestCounter}`,
      role: roleKey,
      method: request.method(),
      url,
      resourceType: request.resourceType(),
      pageUrl: page.url(),
      requestBody: safeJsonParse(request.postData() || ''),
      startedAt: new Date().toISOString(),
    })
  }

  const onRequestFinished = async (request) => {
    const entry = pending.get(request)
    if (!entry) {
      return
    }

    pending.delete(request)
    const response = await request.response()
    completed.push({
      ...entry,
      status: response?.status() ?? null,
      ok: response?.ok() ?? false,
      endedAt: new Date().toISOString(),
    })
  }

  const onRequestFailed = (request) => {
    const entry = pending.get(request)
    if (!entry) {
      return
    }

    pending.delete(request)
    completed.push({
      ...entry,
      status: null,
      ok: false,
      failureText: request.failure()?.errorText ?? 'unknown request failure',
      endedAt: new Date().toISOString(),
    })
  }

  page.on('request', onRequest)
  page.on('requestfinished', onRequestFinished)
  page.on('requestfailed', onRequestFailed)

  return {
    flush() {
      for (const entry of pending.values()) {
        completed.push({
          ...entry,
          status: null,
          ok: false,
          failureText: 'request still pending when recorder stopped',
          endedAt: new Date().toISOString(),
        })
      }
      pending.clear()
      return completed
    },
    stop() {
      page.off('request', onRequest)
      page.off('requestfinished', onRequestFinished)
      page.off('requestfailed', onRequestFailed)
    },
  }
}

const browser = await chromium.launch({
  executablePath,
  headless,
})

const ok = (value, message = 'Assertion failed') => {
  if (!value) {
    throw new Error(message)
  }
}

const mondayIso = () => {
  const now = new Date()
  const local = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = local.getUTCDay()
  const delta = day === 0 ? -6 : 1 - day
  local.setUTCDate(local.getUTCDate() + delta)
  return local.toISOString().slice(0, 10)
}

const formatUkDate = (date) => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${day}/${month}/${year}`
}

const todayUk = () => formatUkDate(new Date())

const apiRequest = async (method, pathname, { token, body } = {}) => {
  const response = await fetch(`${BACKEND_URL}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const rawText = await response.text()
  let data = null
  if (rawText) {
    try {
      data = JSON.parse(rawText)
    } catch {
      data = rawText
    }
  }

  if (!response.ok) {
    const detail =
      (data && typeof data === 'object' && 'detail' in data && data.detail)
      || (data && typeof data === 'object' && 'message' in data && data.message)
      || rawText
      || `${method} ${pathname} failed`
    throw new Error(String(detail))
  }

  return data
}

const loginByApi = async (email, password) =>
  apiRequest('POST', '/api/v1/auth/login', {
    body: { email, password },
  })

const registerPublicUser = async (email, password, name) =>
  apiRequest('POST', '/api/v1/auth/register', {
    body: { email, password, name },
  })

const createPendingGoodsDonation = async (adminToken, donorName, donorEmail) =>
  apiRequest('POST', '/api/v1/donations/goods', {
    token: adminToken,
    body: {
      donor_name: donorName,
      donor_type: 'individual',
      donor_email: donorEmail,
      donor_phone: '07123456789',
      pickup_date: todayUk(),
      status: 'pending',
      items: [
        {
          item_name: 'Rice',
          quantity: 1,
          expiry_date: '2026-12-31',
        },
      ],
    },
  })

const createTempApplications = async ({ label, count, packageId, foodBankId, quantityPerApp = 1 }) => {
  const email = `acceptance-${label}-${timestamp}@example.com`
  const password = 'Accept@12345'
  await registerPublicUser(email, password, `Acceptance ${label}`)
  cleanupState.publicUsers.push(email)

  const login = await loginByApi(email, password)
  const userToken = login.access_token
  const applications = []

  for (let index = 0; index < count; index += 1) {
    const application = await apiRequest('POST', '/api/v1/applications', {
      token: userToken,
      body: {
        food_bank_id: foodBankId,
        week_start: mondayIso(),
        items: [{ package_id: packageId, quantity: quantityPerApp }],
      },
    })
    applications.push(application)
  }

  cleanupState.packageRestores[packageId] = (cleanupState.packageRestores[packageId] || 0) + count * quantityPerApp
  return applications
}

const buildPersistedAuthState = (loginData) =>
  JSON.stringify({
    state: {
      user: loginData.user,
      isAuthenticated: true,
      accessToken: loginData.access_token,
      refreshToken: loginData.refresh_token ?? null,
    },
    version: 0,
  })

const primeAuth = async (page, loginData) => {
  await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.evaluate((persisted) => {
    window.localStorage.setItem('fba-auth-storage', persisted)
  }, buildPersistedAuthState(loginData))
}

const getPreviewFrameScope = async (page, title, readySelector = '.hero-buttons') => {
  const selector = `iframe[title="${title}"]`
  const iframe = page.locator(selector)
  await iframe.waitFor({ state: 'visible', timeout: 30000 })

  const iframeHandle = await iframe.elementHandle()
  ok(iframeHandle, `${title} iframe element was not available`)

  const frame = await iframeHandle.contentFrame()
  ok(frame, `${title} iframe content was not available`)

  const frameLocator = page.frameLocator(selector)
  await frameLocator.locator(readySelector).waitFor({ state: 'visible', timeout: 30000 })

  return {
    locator: (...args) => frameLocator.locator(...args),
    evaluate: (...args) => frame.evaluate(...args),
    waitForTimeout: (...args) => frame.waitForTimeout(...args),
  }
}

const getFoodFrame = async (page) =>
  getPreviewFrameScope(page, 'Food Management Preview')

const getDashboardFrame = async (page) =>
  getPreviewFrameScope(page, 'Data Dashboard Preview')

const waitForToast = async (frame, expectedText) => {
  const toast = frame.locator('#action-toast')
  const deadline = Date.now() + 20000

  while (Date.now() < deadline) {
    const toastText = (await toast.textContent()) || ''
    if (toastText.includes(expectedText)) {
      return
    }

    await frame.waitForTimeout(200)
  }

  throw new Error(`Expected toast to include "${expectedText}"`)
}

const findGroupInput = (scope, labelText) => {
  return scope
    .locator('.form-label')
    .filter({ hasText: labelText })
    .locator('xpath=..')
    .locator('input, select, textarea')
    .first()
}

const findOptionalGroupInput = async (scope, labelText) => {
  const label = scope
    .locator('.form-label')
    .filter({ hasText: labelText })
    .first()

  if ((await label.count()) === 0) {
    return null
  }

  return label
    .locator('xpath=..')
    .locator('input, select, textarea')
    .first()
}

const selectFoodBankIfPresent = async (scope, preferredValue = null) => {
  const field = await findOptionalGroupInput(scope, 'Food Bank')
  if (!field) {
    return preferredValue
  }

  const optionValues = await field.locator('option').evaluateAll((options) =>
    options
      .map((option) => ({
        value: option.getAttribute('value') ?? '',
        disabled: option.disabled,
      }))
      .filter((option) => option.value && !option.disabled)
      .map((option) => option.value),
  )

  const selectedValue = preferredValue && optionValues.includes(preferredValue)
    ? preferredValue
    : optionValues[0] ?? null

  ok(selectedValue, 'No selectable food bank option was available')
  await field.selectOption(selectedValue)
  return selectedValue
}

const selectScopedFoodBankFilterIfPresent = async (frame, preferredValue = null) => {
  const field = frame.locator('#inventory-food-bank-filter')
  if ((await field.count()) === 0) {
    return preferredValue
  }

  const optionValues = await field.locator('option').evaluateAll((options) =>
    options
      .map((option) => ({
        value: option.getAttribute('value') ?? '',
        disabled: option.disabled,
      }))
      .filter((option) => option.value && !option.disabled)
      .map((option) => option.value),
  )

  const selectedValue = preferredValue && optionValues.includes(preferredValue)
    ? preferredValue
    : optionValues[0] ?? null

  ok(selectedValue, 'No selectable scoped food bank option was available')
  await field.selectOption(selectedValue)
  await frame.waitForTimeout(400)
  return selectedValue
}

const expectDownload = async (page, trigger, expectedName) => {
  const downloadPromise = page.waitForEvent('download', { timeout: 20000 })
  await trigger()
  const download = await downloadPromise
  const suggested = download.suggestedFilename()
  ok(suggested === expectedName, `Expected download "${expectedName}", got "${suggested}"`)
  await download.saveAs(path.join(artifactsDir, `${Date.now()}-${suggested}`))
}

const ensureRowByText = async (frame, tbodyId, text) => {
  const row = frame.locator(`#${tbodyId} tr`).filter({ hasText: text }).first()
  await row.waitFor({ state: 'visible', timeout: 30000 })
  return row
}

const setTableSearch = async (frame, sectionSelector, text) => {
  const searchInput = frame.locator(`${sectionSelector} .table-search-input`).first()
  if (await searchInput.count()) {
    await searchInput.fill(text)
    await frame.waitForTimeout(300)
  }
}

const findDonationRow = async (frame, text, searchText = text) => {
  await setTableSearch(frame, '#donation-intake', searchText)
  return ensureRowByText(frame, 'donation-table-body', text)
}

const findCodeRow = async (frame, text, searchText = text) => {
  await setTableSearch(frame, '#code-verification', searchText)
  return ensureRowByText(frame, 'code-table-body', text)
}

const clickHeroAndAssertScroll = async (frame, buttonText, targetId) => {
  const topBefore = await frame.evaluate(() => (document.scrollingElement ?? document.documentElement).scrollTop)
  await frame.locator('.hero-buttons a', { hasText: buttonText }).first().evaluate((element) => {
    if (element instanceof HTMLElement) {
      element.click()
    }
  })
  await frame.waitForTimeout(250)
  const state = await frame.evaluate((id) => {
    const scroller = document.scrollingElement ?? document.documentElement
    const target = document.getElementById(id)
    if (!(target instanceof HTMLElement)) {
      return { exists: false, scrollTop: scroller.scrollTop, targetTop: null }
    }

    return {
      exists: true,
      scrollTop: scroller.scrollTop,
      targetTop: target.getBoundingClientRect().top,
    }
  }, targetId)
  ok(state.exists, `Missing target section ${targetId}`)
  ok(state.scrollTop !== topBefore || Math.abs(state.targetTop ?? 9999) < 220, `Hero button "${buttonText}" did not navigate`)
}

const waitForScrollTop = async (frame, threshold = 50, timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const scrollTop = await frame.evaluate(() => (document.scrollingElement ?? document.documentElement).scrollTop)
    if (scrollTop < threshold) {
      return scrollTop
    }

    await frame.waitForTimeout(200)
  }

  return frame.evaluate(() => (document.scrollingElement ?? document.documentElement).scrollTop)
}

const recordCheck = (checks, section, name, status, detail = '') => {
  checks.push({ section, name, status, detail })
}

const runFoodAcceptance = async ({ page, roleKey, roleLabel, adminLogin }) => {
  const checks = []
  const roleToken = adminLogin.access_token
  let selectedFoodBankValue = null

  const pendingDonations = await Promise.all([
    createPendingGoodsDonation(roleToken, `Acceptance ${roleKey} Receive ${timestamp}`, `acceptance-${roleKey}-receive-${timestamp}@example.com`),
    createPendingGoodsDonation(roleToken, `Acceptance ${roleKey} Batch A ${timestamp}`, `acceptance-${roleKey}-batch-a-${timestamp}@example.com`),
    createPendingGoodsDonation(roleToken, `Acceptance ${roleKey} Batch B ${timestamp}`, `acceptance-${roleKey}-batch-b-${timestamp}@example.com`),
    createPendingGoodsDonation(roleToken, `Acceptance ${roleKey} Delete ${timestamp}`, `acceptance-${roleKey}-delete-${timestamp}@example.com`),
    createPendingGoodsDonation(roleToken, `Acceptance ${roleKey} Batch Delete ${timestamp}`, `acceptance-${roleKey}-batch-delete-${timestamp}@example.com`),
  ])
  cleanupState.goodsDonationEmails.push(
    `acceptance-${roleKey}-receive-${timestamp}@example.com`,
    `acceptance-${roleKey}-batch-a-${timestamp}@example.com`,
    `acceptance-${roleKey}-batch-b-${timestamp}@example.com`,
    `acceptance-${roleKey}-delete-${timestamp}@example.com`,
    `acceptance-${roleKey}-batch-delete-${timestamp}@example.com`,
  )

  const foodBankPackages = await apiRequest('GET', '/api/v1/food-banks/1/packages')
  const packageForCode = foodBankPackages.find((pkg) => Number(pkg.stock ?? 0) >= 3) || foodBankPackages[0]
  ok(packageForCode, 'No package available for code verification acceptance')

  const codeApps = await createTempApplications({
    label: `${roleKey}-codes`,
    count: 3,
    packageId: packageForCode.id,
    foodBankId: 1,
  })

  const verifyApp = codeApps[0]
  const voidApp = codeApps[1]
  const batchVoidApp = codeApps[2]

  await page.goto(`${FRONTEND_URL}/admin?section=food`, { waitUntil: 'networkidle', timeout: 30000 })
  const frame = await getFoodFrame(page)
  selectedFoodBankValue = await selectScopedFoodBankFilterIfPresent(frame, selectedFoodBankValue)

  const adminTag = await frame.locator('.admin-tag').textContent()
  recordCheck(checks, 'food', 'role tag', adminTag?.includes(roleLabel) ? 'pass' : 'fail', adminTag || '')

  await clickHeroAndAssertScroll(frame, 'New Donation', 'donation-intake')
  recordCheck(checks, 'food', 'hero: new donation', 'pass')
  await clickHeroAndAssertScroll(frame, 'Low Stock Alerts', 'low-stock')
  recordCheck(checks, 'food', 'hero: low stock alerts', 'pass')
  await clickHeroAndAssertScroll(frame, 'Package Management', 'package-management')
  recordCheck(checks, 'food', 'hero: package management', 'pass')
  await clickHeroAndAssertScroll(frame, 'Expiry Tracking', 'expiry-tracking')
  recordCheck(checks, 'food', 'hero: expiry tracking', 'pass')
  await clickHeroAndAssertScroll(frame, 'Code Verification', 'code-verification')
  recordCheck(checks, 'food', 'hero: code verification', 'pass')

  await frame.locator('.nav-links a', { hasText: 'Data Dashboard' }).click()
  await page.waitForURL(/section=statistics/, { timeout: 20000 })
  recordCheck(checks, 'food', 'nav to statistics', 'pass')
  await page.goto(`${FRONTEND_URL}/admin?section=food`, { waitUntil: 'networkidle', timeout: 30000 })
  const foodFrame = await getFoodFrame(page)
  selectedFoodBankValue = await selectScopedFoodBankFilterIfPresent(foodFrame, selectedFoodBankValue)

  await expectDownload(page, () => foodFrame.locator('#export-donation-btn').click(), 'donation-intake-records.xlsx')
  recordCheck(checks, 'food', 'export donations', 'pass')
  await expectDownload(page, () => foodFrame.locator('#export-inventory-btn').click(), 'inventory-items.xlsx')
  recordCheck(checks, 'food', 'export inventory', 'pass')
  await expectDownload(page, () => foodFrame.locator('#export-package-btn').click(), 'food-packages.xlsx')
  recordCheck(checks, 'food', 'export packages', 'pass')
  await expectDownload(page, () => foodFrame.locator('#export-lot-btn').click(), 'inventory-lots.xlsx')
  recordCheck(checks, 'food', 'export lots', 'pass')
  await expectDownload(page, () => foodFrame.locator('#export-code-btn').click(), 'redemption-codes.xlsx')
  recordCheck(checks, 'food', 'export codes', 'pass')

  const uiDonationName = `Acceptance ${roleKey} UI Donation ${timestamp}`
  const uiDonationEmail = `acceptance-${roleKey}-ui-donation-${timestamp}@example.com`
  cleanupState.goodsDonationEmails.push(uiDonationEmail)
  await foodFrame.locator('#new-donation-btn').click()
  const donationEditor = foodFrame.locator('#new-donation-editor.visible')
  await donationEditor.waitFor({ state: 'visible', timeout: 10000 })
  await findGroupInput(donationEditor, 'Donor Type').selectOption('individual')
  await findGroupInput(donationEditor, 'Donor Name').fill(uiDonationName)
  await findGroupInput(donationEditor, 'Contact Email').fill(uiDonationEmail)
  await findGroupInput(donationEditor, 'Received Date').fill(todayUk())
  const donationRow = donationEditor.locator('.donation-item-row').first()
  await donationRow.locator('select').selectOption({ label: 'Rice' })
  await donationRow.locator('input[type="number"]').fill('2')
  await donationRow.locator('input[type="text"]').fill('31/12/2026')
  await donationEditor.locator('.editor-actions .btn.btn-primary').click()
  await waitForToast(foodFrame, 'Donation submitted.')
  await findDonationRow(foodFrame, uiDonationName)
  recordCheck(checks, 'food', 'new donation submit', 'pass')

  const uiDonationRow = await findDonationRow(foodFrame, uiDonationName)
  await uiDonationRow.locator('.view-donation-btn').click()
  await foodFrame.locator('#view-donation-editor.visible').waitFor({ state: 'visible', timeout: 10000 })
  recordCheck(checks, 'food', 'view donation', 'pass')
  await foodFrame.locator('#view-donation-editor .btn.btn-secondary[data-editor="view-donation-editor"]').click()

  await uiDonationRow.locator('.edit-donation-btn').click()
  const editDonationEditor = foodFrame.locator('#new-donation-editor.visible')
  await findGroupInput(editDonationEditor, 'Donor Name').fill(`${uiDonationName} Edited`)
  await editDonationEditor.locator('.editor-actions .btn.btn-primary').click()
  await waitForToast(foodFrame, 'Donation saved.')
  await findDonationRow(foodFrame, `${uiDonationName} Edited`)
  recordCheck(checks, 'food', 'edit donation', 'pass')

  const receiveRow = await findDonationRow(foodFrame, `Acceptance ${roleKey} Receive ${timestamp}`)
  await receiveRow.locator('.receive-donation-btn').click()
  await waitForToast(foodFrame, 'Donation marked as received.')
  recordCheck(checks, 'food', 'receive donation', 'pass')

  await setTableSearch(foodFrame, '#donation-intake', `Acceptance ${roleKey} Batch`)
  const batchReceiveRowA = await ensureRowByText(foodFrame, 'donation-table-body', `Acceptance ${roleKey} Batch A ${timestamp}`)
  const batchReceiveRowB = await ensureRowByText(foodFrame, 'donation-table-body', `Acceptance ${roleKey} Batch B ${timestamp}`)
  await batchReceiveRowA.locator('.row-checkbox').check()
  await batchReceiveRowB.locator('.row-checkbox').check()
  await foodFrame.locator('#batch-receive-donations').click()
  await waitForToast(foodFrame, 'Selected donations marked as received.')
  recordCheck(checks, 'food', 'batch receive donations', 'pass')

  const batchDeleteRow = await findDonationRow(foodFrame, `Acceptance ${roleKey} Batch Delete ${timestamp}`)
  await batchDeleteRow.locator('.row-checkbox').check()
  await foodFrame.locator('#batch-delete-donations').click()
  await waitForToast(foodFrame, 'Selected donation records deleted.')
  recordCheck(checks, 'food', 'batch delete donations', 'pass')

  const deleteDonationRow = await findDonationRow(foodFrame, `Acceptance ${roleKey} Delete ${timestamp}`)
  await deleteDonationRow.locator('.delete-donation-btn').click()
  await foodFrame.locator('#delete-donation-confirm.visible .btn.btn-danger').click()
  await waitForToast(foodFrame, 'Donation record deleted.')
  recordCheck(checks, 'food', 'delete donation', 'pass')

  const itemName = `Acceptance ${roleKey} Item ${timestamp}`
  await foodFrame.locator('#new-item-btn').click()
  const newItemEditor = foodFrame.locator('#new-item-editor.visible')
  await newItemEditor.waitFor({ state: 'visible', timeout: 10000 })
  selectedFoodBankValue = await selectFoodBankIfPresent(newItemEditor, selectedFoodBankValue)
  await findGroupInput(newItemEditor, 'Item Name').fill(itemName)
  await findGroupInput(newItemEditor, 'Category').selectOption({ label: 'Canned Goods' })
  await findGroupInput(newItemEditor, 'Unit').fill('units')
  await findGroupInput(newItemEditor, 'Safety Threshold').fill('2')
  await newItemEditor.locator('.editor-actions .btn.btn-primary').click()
  await waitForToast(foodFrame, 'Item added.')
  const itemCard = foodFrame.locator('#inventory-card-grid .card').filter({ hasText: itemName }).first()
  await itemCard.waitFor({ state: 'visible', timeout: 20000 })
  recordCheck(checks, 'food', 'new item submit', 'pass')

  await itemCard.locator('.edit-item-btn').click()
  const editItemEditor = foodFrame.locator('#edit-item-editor.visible')
  await findGroupInput(editItemEditor, 'Item Name').fill(`${itemName} Edited`)
  await findGroupInput(editItemEditor, 'Safety Threshold').fill('4')
  await editItemEditor.locator('.editor-actions .btn.btn-primary').click()
  await waitForToast(foodFrame, 'Item saved.')
  const editedItemCard = foodFrame.locator('#inventory-card-grid .card').filter({ hasText: `${itemName} Edited` }).first()
  await editedItemCard.waitFor({ state: 'visible', timeout: 20000 })
  recordCheck(checks, 'food', 'edit item', 'pass')

  await editedItemCard.locator('.stock-in-btn').click()
  const stockInEditor = foodFrame.locator('#stock-in-editor.visible')
  await findGroupInput(stockInEditor, 'Quantity').fill('3')
  await findGroupInput(stockInEditor, 'Expiry Date').fill('31/12/2026')
  await stockInEditor.locator('.editor-actions .btn.btn-primary').click()
  await waitForToast(foodFrame, 'Stock updated.')
  await editedItemCard.waitFor({ state: 'visible', timeout: 20000 })
  recordCheck(checks, 'food', 'stock in item', 'pass')

  await foodFrame.locator('#new-package-btn').click()
  const newPackageEditor = foodFrame.locator('#new-package-editor.visible')
  const packageName = `Acceptance ${roleKey} Package ${timestamp}`
  selectedFoodBankValue = await selectFoodBankIfPresent(newPackageEditor, selectedFoodBankValue)
  await foodFrame.waitForTimeout(200)
  await findGroupInput(newPackageEditor, 'Package Name').fill(packageName)
  await findGroupInput(newPackageEditor, 'Category').selectOption({ label: 'Emergency Pack' })
  await findGroupInput(newPackageEditor, 'Safety Threshold').fill('1')
  const packageItemRow = newPackageEditor.locator('.package-item-row').first()
  await packageItemRow.locator('select').selectOption({ label: `${itemName} Edited` })
  await packageItemRow.locator('input[type="number"]').fill('1')
  await newPackageEditor.locator('.editor-actions .btn.btn-primary').click()
  await waitForToast(foodFrame, 'Package added.')
  const packageCard = foodFrame.locator('#package-card-grid .card').filter({ hasText: packageName }).first()
  await packageCard.waitFor({ state: 'visible', timeout: 20000 })
  recordCheck(checks, 'food', 'new package submit', 'pass')

  await packageCard.locator('.edit-package-btn').click()
  const editPackageEditor = foodFrame.locator('#edit-package-editor.visible')
  await findGroupInput(editPackageEditor, 'Safety Threshold').fill('2')
  await editPackageEditor.locator('.editor-actions .btn.btn-primary').click()
  await waitForToast(foodFrame, 'Package saved.')
  recordCheck(checks, 'food', 'edit package', 'pass')

  await packageCard.locator('.packing-btn').click()
  const packingEditor = foodFrame.locator('#packing-editor.visible')
  await packingEditor.locator('input[type="number"]').fill('1')
  await packingEditor.locator('.editor-actions .btn.btn-primary').click()
  await waitForToast(foodFrame, 'Packing submitted.')
  recordCheck(checks, 'food', 'pack package', 'pass')

  const lotRow = await ensureRowByText(foodFrame, 'lot-table-body', `${itemName} Edited`)
  await lotRow.locator('.edit-lot-btn').click()
  const editLotEditor = foodFrame.locator('#edit-lot-editor.visible')
  await findGroupInput(editLotEditor, 'Expiry Date').fill('30/12/2026')
  await editLotEditor.locator('.editor-actions .btn.btn-primary').click()
  await waitForToast(foodFrame, 'Expiry saved.')
  recordCheck(checks, 'food', 'edit lot expiry', 'pass')

  await lotRow.locator('.mark-wasted-btn').click()
  await foodFrame.locator('#mark-wasted-confirm.visible .btn.btn-danger').click()
  await waitForToast(foodFrame, 'Lot marked as wasted.')
  recordCheck(checks, 'food', 'mark lot wasted', 'pass')

  const wastedRow = await ensureRowByText(foodFrame, 'lot-table-body', `${itemName} Edited`)
  await wastedRow.locator('.delete-lot-btn').click()
  await foodFrame.locator('#delete-lot-confirm.visible .btn.btn-danger').click()
  await waitForToast(foodFrame, 'Lot deleted.')
  recordCheck(checks, 'food', 'delete lot', 'pass')

  await packageCard.locator('.delete-package-btn').click()
  await foodFrame.locator('#delete-package-confirm.visible .btn.btn-danger').click()
  await waitForToast(foodFrame, 'Package deleted.')
  recordCheck(checks, 'food', 'delete package', 'pass')

  const deleteItemCard = foodFrame.locator('#inventory-card-grid .card').filter({ hasText: `${itemName} Edited` }).first()
  await deleteItemCard.locator('.delete-item-btn').click()
  await foodFrame.locator('#delete-item-confirm.visible .btn.btn-danger').click()
  await waitForToast(foodFrame, 'Item deleted.')
  recordCheck(checks, 'food', 'delete item', 'pass')

  await foodFrame.locator('#verify-code-btn').click()
  const verifyEditor = foodFrame.locator('#verify-code-editor.visible')
  await findGroupInput(verifyEditor, 'Redemption Code').fill(verifyApp.redemption_code)
  await verifyEditor.locator('#check-code-btn').click()
  await verifyEditor.locator('#code-verify-result').waitFor({ state: 'visible', timeout: 10000 })
  recordCheck(checks, 'food', 'check redemption code', 'pass')

  await verifyEditor.locator('#redeem-code-btn').click()
  await waitForToast(foodFrame, 'Redemption completed.')
  recordCheck(checks, 'food', 'redeem code', 'pass')

  await apiRequest('PATCH', `/api/v1/applications/${verifyApp.id}`, {
    token: roleToken,
    body: { status: 'pending' },
  })

  await page.reload({ waitUntil: 'networkidle', timeout: 30000 })
  const reloadedFoodFrame = await getFoodFrame(page)
  const codeRowForVoid = await findCodeRow(reloadedFoodFrame, voidApp.redemption_code)
  await codeRowForVoid.locator('.void-code-btn').click()
  await reloadedFoodFrame.locator('#void-code-confirm.visible .btn.btn-danger').click()
  await waitForToast(reloadedFoodFrame, 'Redemption code voided.')
  recordCheck(checks, 'food', 'void code', 'pass')

  await page.reload({ waitUntil: 'networkidle', timeout: 30000 })
  const finalFoodFrame = await getFoodFrame(page)
  const batchVoidRow = await findCodeRow(finalFoodFrame, batchVoidApp.redemption_code)
  await batchVoidRow.locator('.row-checkbox').check()
  await finalFoodFrame.locator('#batch-void-codes').click()
  await waitForToast(finalFoodFrame, 'Selected redemption codes voided.')
  recordCheck(checks, 'food', 'batch void codes', 'pass')

  await page.screenshot({ path: path.join(artifactsDir, `${roleKey}-food.png`), fullPage: true })
  return checks
}

const runDashboardAcceptance = async ({ page, roleKey, roleLabel }) => {
  const checks = []

  await page.goto(`${FRONTEND_URL}/admin?section=statistics`, { waitUntil: 'networkidle', timeout: 30000 })
  const frame = await getDashboardFrame(page)

  const adminTag = await frame.locator('.admin-tag').textContent()
  recordCheck(checks, 'statistics', 'role tag', adminTag?.includes(roleLabel) ? 'pass' : 'fail', adminTag || '')

  await clickHeroAndAssertScroll(frame, 'Donation Analysis', 'donation-analysis')
  recordCheck(checks, 'statistics', 'hero: donation analysis', 'pass')
  await clickHeroAndAssertScroll(frame, 'Inventory Health', 'inventory-health')
  recordCheck(checks, 'statistics', 'hero: inventory health', 'pass')
  await clickHeroAndAssertScroll(frame, 'Package Management', 'distribution-analysis')
  recordCheck(checks, 'statistics', 'hero: package management', 'pass')
  await clickHeroAndAssertScroll(frame, 'Expiry Tracking', 'waste-analysis')
  recordCheck(checks, 'statistics', 'hero: expiry tracking', 'pass')
  await clickHeroAndAssertScroll(frame, 'Code Verification', 'code-verification')
  recordCheck(checks, 'statistics', 'hero: code verification', 'pass')

  const summaryLocator = frame.locator('#time-range-summary')
  await summaryLocator.waitFor({ state: 'visible', timeout: 20000 })
  const monthSummary = (await summaryLocator.textContent()) || ''

  await frame.locator('#time-range-select').selectOption('quarter')
  await frame.waitForTimeout(500)
  const quarterSummary = (await summaryLocator.textContent()) || ''
  ok(monthSummary !== quarterSummary, 'Quarter range did not update summary')
  recordCheck(checks, 'statistics', 'range: quarter', 'pass')

  await frame.locator('#time-range-select').selectOption('year')
  await frame.waitForTimeout(500)
  const yearSummary = (await summaryLocator.textContent()) || ''
  ok(yearSummary !== quarterSummary, 'Year range did not update summary')
  recordCheck(checks, 'statistics', 'range: year', 'pass')

  await frame.locator('#time-range-select').selectOption('month')
  await frame.waitForTimeout(500)
  recordCheck(checks, 'statistics', 'range: month', 'pass')

  const refreshButton = frame.locator('#refresh-data-btn')
  await refreshButton.click()
  await frame.waitForTimeout(800)
  ok(((await refreshButton.textContent()) || '').includes('Refresh'), 'Refresh button did not recover text')
  recordCheck(checks, 'statistics', 'refresh data', 'pass')

  await frame.evaluate(() => {
    window.scrollTo({ top: 1200, behavior: 'auto' })
    document.documentElement.scrollTop = 1200
    document.body.scrollTop = 1200
  })
  await frame.waitForTimeout(300)
  const scrollTopButton = frame.locator('#scroll-top-btn.show')
  await scrollTopButton.waitFor({ state: 'visible', timeout: 10000 })
  await scrollTopButton.click()
  const scrollTop = await waitForScrollTop(frame)
  ok(scrollTop < 50, 'Scroll-to-top button did not return to top')
  recordCheck(checks, 'statistics', 'scroll to top', 'pass')

  await frame.locator('.nav-links a', { hasText: 'Inventory Management' }).click()
  await page.waitForURL(/section=food/, { timeout: 20000 })
  recordCheck(checks, 'statistics', 'nav to food', 'pass')

  await page.goto(`${FRONTEND_URL}/admin?section=statistics`, { waitUntil: 'networkidle', timeout: 30000 })
  const finalFrame = await getDashboardFrame(page)
  await finalFrame.locator('.header-actions .btn.btn-secondary').click()
  await page.waitForTimeout(500)
  const signOutState = await page.evaluate(() => {
    const raw = window.localStorage.getItem('fba-auth-storage')
    const href = window.location.href

    if (!raw) {
      return { href, ok: true }
    }

    try {
      const parsed = JSON.parse(raw)
      const state = parsed?.state ?? {}
      return {
        href,
        ok: state.user == null && state.isAuthenticated === false && state.accessToken == null && state.refreshToken == null,
      }
    } catch {
      return { href, ok: false }
    }
  })
  recordCheck(checks, 'statistics', 'sign out', signOutState.ok ? 'pass' : 'fail', signOutState.href)

  await page.screenshot({ path: path.join(artifactsDir, `${roleKey}-statistics.png`), fullPage: true })
  return checks
}

const roles = [
  {
    key: 'platform-admin',
    label: 'Platform Admin',
    email: 'admin@foodbank.com',
    password: 'admin123',
  },
  {
    key: 'local-admin',
    label: 'Local Admin',
    email: 'localadmin@foodbank.com',
    password: 'localadmin123',
  },
]

const results = []

try {
  for (const role of roles) {
    const loginData = await loginByApi(role.email, role.password)
    const context = await browser.newContext({ acceptDownloads: true })
    const page = await context.newPage()
    const apiTrafficRecorder = attachApiTrafficRecorder(page, role.key)

    try {
      await primeAuth(page, loginData)
      const foodChecks = await runFoodAcceptance({
        page,
        roleKey: role.key,
        roleLabel: role.label,
        adminLogin: loginData,
      })
      const dashboardChecks = await runDashboardAcceptance({
        page,
        roleKey: role.key,
        roleLabel: role.label,
      })
      results.push({
        role: role.key,
        foodChecks,
        dashboardChecks,
      })
    } finally {
      const apiTraffic = apiTrafficRecorder.flush()
      apiTrafficRecorder.stop()
      fs.writeFileSync(
        path.join(artifactsDir, `${role.key}-api-traffic.json`),
        JSON.stringify(apiTraffic, null, 2),
      )
      await context.close()
    }
  }
} finally {
  await browser.close()
  const cleanupInputPath = path.join(artifactsDir, 'cleanup-state.json')
  fs.writeFileSync(cleanupInputPath, JSON.stringify(cleanupState, null, 2))
  const cleanupRun = spawnSync('python', [cleanupScriptPath, cleanupInputPath], {
    cwd: path.resolve(process.cwd(), '..'),
    encoding: 'utf-8',
  })
  if (cleanupRun.status !== 0) {
    console.error(cleanupRun.stdout)
    console.error(cleanupRun.stderr)
    throw new Error('Cleanup script failed')
  }
}

const summary = {
  ok: results.every((roleResult) =>
    [...roleResult.foodChecks, ...roleResult.dashboardChecks].every((check) => check.status === 'pass')
  ),
  frontendUrl: FRONTEND_URL,
  backendUrl: BACKEND_URL,
  executablePath,
  results,
}

fs.writeFileSync(path.join(artifactsDir, 'admin-acceptance-summary.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
