const { execSync } = require('child_process')
const os = require('os')

const isLinux = os.platform() === 'linux'
const cmd = `npx playwright install chromium${isLinux ? ' --with-deps' : ''}`

console.log(`[install-browser] ${cmd}`)
try {
  execSync(cmd, { stdio: 'inherit', shell: true, timeout: 180000 })
  console.log('[install-browser] Chromium installed successfully')
} catch (e) {
  if (!isLinux) {
    console.log('[install-browser] Chromium install skipped on Windows (run "npx playwright install chromium" manually if needed)')
  } else {
    console.error('[install-browser] Failed:', e.message)
    process.exit(1)
  }
}
