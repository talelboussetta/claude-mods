import type { ThemeMessageRule, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

// Drafting vellum by day, blueprint by night, safety orange for the marks.
export const { theme: COLORS, problems: COLOR_PROBLEMS } = makeColors({
  label: 'Drafting Table',
  roles: { accent: '#e8620f', danger: '#d23f3a', success: '#2f9466', warning: '#d6a21a', pro: '#6f63d8' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#e9eef2',
        'surface-1': '#f0f4f7',
        'surface-2': '#f7f9fb',
        'text-primary': '#0e2236',
        'text-secondary': '#2b4560',
        'text-muted': '#4b5f76',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0a1a2f',
        'surface-1': '#0e2139',
        'surface-2': '#122743',
        'surface-3': '#152c4a',
        'text-primary': '#e8f2fc',
        'text-secondary': '#bcd1e6',
        'text-muted': '#94acc6',
      },
    },
  },
})

const MARK = '#e8620f'

// Crop marks in the corners of a sheet: the box of every message.
const sheet = (ground: 'surface-1' | 'surface-2'): ThemeMessageRule => ({
  backgroundColor: ground,
  padding: 14,
  paddingX: 18,
  fill: {
    vector: {
      viewBox: 64,
      slice: 14,
      paths: [
        { d: 'M0 0H64V64H0Z', color: ground },
        { d: 'M0.5 0.5H63.5V63.5H0.5Z', color: 'border', strokeWidth: 1 },
        { d: 'M1 11V1H11', color: MARK, strokeWidth: 2 },
        { d: 'M53 1H63V11', color: MARK, strokeWidth: 2 },
        { d: 'M63 53V63H53', color: MARK, strokeWidth: 2 },
        { d: 'M11 63H1V53', color: MARK, strokeWidth: 2 },
      ],
    },
  },
})

export const LOOK: ThemeSetArgs = {
  colors: COLORS,
  // Strong enough frosting that text stays easy to read; the drawing lives at the edges.
  backdrop: { scene: 'drafting-sheet', glass: { blur: 14, opacity: 0.72 } },
  style: {
    Heading: { fontFamily: ['mono'], fontWeight: 'semibold', letterSpacing: 1 },
    UserMessage: sheet('surface-2'),
    // A solid card under replies, for comfortable reading.
    AssistantMessage: { backgroundColor: 'surface-1', radius: 0, paddingX: 14, paddingY: 10, borderColor: 'border', borderWidth: 1 },
    ToolUse: { fontFamily: ['code'], color: 'text-secondary', backgroundColor: 'surface-2', radius: 0, paddingX: 8, borderColor: 'border', borderWidth: 1 },
  },
  sound: {
    cues: {
      // a pen tapped on the board
      send: { layers: [{ wave: 'crackle', gain: 0.25, attack: 0.002, release: 0.05, filter: { type: 'bandpass', hz: 2400 } }] },
      // the plotter head stepping
      tool: { layers: [{ wave: 'white', gain: 0.08, attack: 0.002, release: 0.03, filter: { type: 'highpass', hz: 5000 } }] },
      // drawing released: two soft notes
      done: { layers: [{ wave: 'triangle', notes: ['E5', 'B5'], step: 0.09, gain: 0.18, release: 0.5 }] },
      ask: { layers: [{ wave: 'sine', notes: ['A4'], gain: 0.16, release: 0.35 }] },
      error: { layers: [{ wave: 'triangle', notes: ['D4', 'A3'], step: 0.12, gain: 0.18, release: 0.4 }] },
    },
  },
}

// What is left when a build refuses `style` or `sound`.
export const PLAIN_LOOK: ThemeSetArgs = { colors: COLORS, backdrop: LOOK.backdrop }
