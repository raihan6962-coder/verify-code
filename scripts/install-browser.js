const { execSync } = require('child_process')
const os = require('os')

const isLinux = os.platform() === 'linux'

function run(cmd, ignoreError = false) {
  try {
    execSync(cmd, { stdio: 'inherit', shell: true, timeout: 180000 })
    return true
  } catch (e) {
    if (!ignoreError) throw e
    return false
  }
}

console.log('[install-browser] Installing Chromium...')

if (isLinux) {
  // Try with system deps first
  if (run('npx playwright install chromium --with-deps', true)) {
    console.log('[install-browser] Chromium + deps installed')
  } else {
    // Install system deps manually, then Chromium
    console.log('[install-browser] Installing system dependencies...')
    run(
      'apt-get update -qq && apt-get install -y -qq ' +
      'libglib2.0-0 libnss3 libnspr4 libatk1.0-0t64 libatk-bridge2.0-0t64 ' +
      'libcups2t64 libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 ' +
      'libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 ' +
      'libcairo2 libasound2t64 libegl1 libxshmfence1',
      true
    )
    run('npx playwright install chromium', true)
    console.log('[install-browser] Chromium installed (system deps may be missing)')
  }
} else {
  run('npx playwright install chromium', true)
  console.log('[install-browser] Chromium install attempted')
}
