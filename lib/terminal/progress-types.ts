// Realistic execution phases based on actual OpenCode workflow
export type ExecutionPhase =
  | 'connecting'      // Connecting to OpenCode server
  | 'analyzing'       // OpenCode analyzing request and codebase
  | 'planning'        // OpenCode planning approach
  | 'executing'       // OpenCode using tools (read, edit, search, bash)
  | 'waiting_input'   // Paused waiting for user answer
  | 'complete'        // Execution finished
  | 'error'           // Error occurred

export interface ToolExecution {
  id: string
  toolName: string
  status: 'running' | 'completed' | 'failed'
  filePath?: string
  startTime: number
  endTime?: number
  result?: string
}

export interface FileChange {
  path: string
  type: 'modified' | 'created' | 'deleted'
  additions: number
  deletions: number
  diff?: string
}

export interface ExecutionProgress {
  phase: ExecutionPhase
  startTime: number
  elapsedMs: number
  
  // Current activity
  currentTool?: string
  currentFile?: string
  
  // Tool execution history
  tools: ToolExecution[]
  completedTools: number
  totalTools: number
  
  // File changes
  filesChanged: FileChange[]
  
  // Status message
  message?: string
  
  // Question state
  waitingForQuestion: boolean
  questionPrompt?: string
}

export const PHASE_MESSAGES: Record<ExecutionPhase, string> = {
  connecting: 'Connecting to OpenCode...',
  analyzing: 'Analyzing your request...',
  planning: 'Planning approach...',
  executing: 'Making changes...',
  waiting_input: '⏸️ Waiting for your input...',
  complete: '✓ Complete',
  error: '✗ Error',
}

export const PHASE_ICONS: Record<ExecutionPhase, string> = {
  connecting: '🔗',
  analyzing: '🔍',
  planning: '📝',
  executing: '⚡',
  waiting_input: '⏸️',
  complete: '✓',
  error: '✗',
}

// Calculate progress based on actual work done
export function calculateProgress(progress: ExecutionProgress): number {
  const phaseWeights: Record<ExecutionPhase, number> = {
    connecting: 5,
    analyzing: 15,
    planning: 15,
    executing: 55,
    waiting_input: 60,  // Pause progress when waiting
    complete: 100,
    error: 0,
  }
  
  const baseWeight = phaseWeights[progress.phase]
  
  if (progress.phase === 'executing' && progress.totalTools > 0) {
    // Add partial progress within executing phase based on tools completed
    const toolProgress = (progress.completedTools / progress.totalTools) * 40 // 40% of the 55% executing weight
    return Math.min(95, baseWeight + toolProgress)
  }
  
  return baseWeight
}

// Format duration helper
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.floor(ms / 100)}s`
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

// Get active tool display text
export function getActiveToolText(tool?: string, file?: string): string {
  if (!tool) return ''
  
  const toolActions: Record<string, string> = {
    read: 'Reading',
    edit: 'Editing',
    write: 'Writing',
    bash: 'Running',
    grep: 'Searching',
    search: 'Searching',
    glob: 'Listing',
    codebase_retrieval: 'Analyzing',
    augment_context_engine_codebase_retrieval: 'Analyzing',
    webfetch: 'Fetching',
    task: 'Processing',
    todowrite: 'Updating',
    skill: 'Using skill',
  }
  
  const action = toolActions[tool.toLowerCase()] || 'Running'
  
  if (file) {
    const shortFile = file.split('/').slice(-2).join('/')
    return `${action} ${shortFile}`
  }
  
  return `${action} ${tool}`
}
