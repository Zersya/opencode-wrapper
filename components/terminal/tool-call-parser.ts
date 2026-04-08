export interface ToolCall {
  id: string
  toolName: string
  status: "running" | "completed" | "failed"
  arguments: Record<string, string>
  result?: string
  duration?: string
  startTime: number
}

interface ParsedSegment {
  type: "text" | "tool_call"
  content?: string
  toolCall?: ToolCall
}

// Tool call patterns - matches various CLI output formats
const TOOL_CALL_PATTERNS = {
  // Matches: ▶ tool_name or > tool_name or ● tool_name
  invocation: /^(?:▶|>|●|▸|→)\s*(\w+(?:_\w+)*)(?:\s*[:\-]?\s*)?$/i,
  
  // Matches: ✓ tool_name completed or ✓ Completed or ✅ 
  completion: /^(?:✓|✅|✔|☑)\s*(?:.*?\s)?(?:completed|done|success|finished)(?:\s*[:\-]?\s*)?$/i,
  
  // Matches: ✗ Failed or ✗ tool_name failed
  failure: /^(?:✗|❌|✘|❎|⊗)\s*(?:.*?\s)?(?:failed|error|cancelled)(?:\s*[:\-]?\s*)?$/i,
  
  // Matches: key: value (arguments)
  argument: /^(\w+):\s*(.+)$/,
  
  // Matches: path: /some/path
  pathArgument: /^(path|file|dir|directory):\s*(.+)$/i,
  
  // Matches: --- or === (section separators)
  separator: /^[\-=]{3,}$/,
}

// Tool name to icon mapping
export const TOOL_ICONS: Record<string, string> = {
  read: "📄",
  read_file: "📄",
  edit: "✏️",
  edit_file: "✏️",
  write: "📝",
  write_file: "📝",
  grep: "🔍",
  search: "🔍",
  find: "🔍",
  glob: "📁",
  list: "📋",
  bash: "💻",
  shell: "💻",
  command: "⌨️",
  task: "📌",
  webfetch: "🌐",
  todowrite: "☑️",
  skill: "🎯",
  ask: "❓",
  question: "❓",
  default: "🔧",
}

export function getToolIcon(toolName: string): string {
  return TOOL_ICONS[toolName] || TOOL_ICONS.default
}

export function parseToolCalls(output: string): ParsedSegment[] {
  const segments: ParsedSegment[] = []
  const lines = output.split('\n')
  
  let currentText = ""
  let currentTool: ToolCall | null = null
  let collectingResult = false
  let resultBuffer: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    // Check for tool invocation
    const invocationMatch = trimmed.match(TOOL_CALL_PATTERNS.invocation)
    if (invocationMatch) {
      // Save any pending text
      if (currentText.trim()) {
        segments.push({ type: "text", content: currentText })
        currentText = ""
      }
      
      // Save any pending result from previous tool
      if (currentTool && resultBuffer.length > 0) {
        currentTool.result = resultBuffer.join('\n')
        resultBuffer = []
      }
      
      // Start new tool call
      currentTool = {
        id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        toolName: invocationMatch[1],
        status: "running",
        arguments: {},
        startTime: Date.now(),
      }
      
      collectingResult = false
      continue
    }
    
    // Check for completion
    if (TOOL_CALL_PATTERNS.completion.test(trimmed)) {
      if (currentTool) {
        currentTool.status = "completed"
        if (resultBuffer.length > 0) {
          currentTool.result = resultBuffer.join('\n')
          resultBuffer = []
        }
        segments.push({ type: "tool_call", toolCall: currentTool })
        currentTool = null
        collectingResult = false
      }
      continue
    }
    
    // Check for failure
    if (TOOL_CALL_PATTERNS.failure.test(trimmed)) {
      if (currentTool) {
        currentTool.status = "failed"
        if (resultBuffer.length > 0) {
          currentTool.result = resultBuffer.join('\n')
          resultBuffer = []
        }
        segments.push({ type: "tool_call", toolCall: currentTool })
        currentTool = null
        collectingResult = false
      }
      continue
    }
    
    // Check for arguments
    const argMatch = trimmed.match(TOOL_CALL_PATTERNS.argument)
    if (argMatch && currentTool && !collectingResult) {
      const [, key, value] = argMatch
      currentTool.arguments[key] = value
      continue
    }
    
    // Check for separator (end of tool call section)
    if (TOOL_CALL_PATTERNS.separator.test(trimmed)) {
      if (currentTool) {
        collectingResult = true
      }
      continue
    }
    
    // Collect result content
    if (currentTool && (collectingResult || trimmed.startsWith('$') || trimmed.startsWith('>'))) {
      resultBuffer.push(line)
      continue
    }
    
    // Regular text
    if (currentTool) {
      // If we have a tool and see regular text, the tool section ended
      if (resultBuffer.length > 0) {
        currentTool.result = resultBuffer.join('\n')
        resultBuffer = []
      }
      segments.push({ type: "tool_call", toolCall: currentTool })
      currentTool = null
      collectingResult = false
    }
    
    currentText += line + '\n'
  }
  
  // Handle any remaining content
  if (currentTool) {
    if (resultBuffer.length > 0) {
      currentTool.result = resultBuffer.join('\n')
    }
    segments.push({ type: "tool_call", toolCall: currentTool })
  }
  
  if (currentText.trim()) {
    segments.push({ type: "text", content: currentText })
  }
  
  return segments
}

// Alternative: Parse tool calls from opencode's specific format
// Based on common AI CLI patterns
export function parseOpencodeToolCalls(output: string): ParsedSegment[] {
  const segments: ParsedSegment[] = []
  
  // Split by tool call markers
  // Pattern: "  > tool_name" or similar indentation-based tool calls
  const parts = output.split(/(?=\n\s*[▶>●▸→]\s*\w+)/)
  
  for (const part of parts) {
    if (!part.trim()) continue
    
    // Check if this is a tool call section
    const toolMatch = part.match(/^\s*[▶>●▸→]\s*(\w+(?:_\w+)*)/)
    if (toolMatch) {
      const toolCall = parseToolCallBlock(toolMatch[1], part)
      if (toolCall) {
        segments.push({ type: "tool_call", toolCall })
      }
    } else {
      segments.push({ type: "text", content: part })
    }
  }
  
  return segments
}

function parseToolCallBlock(toolName: string, block: string): ToolCall | null {
  const lines = block.split('\n')
  const toolCall: ToolCall = {
    id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    toolName,
    status: "completed", // Default, will be updated
    arguments: {},
    startTime: Date.now(),
  }
  
  let inResult = false
  const resultLines: string[] = []
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // Skip the invocation line itself
    if (trimmed.match(new RegExp(`^[▶>●▸→]\\s*${toolName}`, 'i'))) {
      continue
    }
    
    // Check for status indicators
    if (trimmed.match(/^(?:✓|✅|✔)\s*/)) {
      toolCall.status = "completed"
      inResult = false
      continue
    }
    
    if (trimmed.match(/^(?:✗|❌|✘)\s*/)) {
      toolCall.status = "failed"
      inResult = false
      continue
    }
    
    // Parse arguments
    const argMatch = trimmed.match(/^(\w+):\s*(.+)$/)
    if (argMatch && !inResult) {
      const [, key, value] = argMatch
      toolCall.arguments[key] = value
      continue
    }
    
    // Collect result lines
    if (trimmed && !trimmed.startsWith('✓') && !trimmed.startsWith('✗')) {
      // Check if line looks like a result (code, output, etc)
      if (inResult || trimmed.startsWith('$') || trimmed.startsWith('>')) {
        inResult = true
        resultLines.push(line)
      } else if (resultLines.length > 0) {
        // Still collecting result
        resultLines.push(line)
      }
    }
  }
  
  if (resultLines.length > 0) {
    toolCall.result = resultLines.join('\n')
  }
  
  return toolCall
}
