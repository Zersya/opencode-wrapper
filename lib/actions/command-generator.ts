"use server"

import { auth } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { tasks, projects, organizations, customProviders } from "@/lib/db/schema"
import { decryptApiKey } from "@/lib/server/encryption"

interface GenerateCommandResult {
  command: string
  explanation: string
  autoExecute: boolean
}

export async function generateOpencodeCommand(taskId: number): Promise<GenerateCommandResult> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  // Get task with project and org details
  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)

  if (!task) throw new Error("Task not found")

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, task.projectId))
    .limit(1)

  if (!project) throw new Error("Project not found")

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, project.organizationId))
    .limit(1)

  // Check for AI API keys
  const hasOpenAI = org?.openaiApiKey
  const hasAnthropic = org?.anthropicApiKey

  // Check for custom providers if no native keys
  let customProvider = null
  if (!hasOpenAI && !hasAnthropic) {
    const [activeProvider] = await db
      .select()
      .from(customProviders)
      .where(
        and(
          eq(customProviders.organizationId, project.organizationId),
          eq(customProviders.isActive, true)
        )
      )
      .limit(1)
    customProvider = activeProvider
  }

  if (!hasOpenAI && !hasAnthropic && !customProvider) {
    throw new Error(
      "No AI API key configured. Please add an OpenAI, Anthropic, or custom provider API key in organization settings to enable automatic command generation."
    )
  }

  // Prepare context for AI
  const context = {
    taskTitle: task.title,
    taskDescription: task.description || "No description provided",
    taskStatus: task.status,
    taskPriority: task.priority,
    projectName: project.name,
    projectDescription: project.description || "",
  }

  const systemPrompt = `You are an expert at generating OpenCode CLI commands based on task descriptions.

OpenCode is a CLI tool that uses AI to help with coding tasks. Common commands include:
- /fix [description] - Fix bugs or issues (e.g., "/fix authentication bug in login.ts")
- /review - Review code for improvements (e.g., "/review security vulnerabilities in API")
- /refactor [description] - Refactor code (e.g., "/refactor database queries for performance")
- /implement [description] - Implement new features (e.g., "/implement user profile settings page")
- /test [description] - Write tests (e.g., "/test user registration flow")
- /docs [description] - Generate documentation (e.g., "/docs API endpoints")
- /optimize [description] - Optimize performance (e.g., "/optimize image loading")

CRITICAL: Always include a BRIEF, SPECIFIC description after the command word. The description should:
- Be 3-10 words
- Capture the essence of the task
- Include relevant file names or components if mentioned

Analyze the task details and generate the most appropriate opencode command.

Respond ONLY in this JSON format:
{
  "command": "the command without 'opencode' prefix (e.g., '/fix authentication bug in login.ts')",
  "explanation": "brief explanation of why this command fits the task",
  "autoExecute": true/false (whether this seems safe to auto-run)
}`

  const userPrompt = `Generate an opencode command for this task:

Title: ${context.taskTitle}
Description: ${context.taskDescription}
Status: ${context.taskStatus}
Priority: ${context.taskPriority}
Project: ${context.projectName}
${context.projectDescription ? `Project Description: ${context.projectDescription}` : ""}

IMPORTANT: Include a brief description in the command, not just the command word. For example, use "/fix login timeout issue" not just "/fix".

Based on this task, what opencode command would be most appropriate?`

  let response: string

  try {
    if (hasAnthropic) {
      // Use Anthropic Claude
      response = await callAnthropic(
        decryptApiKey(org.anthropicApiKey!),
        systemPrompt,
        userPrompt
      )
    } else if (hasOpenAI) {
      // Use OpenAI
      response = await callOpenAI(
        decryptApiKey(org.openaiApiKey!),
        systemPrompt,
        userPrompt
      )
    } else if (customProvider) {
      // Use custom provider
      response = await callCustomProvider(
        decryptApiKey(customProvider.apiKey),
        customProvider.baseUrl,
        customProvider.apiFormat,
        customProvider.models[0] || "gpt-4o-mini",
        systemPrompt,
        userPrompt
      )
    } else {
      throw new Error("No AI provider available")
    }

    // Parse the response
    const result = parseAIResponse(response)
    
    // Validate the command format
    if (!result.command.startsWith('/')) {
      result.command = '/' + result.command
    }

    return result
  } catch (error) {
    console.error("Failed to generate command:", error)
    throw new Error(
      error instanceof Error 
        ? `AI generation failed: ${error.message}` 
        : "Failed to generate command using AI"
    )
  }
}

async function callOpenAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || ""
}

async function callAnthropic(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 500,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error: ${error}`)
  }

  const data = await response.json()
  return data.content[0]?.text || ""
}

async function callCustomProvider(
  apiKey: string,
  baseUrl: string,
  apiFormat: "openai" | "anthropic",
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (apiFormat === "openai") {
    // OpenAI-compatible format
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Custom provider API error: ${error}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ""
  } else {
    // Anthropic-compatible format
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Custom provider API error: ${error}`)
    }

    const data = await response.json()
    return data.content[0]?.text || ""
  }
}

function parseAIResponse(response: string): GenerateCommandResult {
  // Try to extract JSON from the response
  try {
    // Look for JSON in code blocks
    const jsonMatch = response.match(/```(?:json)?\s*({[\s\S]*?})\s*```/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1])
    }

    // Try parsing the entire response as JSON
    return JSON.parse(response)
  } catch {
    // Fallback: try to extract command from text
    // Match: /command followed by description (up to 100 chars, stop at sentence end)
    const commandMatch = response.match(/(?:command[:\s]*)?([\/][a-z-]+(?:\s+[^\n.]{1,100})?)/i)
    let command = commandMatch ? commandMatch[1].trim() : ""
    
    // Clean up the command
    command = command
      .replace(/\.$/, '')  // Remove trailing period
      .replace(/\s+(?:the|since|because|as|for)\s+.+$/i, '')  // Remove explanation clauses
      .trim()
    
    // If we found a command, use it
    if (command && command.startsWith('/')) {
      return {
        command,
        explanation: "Generated command based on task analysis",
        autoExecute: false,
      }
    }
    
    // Try another pattern: look for command word anywhere
    const simpleMatch = response.match(/\/([a-z-]+)/i)
    if (simpleMatch) {
      return {
        command: '/' + simpleMatch[1],
        explanation: "Extracted command from AI response",
        autoExecute: false,
      }
    }
    
    // Last resort: return a descriptive default
    return {
      command: "/review code for improvements",
      explanation: "Unable to parse AI response, defaulting to code review",
      autoExecute: false,
    }
  }
}

// Alternative: Suggest command without saving (for preview)
export async function previewOpencodeCommand(
  taskTitle: string,
  taskDescription?: string,
  organizationId?: number
): Promise<GenerateCommandResult> {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  // Check for AI API keys if org is provided
  let hasAI = false
  let customProvider: typeof customProviders.$inferSelect | null = null
  if (organizationId) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)
    hasAI = !!(org?.openaiApiKey || org?.anthropicApiKey)
    
    // Check for custom providers if no native keys
    if (!hasAI) {
      const [provider] = await db
        .select()
        .from(customProviders)
        .where(
          and(
            eq(customProviders.organizationId, organizationId),
            eq(customProviders.isActive, true)
          )
        )
        .limit(1)
      customProvider = provider
      hasAI = !!provider
    }
  }

  if (!hasAI) {
    // Return a basic suggestion based on heuristics
    return generateHeuristicCommand(taskTitle, taskDescription)
  }

  // Use AI for better suggestions
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId!))
    .limit(1)

  const systemPrompt = `You are an expert at generating OpenCode CLI commands.

Common OpenCode commands:
- /fix [description] - Fix bugs (e.g., "/fix login timeout issue")
- /review - Code review (e.g., "/review security vulnerabilities")
- /refactor - Refactor code (e.g., "/refactor API endpoints")
- /implement [feature] - Implement features (e.g., "/implement user settings")
- /test - Write tests (e.g., "/test authentication flow")
- /docs - Documentation (e.g., "/docs API reference")
- /optimize - Performance optimization (e.g., "/optimize database queries")

CRITICAL: Always include a brief description (3-10 words) after the command word.

Respond in JSON format:
{
  "command": "the command without opencode prefix",
  "explanation": "why this command fits",
  "autoExecute": boolean
}`

  const userPrompt = `Task Title: ${taskTitle}
Description: ${taskDescription || "No description"}

IMPORTANT: Include a brief description in the command, not just the command word.

Suggest an opencode command:`

  try {
    let response: string
    if (org.anthropicApiKey) {
      response = await callAnthropic(
        decryptApiKey(org.anthropicApiKey),
        systemPrompt,
        userPrompt
      )
    } else if (org.openaiApiKey) {
      response = await callOpenAI(
        decryptApiKey(org.openaiApiKey),
        systemPrompt,
        userPrompt
      )
    } else if (customProvider) {
      response = await callCustomProvider(
        decryptApiKey(customProvider.apiKey),
        customProvider.baseUrl,
        customProvider.apiFormat,
        customProvider.models[0] || "gpt-4o-mini",
        systemPrompt,
        userPrompt
      )
    } else {
      return generateHeuristicCommand(taskTitle, taskDescription)
    }

    return parseAIResponse(response)
  } catch {
    return generateHeuristicCommand(taskTitle, taskDescription)
  }
}

function generateHeuristicCommand(title: string, description?: string): GenerateCommandResult {
  const text = (title + " " + (description || "")).toLowerCase()
  const titleWords = title.split(' ').slice(0, 8).join(' ')
  
  // Heuristic patterns - include more descriptive commands
  if (text.includes("bug") || text.includes("fix") || text.includes("error") || text.includes("crash")) {
    return { 
      command: `/fix ${titleWords}`, 
      explanation: "Task appears to be about fixing an issue", 
      autoExecute: false 
    }
  }
  if (text.includes("test") || text.includes("spec")) {
    return { 
      command: `/test ${titleWords}`, 
      explanation: "Task involves writing tests", 
      autoExecute: false 
    }
  }
  if (text.includes("refactor") || text.includes("clean") || text.includes("improve code")) {
    return { 
      command: `/refactor ${titleWords}`, 
      explanation: "Task is about code refactoring", 
      autoExecute: false 
    }
  }
  if (text.includes("doc") || text.includes("readme") || text.includes("documentation")) {
    return { 
      command: `/docs ${titleWords}`, 
      explanation: "Task involves documentation", 
      autoExecute: true 
    }
  }
  if (text.includes("performance") || text.includes("slow") || text.includes("optimize")) {
    return { 
      command: `/optimize ${titleWords}`, 
      explanation: "Task is about performance optimization", 
      autoExecute: false 
    }
  }
  if (text.includes("implement") || text.includes("add") || text.includes("create") || text.includes("build")) {
    return { 
      command: `/implement ${titleWords}`, 
      explanation: "Task is implementing a new feature", 
      autoExecute: false 
    }
  }
  if (text.includes("security") || text.includes("vulnerability") || text.includes("secure")) {
    return { 
      command: `/review security aspects of ${titleWords}`, 
      explanation: "Task involves security considerations", 
      autoExecute: false 
    }
  }
  if (text.includes("review") || text.includes("audit") || text.includes("check")) {
    return { 
      command: `/review ${titleWords}`, 
      explanation: "Task requires code review or audit", 
      autoExecute: true 
    }
  }
  
  // Default - be more descriptive
  return { 
    command: `/review code for ${titleWords}`, 
    explanation: "General code review recommended", 
    autoExecute: false 
  }
}
