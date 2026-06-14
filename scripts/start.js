const { execSync } = require('child_process')
const os = require('os')

const isLinux = os.platform() === 'linux'

if (isLinux) {
  try {
    execSync('ldconfig -p | grep -q libglib-2.0', { stdio: 'pipe' })
    console.log('[start] Chromium deps already available')
  } catch {
    console.log('[start] Installing Chromium system dependencies...')
    try {
      // Try Playwright's built-in dep installer first
      execSync('npx playwright install-deps chromium', { stdio: 'inherit', timeout: 120000 })
      console.log('[start] System dependencies installed via Playwright')
    } catch {
      // Fallback: manual apt-get without t64 suffixes
      try {
        execSync(
          'apt-get update -qq && apt-get install -y -qq ' +
          'libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 ' +
          'libcups2 libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 ' +
          'libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 ' +
          'libcairo2 libasound2 libegl1 libxshmfence1 libgtk-3-0',
          { stdio: 'inherit', timeout: 120000 }
        )
        console.log('[start] System dependencies installed via apt')
      } catch (e2) {
        console.error('[start] Failed to install deps, will retry at runtime:', e2.message)
      }
    }
  }
}

const port = process.env.PORT || '3000'
console.log(`[start] Starting Next.js on port ${port}`)
execSync(`npx next start -p ${port}`, { stdio: 'inherit', shell: true })
