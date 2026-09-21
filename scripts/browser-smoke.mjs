import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const port = Number(process.env.SMOKE_PORT || 5000)
const baseUrl = process.env.SMOKE_BASE_URL || `http://127.0.0.1:${port}`
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/repl/tools/bin/chromium'
const startupTimeoutMs = 20_000
const stepTimeoutMs = 15_000

let server
let browser
let page
let serverOutput = ''
const browserErrors = []

function appendServerOutput(chunk) {
  serverOutput += chunk.toString()
  if (serverOutput.length > 4_000) {
    serverOutput = serverOutput.slice(-4_000)
  }
}

async function canReachPreview() {
  try {
    const response = await fetch(baseUrl)
    return response.ok
  } catch {
    return false
  }
}

async function waitForPreview() {
  const deadline = Date.now() + startupTimeoutMs
  while (Date.now() < deadline) {
    if (await canReachPreview()) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Preview did not respond at ${baseUrl}`)
}

async function visibleUiState() {
  if (!page) return '(browser page was not created)'

  try {
    const text = await page.locator('body').innerText({ timeout: 2_000 })
    return text.replace(/\s+/g, ' ').trim().slice(0, 6_000) || '(page body is empty)'
  } catch (error) {
    return `(could not read page body: ${error.message})`
  }
}

async function fail(message) {
  const state = await visibleUiState()
  const details = [
    message,
    `Visible UI state: ${state}`,
  ]

  if (browserErrors.length > 0) {
    details.push(`Browser errors: ${browserErrors.join(' | ')}`)
  }

  if (serverOutput.trim()) {
    details.push(`Preview server output: ${serverOutput.trim()}`)
  }

  throw new Error(details.join('\n'))
}

async function requireVisibleText(text, label) {
  try {
    await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: stepTimeoutMs })
  } catch {
    await fail(`Expected ${label} to appear: "${text}"`)
  }
}

async function startPreviewIfNeeded() {
  if (await canReachPreview()) return

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  server = spawn(
    npmCommand,
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)],
    { detached: true, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  server.stdout.on('data', appendServerOutput)
  server.stderr.on('data', appendServerOutput)
  await waitForPreview()
}

async function runSmoke() {
  await startPreviewIfNeeded()

  browser = await chromium.launch({
    headless: true,
    executablePath: chromiumPath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  const context = await browser.newContext({ acceptDownloads: true })
  // Make each run exercise the default workbook instead of a prior localStorage session.
  await context.addInitScript(() => window.localStorage.clear())

  page = await context.newPage()
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: stepTimeoutMs })
  await requireVisibleText('Procurement Agreement & Grades', 'the main procurement view')
  await requireVisibleText('Timber & Log Procurement Management System', 'the loaded LogPro shell')

  const workbookName = await page.locator('.banner-filename').textContent()
  if (workbookName?.trim() !== 'log_procurement.xlsx') {
    await fail(`Expected the default workbook "log_procurement.xlsx", got "${workbookName?.trim() || '(none)'}"`)
  }

  await page.getByRole('button', { name: 'Suppliers', exact: true }).click()
  await requireVisibleText('Suppliers Register', 'the supplier register')

  await page.getByRole('button', { name: 'Add Supplier', exact: true }).click()
  await page.getByLabel(/Supplier Name/).fill('Browser Smoke Supplier')
  await page.getByRole('button', { name: 'Save Supplier', exact: true }).click()
  await requireVisibleText('Browser Smoke Supplier', 'the saved browser supplier')

  const downloadPromise = page.waitForEvent('download', { timeout: stepTimeoutMs })
  await page.getByRole('button', { name: 'Export .xlsx', exact: true }).click()
  const download = await downloadPromise
  if (!download.suggestedFilename().endsWith('.xlsx')) {
    await fail(`Expected an .xlsx export, got "${download.suggestedFilename()}"`)
  }

  console.log(`Browser smoke passed: loaded ${workbookName.trim()}, added a supplier, and downloaded ${download.suggestedFilename()}.`)
}

try {
  await runSmoke()
} catch (error) {
  console.error(`Browser smoke failed: ${error.message}`)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  if (server && server.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM')
    } catch {
      server.kill('SIGTERM')
    }
  }
}