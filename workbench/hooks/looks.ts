import type { ThemeCue, ThemeMessageRule, ThemeSetArgs, ThemeSound } from 'claude-code'

import type { ThemeId } from '../types'
import { makeColors } from './make-colors.js'

// The scene stays sharp (no blur); solid message cards keep the text easy to read.
const GLASS = { blur: 0, opacity: 0.45 }

const card = (ground: 'surface-1' | 'surface-2', radius: number): ThemeMessageRule => ({
  backgroundColor: ground,
  radius,
  paddingX: 14,
  paddingY: 10,
})

// ---- Chess: club room, felt green and cream, charcoal at night.
const chess = makeColors({
  label: 'Workbench · Chess',
  roles: { accent: '#5f8a45', danger: '#d0453b', success: '#4f9a52', warning: '#c99a2e', pro: '#7a6bd6' },
  light: { gray: { anchors: { 'surface-0': '#ece7dc', 'surface-1': '#f5f2eb', 'surface-2': '#fbf9f5', 'text-primary': '#23211e', 'text-secondary': '#45413a', 'text-muted': '#615c52' } } },
  dark: { gray: { anchors: { 'surface-0': '#22211f', 'surface-1': '#2a2927', 'surface-2': '#31302d', 'surface-3': '#383633', 'text-primary': '#f1eee8', 'text-secondary': '#cfcac0', 'text-muted': '#aaa498' } } },
})

// ---- Chalkboard: slate green, chalk white, a yellow stick of chalk for the accent. Dark only.
const chalk = makeColors({
  label: 'Workbench · Chalkboard',
  only: 'dark',
  roles: { accent: '#f0c84a', danger: '#e8705f', success: '#8fcf8a', warning: '#f0c84a', pro: '#a99cf0' },
  dark: { gray: { anchors: { 'surface-0': '#1b2420', 'surface-1': '#212b26', 'surface-2': '#27322c', 'surface-3': '#2d3832', 'text-primary': '#f0efe8', 'text-secondary': '#cfd3c9', 'text-muted': '#a6aea2' } } },
})

// ---- Journey: night sky, dusk amber for the accent. Dark only.
const journey = makeColors({
  label: 'Workbench · Journey',
  only: 'dark',
  roles: { accent: '#f3b86a', danger: '#e8705f', success: '#7fc8a0', warning: '#f3cf8f', pro: '#a99cf0' },
  dark: { gray: { anchors: { 'surface-0': '#111729', 'surface-1': '#171e33', 'surface-2': '#1d253d', 'surface-3': '#232c46', 'text-primary': '#eef0f6', 'text-secondary': '#c8cee0', 'text-muted': '#a0a9c2' } } },
})

// ---- Blueprint: drafting vellum by day, blueprint by night, safety orange.
const blueprint = makeColors({
  label: 'Workbench · Blueprint',
  roles: { accent: '#e8620f', danger: '#d23f3a', success: '#2f9466', warning: '#d6a21a', pro: '#6f63d8' },
  light: { gray: { anchors: { 'surface-0': '#e9eef2', 'surface-1': '#f0f4f7', 'surface-2': '#f7f9fb', 'text-primary': '#0e2236', 'text-secondary': '#2b4560', 'text-muted': '#4b5f76' } } },
  dark: { gray: { anchors: { 'surface-0': '#0a1a2f', 'surface-1': '#0e2139', 'surface-2': '#122743', 'surface-3': '#152c4a', 'text-primary': '#e8f2fc', 'text-secondary': '#bcd1e6', 'text-muted': '#94acc6' } } },
})

export const COLOR_PROBLEMS = [...chess.problems, ...chalk.problems, ...journey.problems, ...blueprint.problems]

const MARK = '#e8620f'
const cropSheet = (ground: 'surface-1' | 'surface-2'): ThemeMessageRule => ({
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

const soft = (send: ThemeCue, notes: [string, string]): ThemeSound => ({
  cues: {
    send,
    tool: { layers: [{ wave: 'white', gain: 0.05, attack: 0.002, release: 0.02, filter: { type: 'highpass', hz: 4000 } }] },
    done: { layers: [{ wave: 'triangle', notes, step: 0.1, gain: 0.16, release: 0.45 }] },
    ask: { layers: [{ wave: 'sine', notes: [notes[1]], gain: 0.14, release: 0.3 }] },
    error: { layers: [{ wave: 'triangle', notes: ['E4', 'B3'], step: 0.12, gain: 0.16, release: 0.4 }] },
  },
})

export const THEMES: Record<ThemeId, { label: string; scene: string; look: ThemeSetArgs }> = {
  chess: {
    label: 'Chess',
    scene: 'wb-chess',
    look: {
      colors: chess.theme,
      backdrop: { scene: 'wb-chess', glass: GLASS },
      style: { Heading: { fontWeight: 'bold' }, UserMessage: { ...card('surface-2', 10), borderColor: 'border', borderWidth: 1 }, AssistantMessage: card('surface-1', 10), ToolUse: { radius: 6 } },
      sound: soft(
        { layers: [{ wave: 'white', gain: 0.18, attack: 0.002, release: 0.035, filter: { type: 'bandpass', hz: 1700 } }, { wave: 'sine', notes: ['G3'], gain: 0.22, attack: 0.002, release: 0.09 }] },
        ['C5', 'G5'],
      ),
    },
  },
  chalk: {
    label: 'Chalkboard',
    scene: 'wb-chalk',
    look: {
      colors: chalk.theme,
      overrideColorScheme: 'dark',
      backdrop: { scene: 'wb-chalk', glass: GLASS },
      style: { Heading: { fontFamily: ['cursive'], fontWeight: 'semibold' }, UserMessage: { ...card('surface-2', 4), borderColor: 'border', borderWidth: 1 }, AssistantMessage: card('surface-1', 4), ToolUse: { radius: 4 } },
      sound: soft({ layers: [{ wave: 'crackle', gain: 0.2, attack: 0.002, release: 0.08, filter: { type: 'bandpass', hz: 3200 } }] }, ['D5', 'A5']),
    },
  },
  journey: {
    label: 'Journey',
    scene: 'wb-journey',
    look: {
      colors: journey.theme,
      overrideColorScheme: 'dark',
      backdrop: { scene: 'wb-journey', glass: GLASS },
      style: { Heading: { fontWeight: 'semibold', letterSpacing: 1 }, UserMessage: { ...card('surface-2', 14), borderColor: 'border', borderWidth: 1 }, AssistantMessage: card('surface-1', 14), ToolUse: { radius: 8 } },
      sound: soft({ layers: [{ wave: 'pink', gain: 0.1, attack: 0.004, release: 0.12, filter: { type: 'lowpass', hz: 900 } }] }, ['A4', 'E5']),
    },
  },
  blueprint: {
    label: 'Blueprint',
    scene: 'wb-blueprint',
    look: {
      colors: blueprint.theme,
      backdrop: { scene: 'wb-blueprint', glass: GLASS },
      style: {
        Heading: { fontFamily: ['mono'], fontWeight: 'semibold', letterSpacing: 1 },
        UserMessage: cropSheet('surface-2'),
        AssistantMessage: { backgroundColor: 'surface-1', radius: 0, paddingX: 14, paddingY: 10, borderColor: 'border', borderWidth: 1 },
        ToolUse: { fontFamily: ['code'], color: 'text-secondary', backgroundColor: 'surface-2', radius: 0, paddingX: 8, borderColor: 'border', borderWidth: 1 },
      },
      sound: soft({ layers: [{ wave: 'crackle', gain: 0.25, attack: 0.002, release: 0.05, filter: { type: 'bandpass', hz: 2400 } }] }, ['E5', 'B5']),
    },
  },
}

export const THEME_IDS = Object.keys(THEMES) as ThemeId[]
