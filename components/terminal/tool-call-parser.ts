export interface ToolCall {
  id: string
  toolName: string
  status: "running" | "completed" | "failed"
  arguments: Record<string, string>
  result?: string
  duration?: string
  startTime: number
  endTime?: number
}

interface ParsedSegment {
  type: "text" | "tool_call"
  content?: string
  toolCall?: ToolCall
}

// Comprehensive tool name to icon mapping (30+ tools)
export const TOOL_ICONS: Record<string, string> = {
  // File operations
  read: "📄",
  read_file: "📄",
  edit: "✏️",
  edit_file: "✏️",
  write: "📝",
  write_file: "📝",
  glob: "📁",
  list: "📋",
  ls: "📋",
  
  // Search operations
  grep: "🔍",
  search: "🔍",
  find: "🔍",
  
  // System operations
  bash: "💻",
  shell: "💻",
  command: "⌨️",
  exec: "⚡",
  
  // Codebase operations
  codebase_retrieval: "🔎",
  augment_context_engine_codebase_retrieval: "🔎",
  
  // Documentation
  context7_resolve_library_id: "📚",
  context7_query_docs: "📖",
  
  // Web operations
  webfetch: "🌐",
  fetch: "🌐",
  curl: "🌐",
  
  // Task management
  task: "📌",
  todowrite: "☑️",
  
  // Skills
  skill: "🎯",
  
  // Interactive
  ask: "❓",
  question: "❓",
  
  // AI/LLM
  claude: "🤖",
  openai: "🧠",
  
  // Database
  db_query: "🗄️",
  db_write: "💾",
  
  // Git
  git: "🔀",
  git_commit: "🔀",
  git_push: "⬆️",
  git_pull: "⬇️",
  
  // Testing
  test: "🧪",
  run_tests: "🧪",
  
  // Build/Deploy
  build: "🔨",
  deploy: "🚀",
  
  // Default
  default: "🔧",
}

export function getToolIcon(toolName: string): string {
  // Try exact match first
  if (TOOL_ICONS[toolName]) {
    return TOOL_ICONS[toolName]
  }
  
  // Try normalized name (remove underscores, lowercase)
  const normalized = toolName.toLowerCase().replace(/_/g, '')
  for (const [key, icon] of Object.entries(TOOL_ICONS)) {
    if (key.toLowerCase().replace(/_/g, '') === normalized) {
      return icon
    }
  }
  
  // Try partial match
  for (const [key, icon] of Object.entries(TOOL_ICONS)) {
    if (toolName.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(toolName.toLowerCase())) {
      return icon
    }
  }
  
  return TOOL_ICONS.default
}

// Enhanced patterns for better matching
const TOOL_CALL_PATTERNS = {
  // Tool invocation patterns (multiple formats)
  invocation: [
    // Standard: ▶ tool_name
    /^(?:\s*)(?:▶|>|●|▸|→|⇢|➜|➤|➔|➙|➛|➝|➞|➟|➠|➡|➢|➣|➤|➥|➦|➧|➨|➩|➪|➫|➬|➭|➮|➯|➱|➲|➳|➴|➵|➶|➷|➸|➹|➺|➻|➼|➽|➾|➿)\s*(\w+(?:[_-]\w+)*)(?:\s*[\:\-\(\[])?/i,
    // JSON format: {"tool": "name"}
    /^\s*\{\s*"tool"\s*:\s*"(\w+(?:[_-]\w+)*)"\s*/i,
    // Function call: tool_name(
    /^(?:\s*)(\w+(?:[_-]\w+)*)\s*\(/i,
    // Using: tool_name
    /^(?:\s*)(?:using|running|calling|executing|invoking)\s*[:\-]?\s*(\w+(?:[_-]\w+)*)/i,
  ],
  
  // Tool completion patterns
  completion: [
    /^(?:\s*)(?:✓|✅|✔|☑|✓|✔️|✅|🟢|✔︎)\s*(?:.*?\s)?(?:completed|done|success|finished|succeeded|ready|ok|✓|✅)/i,
    /^(?:\s*)(?:result|output|returned|response)\s*[:\-=]?\s*/i,
  ],
  
  // Tool failure patterns
  failure: [
    /^(?:\s*)(?:✗|❌|✘|❎|⊗|✖️|❌|🔴|✕|✖|×|X)\s*(?:.*?\s)?(?:failed|error|cancelled|canceled|timeout|exception|crash)/i,
    /^(?:\s*)(?:error|exception|failed|timeout)\s*[:\-=]?\s*/i,
  ],
  
  // Argument patterns
  argument: [
    // key: value
    /^(?:\s*)(\w+)\s*[\:\=]\s*(.+)$/,
    // "key": "value" (JSON style)
    /^(?:\s*)"(\w+)"\s*:\s*"(.+?)"\s*,?$/,
    // key=value
    /^(?:\s*)(\w+)\s*\=\s*(.+)$/,
  ],
  
  // Section separators
  separator: [
    /^[\-=]{3,}$/,
    /^(?:\s*)[┌┬┐├┼┤└┴┘─│]+/,  // Box drawing characters
  ],
  
  // Code block indicators
  codeBlock: [
    /^```\w*$/,  // Code fence
    /^\s*\$\s+/,  // Shell prompt
  ],
}

// Tool name normalization
function normalizeToolName(name: string): string {
  return name.toLowerCase().trim()
}

// Detect if a line is a tool invocation
function isToolInvocation(line: string): { isMatch: boolean; toolName?: string } {
  for (const pattern of TOOL_CALL_PATTERNS.invocation) {
    const match = line.match(pattern)
    if (match) {
      return { isMatch: true, toolName: normalizeToolName(match[1]) }
    }
  }
  return { isMatch: false }
}

// Detect if a line indicates tool completion
function isToolCompletion(line: string): boolean {
  return TOOL_CALL_PATTERNS.completion.some(pattern => pattern.test(line))
}

// Detect if a line indicates tool failure
function isToolFailure(line: string): boolean {
  return TOOL_CALL_PATTERNS.failure.some(pattern => pattern.test(line))
}

// Parse arguments from a line
function parseArguments(line: string): { key: string; value: string } | null {
  for (const pattern of TOOL_CALL_PATTERNS.argument) {
    const match = line.match(pattern)
    if (match) {
      return { key: match[1], value: match[2].trim() }
    }
  }
  return null
}

// Calculate duration string
function formatDuration(startTime: number, endTime: number): string {
  const ms = endTime - startTime
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

// Main parsing function
export function parseToolCalls(output: string): ParsedSegment[] {
  const segments: ParsedSegment[] = []
  const lines = output.split('\n')
  
  let currentText = ""
  let currentTool: ToolCall | null = null
  let resultBuffer: string[] = []
  let inCodeBlock = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    // Track code blocks
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      if (currentTool) {
        resultBuffer.push(line)
      } else {
        currentText += line + '\n'
      }
      continue
    }
    
    // Empty lines
    if (!trimmed) {
      if (currentTool) {
        resultBuffer.push(line)
      } else {
        currentText += line + '\n'
      }
      continue
    }
    
    // Check for tool invocation
    const invocation = isToolInvocation(line)
    if (invocation.isMatch && !inCodeBlock) {
      // Save any pending text
      if (currentText.trim()) {
        segments.push({ type: "text", content: currentText })
        currentText = ""
      }
      
      // Save any pending result from previous tool
      if (currentTool && resultBuffer.length > 0) {
        currentTool.result = resultBuffer.join('\n')
        currentTool.endTime = Date.now()
        currentTool.duration = formatDuration(currentTool.startTime, currentTool.endTime)
        segments.push({ type: "tool_call", toolCall: currentTool })
        resultBuffer = []
      }
      
      // Start new tool call
      currentTool = {
        id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        toolName: invocation.toolName!,
        status: "running",
        arguments: {},
        startTime: Date.now(),
      }
      
      continue
    }
    
    // Check for completion
    if (isToolCompletion(trimmed) && currentTool) {
      currentTool.status = "completed"
      if (resultBuffer.length > 0) {
        currentTool.result = resultBuffer.join('\n')
        resultBuffer = []
      }
      currentTool.endTime = Date.now()
      currentTool.duration = formatDuration(currentTool.startTime, currentTool.endTime)
      segments.push({ type: "tool_call", toolCall: currentTool })
      currentTool = null
      continue
    }
    
    // Check for failure
    if (isToolFailure(trimmed) && currentTool) {
      currentTool.status = "failed"
      if (resultBuffer.length > 0) {
        currentTool.result = resultBuffer.join('\n')
        resultBuffer = []
      }
      currentTool.endTime = Date.now()
      currentTool.duration = formatDuration(currentTool.startTime, currentTool.endTime)
      segments.push({ type: "tool_call", toolCall: currentTool })
      currentTool = null
      continue
    }
    
    // Parse arguments (only if we have a tool and not in result collection)
    if (currentTool && resultBuffer.length === 0) {
      const arg = parseArguments(trimmed)
      if (arg) {
        currentTool.arguments[arg.key] = arg.value
        continue
      }
    }
    
    // Check for separator
    if (TOOL_CALL_PATTERNS.separator.some(p => p.test(trimmed)) && currentTool) {
      // Separator indicates moving to result phase
      continue
    }
    
    // Collect content
    if (currentTool) {
      resultBuffer.push(line)
    } else {
      currentText += line + '\n'
    }
  }
  
  // Handle any remaining content
  if (currentTool) {
    if (resultBuffer.length > 0) {
      currentTool.result = resultBuffer.join('\n')
    }
    currentTool.endTime = Date.now()
    currentTool.duration = formatDuration(currentTool.startTime, currentTool.endTime)
    segments.push({ type: "tool_call", toolCall: currentTool })
  }
  
  if (currentText.trim()) {
    segments.push({ type: "text", content: currentText })
  }
  
  return segments
}

// Parse tool calls from OpenCode's structured format
export function parseStructuredToolCalls(events: Array<{
  type: string
  tool?: string
  arguments?: Record<string, unknown>
  result?: string
  status?: string
}>): ParsedSegment[] {
  const segments: ParsedSegment[] = []
  
  for (const event of events) {
    if (event.type === 'tool_call' && event.tool) {
      const toolCall: ToolCall = {
        id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        toolName: event.tool,
        status: (event.status as "running" | "completed" | "failed") || "completed",
        arguments: Object.entries(event.arguments || {}).reduce((acc, [key, value]) => {
          acc[key] = typeof value === 'string' ? value : JSON.stringify(value)
          return acc
        }, {} as Record<string, string>),
        result: event.result,
        startTime: Date.now(),
      }
      
      segments.push({ type: "tool_call", toolCall })
    }
  }
  
  return segments
}

// Helper to merge new output with existing segments
export function mergeToolCallSegments(
  existingSegments: ParsedSegment[],
  newOutput: string
): ParsedSegment[] {
  // Get the last tool call from existing segments
  const lastToolIndex = existingSegments.findLastIndex(s => s.type === 'tool_call')
  
  if (lastToolIndex === -1) {
    // No existing tool calls, parse fresh
    return parseToolCalls(newOutput)
  }
  
  const lastTool = existingSegments[lastToolIndex].toolCall
  if (lastTool && lastTool.status === 'running') {
    // Tool is still running, append new content to it
    const existingText = existingSegments
      .filter(s => s.type === 'text')
      .map(s => s.content)
      .join('')
    
    const fullOutput = existingText + newOutput
    return parseToolCalls(fullOutput)
  }
  
  // Tool completed, parse new content
  const newSegments = parseToolCalls(newOutput)
  return [...existingSegments, ...newSegments]
}
