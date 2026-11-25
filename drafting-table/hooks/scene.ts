import type { WorkDay, WorkLog } from '../types'

// One day's work as a number: what moves the drawing forward.
// 100 points finish the day's drawing.
export const DAY_TARGET = 100
export const scoreOf = (d: WorkDay | undefined): number =>
  d === undefined ? 0 : d.prompts * 2 + d.edits + d.commits * 5 + d.minutes / 10

export const STAGES = [
  'centre lines',
  'pitch circle',
  'bore and keyway',
  'bolt circle',
  'gear teeth',
  'section A-A',
  'hatching',
  'dimensions',
  'callouts',
  'approval stamp',
] as const

export const stagesDone = (d: WorkDay | undefined): number =>
  Math.min(STAGES.length, Math.floor((scoreOf(d) / DAY_TARGET) * STAGES.length))

export const today = (log: WorkLog | null): WorkDay | undefined => log?.days.at(-1)
export const lastWeek = (log: WorkLog | null): WorkDay[] => log?.days.slice(-7) ?? []

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const hours = (minutes: number) =>
  minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`

export const kilo = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

const DAY_LETTERS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
export const weekday = (date: string) => DAY_LETTERS[new Date(`${date}T12:00:00`).getDay()] ?? '--'

// Colors for light (drafting vellum) and dark (blueprint), shared with the pane.
export const SHEET_CSS = `
svg { --paper: #e9eef2; --grid: #1d4f8612; --grid2: #1d4f8628; --ink: #123f75; --ink2: #2c5c94; --ghost: #1d4f8660; --mark: #d4500a; --hatch: #1d4f8680; }
@media (prefers-color-scheme: dark) {
  svg { --paper: #0a1a2f; --grid: #7fc3ff0e; --grid2: #7fc3ff22; --ink: #b4dcff; --ink2: #7fb8ec; --ghost: #7fc3ff55; --mark: #ff7a2a; --hatch: #7fc3ff80; }
}
.paper { fill: var(--paper); }
.ink { stroke: var(--ink); fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.thin { stroke: var(--ink2); fill: none; stroke-width: 1.2; }
.ghost { stroke: var(--ghost); fill: none; stroke-width: 1.3; stroke-dasharray: 3 5; }
.centre { stroke: var(--ink2); fill: none; stroke-width: 1.1; stroke-dasharray: 18 4 2 4; }
.mark { stroke: var(--mark); fill: none; stroke-width: 2.6; }
.markfill { fill: var(--mark); }
.txt { fill: var(--ink); font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; font-weight: 600; letter-spacing: 0.06em; }
.dim { fill: var(--ink2); font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; }
.big { fill: var(--ink); font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 22px; font-weight: 700; letter-spacing: 0.04em; }
.marktxt { fill: var(--mark); font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 700; letter-spacing: 0.12em; }
`

function gearPath(cx: number, cy: number, teeth: number, rOut: number, rRoot: number): string {
  const pts: string[] = []
  const step = (Math.PI * 2) / teeth
  for (let i = 0; i < teeth; i++) {
    const a = i * step
    const p = (r: number, t: number) =>
      `${(cx + r * Math.cos(a + t * step)).toFixed(1)} ${(cy + r * Math.sin(a + t * step)).toFixed(1)}`
    pts.push(p(rRoot, 0), p(rRoot, 0.12), p(rOut, 0.28), p(rOut, 0.52), p(rRoot, 0.68))
  }
  return `M${pts.join(' L')} Z`
}

const arrow = (x: number, y: number, dir: 1 | -1) =>
  `<path class="markfill" d="M${x} ${y} l${8 * dir} -3 v6 z"/>`

// The day's part: a flanged spur gear, front view and section, drawn stage by
// stage. Stages not reached yet show as faint construction lines.
function partDrawing(done: number, total: number): string {
  const cx = 1390
  const cy = 330
  const out: string[] = []
  const stage = (i: number, body: string, ghost: string = body) => {
    if (i < done) {
      const isNewest = i === done - 1
      out.push(`<g class="${isNewest ? 'newest' : ''}">${body}</g>`)
    } else {
      out.push(`<g class="ghostlayer">${ghost.replace(/class="spin"/g, '').replace(/class="(ink|mark|thin|centre)"/g, 'class="ghost"').replace(/class="markfill"/g, 'class="ghostfill"').replace(/class="(marktxt|dim)"/g, 'class="ghosttxt"')}</g>`)
    }
  }

  // 1 centre lines
  stage(0, `<path class="centre" d="M${cx - 175} ${cy} H${cx + 175} M${cx} ${cy - 175} V${cy + 175}"/>`)
  // 2 pitch circle
  stage(1, `<circle class="centre" cx="${cx}" cy="${cy}" r="133"/><circle class="ink" cx="${cx}" cy="${cy}" r="118"/>`)
  // 3 bore and keyway
  stage(2, `<path class="ink" d="M${cx - 30} ${cy - 6} A31 31 0 1 0 ${cx + 30} ${cy - 6} L${cx + 30} ${cy - 6}"/><path class="ink" d="M${cx - 30} ${cy - 6} V${cy - 30} H${cx - 6} M${cx + 30} ${cy - 6} V${cy - 30} H${cx + 6} M${cx - 6} ${cy - 30} V${cy - 40} H${cx + 6} V${cy - 30}"/>`)
  // 4 bolt circle and holes
  const holes = Array.from({ length: 6 }, (_, k) => {
    const a = (k * Math.PI) / 3 + Math.PI / 6
    return `<circle class="ink" cx="${(cx + 75 * Math.cos(a)).toFixed(1)}" cy="${(cy + 75 * Math.sin(a)).toFixed(1)}" r="9"/>`
  }).join('')
  stage(3, `<circle class="centre" cx="${cx}" cy="${cy}" r="75"/>${holes}`)
  // 5 teeth (the gear turns once the teeth exist)
  stage(4, `<g class="spin"><path class="ink" d="${gearPath(cx, cy, 28, 148, 126)}"/></g>`)
  // 6 section A-A below the front view
  const sy = 610
  const section = `<path class="ink" d="M${cx - 148} ${sy - 24} H${cx + 148} V${sy + 24} H${cx - 148} Z M${cx - 118} ${sy - 24} V${sy - 40} H${cx + 118} V${sy - 24} M${cx - 31} ${sy - 40} V${sy + 24} M${cx + 31} ${sy - 40} V${sy + 24}"/><text class="dim" x="${cx - 148}" y="${sy + 50}">SECTION A-A</text>`
  stage(5, section)
  // 7 hatching on the section
  const hatch: string[] = []
  for (let x = cx - 148; x < cx + 148; x += 10) {
    if (x > cx - 36 && x < cx + 26) continue
    hatch.push(`M${x} ${sy + 24} l${Math.min(48, cx + 148 - x)} ${-Math.min(48, cx + 148 - x)}`)
  }
  stage(6, `<path class="thin" style="stroke: var(--hatch)" d="${hatch.join(' ')}"/>`)
  // 8 dimensions
  stage(
    7,
    `<path class="thin" d="M${cx - 148} ${cy + 175} V${cy + 200} M${cx + 148} ${cy + 175} V${cy + 200} M${cx - 140} ${cy + 192} H${cx + 140}"/>${arrow(cx - 148, cy + 192, 1)}${arrow(cx + 148, cy + 192, -1)}<text class="dim" x="${cx - 26}" y="${cy + 186}">Ø296 h7</text><path class="thin" d="M${cx - 172} ${sy - 40} V${sy + 24} M${cx - 178} ${sy - 40} H${cx - 152} M${cx - 178} ${sy + 24} H${cx - 152}"/><text class="dim" x="${cx - 168}" y="${sy - 4}">64</text>`,
  )
  // 9 callout balloons
  const balloon = (n: number, x: number, y: number, tx: number, ty: number) =>
    `<path class="thin" d="M${x} ${y} L${tx} ${ty}"/><circle class="ink" cx="${tx}" cy="${ty}" r="12"/><text class="dim" x="${tx - 3.5}" y="${ty + 3.5}">${n}</text><circle class="markfill" cx="${x}" cy="${y}" r="2.2"/>`
  stage(8, balloon(1, cx + 100, cy - 100, cx + 160, cy - 160) + balloon(2, cx + 66, cy + 38, cx + 170, cy + 120) + balloon(3, cx - 6, cy - 36, cx - 120, cy - 170))
  // 10 approval stamp
  stage(
    9,
    `<g transform="rotate(-14 ${cx - 80} ${cy + 110})"><rect class="mark" x="${cx - 160}" y="${cy + 84}" width="160" height="52" rx="6"/><rect class="mark" style="stroke-width:1" x="${cx - 155}" y="${cy + 89}" width="150" height="42" rx="4"/><text class="marktxt" font-size="20" x="${cx - 146}" y="${cy + 117}">SHIPPED</text></g>`,
  )

  const pct = Math.round((done / total) * 100)
  return `<g class="part">${out.join('')}<text class="dim" x="${cx - 175}" y="${cy - 190}">FIG. 1  DAILY ASSEMBLY  ${pct}% DRAFTED</text></g>`
}

// The week as a building elevation: one hatched column a day.
function elevation(week: WorkDay[]): string {
  const x0 = 70
  const base = 900
  const colW = 34
  const gap = 12
  const maxH = 260
  const max = Math.max(DAY_TARGET, ...week.map(scoreOf))
  const cols = week
    .map((d, i) => {
      const s = scoreOf(d)
      const h = Math.max(2, (s / max) * maxH)
      const x = x0 + i * (colW + gap)
      const isToday = i === week.length - 1
      const floors: string[] = []
      for (let y = base - 14; y > base - h + 4; y -= 14) floors.push(`M${x + 4} ${y} H${x + colW - 4}`)
      return `<rect class="${isToday ? 'mark' : 'ink'}" x="${x}" y="${(base - h).toFixed(1)}" width="${colW}" height="${h.toFixed(1)}"/><path class="thin" d="${floors.join(' ')}"/><text class="dim" x="${x + 9}" y="${base + 16}">${weekday(d.date)}</text><text class="dim" x="${x + 4}" y="${(base - h - 6).toFixed(1)}">${Math.round(s)}</text>`
    })
    .join('')
  const targetY = base - (DAY_TARGET / max) * maxH
  const width = 7 * (colW + gap)
  return `<g class="elev"><text class="txt" x="${x0}" y="${base - maxH - 40}">ELEVATION  LAST 7 DAYS</text><path class="ink" d="M${x0 - 14} ${base} H${x0 + width + 4}"/><path class="centre" d="M${x0 - 14} ${targetY.toFixed(1)} H${x0 + width + 4}"/><text class="dim" x="${x0 - 14}" y="${(targetY - 5).toFixed(1)}">TARGET ${DAY_TARGET}</text>${cols}</g>`
}

function titleBlock(d: WorkDay | undefined, week: WorkDay[], done: number): string {
  const x = 1170
  const y = 770
  const w = 400
  const sum = (k: keyof Pick<WorkDay, 'prompts' | 'commits' | 'minutes'>) => week.reduce((n, one) => n + one[k], 0)
  const rev = String.fromCharCode(65 + Math.min(25, d?.commits ?? 0))
  const date = d?.date ?? '----------'
  const cell = (cx: number, cy: number, label: string, value: string) =>
    `<text class="dim" x="${cx + 6}" y="${cy + 13}">${label}</text><text class="big" x="${cx + 6}" y="${cy + 38}">${esc(value)}</text>`
  const rows = [
    cell(x, y + 40, 'PROMPTS', String(d?.prompts ?? 0)),
    cell(x + 100, y + 40, 'TOOL RUNS', String(d?.tools ?? 0)),
    cell(x + 200, y + 40, 'EDITS', String(d?.edits ?? 0)),
    cell(x + 300, y + 40, 'LINES', kilo(d?.lines ?? 0)),
    cell(x, y + 90, 'COMMITS', String(d?.commits ?? 0)),
    cell(x + 100, y + 90, 'ON BOARD', hours(d?.minutes ?? 0)),
    cell(x + 200, y + 90, 'WEEK PRM', String(sum('prompts'))),
    cell(x + 300, y + 90, 'WEEK TIME', hours(sum('minutes'))),
  ].join('')
  return `<g class="tb"><rect class="ink" x="${x}" y="${y}" width="${w}" height="190"/><path class="thin" d="M${x} ${y + 40} H${x + w} M${x} ${y + 90} H${x + w} M${x} ${y + 140} H${x + w} M${x + 100} ${y + 40} V${y + 140} M${x + 200} ${y + 40} V${y + 140} M${x + 300} ${y} V${y + 140} M${x + 300} ${y + 140} V${y + 190}"/><text class="dim" x="${x + 6}" y="${y + 14}">TITLE</text><text class="txt" x="${x + 6}" y="${y + 32}" font-weight="700">WORK LOG / DAILY ASSEMBLY</text><text class="dim" x="${x + 306}" y="${y + 14}">REV</text><text class="big" x="${x + 340}" y="${y + 34}">${rev}</text><text class="dim" x="${x + 6}" y="${y + 155}">DWG NO.  WL-${date.replace(/-/g, '')}   SCALE 1:1   SHEET 1/1</text><text class="dim" x="${x + 6}" y="${y + 176}">DRAWN T.B.   CHK CLAUDE   ${done}/${STAGES.length} STAGES</text>${rows}<text class="dim" x="${x + 306}" y="${y + 155}">STATUS</text><text class="marktxt" font-size="13" x="${x + 306}" y="${y + 176}">${done >= STAGES.length ? 'RELEASED' : done === 0 ? 'NOT STARTED' : 'IN WORK'}</text></g>`
}

function partsList(d: WorkDay | undefined): string {
  const x = 70
  const y = 80
  const items = d?.projects ?? []
  const rows = items.length === 0
    ? `<text class="dim" x="${x + 6}" y="${y + 62}">NO PARTS YET TODAY</text>`
    : items
        .map(([name, n], i) => `<text class="txt" x="${x + 6}" y="${y + 62 + i * 22}">${i + 1}</text><text class="txt" x="${x + 40}" y="${y + 62 + i * 22}">${esc(name.slice(0, 22).toUpperCase())}</text><text class="txt" x="${x + 270}" y="${y + 62 + i * 22}">${n}</text>`)
        .join('')
  return `<g class="parts"><text class="txt" x="${x}" y="${y}" font-weight="700">PARTS LIST  TODAY</text><path class="thin" d="M${x} ${y + 12} H${x + 310} M${x} ${y + 42} H${x + 310} M${x + 32} ${y + 12} V${y + 112} M${x + 260} ${y + 12} V${y + 112}"/><text class="dim" x="${x + 6}" y="${y + 32}">ITEM</text><text class="dim" x="${x + 40}" y="${y + 32}">PROJECT</text><text class="dim" x="${x + 266}" y="${y + 32}">PRM</text>${rows}<text class="dim" x="${x}" y="${y + 140}">NOTES: 1. DO NOT SCALE DRAWING.</text><text class="dim" x="${x}" y="${y + 156}">2. BREAK ALL SHARP EDGES. 3. SHIP IT.</text></g>`
}

function frame(): string {
  const ticks: string[] = []
  const labels: string[] = []
  for (let i = 1; i < 8; i++) {
    const x = 20 + i * 195
    ticks.push(`M${x} 20 V34 M${x} 966 V980`)
    labels.push(`<text class="dim" x="${x - 100}" y="31">${i}</text><text class="dim" x="${x - 100}" y="977">${i}</text>`)
  }
  for (let i = 1; i < 5; i++) {
    const y = 20 + i * 192
    ticks.push(`M20 ${y} H34 M1566 ${y} H1580`)
    labels.push(`<text class="dim" x="24" y="${y - 92}">${'ABCDE'[i - 1]}</text><text class="dim" x="1570" y="${y - 92}">${'ABCDE'[i - 1]}</text>`)
  }
  return `<rect class="ink" x="20" y="20" width="1560" height="960"/><rect class="thin" x="34" y="34" width="1532" height="932"/><path class="thin" d="${ticks.join(' ')}"/>${labels.join('')}`
}

export function sceneSvg(log: WorkLog | null): string {
  const d = today(log)
  const week = lastWeek(log)
  const done = stagesDone(d)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>${SHEET_CSS}
.ghostfill { fill: var(--ghost); }
.ghosttxt { fill: var(--ghost); font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 10px; letter-spacing: 0.08em; }
.spin { transform-origin: 1390px 330px; animation: spin 240s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.newest path, .newest circle, .newest rect { stroke-dasharray: 1400; stroke-dashoffset: 0; animation: draft 7s ease-out 1; }
@keyframes draft { from { stroke-dashoffset: 1400; } to { stroke-dashoffset: 0; } }
.head { animation: plot 70s ease-in-out infinite; }
@keyframes plot { 0% { transform: translate(0px, 0px); } 25% { transform: translate(-120px, 90px); } 50% { transform: translate(60px, 170px); } 75% { transform: translate(110px, -60px); } 100% { transform: translate(0px, 0px); } }
</style>
<defs>
<pattern id="minor" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0 H0 V20" fill="none" style="stroke: var(--grid)" stroke-width="1"/></pattern>
<pattern id="major" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#minor)"/><path d="M100 0 H0 V100" fill="none" style="stroke: var(--grid2)" stroke-width="1"/></pattern>
</defs>
<rect class="paper" x="-400" y="-400" width="2400" height="1800"/>
<rect x="-400" y="-400" width="2400" height="1800" fill="url(#major)"/>
${frame()}
${partsList(d)}
${elevation(week)}
${partDrawing(done, STAGES.length)}
${titleBlock(d, week, done)}
<g class="head"><g transform="translate(1390 330)"><circle class="mark" r="10" style="stroke-width:1.2"/><path class="mark" style="stroke-width:1.2" d="M-22 0 H-12 M12 0 H22 M0 -22 V-12 M0 12 V22"/></g></g>
</svg>`
}

// A 14-day bar chart for the pane, in the same ink.
export function chartSvg(log: WorkLog | null, days: number): string {
  const list = log?.days.slice(-days) ?? []
  const w = 560
  const h = 200
  const pad = 28
  const max = Math.max(DAY_TARGET, ...list.map(scoreOf))
  const bw = (w - pad * 2) / Math.max(1, list.length)
  const bars = list
    .map((d, i) => {
      const s = scoreOf(d)
      const bh = (s / max) * (h - pad * 2)
      const x = pad + i * bw + 3
      const isToday = i === list.length - 1
      const commits = d.commits > 0 ? `<circle class="markfill" cx="${(x + (bw - 6) / 2).toFixed(1)}" cy="${(h - pad - bh - 8).toFixed(1)}" r="3"/>` : ''
      return `<rect class="${isToday ? 'mark' : 'ink'}" x="${x.toFixed(1)}" y="${(h - pad - bh).toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${Math.max(1, bh).toFixed(1)}"/>${commits}<text class="dim" x="${(x + 1).toFixed(1)}" y="${h - pad + 14}">${weekday(d.date)}</text>`
    })
    .join('')
  const ty = h - pad - (DAY_TARGET / max) * (h - pad * 2)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><style>${SHEET_CSS}</style><rect class="paper" width="${w}" height="${h}"/><path class="thin" d="M${pad} ${h - pad} H${w - pad}"/><path class="centre" d="M${pad} ${ty.toFixed(1)} H${w - pad}"/><text class="dim" x="${w - pad - 44}" y="${(ty - 4).toFixed(1)}">TARGET</text>${bars}</svg>`
}
