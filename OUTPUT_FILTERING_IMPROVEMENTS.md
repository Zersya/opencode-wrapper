# Output Filtering & Interactive Input Improvements

## Overview

Enhanced the opencode execution output to:
1. **Filter out wrapper logs** - Show only opencode conversation to users
2. **Detect user questions** - Identify when opencode asks for input
3. **Enable interactive responses** - Allow users to respond to questions

## Changes Made

### 1. Output Filter Module (`lib/server/output-filter.ts`)

**Purpose:** Intelligently filter execution output

**Features:**
- ✅ Remove `[opencode-wrapper]` messages from user-visible output
- ✅ Remove debug/log messages from conversation
- ✅ Detect 3 types of questions:
  - **Input**: "Please provide...", "What is...", "Enter:"
  - **Choice**: "Choose option:", "Select [1-3]:"
  - **Confirmation**: "Proceed?", "Continue? (y/n)"

**Key Functions:**
```typescript
processOutput(raw: string): ProcessedOutput
  → { type, content, isQuestion, questionType, shouldDisplay }

isWaitingForInput(output: string): boolean
  → Detects if opencode is asking a question

extractQuestionPrompt(output: string): string | null
  → Extracts just the question text
```

### 2. Enhanced Execution Tracking (`lib/server/cli-executor.ts`)

**New State Properties:**
```typescript
RunningExecution {
  waitingForInput: boolean      // Is opencode asking a question?
  questionPrompt?: string       // The question text
}
```

**Improved Output Handling:**
```typescript
appendOutput(data: string)
  → Filters output before publishing to SSE
  → Detects questions and publishes 'question' events
  
logWrapper(message: string)
  → Wrapper messages → console logs only (not shown to users)
```

**New Functions:**
```typescript
isWaitingForInput(executionId): boolean
getQuestionPrompt(executionId): string | undefined
sendInputToExecution(executionId, input): { success, error? }
```

**Process Spawn Changes:**
- ✅ Changed `stdio: ['ignore', ...]` → `['pipe', ...]`
- ✅ Enables stdin for interactive responses
- ✅ Allows sending user input back to opencode

### 3. Enhanced SSE Events (`lib/server/execution-stream.ts`)

**New Event Type:**
```typescript
type: "question"
payload: {
  output: string,           // The question text
  questionType: "input" | "choice" | "confirmation",
  status: "waiting_for_input",
  timestamp: string
}
```

**New Publisher Function:**
```typescript
publishQuestion(executionId, question, questionType)
```

### 4. Input API Endpoint (`app/api/executions/[id]/input/route.ts`)

**POST** `/api/executions/[id]/input`
- Send user response to opencode
- Body: `{ "input": "user response" }`
- Returns: `{ "success": true }` or error

**GET** `/api/executions/[id]/input`
- Check if execution is waiting for input
- Returns: `{ "waitingForInput": boolean, "question": string | null }`

## User Experience Flow

### Before:
```
[opencode-wrapper] Workspace ready at: /workspace
[opencode-wrapper] Cloning repository...
[opencode-wrapper] Repository ready at: /workspace/repo
[opencode-wrapper] Starting opencode execution...

user: /fix-bug
assistant: I'll help you fix the bug. What file should I check?
[opencode-wrapper] Process ended
```

### After:
```
user: /fix-bug
assistant: I'll help you fix the bug. What file should I check?
↑ [QUESTION DETECTED] waiting_for_input

User types: "src/auth/login.ts"
→ Sent via POST /api/executions/123/input

assistant: I'll examine src/auth/login.ts...
[Proceeds with fix]
```

## Frontend Integration Guide

### 1. Listen for Question Events

```typescript
eventSource.addEventListener('question', (event) => {
  const data = JSON.parse(event.data)
  
  if (data.questionType === 'input') {
    showInputPrompt(data.output)
  } else if (data.questionType === 'choice') {
    showChoicePrompt(data.output)
  } else if (data.questionType === 'confirmation') {
    showConfirmationDialog(data.output)
  }
})
```

### 2. Send User Response

```typescript
async function sendUserResponse(executionId: number, response: string) {
  const res = await fetch(`/api/executions/${executionId}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: response })
  })
  
  if (!res.ok) throw new Error('Failed to send input')
  return res.json()
}
```

### 3. Check Input Status

```typescript
async function checkIfWaitingForInput(executionId: number) {
  const res = await fetch(`/api/executions/${executionId}/input`)
  const data = await res.json()
  return data // { waitingForInput: boolean, question: string | null }
}
```

## Testing Scenarios

### Test 1: Simple Question
1. Execute: `/create-component`
2. OpenCode asks: "What component name?"
3. Event: `{ type: "question", questionType: "input" }`
4. User responds: "Button"
5. OpenCode proceeds with button creation

### Test 2: Multiple Choice
1. Execute: `/choose-framework`
2. OpenCode asks: "Choose framework:\n1. React\n2. Vue\n3. Svelte"
3. Event: `{ type: "question", questionType: "choice" }`
4. User responds: "1"
5. OpenCode proceeds with React setup

### Test 3: Confirmation
1. Execute: `/delete-all-files`
2. OpenCode asks: "Are you sure? (y/n)"
3. Event: `{ type: "question", questionType: "confirmation" }`
4. User responds: "n"
5. OpenCode cancels operation

## Debug Logging

All wrapper messages are logged to console for debugging:

```bash
[cli-executor:wrapper] Workspace ready at: /workspace
[cli-executor:wrapper] Cloning repository...
[cli-executor:wrapper] Repository ready at: /workspace/repo
[cli-executor:wrapper] Starting opencode execution...
[cli-executor] OpenCode is asking: input
[cli-executor] Question: What file should I check?
```

## Files Modified

1. ✅ `lib/server/output-filter.ts` - New output filtering module
2. ✅ `lib/server/cli-executor.ts` - Enhanced execution handling
3. ✅ `lib/server/execution-stream.ts` - Added question event type
4. ✅ `app/api/executions/[id]/input/route.ts` - New input API endpoint

## Commands to Run

```bash
npm run dev
```

The filtering and interactive input handling is now active. Test with any opencode command that asks questions!

## Notes

- Wrapper messages are **still stored** in database for full audit trail
- Only **filtered** from real-time SSE stream to users
- Question detection uses pattern matching - may need tuning for edge cases
- Stdin pipe allows unlimited back-and-forth interaction
- No timeout on user responses (opencode handles its own timeout)
