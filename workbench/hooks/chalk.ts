import type { Progress } from '../types'

const W = 1600
const H = 1000
export const CHALK_TARGET = 40

// The proof, one line further for each slice of the day's target.
export const PROOF = [
  'e^x = 1 + x + x²/2! + x³/3! + …',
  'cos x = 1 − x²/2! + x⁴/4! − …',
  'sin x = x − x³/3! + x⁵/5! − …',
  'let x = iθ',
  'e^(iθ) = 1 + iθ − θ²/2! − iθ³/3! + …',
  'e^(iθ) = cos θ + i sin θ',
  'θ = π',
  'e^(iπ) = −1',
  'e^(iπ) + 1 = 0   ✓',
]

export const linesShown = (n: number) =>
  n <= 0 ? 0 : Math.min(PROOF.length, Math.max(1, Math.ceil((n / CHALK_TARGET) * PROOF.length)))

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const CSS = `
.frame { fill: #4f3622; }
.bg { fill: #1f2a25; }
.chalk { fill: #ecebe4; font-family: Segoe Print, Bradley Hand, Chalkboard SE, Comic Sans MS, cursive; }
.dust { fill: #ecebe4; opacity: 0.018; }
.tally { stroke: #ecebe4; stroke-width: 4; stroke-linecap: round; opacity: 0.85; }
.ul { stroke: #f0c84a; stroke-width: 3; fill: none; stroke-linecap: round; opacity: 0.85; }
@keyframes write { from { width: 0; } }
@keyframes stroke { from { stroke-dashoffset: 80; } }
.wipe { animation: write 2.2s steps(40) .3s both; }
.newtally { stroke-dasharray: 80; animation: stroke .6s ease-out .2s both; }
`

export function chalkSvg(progress: Progress | null): string {
  const n = progress?.today ?? 0
  const shown = linesShown(n)
  const dust = Array.from({ length: 26 }, (_, i) => {
    const x = ((i * 397) % 1500) + 50
    const y = ((i * 233) % 820) + 80
    const r = 40 + ((i * 53) % 120)
    return `<ellipse class="dust" cx="${x}" cy="${y}" rx="${r}" ry="${(r * 0.45).toFixed(0)}"/>`
  }).join('')
  const lines = PROOF.slice(0, shown)
    .map((t, i) => {
      const y = 170 + i * 72
      const isNew = i === shown - 1
      const text = `<text class="chalk" x="1060" y="${y}" font-size="${i === PROOF.length - 1 ? 34 : 26}" opacity="${isNew ? 1 : 0.8}">${esc(t)}</text>`
      return isNew
        ? `<clipPath id="c${i}"><rect class="wipe" x="1050" y="${y - 40}" width="520" height="60"/></clipPath><g clip-path="url(#c${i})">${text}</g>`
        : text
    })
    .join('')
  const tallies: string[] = []
  for (let i = 0; i < Math.min(n, 80); i++) {
    const g = Math.floor(i / 5)
    const k = i % 5
    const gx = 90 + (g % 4) * 78
    const gy = 640 + Math.floor(g / 4) * 70
    const d = k < 4 ? `M${gx + k * 13} ${gy} l${((i * 7) % 3) - 1} 46` : `M${gx - 8} ${gy + 38} L${gx + 50} ${gy + 6}`
    tallies.push(`<path class="tally${i === n - 1 ? ' newtally' : ''}" d="${d}"/>`)
  }
  const empty = n === 0 ? `<text class="chalk" x="1060" y="170" font-size="24" opacity="0.55">your first prompt writes the first line</text>` : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><style>${CSS}</style>
<rect class="frame" width="${W}" height="${H}"/>
<rect class="bg" x="26" y="26" width="${W - 52}" height="${H - 92}" rx="6"/>${dust}
<text class="chalk" x="90" y="130" font-size="30" opacity="0.9">today's proof</text>
<path class="ul" d="M90 146 q90 -8 190 2"/>
<text class="chalk" x="90" y="600" font-size="18" opacity="0.7">prompts: ${n}</text>
${tallies.join('')}
${lines}${empty}
<rect x="300" y="${H - 66}" width="${W - 600}" height="22" rx="4" fill="#3f2a19"/>
<rect x="520" y="${H - 76}" width="70" height="14" rx="6" fill="#efeee8"/><rect x="620" y="${H - 74}" width="46" height="12" rx="5" fill="#f2c94c"/>
<rect x="1000" y="${H - 84}" width="120" height="26" rx="4" fill="#3b4a5a"/><rect x="1000" y="${H - 84}" width="120" height="10" rx="3" fill="#c9b79a"/>
</svg>`
}
