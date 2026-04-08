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

OpenCode is a CLI tool that uses AI to help with coding tasks. It works best with NATURAL LANGUAGE descriptions rather than slash commands.

Examples of good natural language prompts:
- "Fix the authentication bug in the login component"
- "Review the API endpoints for security issues"
- "Refactor the database queries to improve performance"
- "Implement a user profile settings page with form validation"
- "Write comprehensive tests for the user registration flow"
- "Generate documentation for the API endpoints"
- "Optimize image loading to improve page speed"
- "Add error handling to the payment processing module"

CRITICAL INSTRUCTIONS:
1. Generate a NATURAL LANGUAGE description of what needs to be done
2. DO NOT use slash commands like /fix, /implement, etc. - they don't exist in opencode
3. DO NOT explain what you're doing - just give the command description
4. DO NOT say "The user wants me to..." - just describe the task itself
5. Be specific and descriptive - include file names, component names, or specific requirements
6. The description should clearly explain the task in 1-2 sentences

BAD EXAMPLE: "The user wants me to generate a natural language prompt..."
GOOD EXAMPLE: "Fix the authentication timeout bug in the login component"

Respond ONLY in this JSON format:
{
  "command": "a natural language description of the task (e.g., 'Fix the login timeout issue in the auth module')",
  "explanation": "brief explanation of what this task involves",
  "autoExecute": true/false (whether this seems safe to auto-run)
}`

  const userPrompt = `Generate a natural language prompt for opencode based on this task:

Title: ${context.taskTitle}
Description: ${context.taskDescription}
Status: ${context.taskStatus}
Priority: ${context.taskPriority}
Project: ${context.projectName}
${context.projectDescription ? `Project Description: ${context.projectDescription}` : ""}

IMPORTANT: 
- Generate a NATURAL LANGUAGE description, NOT a slash command
- Be specific about what needs to be done
- Include file names or component names if mentioned
- Example: "Fix the authentication timeout in the login.ts file" instead of "/fix login timeout"

What should opencode do for this task?`

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
    
    // Strip any leading slash (AI sometimes still generates them despite instructions)
    if (result.command.startsWith('/')) {
      result.command = result.command.substring(1).trim()
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
      const parsed = JSON.parse(jsonMatch[1])
      // Validate the parsed result has required fields
      if (parsed.command && typeof parsed.command === 'string') {
        return parsed
      }
    }

    // Try parsing the entire response as JSON
    const parsed = JSON.parse(response)
    if (parsed.command && typeof parsed.command === 'string') {
      return parsed
    }
    throw new Error('Invalid JSON structure')
  } catch {
    // Fallback: try to extract command from text
    // Look for the first line that looks like a command/prompt
    const lines = response.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('{') && !l.startsWith('}'))
    
    for (const line of lines) {
      // Skip explanatory text and meta-commentary
      if (line.match(/^(here is|the command|this will|suggested|try|use|based on|i will|i'll|the user wants me to|to generate)/i)) {
        continue
      }
      // Skip task metadata lines (Title:, Description:, etc.)
      if (line.match(/^(title|description|status|priority|project):/i)) {
        continue
      }
      // Skip JSON property names that leaked through
      if (line.match(/^["']?(command|explanation|autoExecute)["']?\s*:/i)) {
        continue
      }
      // Look for a descriptive sentence (actual task description)
      // Must be reasonable length, no URLs, and not look like instructions
      if (line.length > 10 && line.length < 300 && 
          !line.includes('://') && 
          !line.match(/^(i |this |that |these |those |the )/i)) {
        return {
          command: line.replace(/^[\s-]*["']?|["']?[\s]*$/g, '').replace(/^\/+/, '').trim(), // Strip leading slashes
          explanation: "Generated from AI response",
          autoExecute: false,
        }
      }
    }
    
    // Last resort: return the first non-empty line that's not obviously wrong
    for (const line of lines) {
      if (line.length > 5 && 
          !line.match(/^(command|explanation|autoExecute|here is|the user|title|description|status|priority)/i)) {
        return {
          command: line.replace(/^[\s-]*["']?|["']?[\s]*$/g, '').replace(/^\/+/, '').trim(),
          explanation: "Extracted from AI response",
          autoExecute: false,
        }
      }
    }
    
    // Absolute fallback - use the task title from context if available
    return {
      command: "Review and improve the codebase", // Safe default
      explanation: "Unable to parse AI response, using safe default",
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

  const systemPrompt = `You are an expert at generating OpenCode CLI natural language prompts.

OpenCode works best with descriptive NATURAL LANGUAGE rather than slash commands. Generate clear, specific descriptions of what needs to be done.

Examples of good prompts:
- "Fix the authentication timeout bug in the login component"
- "Review the API endpoints for security vulnerabilities"  
- "Refactor the database queries to improve performance"
- "Implement a user profile settings page with form validation"
- "Write comprehensive tests for the user registration flow"
- "Generate documentation for the REST API endpoints"
- "Optimize image loading to reduce page load time"

CRITICAL INSTRUCTIONS:
1. Generate a NATURAL LANGUAGE description, NOT a slash command like /fix or /implement.
2. DO NOT explain what you're doing - just give the command description
3. DO NOT say "The user wants me to..." - just describe the task itself
4. Be specific and descriptive

BAD EXAMPLE: "The user wants me to generate a natural language prompt..."
GOOD EXAMPLE: "Fix the authentication timeout bug in the login component"

Respond in JSON format:
{
  "command": "a natural language description of what opencode should do",
  "explanation": "why this task is appropriate",
  "autoExecute": boolean
}`

  const userPrompt = `Task Title: ${taskTitle}
Description: ${taskDescription || "No description"}

IMPORTANT: 
- Generate a NATURAL LANGUAGE description, NOT a slash command
- Be specific about what needs to be done
- Example: "Fix the login timeout in the auth module" instead of "/fix login"

What should opencode do for this task?`

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

    const result = parseAIResponse(response)
    
    // Strip any leading slash (AI sometimes still generates them despite instructions)
    if (result.command.startsWith('/')) {
      result.command = result.command.substring(1).trim()
    }
    
    return result
  } catch {
    return generateHeuristicCommand(taskTitle, taskDescription)
  }
}

function generateHeuristicCommand(title: string, description?: string): GenerateCommandResult {
  const text = (title + " " + (description || "")).toLowerCase()
  
  // Heuristic patterns - generate natural language descriptions
  if (text.includes("bug") || text.includes("fix") || text.includes("error") || text.includes("crash")) {
    return { 
      command: `Fix the ${title.toLowerCase().replace(/bug|fix|error|crash/g, '').trim()}`, 
      explanation: "Task appears to be about fixing an issue", 
      autoExecute: false 
    }
  }
  if (text.includes("test") || text.includes("spec")) {
    return { 
      command: `Write tests for ${title.toLowerCase().replace(/test|spec/g, '').trim()}`, 
      explanation: "Task involves writing tests", 
      autoExecute: false 
    }
  }
  if (text.includes("refactor") || text.includes("clean") || text.includes("improve code")) {
    return { 
      command: `Refactor the ${title.toLowerCase().replace(/refactor|clean|improve code/g, '').trim()} to improve code quality`, 
      explanation: "Task is about code refactoring", 
      autoExecute: false 
    }
  }
  if (text.includes("doc") || text.includes("readme") || text.includes("documentation")) {
    return { 
      command: `Generate documentation for ${title.toLowerCase().replace(/doc|readme|documentation/g, '').trim()}`, 
      explanation: "Task involves documentation", 
      autoExecute: true 
    }
  }
  if (text.includes("performance") || text.includes("slow") || text.includes("optimize")) {
    return { 
      command: `Optimize the performance of ${title.toLowerCase().replace(/performance|slow|optimize/g, '').trim()}`, 
      explanation: "Task is about performance optimization", 
      autoExecute: false 
    }
  }
  if (text.includes("implement") || text.includes("add") || text.includes("create") || text.includes("build")) {
    return { 
      command: `Implement ${title.toLowerCase().replace(/implement|add|create|build/g, '').trim()}`, 
      explanation: "Task is implementing a new feature", 
      autoExecute: false 
    }
  }
  if (text.includes("security") || text.includes("vulnerability") || text.includes("secure")) {
    return { 
      command: `Review and fix security issues in ${title.toLowerCase().replace(/security|vulnerability|secure/g, '').trim()}`, 
      explanation: "Task involves security considerations", 
      autoExecute: false 
    }
  }
  if (text.includes("review") || text.includes("audit") || text.includes("check")) {
    return { 
      command: `Review ${title.toLowerCase().replace(/review|audit|check/g, '').trim()} for code quality and best practices`, 
      explanation: "Task requires code review or audit", 
      autoExecute: true 
    }
  }
  
  // Default - natural language
  return { 
    command: `Work on ${title.toLowerCase()}`, 
    explanation: "General task description", 
    autoExecute: false 
  }
}
