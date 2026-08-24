import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { siteUrl } from './env'

const OG_WIDTH = 1200
const OG_HEIGHT = 630

/**
 * Origin Chromium should hit. Prefer the deployment host on Vercel so the
 * screenshot targets this same app, not a stale custom domain.
 */
export function resolveOgCaptureOrigin() {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`
  }
  return siteUrl()
}

function localChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  }
  if (process.platform === 'linux') {
    return '/usr/bin/google-chrome'
  }
  return null
}

/**
 * Screenshot a public og-frame page (must contain #og-root).
 * @param {string} framePath absolute path e.g. /slug/cycles/1/og-frame
 * @returns {Promise<Buffer>}
 */
export async function screenshotOgFrame(framePath) {
  const origin = resolveOgCaptureOrigin()
  const path = framePath.startsWith('/') ? framePath : `/${framePath}`
  const url = `${origin}${path}`

  const onVercel = Boolean(process.env.VERCEL)
  let executablePath
  let args = [...chromium.args]
  let headless = chromium.headless

  if (onVercel) {
    executablePath = await chromium.executablePath()
  } else {
    executablePath = localChromePath() || (await chromium.executablePath())
    args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    headless = true
  }

  if (!executablePath) {
    throw new Error('No Chrome/Chromium executable found for OG screenshot')
  }

  let browser
  try {
    browser = await puppeteer.launch({
      args,
      defaultViewport: {
        width: OG_WIDTH,
        height: OG_HEIGHT,
        deviceScaleFactor: 2,
      },
      executablePath,
      headless,
    })

    const page = await browser.newPage()
    page.setDefaultTimeout(12000)
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 12000 })
    await page.waitForSelector('#og-root', { timeout: 8000 })

    const el = await page.$('#og-root')
    if (!el) throw new Error('#og-root not found')

    const png = await el.screenshot({ type: 'png' })
    return Buffer.from(png)
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

export function ogPngResponse(pngBuffer) {
  return new Response(pngBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
