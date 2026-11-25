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

/** Prompts sent: all time and today, shared by every session through the store. */
export type Progress = { total: number; today: number; date: string }

export type ThemeId = 'chess' | 'chalk' | 'journey' | 'blueprint'

declare module 'claude-code' {
  interface PluginState {
    workbench: {
      theme: ThemeId
      progress: Progress | null
      log: Shaped<WorkLog | null>
      view: WorkView
      isScanning: boolean
    }
  }
}
