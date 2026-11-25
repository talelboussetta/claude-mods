export type WorkDay = {
  date: string
  prompts: number
  tools: number
  edits: number
  lines: number
  minutes: number
  sessions: number
  commits: number
  projects: [string, number][]
}

export type WorkLog = { generatedAt: number; repos: number; days: WorkDay[] }

export type WorkView = 'day' | 'week'

declare module 'claude-code' {
  interface PluginState {
    'drafting-table': {
      log: Shaped<WorkLog | null>
      view: WorkView
      isScanning: boolean
      isBandHidden: boolean
    }
  }
}
