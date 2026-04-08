export interface FilteredOutput {
  conversation: string
  isQuestion: boolean
  questionType?: "input" | "choice" | "confirmation"
  raw: string
}

const PATTERNS = {
  wrapper: /^\[opencode-wrapper\]/,
  
  question: {
    input: /(?:please\s+(?:provide|enter|input)|what\s+(?:is|are)|how\s+(?:do|can|should)|enter\s+(?:the|your)|input:?\s*$|:\s*$)/i,
    choice: /(?:choose|select|pick|option|which)\s*(?:\d+:|\(\[\]\d[\)\]]|:?\s*$)/i,
    confirmation: /(?:proceed\?|continue\?|confirm\?|yes\/no|y\/n|are you sure)/i,
  },
  
  opencodeStart: /^(\s*)(?:user|assistant|system|tool):\s*/i,
  
  // Opencode's internal logs - comprehensive pattern to catch all operational logs
  // Matches: INFO 2026-04-08T17:17:31 +0ms service=bus type=message.part.delta publishing
  // Matches: WARN 2026-04-08T17:17:31 +49ms service=skill name=frontend-design ...
  // NOTE: This is very specific to avoid filtering AI output that might contain these words
  opencodeLog: /^(?:INFO|WARN|ERROR|DEBUG)\s+\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\s+[+-]\d+ms\s+service=/i,
  
  // Alternative pattern for opencode logs - must have timestamp AND be at start of line
  // This prevents filtering AI output that mentions "INFO" or "ERROR"
  opencodeLogAlt: /^(?:INFO|WARN|ERROR|DEBUG)\s+\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/i,
  
  // Only filter wrapper debug logs
  debugLog: /^\s*\[?(?:debug)\]?\s*[:\)]/i,
}

export function filterOutput(rawOutput: string): FilteredOutput {
  const lines = rawOutput.split('\n')
  const conversationLines: string[] = []
  let isQuestion = false
  let questionType: "input" | "choice" | "confirmation" | undefined
  
  // Debug logging for first few calls
  if (rawOutput.length > 100) {
    console.log(`[output-filter] Filtering ${rawOutput.length} chars, ${lines.length} lines`)
  }

  for (const line of lines) {
    const trimmedLine = line.trim()
    
    if (!trimmedLine) {
      conversationLines.push(line)
      continue
    }
    
    if (PATTERNS.wrapper.test(trimmedLine)) {
      continue
    }
    
    if (PATTERNS.debugLog.test(trimmedLine)) {
      continue
    }
    
    // Filter opencode's internal operational logs (INFO, WARN, ERROR, DEBUG)
    if (PATTERNS.opencodeLog.test(trimmedLine) || PATTERNS.opencodeLogAlt.test(trimmedLine)) {
      continue
    }
    
    conversationLines.push(line)
    
    if (!isQuestion) {
      if (PATTERNS.question.input.test(trimmedLine)) {
        isQuestion = true
        questionType = "input"
      } else if (PATTERNS.question.choice.test(trimmedLine)) {
        isQuestion = true
        questionType = "choice"
      } else if (PATTERNS.question.confirmation.test(trimmedLine)) {
        isQuestion = true
        questionType = "confirmation"
      }
    }
  }

  const conversation = conversationLines.join('\n')

  return {
    conversation,
    isQuestion,
    questionType,
    raw: rawOutput,
  }
}

export type OutputType = "wrapper" | "conversation" | "error"

export interface ProcessedOutput {
  type: OutputType
  content: string
  isQuestion?: boolean
  questionType?: "input" | "choice" | "confirmation"
  shouldDisplay: boolean
}

export function processOutput(rawOutput: string): ProcessedOutput {
  // DEBUG: Log what we're processing
  if (rawOutput.length > 50) {
    console.log(`[output-filter] processOutput called with ${rawOutput.length} chars`)
    console.log(`[output-filter] First 100 chars: "${rawOutput.substring(0, 100)}..."`)
  }
  
  const filtered = filterOutput(rawOutput)
  
  // DEBUG: Log filter results
  if (rawOutput.length > 50) {
    console.log(`[output-filter] Filtered to ${filtered.conversation.length} chars, isQuestion: ${filtered.isQuestion}`)
  }
  
  if (PATTERNS.wrapper.test(rawOutput)) {
    return {
      type: "wrapper",
      content: rawOutput,
      shouldDisplay: false,
    }
  }
  
  // Show output if there's conversation content OR if it looks like AI response
  // Don't require conversation to be non-empty - some valid AI output might be filtered
  if (filtered.conversation || rawOutput.length > 0) {
    return {
      type: "conversation",
      content: filtered.conversation || rawOutput, // Fallback to raw if filtered is empty
      isQuestion: filtered.isQuestion,
      questionType: filtered.questionType,
      shouldDisplay: true,
    }
  }
  
  return {
    type: "error",
    content: rawOutput,
    shouldDisplay: true,
  }
}

export function extractQuestionPrompt(output: string): string | null {
  const filtered = filterOutput(output)
  
  if (!filtered.isQuestion) {
    return null
  }
  
  const lines = filtered.conversation.split('\n')
  const questionLines: string[] = []
  let foundQuestion = false
  
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (line) {
      questionLines.unshift(lines[i])
      foundQuestion = true
    } else if (foundQuestion) {
      break
    }
  }
  
  return questionLines.join('\n').trim() || null
}

export function isWaitingForInput(output: string): boolean {
  const filtered = filterOutput(output)
  return filtered.isQuestion
}
