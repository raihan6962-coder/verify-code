const { execSync } = require('child_process')
const os = require('os')

const isLinux = os.platform() === 'linux'

function run(cmd, ignoreError = false) {
  try {
    execSync(cmd, { stdio: 'inherit', shell: true, timeout: 180000 })
    return true
  } catch {
    return false
  }
}

console.log('[install-browser] Installing Chromium...')

if (isLinux) {
  if (!run('npx playwright install chromium --with-deps')) {
    run('apt-get update -qq && apt-get install -y -qq ' +
      'libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 ' +
      'libcups2 libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 ' +
      'libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 ' +
      'libcairo2 libasound2 libegl1 libxshmfence1 libgtk-3-0')
    run('npx playwright install chromium')
  }
} else {
  run('npx playwright install chromium')
}

console.log('[install-browser] Done')
