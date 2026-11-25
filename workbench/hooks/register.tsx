import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Progress, ThemeId, WorkDay, WorkLog, WorkView } from '../types'
import { PROOF, chalkSvg, linesShown } from './chalk'
import { boardSvg, where } from './chess-board'
import {
  DAY_TARGET,
  STAGES,
  chartSvg,
  hours,
  kilo,
  lastWeek,
  sceneSvg,
  scoreOf,
  stagesDone,
  today,
  weekday,
} from './drafting-scene'
import { journeySvg, roadShare } from './journey'
import { COLOR_PROBLEMS, THEMES, THEME_IDS } from './looks'

const PANE = 'workbench-log'
const RESCAN_MIN_MS = 90 * 1000
const RESCAN_EVERY_MS = 10 * 60 * 1000
const SYNC_EVERY_MS = 60 * 1000

const themeAtom = atom({ plugin: 'workbench', key: 'theme' } as const, 'chess' as ThemeId)
const progressAtom = atom({ plugin: 'workbench', key: 'progress' } as const, null as Progress | null)
const logAtom = atom({ plugin: 'workbench', key: 'log' } as const, null, { shape: 'log-1' })
const viewAtom = atom({ plugin: 'workbench', key: 'view' } as const, 'day' as WorkView)
const scanningAtom = atom({ plugin: 'workbench', key: 'isScanning' } as const, false)

const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && (THEME_IDS as string[]).includes(v)
const isProgress = (v: unknown): v is Progress =>
  typeof v === 'object' && v !== null && typeof (v as Progress).total === 'number'
const isWorkLog = (v: unknown): v is WorkLog =>
  typeof v === 'object' && v !== null && Array.isArray((v as WorkLog).days)

const SPARK = '▁▂▃▄▅▆▇█'
const spark = (days: WorkDay[]) => {
  const max = Math.max(1, ...days.map(scoreOf))
  return days.map(d => SPARK[Math.min(7, Math.round((scoreOf(d) / max) * 7))]).join('')
}

let lastScanAt = 0
let isScanning = false

async function dayKey($: EngineInterface): Promise<string> {
  const d = new Date(await $.clock.now())
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// The stored count, with today's tally reset when the date has moved on.
async function storedProgress($: EngineInterface): Promise<Progress | null> {
  const stored = await $.store.get('progress')
  if (!isProgress(stored)) return null
  const date = await dayKey($)
  return stored.date === date ? stored : { ...stored, today: 0, date }
}

async function advance($: EngineInterface): Promise<void> {
  const date = await dayKey($)
  const prev = (await storedProgress($)) ?? { total: 0, today: 0, date }
  const next: Progress = { total: prev.total + 1, today: prev.today + 1, date }
  await $.store.set('progress', next)
  await update($, progressAtom, () => next)
}

async function scan($: EngineInterface): Promise<void> {
  if (isScanning) return
  isScanning = true
  lastScanAt = await $.clock.now()
  await update($, scanningAtom, () => true)
  try {
    const env = await $.process.hookEnv()
    const dataDir = env.CLAUDE_PLUGIN_DATA ?? $.plugin.root
    const run = await $.process.run(
      ['node', `${$.plugin.root}/hooks/scan.mjs`, `${dataDir}/scan-cache.json`, '14'],
      { timeoutMs: 600_000 },
    )
    if (run.exitCode !== 0) {
      $.ui.log(`workbench: scan failed: ${run.stderr.slice(0, 400)}`, { to: 'debug' })
      return
    }
    const parsed: unknown = JSON.parse(run.stdout)
    if (!isWorkLog(parsed)) return
    await update($, logAtom, () => parsed)
    await $.store.set('log', parsed)
  } catch (error) {
    $.ui.log(`workbench: scan error: ${String(error)}`, { to: 'debug' })
  } finally {
    isScanning = false
    await update($, scanningAtom, () => false)
  }
}

async function applyLook($: EngineInterface, id: ThemeId): Promise<void> {
  const { look } = THEMES[id]
  try {
    await $.theme.set(look)
  } catch (error) {
    $.ui.log(`workbench: full look refused, plain look instead: ${String(error)}`)
    await $.theme.set({ colors: look.colors, backdrop: look.backdrop, ...(look.overrideColorScheme ? { overrideColorScheme: look.overrideColorScheme } : {}) })
  }
}

// Pick a theme: every session follows within a minute, through the store.
async function choose($: EngineInterface, id: ThemeId): Promise<void> {
  await $.store.set('theme', id)
  await update($, themeAtom, () => id)
  await applyLook($, id)
  if (id === 'blueprint' && (await read($, logAtom)) === null) void scan($)
}

async function sync($: EngineInterface): Promise<void> {
  const stored = await $.store.get('theme')
  if (isThemeId(stored) && stored !== (await read($, themeAtom))) {
    await update($, themeAtom, () => stored)
    await applyLook($, stored)
  }
  const progress = await storedProgress($)
  const mine = await read($, progressAtom)
  if (progress && (mine === null || progress.total !== mine.total || progress.today !== mine.today)) {
    await update($, progressAtom, () => progress)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const unpainted = COLOR_PROBLEMS.find(line => line.startsWith("Desktop won't paint"))
    if (unpainted !== undefined) $.ui.log(`workbench: ${unpainted}`)
    const stored = await $.store.get('theme')
    const id: ThemeId = isThemeId(stored) ? stored : 'chess'
    await update($, themeAtom, () => id)
    await applyLook($, id)
    const progress = await storedProgress($)
    if (progress) await update($, progressAtom, () => progress)
    const log = await $.store.get('log')
    if (isWorkLog(log)) await update($, logAtom, () => log)

    await $.command.register({
      name: 'backdrop',
      description: 'Switch the Workbench backdrop: chess, chalk, journey or blueprint',
      argumentHint: 'chess | chalk | journey | blueprint',
    })
    await $.command.register({ name: 'worklog', description: 'Open the work log: what you got done today and this week' })

    if (id === 'blueprint') void scan($)
    $.clock.every(SYNC_EVERY_MS, () => void sync($))
    $.clock.every(RESCAN_EVERY_MS, async () => {
      if ((await read($, themeAtom)) === 'blueprint') void scan($)
    })

    return started
  })

  // Every prompt you type moves the scene on: a chess move, a chalk line, a step on the road.
  on('prompt.submit', async ($, e, next) => {
    const entered = await next(e)
    if (e.command === undefined && e.isMeta !== true && !('drop' in entered)) await advance($).catch(error => $.ui.log(`workbench: could not count the prompt: ${String(error)}`, { to: 'debug' }))

    return entered
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if ((await read($, themeAtom)) === 'blueprint' && (await $.clock.now()) - lastScanAt > RESCAN_MIN_MS) void scan($)

    return done
  })

  on('command.run', { command: 'backdrop' }, async ($, e) => {
    const want = e.args.trim().toLowerCase()
    const id = THEME_IDS.find(t => t === want || THEMES[t].label.toLowerCase() === want)
    if (id === undefined) {
      const now = await read($, themeAtom)
      return { text: `Theme is ${THEMES[now].label}. Pick one: ${THEME_IDS.join(', ')}. The buttons above the prompt switch too.` }
    }
    await choose($, id)

    return { text: `Theme set to ${THEMES[id].label}. Other sessions follow within a minute.` }
  })

  on('command.run', { command: 'worklog' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Work log' })
    void scan($)

    return { text: 'Work log opened.' }
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    const id = THEME_IDS.find(t => THEMES[t].scene === e.props.scene)
    if (id === undefined) return next(e)
    const { Svg } = $.ui.resolve(e)
    const progress = await read($, progressAtom)

    if (id === 'chess') {
      const { game, ply } = where(progress?.total ?? 0)
      const last = ply > 0 ? game.plies[ply - 1] : undefined
      return <Svg source={boardSvg(progress)} alt={`Chessboard: ${game.title}, ${last ? `last move ${last.san}` : 'starting position'}`} isInteractive />
    }
    if (id === 'chalk') {
      return <Svg source={chalkSvg(progress)} alt={`Chalkboard: ${linesShown(progress?.today ?? 0)} of ${PROOF.length} lines of today's proof`} isInteractive />
    }
    if (id === 'journey') {
      return <Svg source={journeySvg(progress)} alt={`Mountain road at dusk: ${Math.round(roadShare(progress?.today ?? 0) * 100)}% of today's road walked`} isInteractive />
    }
    const log = await read($, logAtom)
    return <Svg source={sceneSvg(log)} alt={`Blueprint sheet: today's drawing is ${stagesDone(today(log))} of ${STAGES.length} stages drafted`} isInteractive />
  })

  // The switcher, always above the prompt: four buttons and a line on how today is going.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const id = await read($, themeAtom)
    const progress = await read($, progressAtom)
    const n = progress?.today ?? 0

    let status: string
    if (id === 'chess') {
      const { game, ply } = where(progress?.total ?? 0)
      const last = ply > 0 ? game.plies[ply - 1] : undefined
      status = last
        ? `${game.title} · move ${Math.ceil(ply / 2)} ${last.san}${last.check === 'mate' ? ' · checkmate!' : ''}`
        : `${game.title} · your next prompt plays the first move`
    } else if (id === 'chalk') {
      status = `${n} prompts today · line ${linesShown(n)} of ${PROOF.length}`
    } else if (id === 'journey') {
      status = `${n} prompts today · ${Math.round(roadShare(n) * 100)}% of today's road`
    } else {
      const log = await read($, logAtom)
      const d = today(log)
      status = d
        ? `${Math.min(100, Math.round((scoreOf(d) / DAY_TARGET) * 100))}% · ${d.prompts} prompts · ${d.edits} edits · ${d.commits} commits · ${hours(d.minutes)} │ 7d ${spark(lastWeek(log))}`
        : (await read($, scanningAtom))
          ? 'reading your transcripts for the work log…'
          : 'no work log yet'
    }

    return (
      <Box flexDirection="row" gap={1}>
        {THEME_IDS.map(t => (
          <Button key={t} label={t === id ? `● ${THEMES[t].label}` : THEMES[t].label} onPress={() => choose($, t)} />
        ))}
        <Text dimColor wrap="truncate-end">
          {status}
        </Text>
        {id === 'blueprint' && <Button key="log" label="Log" onPress={() => $.ui.open({ id: PANE, title: 'Work log' })} />}
      </Box>
    )
  })

  // The work log pane: today's stages, or the week's table.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const SvgEl = 'Svg' in els ? els.Svg : undefined
    const log = await read($, logAtom)
    const view = await read($, viewAtom)
    const isScanningNow = await read($, scanningAtom)
    const d = today(log)
    const week = lastWeek(log)

    const header = (
      <Box flexDirection="row" gap={1}>
        <Button key="day" label={view === 'day' ? '[Today]' : 'Today'} onPress={() => update($, viewAtom, () => 'day')} />
        <Button key="week" label={view === 'week' ? '[Week]' : 'Week'} onPress={() => update($, viewAtom, () => 'week')} />
        <Button key="rescan" label={isScanningNow ? 'Scanning…' : 'Rescan'} onPress={() => void scan($)} />
      </Box>
    )

    if (log === null || d === undefined) {
      return (
        <Box flexDirection="column" gap={1}>
          {header}
          <Text dimColor>
            {isScanningNow
              ? 'Reading your Claude transcripts and git history. The first scan takes about a minute.'
              : 'No work log yet. Press Rescan.'}
          </Text>
        </Box>
      )
    }

    const updated = new Date(log.generatedAt)
    const stamp = `${String(updated.getHours()).padStart(2, '0')}:${String(updated.getMinutes()).padStart(2, '0')}`

    if (view === 'week') {
      const sum = (k: 'prompts' | 'tools' | 'edits' | 'lines' | 'commits' | 'minutes') =>
        week.reduce((acc, one) => acc + one[k], 0)
      const best = [...week].sort((a, b) => scoreOf(b) - scoreOf(a))[0]

      return (
        <Box flexDirection="column" gap={1}>
          {header}
          <Text mono bold>
            LAST 7 DAYS · {sum('prompts')} prompts · {sum('commits')} commits · {hours(sum('minutes'))} on the board
          </Text>
          {SvgEl !== undefined && <SvgEl source={chartSvg(log, 14)} alt="Work score for each of the last 14 days" />}
          <Box flexDirection="column">
            <Text mono dimColor>
              {'DAY        PRM  TOOLS  EDITS  LINES  CMT  TIME   SCORE'}
            </Text>
            {week.map(one => (
              <Text mono key={one.date} color={one === week.at(-1) ? 'accent' : undefined}>
                {`${weekday(one.date)} ${one.date.slice(5)}  ${String(one.prompts).padStart(3)}  ${String(one.tools).padStart(5)}  ${String(one.edits).padStart(5)}  ${kilo(one.lines).padStart(5)}  ${String(one.commits).padStart(3)}  ${hours(one.minutes).padStart(5)}  ${String(Math.round(scoreOf(one))).padStart(5)}`}
              </Text>
            ))}
          </Box>
          {best !== undefined && (
            <Text dimColor>
              Best day: {weekday(best.date)} {best.date} ({Math.round(scoreOf(best))} points). Updated {stamp}, {log.repos} repos watched.
            </Text>
          )}
        </Box>
      )
    }

    const done = stagesDone(d)
    const score = Math.round(scoreOf(d))
    const nextAt = done < STAGES.length ? Math.ceil(((done + 1) / STAGES.length) * DAY_TARGET) : undefined

    return (
      <Box flexDirection="column" gap={1}>
        {header}
        <Text mono bold>
          DWG WL-{d.date.replace(/-/g, '')} · {score}/{DAY_TARGET} points · {done}/{STAGES.length} stages
        </Text>
        <Box flexDirection="column">
          <Text mono>{`PROMPTS    ${d.prompts}`}</Text>
          <Text mono>{`TOOL RUNS  ${d.tools}`}</Text>
          <Text mono>{`EDITS      ${d.edits}  (${kilo(d.lines)} lines written)`}</Text>
          <Text mono>{`COMMITS    ${d.commits}`}</Text>
          <Text mono>{`SESSIONS   ${d.sessions}`}</Text>
          <Text mono>{`ON BOARD   ${hours(d.minutes)}`}</Text>
        </Box>
        <Box flexDirection="column">
          {STAGES.map((name, i) => (
            <Text mono key={name} dimColor={i >= done}>
              {i < done ? '■' : '□'} {String(i + 1).padStart(2)} {name}
            </Text>
          ))}
        </Box>
        {d.projects.length > 0 && <Text dimColor>Parts today: {d.projects.map(([name, k]) => `${name} (${k})`).join(', ')}</Text>}
        <Text dimColor>
          {nextAt === undefined
            ? 'Drawing released for today.'
            : `Next stage at ${nextAt} points. A prompt is 2, an edit 1, a commit 5, ten minutes on the board 1.`}{' '}
          Updated {stamp}.
        </Text>
      </Box>
    )
  })
}
