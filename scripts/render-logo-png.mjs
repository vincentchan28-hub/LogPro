import { chromium } from 'playwright-core'
import fs from 'node:fs'

async function render() {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  const page = await browser.newPage({
    viewport: { width: 400, height: 480, deviceScaleFactor: 2 }
  })

  const svg = fs.readFileSync('public/logo.svg', 'utf8')
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            width: 100vw;
            height: 100vh;
          }
          svg {
            width: 360px;
            height: auto;
          }
        </style>
      </head>
      <body>
        ${svg}
      </body>
    </html>
  `)

  await page.locator('svg').screenshot({
    path: 'public/logo.png',
    omitBackground: true
  })

  await browser.close()
  console.log('Rendered public/logo.png successfully')
}

render().catch(console.error)
