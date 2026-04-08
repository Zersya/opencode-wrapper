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
    choice: /(?:choose|select|pick|option|which)\s*(?:\d+:|[\(\[]\d[\)\]]|:?\s*$)/i,
    confirmation: /(?:proceed\?|continue\?|confirm\?|yes\/no|y\/n|are you sure)/i,
  },
  
  opencodeStart: /^(\s*)(?:user|assistant|system|tool):\s*/i,
  
  debugLog: /^\s*\[?(?:debug|info|warn|error|log)\]?\s*[:\)]/i,
}

export function filterOutput(rawOutput: string): FilteredOutput {
  const lines = rawOutput.split('\n')
  const conversationLines: string[] = []
  let isQuestion = false
  let questionType: "input" | "choice" | "confirmation" | undefined

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
  const filtered = filterOutput(rawOutput)
  
  if (PATTERNS.wrapper.test(rawOutput)) {
    return {
      type: "wrapper",
      content: rawOutput,
      shouldDisplay: false,
    }
  }
  
  if (filtered.conversation) {
    return {
      type: "conversation",
      content: filtered.conversation,
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
