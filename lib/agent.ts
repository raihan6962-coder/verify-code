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
      this.pagePromise = (async () => {
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
      })()
    }
    return this.pagePromise
  }

  private async refreshScreenshot(): Promise<void> {
    if (this.page) {
      this.screenshotBuffer = await this.page.screenshot({ type: 'jpeg', quality: 40 })
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

  async processMessage(message: string): Promise<{ result: string }> {
    return (this.processQueue = this.processQueue.then(() => this._processMessage(message)))
  }

  private async _processMessage(message: string): Promise<{ result: string }> {
    if (!hasGroqApiKey()) {
      return this.execute(message)
    }

    const page = await this.ensurePage()
    const url = page.url()
    const title = await page.title()
    const pageText = ((await page.evaluate(() => document.body?.innerText || '').catch(() => '')) || '')
      .replace(/data:image\/[^;]+;base64,[^\s]+/gi, '[image]')
      .replace(/https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|svg|webp)(\?[^\s]*)?/gi, '[image]')
      .substring(0, 3000)

    const systemPrompt = `You control a web browser. Current state:
- URL: ${url}
- Title: ${title}
- Page text: ${pageText}

Available commands (one per line):
- open <url> — navigate to a website (auto-adds .com)
- search for <query> — Google search
- click <text> — click an element containing that text
- type <text> — type text with keyboard
- scroll down / scroll up
- go back
- press <key> — keyboard shortcut (Enter, Escape, Tab, Control+A, etc.)
- copy — copy selected text to internal clipboard
- paste — type clipboard content
- refresh — reload page

Instructions:
1. First, understand what the user wants.
2. Break the task into small sequential steps using the commands above.
3. Each step must be ONE simple command.
4. Execute steps one by one.
5. Report what you did.

⚠️ CRITICAL: Use multiple simple commands. For example:
- To search YouTube: "open youtube" → wait → "search for cats" → wait → "press Enter"
- To click something specific: use "click <visible button/link text>"
- After navigating to a new page, the next command acts on that page.

Respond ONLY with valid JSON (no markdown):
{"type":"action","commands":["cmd1","cmd2",...],"reply":"what I did"}
{"type":"chat","reply":"your answer"}
{"type":"done","reply":"already done"}
{"type":"ask","reply":"clarification needed"}`

    try {
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

      if (parsed.type === 'action' && Array.isArray(parsed.commands)) {
        for (const cmd of parsed.commands) {
          if (typeof cmd === 'string' && cmd.trim()) {
            await this.execute(cmd)
          }
        }
        return { result: parsed.reply || `Done: ${parsed.commands.length} steps` }
      }

      return { result: parsed.reply || raw }
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
agent.ensurePage()
export { agent }
