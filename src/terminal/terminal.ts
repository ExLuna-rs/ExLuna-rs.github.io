// A small DOM terminal: output log, prompt, history, tab completion.
// Commands are registered from the outside (see commands.ts).

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// Inline `code` becomes a clickable command.
export const md = (s: string) => esc(s).replace(/`([^`]+)`/g, (_, c) => cmd(c))
export const cmd = (label: string, run = label) => `<button class="c" data-run="${esc(run)}">${esc(label)}</button>`
export const link = (url: string, label = url) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`
export const acc = (s: string) => `<span class="acc">${esc(s)}</span>`
export const dim = (s: string) => `<span class="dim">${esc(s)}</span>`
export const warn = (s: string) => `<span class="warn">${esc(s)}</span>`

export interface Command {
  name: string
  aliases?: string[]
  hidden?: boolean
  desc?: () => string
  run: (args: string[], raw: string) => void | Promise<void>
  complete?: (args: string[]) => string[]
}

export class Terminal {
  readonly el: HTMLElement
  private out: HTMLElement
  private input: HTMLInputElement
  private promptEl: HTMLElement
  private commands = new Map<string, Command>()
  private history: string[] = []
  private hIndex = 0
  cwd = '~'
  host = 'luna'

  constructor(root: HTMLElement) {
    this.el = root
    this.out = root.querySelector('.term-out')!
    this.input = root.querySelector('input')!
    this.promptEl = root.querySelector('.prompt')!
    this.updatePrompt()

    root.querySelector('form')!.addEventListener('submit', e => {
      e.preventDefault()
      const line = this.input.value
      this.input.value = ''
      this.exec(line, true)
    })
    this.input.addEventListener('keydown', e => this.onKey(e))
    // Clicking a command in the output runs it, like a hyperlink.
    this.out.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-run]')
      if (b) this.exec(b.dataset.run!, true)
    })
    // Clicking the log focuses the prompt, but not on touch: no surprise keyboard.
    this.out.addEventListener('mouseup', () => {
      if (!matchMedia('(pointer: coarse)').matches && !getSelection()?.toString()) this.focus()
    })
  }

  register(c: Command) {
    this.commands.set(c.name, c)
    c.aliases?.forEach(a => this.commands.set(a, c))
  }

  list() { return [...new Set(this.commands.values())].filter(c => !c.hidden) }
  get(name: string) { return this.commands.get(name) }

  focus() { if (!this.el.classList.contains('min')) this.input.focus({ preventScroll: true }) }
  blur() { this.input.blur() }
  get focused() { return document.activeElement === this.input }

  setHost(host: string, cwd = this.cwd) { this.host = host; this.cwd = cwd; this.updatePrompt() }

  private updatePrompt() {
    this.promptEl.innerHTML = `<span class="acc">exluna@${esc(this.host)}</span>:<span class="path">${esc(this.cwd)}</span>$`
    this.el.querySelector('.title')!.textContent = `exluna@${this.host}: ${this.cwd}`
  }

  print(html: string, cls = '') {
    const div = document.createElement('div')
    div.className = `line ${cls}`
    div.innerHTML = html || '&nbsp;'
    this.out.appendChild(div)
    // Keep the DOM bounded on long sessions.
    while (this.out.childElementCount > 600) this.out.firstElementChild!.remove()
    this.out.scrollTop = this.out.scrollHeight
    return div
  }

  lines(list: string[], cls = '') { list.forEach(l => this.print(l, cls)) }
  clear() { this.out.innerHTML = '' }

  async exec(raw: string, echo = false) {
    const line = raw.trim()
    if (echo) this.print(`${this.promptEl.innerHTML} ${esc(raw)}`, 'echo')
    if (!line) return
    if (echo) { this.history.push(line); this.hIndex = this.history.length }
    const [name, ...args] = line.split(/\s+/)
    const c = this.commands.get(name.toLowerCase())
    if (!c) {
      this.missing(name)
      return
    }
    await c.run(args, line)
  }

  onMissing?: (name: string) => void
  private missing(name: string) { this.onMissing?.(name) }

  getHistory() { return this.history }

  private onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
      e.preventDefault()
      this.hIndex = Math.max(0, this.hIndex - 1)
      this.input.value = this.history[this.hIndex] ?? ''
    } else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
      e.preventDefault()
      this.hIndex = Math.min(this.history.length, this.hIndex + 1)
      this.input.value = this.history[this.hIndex] ?? ''
    } else if (e.key === 'Tab') {
      e.preventDefault()
      this.complete()
    } else if (e.ctrlKey && e.key === 'l') {
      e.preventDefault()
      this.clear()
    } else if (e.ctrlKey && e.key === 'c') {
      this.print(`${this.promptEl.innerHTML} ${esc(this.input.value)}^C`, 'echo')
      this.input.value = ''
    }
  }

  private complete() {
    const value = this.input.value
    const parts = value.split(/\s+/)
    let options: string[]
    if (parts.length <= 1) {
      options = [...this.commands.keys()].filter(k => !this.commands.get(k)!.hidden && k.startsWith(parts[0]))
    } else {
      const c = this.commands.get(parts[0])
      const last = parts[parts.length - 1]
      options = (c?.complete?.(parts.slice(1)) ?? []).filter(o => o.startsWith(last))
    }
    options = [...new Set(options)].sort()
    if (options.length === 1) {
      parts[parts.length - 1] = options[0]
      this.input.value = parts.join(' ') + ' '
    } else if (options.length > 1) {
      const prefix = options.reduce((a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i) })
      parts[parts.length - 1] = prefix
      this.input.value = parts.join(' ')
      this.print(`${this.promptEl.innerHTML} ${esc(value)}`, 'echo')
      this.print(options.map(o => cmd(o, parts.length > 1 ? `${parts.slice(0, -1).join(' ')} ${o}` : o)).join('  '))
    }
  }
}
