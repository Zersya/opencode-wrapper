export type ExecutionPhase =
  | 'initializing'
  | 'cloning_repository'
  | 'starting_session'
  | 'analyzing'
  | 'planning'
  | 'executing_tools'
  | 'processing_results'
  | 'finalizing'
  | 'completed'
  | 'error'

export interface ExecutionProgress {
  phase: ExecutionPhase
  progressPercent: number
  currentStep: number
  totalSteps: number
  elapsedMs: number
  estimatedRemainingMs?: number
  currentTool?: string
  completedTools: string[]
  message?: string
}

export const PHASE_MESSAGES: Record<ExecutionPhase, string> = {
  initializing: 'Initializing execution environment...',
  cloning_repository: 'Cloning repository...',
  starting_session: 'Starting OpenCode session...',
  analyzing: 'Analyzing your request...',
  planning: 'Planning approach...',
  executing_tools: 'Executing tools...',
  processing_results: 'Processing results...',
  finalizing: 'Finalizing...',
  completed: 'Completed',
  error: 'Error occurred',
}

export const PHASE_ORDER: ExecutionPhase[] = [
  'initializing',
  'cloning_repository',
  'starting_session',
  'analyzing',
  'planning',
  'executing_tools',
  'processing_results',
  'finalizing',
  'completed',
]

export function calculateProgress(phase: ExecutionPhase): number {
  const index = PHASE_ORDER.indexOf(phase)
  if (index === -1) return 0
  return Math.round((index / (PHASE_ORDER.length - 1)) * 100)
}
