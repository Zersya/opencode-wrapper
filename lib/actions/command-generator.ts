"use server"

import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { tasks, projects, organizations } from "@/lib/db/schema"
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

  if (!hasOpenAI && !hasAnthropic) {
    throw new Error(
      "No AI API key configured. Please add an OpenAI or Anthropic API key in organization settings to enable automatic command generation."
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
- /fix [description] - Fix bugs or issues
- /review - Review code for improvements
- /refactor [description] - Refactor code
- /implement [description] - Implement new features
- /test [description] - Write tests
- /docs [description] - Generate documentation
- /optimize [description] - Optimize performance

Analyze the task details and generate the most appropriate opencode command.

Respond ONLY in this JSON format:
{
  "command": "the command without 'opencode' prefix (e.g., '/fix authentication bug')",
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
    } else {
      // Use OpenAI
      response = await callOpenAI(
        decryptApiKey(org.openaiApiKey!),
        systemPrompt,
        userPrompt
      )
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
      max_tokens: 300,
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
      max_tokens: 300,
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
    const commandMatch = response.match(/(?:command[:\s]*)?([\/][a-z-]+[^\n]*)/i)
    const command = commandMatch ? commandMatch[1].trim() : "/review"
    
    return {
      command,
      explanation: "Generated command based on task analysis",
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
  if (organizationId) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)
    hasAI = !!(org?.openaiApiKey || org?.anthropicApiKey)
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
- /fix [description] - Fix bugs
- /review - Code review
- /refactor - Refactor code
- /implement [feature] - Implement features
- /test - Write tests
- /docs - Documentation
- /optimize - Performance optimization

Respond in JSON format:
{
  "command": "the command without opencode prefix",
  "explanation": "why this command fits",
  "autoExecute": boolean
}`

  const userPrompt = `Task Title: ${taskTitle}
Description: ${taskDescription || "No description"}

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
  
  // Heuristic patterns
  if (text.includes("bug") || text.includes("fix") || text.includes("error") || text.includes("crash")) {
    return { command: "/fix " + title.slice(0, 50), explanation: "Task appears to be about fixing an issue", autoExecute: false }
  }
  if (text.includes("test") || text.includes("spec")) {
    return { command: "/test " + title.slice(0, 50), explanation: "Task involves writing tests", autoExecute: false }
  }
  if (text.includes("refactor") || text.includes("clean") || text.includes("improve code")) {
    return { command: "/refactor " + title.slice(0, 50), explanation: "Task is about code refactoring", autoExecute: false }
  }
  if (text.includes("doc") || text.includes("readme")) {
    return { command: "/docs " + title.slice(0, 50), explanation: "Task involves documentation", autoExecute: true }
  }
  if (text.includes("performance") || text.includes("slow") || text.includes("optimize")) {
    return { command: "/optimize " + title.slice(0, 50), explanation: "Task is about performance optimization", autoExecute: false }
  }
  if (text.includes("implement") || text.includes("add") || text.includes("create")) {
    return { command: "/implement " + title.slice(0, 50), explanation: "Task is implementing a new feature", autoExecute: false }
  }
  
  // Default
  return { command: "/review", explanation: "General code review recommended", autoExecute: true }
}
