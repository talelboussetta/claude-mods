import type { Progress as ChessProgress } from '../types'
import { GAMES } from './chess-games'
import type { Game, Ply } from './chess-games'

export const W = 1600
export const H = 1000
const S = 74
const BX = 900
const BY = 190
const TOTAL = GAMES.reduce((n, g) => n + g.plies.length, 0)
export const DAY_TARGET = 40

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Where the run of prompts has reached: which game, how many plies into it.
export function where(total: number): { game: Game; index: number; ply: number; won: number } {
  if (total <= 0) return { game: GAMES[0]!, index: 0, ply: 0, won: 0 }
  let k = ((total - 1) % TOTAL) + 1
  const laps = Math.floor((total - 1) / TOTAL)
  for (let i = 0; i < GAMES.length; i++) {
    const g = GAMES[i]!
    if (k <= g.plies.length) {
      const won = laps * GAMES.length + i + (k === g.plies.length ? 1 : 0)
      return { game: g, index: i, ply: k, won }
    }
    k -= g.plies.length
  }
  return { game: GAMES[0]!, index: 0, ply: 0, won: 0 }
}

const START = ['RNBQKBNR', 'PPPPPPPP', '', '', '', '', 'pppppppp', 'rnbqkbnr']
const sqName = (f: number, r: number) => String.fromCharCode(97 + f) + (r + 1)

function position(game: Game, upTo: number): Record<string, string> {
  const b: Record<string, string> = {}
  START.forEach((row, r) => [...row].forEach((p, f) => (b[sqName(f, r)] = p)))
  for (const p of game.plies.slice(0, upTo)) {
    if (p.captured && p.captured !== p.to) delete b[p.captured]
    b[p.to] = b[p.from]!
    delete b[p.from]
    if (p.rook) {
      b[p.rook[1]!] = b[p.rook[0]!]!
      delete b[p.rook[0]!]
    }
  }
  return b
}

const xy = (s: string) => ({ x: BX + (s.charCodeAt(0) - 97) * S, y: BY + (7 - (Number(s[1]) - 1)) * S })

// Flat pieces drawn on a 100 box, original shapes.
const SHAPES: Record<string, string> = {
  P: 'M50 18a12 12 0 1 1 0 24a12 12 0 1 1 0-24Z M40 45h20l-3 7h-14Z M43 52h14q2 16 11 26h-36q9-10 11-26Z M28 79h44v9h-44Z',
  R: 'M28 16h9v8h8v-8h10v8h8v-8h9v17l-7 6v32h-30v-32l-7-6Z M30 71h40l5 9h-50Z M25 80h50v8h-50Z',
  B: 'M50 12a5 5 0 1 1 0 10a5 5 0 1 1 0-10Z M50 23c-13 10-17 23-12 34h24c5-11 1-24-12-34Z M37 57h26v7h-26Z M41 64h18q2 9 9 15h-36q7-6 9-15Z M28 79h44v9h-44Z',
  N: 'M30 88v-9h4c0-14 6-24 14-32c-6 1-10 5-15 5c-5 0-7-5-4-10c5-8 12-15 18-17l3-8l5 7c12 5 19 19 21 34c1 10 0 20-1 30h5v9Z',
  Q: 'M29 75l-7-40l11 17l3-25l8 24l6-30l6 30l8-24l3 25l11-17l-7 40Z M26 75h48v6h-48Z M30 81h40l3 7h-46Z',
  K: 'M47 6h6v8h8v6h-8v8h-6v-8h-8v-6h8Z M50 29c-14 0-23 8-23 18c0 10 6 17 10 26h26c4-9 10-16 10-26c0-10-9-18-23-18Z M35 73h30v6h-30Z M28 80h44v8h-44Z',
}
const DOTS: Record<string, [number, number][]> = {
  Q: [[22, 33], [36, 25], [50, 17], [64, 25], [78, 33]],
}
const DETAIL: Record<string, string> = {
  B: 'M54 30l-9 11',
  N: 'M52 30h0.1',
  K: 'M50 36v26 M40 47h20',
}

function piece(p: string): string {
  const t = p.toUpperCase()
  const side = p === t ? 'w' : 'b'
  const s = S / 100
  const dots = (DOTS[t] ?? []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.5"/>`).join('')
  const detail = DETAIL[t] ? `<path class="det" d="${DETAIL[t]}"/>` : ''
  return `<g class="pc ${side}" transform="scale(${s})"><path d="${SHAPES[t]}"/>${dots}${detail}</g>`
}

const CSS = `
svg { --bg: #ece7dc; --bg2: #e2dccf; --txt: #2a2824; --sub: #6b665c; --rule: #2a282422; --chip: #2a28241a; --lite: #e9e4cd; --dark: #6d9152; --frame: #4a5a3b; --hi: #f3ea6a; --barbg: #3a3834; --barfg: #f4f1ea; --pane: #f6f3ec; }
@media (prefers-color-scheme: dark) {
  svg { --bg: #22211f; --bg2: #2a2926; --txt: #ece8df; --sub: #a39e92; --rule: #ece8df1c; --chip: #ece8df17; --pane: #2b2a27; }
}
.bg { fill: var(--bg); }
.pane { fill: var(--pane); stroke: var(--rule); }
.lite { fill: var(--lite); }
.dark { fill: var(--dark); }
.hi { fill: var(--hi); opacity: 0.55; }
.coord { font: 700 12px ui-sans-serif, Segoe UI, Helvetica, Arial, sans-serif; }
.coord.on-lite { fill: var(--dark); }
.coord.on-dark { fill: var(--lite); }
.t { fill: var(--txt); font-family: ui-sans-serif, Segoe UI, Helvetica, Arial, sans-serif; }
.s { fill: var(--sub); font-family: ui-sans-serif, Segoe UI, Helvetica, Arial, sans-serif; }
.m { fill: var(--txt); font-family: ui-monospace, Consolas, Menlo, monospace; }
.chip { fill: var(--chip); }
.now { fill: var(--dark); }
.nowt { fill: #fff; font-family: ui-monospace, Consolas, Menlo, monospace; font-weight: 700; }
.rule { stroke: var(--rule); }
.pc.w path, .pc.w circle { fill: #f7f5ef; stroke: #2e2d2a; stroke-width: 3.2; stroke-linejoin: round; }
.pc.b path, .pc.b circle { fill: #2c2b28; stroke: #111110; stroke-width: 3.2; stroke-linejoin: round; }
.pc.w .det { fill: none; stroke: #2e2d2a; stroke-width: 3.5; stroke-linecap: round; }
.pc.b .det { fill: none; stroke: #d8d4ca; stroke-width: 3.5; stroke-linecap: round; }
.shadow { fill: #000; opacity: 0.18; }
.ring { fill: none; stroke: var(--hi); stroke-width: 4; opacity: 0; }
.check { fill: url(#checkglow); }
.banner { fill: var(--pane); stroke: var(--dark); stroke-width: 3; }
.barbg { fill: var(--barbg); }
.barfg { fill: var(--barfg); }
@keyframes pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
@keyframes ripple { 0% { opacity: 0.9; transform: scale(0.4); } 100% { opacity: 0; transform: scale(1.5); } }
@keyframes gone { 0%, 60% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translate(10px, 34px) rotate(28deg) scale(0.55); } }
@keyframes fadein { 0%, 70% { opacity: 0; } 100% { opacity: 1; } }
@keyframes rise { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes breathe { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.6; } }
@keyframes tip { 0%, 55% { transform: none; } 100% { transform: rotate(-64deg); } }
.checkp { animation: pulse 1.1s ease-in-out 1.3s 3; }
`

function moverCss(id: string, from: string, to: string, delay: number): string {
  const a = xy(from)
  const b = xy(to)
  const dx = a.x - b.x
  const dy = a.y - b.y
  return `@keyframes ${id} { 0% { transform: translate(${dx}px, ${dy}px) scale(1); } 14% { transform: translate(${dx}px, ${dy - 10}px) scale(1.16); } 78% { transform: translate(0px, -10px) scale(1.16); } 90% { transform: translate(0px, 2px) scale(0.96); } 100% { transform: none; } }
.${id} { transform-origin: ${S / 2}px ${S / 2}px; animation: ${id} 1.05s cubic-bezier(.45,.05,.2,1) ${delay}s both; }
@keyframes ${id}s { 0% { transform: translate(${dx}px, ${dy}px) scale(1); opacity: 0.18; } 14% { transform: translate(${dx}px, ${dy}px) scale(1.25); opacity: 0.1; } 78% { transform: scale(1.25); opacity: 0.1; } 100% { transform: none; opacity: 0.18; } }
.${id}s { transform-origin: ${S / 2}px ${S * 0.88}px; animation: ${id}s 1.05s cubic-bezier(.45,.05,.2,1) ${delay}s both; }`
}

function moveList(game: Game, ply: number): string {
  const rows: string[] = []
  const total = Math.ceil(game.plies.length / 2)
  const cur = ply === 0 ? 0 : Math.ceil(ply / 2)
  const span = 13
  const first = Math.max(1, Math.min(cur - span + 3, total - span + 1))
  const y0 = BY + 166
  for (let n = first; n < first + span && n <= total; n++) {
    const y = y0 + (n - first) * 26
    rows.push(`<text class="s" x="96" y="${y}" font-size="14">${n}.</text>`)
    for (const side of [0, 1]) {
      const i = (n - 1) * 2 + side
      const p = game.plies[i]
      if (p === undefined) continue
      const x = side === 0 ? 140 : 250
      const isNow = i === ply - 1
      const isPast = i < ply
      if (isNow) rows.push(`<rect class="now" x="${x - 8}" y="${y - 17}" width="${p.san.length * 10 + 18}" height="24" rx="5" style="animation: rise .5s ease-out .2s both"/>`)
      rows.push(`<text class="${isNow ? 'nowt' : 'm'}" x="${x}" y="${y}" font-size="16" ${isPast || isNow ? '' : 'opacity="0.35"'}>${esc(p.san)}</text>`)
    }
  }
  return rows.join('')
}

export function boardSvg(progress: ChessProgress | null): string {
  const total = progress?.total ?? 0
  const today = progress?.today ?? 0
  const { game, index, ply, won } = where(total)
  const b = position(game, ply)
  const last: Ply | undefined = ply > 0 ? game.plies[ply - 1] : undefined
  const isMate = last?.check === 'mate'
  const delay = 0.35

  const squares: string[] = []
  for (let r = 7; r >= 0; r--) {
    for (let f = 0; f < 8; f++) {
      const isLite = (f + r) % 2 === 1
      const x = BX + f * S
      const y = BY + (7 - r) * S
      squares.push(`<rect class="${isLite ? 'lite' : 'dark'}" x="${x}" y="${y}" width="${S}" height="${S}"/>`)
      if (f === 0) squares.push(`<text class="coord ${isLite ? 'on-lite' : 'on-dark'}" x="${x + 4}" y="${y + 15}">${r + 1}</text>`)
      if (r === 0) squares.push(`<text class="coord ${isLite ? 'on-lite' : 'on-dark'}" x="${x + S - 12}" y="${y + S - 5}">${String.fromCharCode(97 + f)}</text>`)
    }
  }

  const marks: string[] = []
  const css: string[] = []
  if (last) {
    for (const s of [last.from, last.to]) {
      const { x, y } = xy(s)
      marks.push(`<rect class="hi" x="${x}" y="${y}" width="${S}" height="${S}"/>`)
    }
  }
  // The king in check glows red under its square.
  if (last?.check) {
    const kingSide = isWhitePiece(last.piece) ? 'k' : 'K'
    const ks = Object.keys(b).find(s => b[s] === kingSide)
    if (ks) {
      const { x, y } = xy(ks)
      marks.push(`<rect class="check checkp" x="${x}" y="${y}" width="${S}" height="${S}"/>`)
    }
  }

  const pieces: string[] = []
  const movers = new Set<string>()
  if (last) {
    movers.add(last.to)
    if (last.rook) movers.add(last.rook[1]!)
  }
  for (const [s, p] of Object.entries(b)) {
    if (movers.has(s)) continue
    const { x, y } = xy(s)
    const isMatedKing = isMate && last && p === (isWhitePiece(last.piece) ? 'k' : 'K')
    if (isMatedKing) {
      css.push(`.tipk { transform-origin: ${S / 2}px ${S * 0.88}px; transform: rotate(-64deg); animation: tip 1.6s cubic-bezier(.6,0,.4,1) 1.2s both; }`)
      pieces.push(`<g transform="translate(${x} ${y})"><g class="tipk">${piece(p)}</g></g>`)
      continue
    }
    pieces.push(`<g transform="translate(${x} ${y})">${piece(p)}</g>`)
  }

  const moving: string[] = []
  if (last) {
    // A captured piece falls away as the attacker lands.
    if (last.captured && last.capturedPiece) {
      const { x, y } = xy(last.captured)
      css.push(`.cap { transform-origin: ${S / 2}px ${S / 2}px; animation: gone .55s ease-in ${delay + 0.75}s both; }`)
      moving.push(`<g transform="translate(${x} ${y})"><g class="cap" opacity="0">${piece(last.capturedPiece)}</g></g>`)
    }
    const hops: [string, string, string][] = [['mv', last.from, last.to]]
    if (last.rook) hops.push(['mvr', last.rook[0]!, last.rook[1]!])
    for (const [id, from, to] of hops) {
      css.push(moverCss(id, from, to, id === 'mv' ? delay : delay + 0.35))
      const { x, y } = xy(to)
      const p = b[to]!
      moving.push(
        `<g transform="translate(${x} ${y})"><ellipse class="shadow ${id}s" cx="${S / 2}" cy="${S * 0.88}" rx="${S * 0.3}" ry="${S * 0.08}"/><g class="${id}">${piece(p)}</g></g>`,
      )
    }
    const { x, y } = xy(last.to)
    css.push(`.rp { transform-origin: ${x + S / 2}px ${y + S / 2}px; animation: ripple .8s ease-out ${delay + 0.95}s both; }`)
    moving.push(`<circle class="ring rp" cx="${x + S / 2}" cy="${y + S / 2}" r="${S * 0.55}"/>`)
  }

  // Today's prompts as the evaluation bar beside the board.
  const frac = Math.min(1, today / DAY_TARGET)
  const barH = 8 * S
  const fill = Math.round(barH * frac)
  const bar = `<rect class="barbg" x="${BX - 34}" y="${BY}" width="20" height="${barH}" rx="3"/><rect class="barfg" x="${BX - 34}" y="${BY + barH - fill}" width="20" height="${fill}" rx="3" style="animation: rise .8s ease-out both"/><text class="s" x="${BX - 24}" y="${BY + barH + 22}" font-size="13" text-anchor="middle" font-weight="700">${today}</text>`

  const next = GAMES[(index + 1) % GAMES.length]!
  const banner = isMate
    ? `<g style="animation: fadein 2.4s ease-out both"><rect class="banner" x="${BX + 2 * S - 10}" y="${BY + 3 * S}" width="${4 * S + 20}" height="${2 * S}" rx="12"/><text class="t" x="${BX + 4 * S}" y="${BY + 3 * S + 62}" font-size="34" font-weight="800" text-anchor="middle">${esc(game.result)}</text><text class="s" x="${BX + 4 * S}" y="${BY + 3 * S + 92}" font-size="14" text-anchor="middle" letter-spacing="2">CHECKMATE</text></g>`
    : ''

  const status = isMate
    ? `Next prompt opens ${esc(next.title)}`
    : last?.check === 'check'
      ? `${esc(last.san)}  Check!`
      : ply === 0
        ? 'Your next prompt plays the first move'
        : `Move ${Math.ceil(ply / 2)} of ${Math.ceil(game.plies.length / 2)}`

  const panel = `<rect class="pane" x="64" y="${BY}" width="360" height="${8 * S}" rx="14"/>
<text class="s" x="96" y="${BY + 40}" font-size="12" letter-spacing="2" font-weight="700">GAME ${index + 1} OF ${GAMES.length}</text>
<text class="t" x="96" y="${BY + 72}" font-size="26" font-weight="800">${esc(game.title)}</text>
<text class="s" x="96" y="${BY + 98}" font-size="13">${esc(game.players)}</text>
<text class="s" x="96" y="${BY + 118}" font-size="13">${esc(game.place)}</text>
<path class="rule" d="M96 ${BY + 134} H392"/>
${moveList(game, ply)}
<path class="rule" d="M96 ${BY + 8 * S - 74} H392"/>
<text class="t" x="96" y="${BY + 8 * S - 46}" font-size="15" font-weight="700">${status}</text>
<text class="s" x="96" y="${BY + 8 * S - 22}" font-size="13">${today} prompts today · ${total} moves played · ${won} ${won === 1 ? 'game' : 'games'} won</text>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
<style>${CSS}${css.join('\n')}</style>
<defs><radialGradient id="checkglow"><stop offset="0" stop-color="#ff3b30" stop-opacity="0.95"/><stop offset="0.6" stop-color="#ff3b30" stop-opacity="0.45"/><stop offset="1" stop-color="#ff3b30" stop-opacity="0"/></radialGradient>
<radialGradient id="vig" cx="0.62" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/></radialGradient></defs>
<rect class="bg" width="${W}" height="${H}"/>
<rect width="${W}" height="${H}" fill="url(#vig)"/>
<rect x="${BX - 10}" y="${BY - 10}" width="${8 * S + 20}" height="${8 * S + 20}" rx="10" fill="#000" opacity="0.25" transform="translate(0 8)"/>
<rect x="${BX - 8}" y="${BY - 8}" width="${8 * S + 16}" height="${8 * S + 16}" rx="8" style="fill: var(--frame)"/>
${squares.join('')}
${marks.join('')}
${pieces.join('')}
${moving.join('')}
${banner}
${bar}
${panel}
</svg>`
}

const isWhitePiece = (p: string) => p === p.toUpperCase()
