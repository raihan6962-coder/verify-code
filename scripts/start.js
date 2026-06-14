const { execSync } = require('child_process')
const port = process.env.PORT || '3000'
console.log(`[start] Starting Next.js on port ${port}`)
execSync(`npx next start -p ${port}`, { stdio: 'inherit', shell: true })
