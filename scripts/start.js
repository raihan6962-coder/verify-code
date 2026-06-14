const { execSync } = require('child_process')
const os = require('os')

const isLinux = os.platform() === 'linux'

if (isLinux) {
  try {
    execSync('ldconfig -p | grep -q libglib-2.0', { stdio: 'pipe' })
  } catch {
    console.log('[start] Installing Chromium system dependencies...')
    execSync(
      'apt-get update -qq && apt-get install -y -qq ' +
      'libglib2.0-0 libnss3 libnspr4 libatk1.0-0t64 libatk-bridge2.0-0t64 ' +
      'libcups2t64 libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 ' +
      'libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 ' +
      'libcairo2 libasound2t64 libegl1 libxshmfence1 libgtk-3-0',
      { stdio: 'inherit', timeout: 120000 }
    )
    console.log('[start] System dependencies installed')
  }
}

const port = process.env.PORT || '3000'
console.log(`[start] Starting Next.js on port ${port}`)
execSync(`npx next start -p ${port}`, { stdio: 'inherit', shell: true })
