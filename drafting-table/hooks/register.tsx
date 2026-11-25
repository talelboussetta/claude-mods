import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { WorkDay, WorkLog, WorkView } from '../types'
import { COLOR_PROBLEMS, LOOK, PLAIN_LOOK } from './look'
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
} from './scene'

const PLUGIN = 'drafting-table'
const PANE = 'drafting-table-log'
const SCENE = 'drafting-sheet'
const STORE_KEY = 'log'
const RESCAN_MIN_MS = 90 * 1000
const RESCAN_EVERY_MS = 10 * 60 * 1000

const logAtom = atom({ plugin: 'drafting-table', key: 'log' } as const, null, { shape: 'log-1' })
const viewAtom = atom({ plugin: 'drafting-table', key: 'view' } as const, 'day' as WorkView)
const scanningAtom = atom({ plugin: 'drafting-table', key: 'isScanning' } as const, false)
const bandHiddenAtom = atom({ plugin: 'drafting-table', key: 'isBandHidden' } as const, false)

const SPARK = '▁▂▃▄▅▆▇█'
const spark = (days: WorkDay[]) => {
  const max = Math.max(1, ...days.map(scoreOf))
  return days.map(d => SPARK[Math.min(7, Math.round((scoreOf(d) / max) * 7))]).join('')
}

const isWorkLog = (v: unknown): v is WorkLog =>
  typeof v === 'object' && v !== null && Array.isArray((v as WorkLog).days)

let lastScanAt = 0
let isScanning = false

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
      $.ui.log(`drafting-table: scan failed: ${run.stderr.slice(0, 400)}`, { to: 'debug' })
      return
    }
    const parsed: unknown = JSON.parse(run.stdout)
    if (!isWorkLog(parsed)) return
    await update($, logAtom, () => parsed)
    await $.store.set(STORE_KEY, parsed)
  } catch (error) {
    $.ui.log(`drafting-table: scan error: ${String(error)}`, { to: 'debug' })
  } finally {
    isScanning = false
    await update($, scanningAtom, () => false)
  }
}

async function setLook($: EngineInterface): Promise<void> {
  const unpainted = COLOR_PROBLEMS.find(line => line.startsWith("Desktop won't paint"))
  if (unpainted !== undefined) $.ui.log(`drafting-table: ${unpainted}`)
  try {
    await $.theme.set(LOOK)
  } catch (error) {
    $.ui.log(`drafting-table: full look refused, plain look instead: ${String(error)}`)
    await $.theme.set(PLAIN_LOOK)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await setLook($)
    await $.command.register({
      name: 'worklog',
      description: 'Open the drafting-table work log: what you got done today and this week',
    })
    const stored = await $.store.get(STORE_KEY)
    if (isWorkLog(stored)) await update($, logAtom, () => stored)
    void scan($)
    $.clock.every(RESCAN_EVERY_MS, () => void scan($))

    return started
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if ((await $.clock.now()) - lastScanAt > RESCAN_MIN_MS) void scan($)

    return done
  })

  on('command.run', { command: 'worklog' }, async $ => {
    await update($, bandHiddenAtom, () => false)
    await $.ui.open({ id: PANE, title: 'Work log' })
    void scan($)

    return { text: 'Work log opened.' }
  })

  // The sheet behind the conversation.
  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.scene !== SCENE || (e.surface !== 'desktop' && e.surface !== 'mobile')) return next(e)
    const { Svg } = $.ui.resolve(e)
    const log = await read($, logAtom)
    const d = today(log)

    return (
      <Svg
        source={sceneSvg(log)}
        alt={`Blueprint sheet: today's gear drawing is ${stagesDone(d)} of ${STAGES.length} stages drafted`}
        isInteractive
      />
    )
  })

  // One line above the prompt.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, bandHiddenAtom))) return next(e)
    const log = await read($, logAtom)
    const isScanningNow = await read($, scanningAtom)
    const { Box, Text, Button } = $.ui.resolve(e)
    const d = today(log)

    if (d === undefined) {
      return (
        <Box>
          <Text mono dimColor>
            ▸ DRAFTING TABLE {isScanningNow ? 'reading your transcripts for the work log…' : 'no work log yet'}
          </Text>
        </Box>
      )
    }
    const week = lastWeek(log)
    const pct = Math.min(100, Math.round((scoreOf(d) / DAY_TARGET) * 100))

    return (
      <Box flexDirection="row" gap={1}>
        <Text mono color="accent" bold>
          ▸ {pct}%
        </Text>
        <Text mono wrap="truncate-end">
          {d.prompts} prompts · {d.tools} tool runs · {d.edits} edits ({kilo(d.lines)} lines) · {d.commits} commits ·{' '}
          {hours(d.minutes)} on the board
        </Text>
        <Text mono dimColor>
          │ 7d {spark(week)}
        </Text>
        <Button key="log" label="Log" onPress={() => $.ui.open({ id: PANE, title: 'Work log' })} />
        <Button key="hide" label="Hide" onPress={() => update($, bandHiddenAtom, () => true)} />
      </Box>
    )
  })

  // The pane: today's stages, or the week's table.
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
        week.reduce((n, one) => n + one[k], 0)
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
            <Text mono bold>
              {`TOTAL      ${String(sum('prompts')).padStart(3)}  ${String(sum('tools')).padStart(5)}  ${String(sum('edits')).padStart(5)}  ${kilo(sum('lines')).padStart(5)}  ${String(sum('commits')).padStart(3)}  ${hours(sum('minutes')).padStart(5)}`}
            </Text>
          </Box>
          {best !== undefined && (
            <Text dimColor>
              Best day: {weekday(best.date)} {best.date} ({Math.round(scoreOf(best))} points). Updated {stamp}, {log.repos} repos
              watched.
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
            <Text mono key={name} color={i < done ? undefined : 'muted'} dimColor={i >= done}>
              {i < done ? '■' : '□'} {String(i + 1).padStart(2)} {name}
            </Text>
          ))}
        </Box>
        {d.projects.length > 0 && (
          <Text dimColor>Parts today: {d.projects.map(([name, n]) => `${name} (${n})`).join(', ')}</Text>
        )}
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
