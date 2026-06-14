import { chromium, type Browser, type Page } from 'playwright'
import { groqChat, hasGroqApiKey, setGroqApiKey } from './groq'

class BrowserAgent {
  private browser: Browser | null = null
  private page: Page | null = null
  private pagePromise: Promise<Page> | null = null
  private screenshotBuffer: Buffer | null = null
  private clipboard = ''
  private taskQueue: Promise<{ result: string }> = Promise.resolve({ result: '' })
  private processQueue: Promise<{ result: string }> = Promise.resolve({ result: '' })

  setApiKey(key: string) {
    setGroqApiKey(key)
  }

  get hasAi(): boolean {
    return hasGroqApiKey()
  }

  ensurePage(): Promise<Page> {
    if (!this.pagePromise) {
      this.pagePromise = this._launchBrowser().catch((err) => {
        console.error('[browser] Launch failed, will retry:', err.message)
        this.pagePromise = null
        throw err
      })
    }
    return this.pagePromise
  }

  private async _launchBrowser(): Promise<Page> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    })
    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
    })
    this.page = await context.newPage()
    await this.page.goto('about:blank')
    return this.page
  }

  private async refreshScreenshot(): Promise<void> {
    if (this.page) {
      this.screenshotBuffer = await this.page.screenshot({ type: 'jpeg', quality: 40 })
    }
  }

  private async _captureState(): Promise<{ url: string; title: string; text: string }> {
    try {
      if (!this.page || this.page.isClosed()) {
        return { url: '', title: '', text: '' }
      }
      const url = this.page.url()
      const title = await this.page.title()
      const text = ((await this.page.evaluate(() => document.body?.innerText || '').catch(() => '')) || '')
        .replace(/data:image\/[^;]+;base64,[^\s]+/gi, '[image]')
        .replace(/https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|svg|webp)(\?[^\s]*)?/gi, '[image]')
        .substring(0, 2000)
      return { url, title, text }
    } catch {
      return { url: '', title: '', text: '' }
    }
  }

  async getPageInfo(): Promise<{ url: string; title: string }> {
    try {
      const page = await this.ensurePage()
      const url = page.url()
      const title = await page.title()
      return { url, title }
    } catch {
      return { url: '', title: '' }
    }
  }

  async clickAt(x: number, y: number): Promise<{ result: string }> {
    return (this.taskQueue = this.taskQueue.then(async () => {
      try {
        const page = await this.ensurePage()
        await page.mouse.click(x, y)
        this.refreshScreenshot().catch(() => {})
        return { result: `✓ clicked at (${x}, ${y})` }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return { result: `✗ click failed: ${msg}` }
      }
    }))
  }

  async execute(command: string): Promise<{ result: string }> {
    return (this.taskQueue = this.taskQueue.then(async () => {
      try {
        const page = await this.ensurePage()
        const lower = command.trim().toLowerCase()
        const trimmed = command.trim()

        // fill <label> with <value> — form field by label/placeholder/name
        const fillMatch = trimmed.match(/^fill\s+(.+?)\s+with\s+(.+)$/i)
        if (fillMatch) {
          const label = fillMatch[1].trim()
          const value = fillMatch[2].trim()
          try {
            await page.getByLabel(label).fill(value, { timeout: 3000 })
          } catch {
            await page.getByPlaceholder(label).fill(value, { timeout: 3000 })
          }
          this.refreshScreenshot().catch(() => {})
          return { result: `✓ filled "${label}"` }
        }

        // select <option> from <dropdown> — dropdown selection
        const selectMatch = trimmed.match(/^select\s+(.+?)\s+from\s+(.+)$/i)
        if (selectMatch) {
          const option = selectMatch[1].trim()
          const dropdown = selectMatch[2].trim()
          await page.getByLabel(dropdown).selectOption({ label: option }, { timeout: 3000 })
          this.refreshScreenshot().catch(() => {})
          return { result: `✓ selected "${option}"` }
        }

        if (lower === 'submit') {
          await page.locator('button[type="submit"], input[type="submit"]').first().click({ timeout: 5000 })
          this.refreshScreenshot().catch(() => {})
          return { result: '✓ submitted form' }
        }

        if (lower.startsWith('wait for ')) {
          const text = trimmed.slice(9).trim()
          await page.locator(`text=${text}`).first().waitFor({ state: 'visible', timeout: 10000 })
          this.refreshScreenshot().catch(() => {})
          return { result: `✓ waited for "${text}"` }
        }

        if (lower.startsWith('wait ')) {
          const ms = parseInt(trimmed.slice(5).trim(), 10)
          if (!isNaN(ms) && ms > 0 && ms <= 30000) {
            await page.waitForTimeout(ms)
          }
          return { result: `✓ waited ${ms}ms` }
        }

        if (lower.startsWith('evaluate ')) {
          const js = trimmed.slice(9).trim()
          const result = await page.evaluate(js)
          return { result: `✓ → ${JSON.stringify(result).substring(0, 500)}` }
        }

        if (lower.startsWith('open ')) {
          let url = command.slice(5).trim()
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            if (!url.includes('.')) {
              url += '.com'
            }
            url = 'https://' + url
          }
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
        } else if (lower.startsWith('search for ')) {
          const query = command.slice(11).trim()
          await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 15000 })
          await page.locator('textarea[name="q"]').fill(query)
          await page.keyboard.press('Enter')
        } else if (lower.startsWith('click ')) {
          const text = command.slice(6).trim()
          await page.locator(`text=${text}`).first().click({ timeout: 5000 })
        } else if (lower.startsWith('type ')) {
          const text = command.slice(5).trim()
          await page.keyboard.type(text, { delay: 10 })
        } else if (lower === 'copy') {
          this.clipboard = await page.evaluate(() => window.getSelection()?.toString() || '')
          if (!this.clipboard) {
            return { result: 'No text selected to copy' }
          }
        } else if (lower.startsWith('copy ')) {
          this.clipboard = command.slice(5).trim()
        } else if (lower === 'paste' || lower === 'paste copied text') {
          if (!this.clipboard) {
            return { result: 'Nothing to paste. Copy something first.' }
          }
          await page.keyboard.type(this.clipboard, { delay: 10 })
        } else if (lower.startsWith('select ')) {
          const text = command.slice(7).trim()
          const found = await page.evaluate((searchText: string) => {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
            let node: Text | null
            while ((node = walker.nextNode() as Text | null)) {
              if (node.textContent?.includes(searchText)) {
                const range = document.createRange()
                const idx = node.textContent.indexOf(searchText)
                range.setStart(node, idx)
                range.setEnd(node, idx + searchText.length)
                const sel = window.getSelection()
                sel?.removeAllRanges()
                sel?.addRange(range)
                return true
              }
            }
            return false
          }, text)
          if (!found) return { result: `Text "${text}" not found on page` }
        } else if (lower === 'scroll down') {
          await page.evaluate(() => window.scrollBy({ top: 600, behavior: 'instant' }))
        } else if (lower === 'scroll up') {
          await page.evaluate(() => window.scrollBy({ top: -600, behavior: 'instant' }))
        } else if (lower === 'go back') {
          await page.goBack()
        } else if (lower.startsWith('press ')) {
          const key = command.slice(6).trim()
          await page.keyboard.press(key)
        } else if (lower === 'refresh' || lower === 'reload') {
          await page.reload()
        } else {
          try {
            await page.locator(`text=${command}`).first().click({ timeout: 5000 })
          } catch {
            return {
              result: `Unknown command: "${command}"`,
            }
          }
        }

        this.refreshScreenshot().catch(() => {})
        return { result: `✓ ${command}` }
      } catch (err: unknown) {
        this.refreshScreenshot().catch(() => {})
        const msg = err instanceof Error ? err.message : String(err)
        return { result: `✗ ${command}: ${msg}` }
      }
    }))
  }

  async processMessage(message: string, apiKey?: string): Promise<{ result: string }> {
    return (this.processQueue = this.processQueue.then(() => this._processMessage(message, apiKey)))
  }

  private async _processMessage(message: string, apiKey?: string): Promise<{ result: string }> {
    const hasKey = apiKey ? true : hasGroqApiKey()
    if (apiKey) setGroqApiKey(apiKey)
    if (!hasKey) {
      return this.execute(message)
    }

    try {
      await this.ensurePage()
      const maxSteps = 30
      let stepLog = ''
      let lastResult = ''

      for (let step = 0; step < maxSteps; step++) {
        if (step > 0) {
          await new Promise(r => setTimeout(r, 600))
        }

        const state = await this._captureState()
        const stepHistory = stepLog ? `Steps completed:\n${stepLog.slice(-1200)}` : ''
        const prevResult = lastResult ? `Last step result: ${lastResult}` : ''

        const systemPrompt = `You control a web browser. Current page:
URL: ${state.url || 'about:blank'}
Title: ${state.title || 'New Tab'}
Page text: ${state.text || '(empty)'}

${stepHistory}
${prevResult}
Task: ${message}

Commands (ONE at a time):
- open <url> — navigate
- click <text> — click element with that text
- type <text> — type text
- fill <label> with <value> — fill form field (by label/placeholder)
- select <option> from <dropdown> — choose dropdown option
- submit — click submit button
- wait for <text> — wait for text to appear (max 10s)
- wait <ms> — pause (e.g. wait 2000)
- search for <query> — Google search
- scroll down / scroll up
- go back
- press <key> — keyboard shortcut (Enter, Tab, Escape, etc.)
- copy / paste
- refresh / reload
- evaluate <js> — run JavaScript

Rules:
1. Return ONE command at a time
2. After each command you'll see the new page state
3. Adapt next steps based on what actually happens
4. Handle errors by trying alternatives
5. Use "type" to type info, "fill" for form fields
6. Never ask the user questions
7. When task is fully done, return {"type":"done","reply":"summary"}

Respond ONLY with valid JSON:
{"type":"action","cmd":"one command","reply":"what I'm doing"}
{"type":"done","reply":"Task complete! Summary of what was done."}`

        const raw = await groqChat(systemPrompt, message)
        let parsed: any
        try {
          parsed = JSON.parse(raw)
        } catch {
          const match = raw.match(/\{[^]*\}/)
          parsed = match ? JSON.parse(match[0]) : null
        }

        if (!parsed || !parsed.type) {
          return { result: raw }
        }

        if (parsed.type === 'done') {
          return { result: parsed.reply || 'Task complete.' }
        }

        if (parsed.type === 'action' && parsed.cmd) {
          const cmdResult = await this.execute(parsed.cmd)
          stepLog += `Step ${step + 1}: "${parsed.cmd}" → ${cmdResult.result}\n`
          lastResult = cmdResult.result
          continue
        }

        return { result: parsed.reply || raw }
      }

      return { result: `Reached ${maxSteps} steps. Progress:\n${stepLog}` }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { result: `AI error: ${msg}` }
    }
  }

  async getScreenshot(): Promise<Buffer | null> {
    if (!this.screenshotBuffer && this.page) {
      try {
        this.screenshotBuffer = await this.page.screenshot({ type: 'jpeg', quality: 40 })
      } catch {
        return null
      }
    }
    return this.screenshotBuffer
  }
}

const agent = new BrowserAgent()
agent.ensurePage().catch(() => {})
export { agent }
