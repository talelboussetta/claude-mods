// Work log scanner for the drafting-table mod.
// Reads Claude Code transcripts (~/.claude/projects/*/*.jsonl) and the git
// history of every repository those sessions worked in, and prints the work
// done per day as JSON. Incremental: what it has read is kept in a cache file,
// so later runs read only the new end of each transcript.
//
//   node scan.mjs <cacheFile> [days]

import { createReadStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, basename, sep } from 'node:path'
import { execFileSync } from 'node:child_process'

const cacheFile = process.argv[2] ?? join(homedir(), '.claude', 'drafting-table-cache.json')
const DAYS = Number(process.argv[3] ?? 14)
const CACHE_VERSION = 3
const SLOT_MS = 5 * 60 * 1000
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

const now = Date.now()
const dayKey = ms => {
  const d = new Date(ms)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const startOfWindow = (() => {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (DAYS - 1))
  return d.getTime()
})()

let cache = { v: CACHE_VERSION, files: {} }
try {
  const read = JSON.parse(readFileSync(cacheFile, 'utf8'))
  if (read.v === CACHE_VERSION) cache = read
} catch {}

const projectOf = cwd => {
  if (typeof cwd !== 'string' || cwd === '') return 'unknown'
  let path = cwd.replace(/[\\/]+$/, '')
  const wt = path.search(/[\\/]\.claude[\\/]worktrees[\\/]/)
  if (wt >= 0) path = path.slice(0, wt)
  if (/scratch-workspaces/i.test(path)) return 'scratch'
  if (/[\\/]rt3([\\/]|$)/i.test(path)) return 'rt3'
  const parts = path.split(/[\\/]/).filter(Boolean)
  // D:\dev\work\<repo>\... and D:\dev\startup\<project>\... name the project folder.
  const dev = parts.findIndex(p => p.toLowerCase() === 'dev')
  if (dev >= 0 && parts.length > dev + 2) return parts[dev + 2]
  if (dev >= 0 && parts.length > dev + 1) return parts[dev + 1]
  return parts.at(-1) ?? path
}

const linesOf = s => (typeof s === 'string' && s.length > 0 ? s.split('\n').length : 0)

function bucket(file, day) {
  return (file.days[day] ??= { p: 0, t: 0, e: 0, l: 0, slots: [], proj: {} })
}

function touch(file, ms) {
  const day = dayKey(ms)
  const b = bucket(file, day)
  const slot = Math.floor(ms / SLOT_MS)
  if (!b.slots.includes(slot)) b.slots.push(slot)
  return b
}

function handleLine(file, line) {
  const isAssistant = line.includes('"type":"assistant"')
  const isHuman = !isAssistant && line.includes('"kind":"human"') && line.includes('"type":"user"')
  if (!isAssistant && !isHuman) return
  let o
  try {
    o = JSON.parse(line)
  } catch {
    return
  }
  if (o.isSidechain) return
  const ms = Date.parse(o.timestamp)
  if (!Number.isFinite(ms) || ms < startOfWindow) return

  if (o.type === 'user' && o.origin?.kind === 'human') {
    const c = o.message?.content
    const isPrompt =
      typeof c === 'string' ||
      (Array.isArray(c) && c.some(b => b?.type === 'text') && !c.some(b => b?.type === 'tool_result'))
    if (!isPrompt || o.isMeta) return
    file.human = true
    const b = touch(file, ms)
    b.p += 1
    const proj = projectOf(o.cwd)
    b.proj[proj] = (b.proj[proj] ?? 0) + 1
    if (typeof o.cwd === 'string' && !file.cwds.includes(o.cwd)) file.cwds.push(o.cwd)
    return
  }

  if (o.type === 'assistant') {
    const blocks = o.message?.content
    if (!Array.isArray(blocks)) return
    const b = touch(file, ms)
    for (const block of blocks) {
      if (block?.type !== 'tool_use') continue
      b.t += 1
      if (EDIT_TOOLS.has(block.name)) {
        b.e += 1
        const i = block.input ?? {}
        if (block.name === 'Write') b.l += linesOf(i.content)
        else if (block.name === 'Edit') b.l += linesOf(i.new_string)
        else if (block.name === 'MultiEdit') for (const ed of i.edits ?? []) b.l += linesOf(ed?.new_string)
        else if (block.name === 'NotebookEdit') b.l += linesOf(i.new_source)
      }
    }
  }
}

function scanFile(path, file, size) {
  return new Promise(resolve => {
    const stream = createReadStream(path, { start: file.offset, end: size - 1 })
    let carry = Buffer.alloc(0)
    let consumed = file.offset
    stream.on('data', chunk => {
      let buf = carry.length ? Buffer.concat([carry, chunk]) : chunk
      let start = 0
      let nl
      while ((nl = buf.indexOf(10, start)) !== -1) {
        handleLine(file, buf.toString('utf8', start, nl))
        consumed += nl - start + 1
        start = nl + 1
      }
      carry = buf.subarray(start)
    })
    stream.on('end', () => {
      file.offset = consumed
      resolve()
    })
    stream.on('error', () => resolve())
  })
}

const root = join(homedir(), '.claude', 'projects')
const seen = new Set()
let projectDirs = []
try {
  projectDirs = readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory())
} catch {}

for (const dir of projectDirs) {
  const full = join(root, dir.name)
  let entries = []
  try {
    entries = readdirSync(full, { withFileTypes: true })
  } catch {
    continue
  }
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.endsWith('.jsonl')) continue
    const path = join(full, ent.name)
    let st
    try {
      st = statSync(path)
    } catch {
      continue
    }
    if (st.mtimeMs < startOfWindow) continue
    seen.add(path)
    let file = cache.files[path]
    if (!file || st.size < file.offset) {
      file = cache.files[path] = { offset: 0, human: false, days: {}, cwds: [] }
    }
    if (st.size > file.offset) await scanFile(path, file, st.size)
  }
}

// Forget files and days that left the window.
const firstDay = dayKey(startOfWindow)
for (const [path, file] of Object.entries(cache.files)) {
  if (!seen.has(path)) {
    delete cache.files[path]
    continue
  }
  for (const day of Object.keys(file.days)) if (day < firstDay) delete file.days[day]
}

// Commits: every repository a human session worked in.
const git = (args, cwd) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 })
  } catch {
    return ''
  }
}
const author = git(['config', '--global', 'user.email'], homedir()).trim() || git(['config', '--global', 'user.name'], homedir()).trim()
const repos = new Set()
const cwds = new Set(Object.values(cache.files).filter(f => f.human).flatMap(f => f.cwds))
for (const cwd of cwds) {
  if (!existsSync(cwd)) continue
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd).trim()
  // A folder whose repository is the whole home folder is not a project.
  const top = git(['rev-parse', '--show-toplevel'], cwd).trim()
  if (common === '' || top === '' || top.replace(/\//g, sep).toLowerCase() === homedir().toLowerCase()) continue
  if (!repos.has(common)) repos.add(common)
}
const commitsByDay = {}
const commitHashes = new Set()
const repoByDay = {}
for (const common of repos) {
  const args = ['--git-dir', common, 'log', '--all', `--since=${new Date(startOfWindow).toISOString()}`, '--format=%H %at']
  if (author) args.push(`--author=${author}`)
  const name = basename(dirname(common))
  for (const row of git(args, homedir()).split('\n')) {
    const [hash, at] = row.trim().split(' ')
    if (!hash || commitHashes.has(hash)) continue
    commitHashes.add(hash)
    const day = dayKey(Number(at) * 1000)
    commitsByDay[day] = (commitsByDay[day] ?? 0) + 1
    ;(repoByDay[day] ??= {})[name] = (repoByDay[day][name] ?? 0) + 1
  }
}

// Totals per day.
const days = []
for (let i = 0; i < DAYS; i++) {
  const d = new Date(startOfWindow)
  d.setDate(d.getDate() + i)
  const key = dayKey(d.getTime())
  const slots = new Set()
  const proj = {}
  let p = 0, t = 0, e = 0, l = 0, sessions = 0
  for (const file of Object.values(cache.files)) {
    if (!file.human) continue
    const b = file.days[key]
    if (!b) continue
    if (b.p > 0) sessions += 1
    p += b.p
    t += b.t
    e += b.e
    l += b.l
    for (const s of b.slots) slots.add(s)
    for (const [k, v] of Object.entries(b.proj)) proj[k] = (proj[k] ?? 0) + v
  }
  const projects = Object.entries(proj).sort((a, b) => b[1] - a[1]).slice(0, 3)
  days.push({
    date: key,
    prompts: p,
    tools: t,
    edits: e,
    lines: l,
    minutes: slots.size * 5,
    sessions,
    commits: commitsByDay[key] ?? 0,
    projects,
  })
}

try {
  mkdirSync(dirname(cacheFile), { recursive: true })
  writeFileSync(cacheFile, JSON.stringify(cache))
} catch {}

process.stdout.write(JSON.stringify({ generatedAt: now, repos: repos.size, days }))
