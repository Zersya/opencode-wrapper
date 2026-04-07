# OpenCode Wrapper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Linear-like project management platform with multi-user kanban boards and server-side opencode CLI execution with real-time output streaming.

**Architecture:**
- Frontend: Next.js 14 App Router + shadcn/ui + Tailwind CSS
- Backend: Next.js Server Actions + API Routes + Polling
- Database: PostgreSQL with Drizzle ORM
- Auth: Clerk with GitHub/GitLab OAuth
- CLI Execution: Docker-isolated environments per organization
- Deployment: Railway + Coolify with Docker containers

**Tech Stack:**
- Next.js 14.2+, React 18.3+
- Drizzle ORM 0.30+, PostgreSQL
- Clerk Authentication
- shadcn/ui + Radix UI
- Tailwind CSS
- @dnd-kit (drag-drop)
- Lucide React (icons)
- date-fns (dates)
- Docker (CLI isolation)

---

## Architecture Overview

### Multi-Tenancy & Isolation
```
Organization A
├── Docker Container (isolated environment)
│   ├── Working directory: /workspace/org-a
│   ├── Environment: API keys for org-a
│   └── opencode CLI processes
└── Projects & Tasks

Organization B
├── Docker Container (separate isolation)
│   ├── Working directory: /workspace/org-b
│   ├── Environment: API keys for org-b
│   └── opencode CLI processes
└── Projects & Tasks
```

### API Key Management
- Encrypted with AES-256-GCM
- Master encryption key in `ENCRYPTION_KEY` env var
- Stored per-organization in database
- Never logged or exposed in API responses

### Deployment Architecture
```
Railway/Coolify Docker Container:
├── Next.js App (port 3000)
├── PostgreSQL (managed service)
├── Docker Socket (for spawning containers)
└── Persistent Volume: /workspace (git repos)
```

---

## Database Schema

### File: `lib/db/schema.ts`

```typescript
import { 
  pgTable, serial, text, integer, timestamp, boolean, 
  jsonb, pgEnum 
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const taskStatusEnum = pgEnum('task_status', [
  'backlog', 'todo', 'in_progress', 'in_review', 'done', 'canceled'
]);

export const taskPriorityEnum = pgEnum('task_priority', [
  'no_priority', 'low', 'medium', 'high', 'urgent'
]);

export const executionStatusEnum = pgEnum('execution_status', [
  'pending', 'running', 'success', 'failed', 'canceled'
]);

export const gitProviderEnum = pgEnum('git_provider', ['github', 'gitlab']);

// Users (synced from Clerk)
export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user ID
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Organizations
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  ownerId: text('owner_id').references(() => users.id).notNull(),
  
  // Encrypted API keys (AES-256-GCM)
  openaiApiKey: text('openai_api_key'),
  anthropicApiKey: text('anthropic_api_key'),
  
  // Docker container ID for this org
  containerId: text('container_id'),
  containerStatus: text('container_status').default('stopped'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Organization Members
export const organizationMembers = pgTable('organization_members', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').references(() => organizations.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  role: text('role').default('member').notNull(), // owner, admin, member
  joinedAt: timestamp('joined_at').defaultNow(),
});

// Projects
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').references(() => organizations.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  slug: text('slug').notNull(),
  
  // Git repository
  gitProvider: gitProviderEnum('git_provider'),
  gitRepoUrl: text('git_repo_url'),
  gitBranch: text('git_branch').default('main'),
  
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tasks
export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  
  // Kanban
  status: taskStatusEnum('status').default('backlog').notNull(),
  priority: taskPriorityEnum('priority').default('no_priority').notNull(),
  position: integer('position').default(0).notNull(), // Order within column
  
  // Assignment
  assigneeId: text('assignee_id').references(() => users.id),
  creatorId: text('creator_id').references(() => users.id).notNull(),
  
  // CLI Execution
  opencodeCommand: text('opencode_command'), // e.g., "fix login bug"
  autoExecute: boolean('auto_execute').default(false), // Run when moved to in_progress
  
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Task Executions (CLI runs)
export const taskExecutions = pgTable('task_executions', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  organizationId: integer('organization_id').references(() => organizations.id).notNull(),
  
  status: executionStatusEnum('status').default('pending').notNull(),
  command: text('command').notNull(), // Full opencode command
  workingDirectory: text('working_directory').notNull(),
  
  // Process info
  pid: integer('pid'),
  containerId: text('container_id'), // Docker container for this execution
  
  // Output
  output: text('output'), // Full output log
  outputPosition: integer('output_position').default(0), // For polling
  
  exitCode: integer('exit_code'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Git Integrations
export const gitIntegrations = pgTable('git_integrations', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  organizationId: integer('organization_id').references(() => organizations.id),
  provider: gitProviderEnum('provider').notNull(),
  
  accessToken: text('access_token').notNull(), // Encrypted
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  scope: text('scope'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Comments
export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(), // task_assigned, comment_added, execution_complete
  title: text('title').notNull(),
  content: text('content'),
  data: jsonb('data'), // { taskId, executionId, etc }
  read: boolean('read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  organizations: many(organizationMembers),
  createdTasks: many(tasks, { relationName: 'creator' }),
  assignedTasks: many(tasks, { relationName: 'assignee' }),
  comments: many(comments),
  notifications: many(notifications),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, { fields: [organizations.ownerId], references: [users.id] }),
  members: many(organizationMembers),
  projects: many(projects),
  gitIntegrations: many(gitIntegrations),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, { fields: [projects.organizationId], references: [organizations.id] }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id], relationName: 'assignee' }),
  creator: one(users, { fields: [tasks.creatorId], references: [users.id], relationName: 'creator' }),
  executions: many(taskExecutions),
  comments: many(comments),
}));

export const taskExecutionsRelations = relations(taskExecutions, ({ one }) => ({
  task: one(tasks, { fields: [taskExecutions.taskId], references: [tasks.id] }),
  user: one(users, { fields: [taskExecutions.userId], references: [users.id] }),
  organization: one(organizations, { fields: [taskExecutions.organizationId], references: [organizations.id] }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskExecution = typeof taskExecutions.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
```

---

## Implementation Phases

### Phase 1: Project Foundation (Day 1-2)
1. Initialize Next.js project with TypeScript and Tailwind
2. Install all dependencies (Clerk, Drizzle, shadcn/ui, etc.)
3. Configure Tailwind with Linear-inspired theme
4. Setup Drizzle ORM with PostgreSQL
5. Create database schema and run migrations
6. Configure Clerk authentication
7. Setup shadcn/ui components

### Phase 2: Core UI Layout (Day 3-4)
1. Create sidebar component (collapsible navigation)
2. Build header with user menu and search
3. Implement command palette (CMD+K)
4. Create dashboard layout wrapper
5. Build dashboard home page

### Phase 3: Task Management (Day 5-7)
1. Create kanban board components (board, column, task card)
2. Implement drag-drop functionality with @dnd-kit
3. Build task server actions (CRUD operations)
4. Create task detail view
5. Add task creation/editing forms
6. Implement task status updates

### Phase 4: CLI Execution Engine (Day 8-10)
1. Create encryption utilities for API keys
2. Build Docker manager for container lifecycle
3. Implement CLI executor service
4. Create execution server actions
5. Build terminal output viewer component
6. Add execution controls (start, stop, retry)
7. Implement polling for execution updates

### Phase 5: Git Integration (Day 11-12)
1. Setup GitHub/GitLab OAuth in Clerk
2. Create OAuth callback routes
3. Build repository browser component
4. Implement commit and push operations
5. Create PR workflow UI
6. Add branch management

### Phase 6: Polish & Launch (Day 13-14)
1. Implement notifications system
2. Build organization management
3. Create settings page
4. Add API key management UI
5. Performance optimization
6. Final testing and bug fixes

---

## Key Files Summary

| Phase | Category | Files to Create |
|-------|----------|----------------|
| 1 | Config | package.json, tsconfig.json, tailwind.config.ts, .env.local |
| 1 | Database | lib/db/index.ts, lib/db/schema.ts, drizzle.config.ts |
| 1 | Auth | middleware.ts, app/(auth)/sign-in/page.tsx |
| 1 | UI | components/ui/*.tsx, lib/utils.ts |
| 2 | Layout | components/layout/sidebar.tsx, header.tsx, command-palette.tsx |
| 3 | Kanban | components/kanban/board.tsx, column.tsx, task-card.tsx |
| 3 | Actions | lib/actions/tasks.ts |
| 4 | Execution | lib/server/docker-manager.ts, cli-executor.ts, encryption.ts |
| 4 | Actions | lib/actions/executions.ts |
| 5 | Git | lib/server/git-api.ts, app/api/auth/callback/[provider]/route.ts |
| 6 | Deployment | Dockerfile, docker-compose.yml, .dockerignore |

---

## Commands Summary

**Setup:**
```bash
npx create-next-app@latest . --typescript --tailwind --app
npm install @clerk/nextjs drizzle-orm pg @radix-ui/react-* shadcn-ui
npx drizzle-kit generate:pg
npx drizzle-kit push
```

**Development:**
```bash
npm run dev
npx drizzle-kit studio
```

**Production:**
```bash
docker-compose up -d
docker-compose logs -f app
```

---

## Next Steps

1. Review and approve this plan
2. Begin Phase 1 implementation
3. Test each phase before moving to next
4. Commit frequently with clear messages

Ready to proceed with implementation?
