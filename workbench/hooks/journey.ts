import type { Progress } from '../types'

const W = 1600
const H = 1000
export const ROAD_TARGET = 40
const f = (n: number) => n.toFixed(1)

const CSS = `
.r1 { fill: #3c4a66; } .r2 { fill: #2b3650; } .r3 { fill: #1c2438; } .r4 { fill: #121827; }
.mist { fill: #c9d3e6; opacity: 0.10; }
.star { fill: #fff; }
.path { fill: none; stroke: #e9c48a; stroke-width: 2; stroke-dasharray: 2 8; opacity: 0.55; stroke-linecap: round; }
.walked { fill: none; stroke: #f3cf8f; stroke-width: 3; opacity: 0.9; stroke-linecap: round; }
.ms { fill: #f3cf8f; }
.cal { fill: #f3dcb4; font-family: Segoe UI, Tahoma, Geeza Pro, Arial, sans-serif; font-weight: 700; }
.t { fill: #e9e2d4; font: 600 13px ui-sans-serif, Segoe UI, sans-serif; letter-spacing: 3px; }
.s { fill: #a9b3c6; font: 13px ui-sans-serif, Segoe UI, sans-serif; }
@keyframes drift { from { transform: translateX(-60px); } to { transform: translateX(60px); } }
@keyframes tw { 0%, 100% { opacity: .2; } 50% { opacity: .9; } }
@keyframes step { from { transform: translate(-34px, 4px); } }
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
.m1 { animation: drift 40s ease-in-out infinite alternate; }
.m2 { animation: drift 55s ease-in-out infinite alternate-reverse; }
.walker { animation: step 1.4s cubic-bezier(.3,.6,.3,1) .3s both; }
.bob { animation: bob .35s ease-in-out .3s 4; }
`

const ridge = (base: number, amp: number, seed: number, cls: string) => {
  let d = `M0 ${H}`
  for (let x = 0; x <= W; x += 40) {
    const y = base - Math.abs(Math.sin(x / 210 + seed)) * amp - Math.sin(x / 67 + seed * 3) * amp * 0.18
    d += ` L${x} ${f(y)}`
  }
  return `<path class="${cls}" d="${d} L${W} ${H} Z"/>`
}

const pathY = (x: number) => 860 - Math.sin(x / 260 + 1.2) * 40 - x * 0.06
const PTS: [number, number][] = Array.from({ length: 41 }, (_, i) => {
  const x = 80 + i * 36
  return [x, pathY(x)]
})

export const roadShare = (n: number) => Math.min(1, n / ROAD_TARGET)

export function journeySvg(progress: Progress | null): string {
  const n = progress?.today ?? 0
  const t = roadShare(n)
  const idx = Math.round(t * (PTS.length - 1))
  const line = (pts: [number, number][]) => 'M' + pts.map(([x, y]) => `${x} ${f(y)}`).join(' L')
  const [wx, wy] = PTS[idx]!
  const stars = Array.from({ length: 70 }, (_, i) => {
    const x = (i * 211) % W
    const y = ((i * 97) % 380) + 10
    const r = (i % 3) * 0.5 + 0.7
    return `<circle class="star" cx="${x}" cy="${y}" r="${r}" style="animation: tw ${4 + (i % 5)}s ease-in-out ${(i % 7) * 0.6}s infinite"/>`
  }).join('')
  const miles = [0.25, 0.5, 0.75, 1]
    .map(m => {
      const [x, y] = PTS[Math.round(m * (PTS.length - 1))]!
      return `<circle class="ms" cx="${x}" cy="${f(y)}" r="${m <= t ? 6 : 4}" opacity="${m <= t ? 1 : 0.4}"/>`
    })
    .join('')
  const walker = `<g transform="translate(${wx} ${f(wy)}) scale(1.7)"><g class="${n > 0 ? 'walker' : ''}"><g class="${n > 0 ? 'bob' : ''}">
<circle cx="0" cy="-34" r="5" fill="#0b0f1a"/><path d="M-5 -28 h10 l3 18 h-16 Z" fill="#0b0f1a"/><path d="M-4 -10 l-4 10 M4 -10 l5 10" stroke="#0b0f1a" stroke-width="3" stroke-linecap="round"/>
<path d="M9 -32 l4 32" stroke="#0b0f1a" stroke-width="2" stroke-linecap="round"/><circle cx="-6" cy="-20" r="5" fill="#f3cf8f"/></g></g></g>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><style>${CSS}</style>
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f1630"/><stop offset="0.55" stop-color="#2a3558"/><stop offset="0.8" stop-color="#8a6a78"/><stop offset="1" stop-color="#e2a37c"/></linearGradient></defs>
<rect fill="url(#sky)" width="${W}" height="${H}"/>${stars}
<circle cx="1330" cy="170" r="46" fill="#f3e6c8" opacity="0.9"/><circle cx="1312" cy="160" r="46" fill="#121b3a" opacity="0.92"/>
<text class="cal" x="560" y="240" font-size="120" opacity="0.10" direction="rtl" text-anchor="start">الرحلة</text>
${ridge(700, 160, 0.3, 'r1')}
<g class="m1"><ellipse class="mist" cx="500" cy="700" rx="700" ry="40"/></g>
${ridge(780, 130, 1.7, 'r2')}
<g class="m2"><ellipse class="mist" cx="1100" cy="790" rx="800" ry="46"/></g>
${ridge(880, 90, 2.9, 'r3')}
<path class="r4" d="M0 ${H} L0 900 ${PTS.map(([x, y]) => `L${x} ${f(y + 22)}`).join(' ')} L${W} 860 L${W} ${H} Z"/>
<path class="path" d="${line(PTS)}"/>
<path class="walked" d="${line(PTS.slice(0, idx + 1))}"/>
${miles}
${walker}
<text class="t" x="80" y="${H - 40}">TODAY'S ROAD</text>
<text class="s" x="230" y="${H - 40}">${n} prompts · ${Math.round(t * 100)}% of the way · each prompt is one step</text>
</svg>`
}
