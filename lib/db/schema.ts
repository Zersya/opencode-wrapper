import { 
  pgTable, serial, text, integer, timestamp, boolean, 
  jsonb, pgEnum 
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const taskStatusEnum = pgEnum('task_status', [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'canceled',
]);

export const taskPriorityEnum = pgEnum('task_priority', [
  'no_priority',
  'low',
  'medium',
  'high',
  'urgent',
]);

export const executionStatusEnum = pgEnum('execution_status', [
  'pending',
  'running',
  'success',
  'failed',
  'canceled',
]);

export const gitProviderEnum = pgEnum('git_provider', ['github', 'gitlab']);

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  ownerId: text('owner_id').references(() => users.id).notNull(),
  openaiApiKey: text('openai_api_key'),
  anthropicApiKey: text('anthropic_api_key'),
  containerId: text('container_id'),
  containerStatus: text('container_status').default('stopped'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const organizationMembers = pgTable('organization_members', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').references(() => organizations.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  role: text('role').default('member').notNull(),
  joinedAt: timestamp('joined_at').defaultNow(),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').references(() => organizations.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  slug: text('slug').notNull(),
  gitProvider: gitProviderEnum('git_provider'),
  gitRepoUrl: text('git_repo_url'),
  gitBranch: text('git_branch').default('main'),
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: taskStatusEnum('status').default('backlog').notNull(),
  priority: taskPriorityEnum('priority').default('no_priority').notNull(),
  position: integer('position').default(0).notNull(),
  assigneeId: text('assignee_id').references(() => users.id),
  creatorId: text('creator_id').references(() => users.id).notNull(),
  opencodeCommand: text('opencode_command'),
  autoExecute: boolean('auto_execute').default(false),
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const taskExecutions = pgTable('task_executions', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  organizationId: integer('organization_id').references(() => organizations.id).notNull(),
  status: executionStatusEnum('status').default('pending').notNull(),
  command: text('command').notNull(),
  workingDirectory: text('working_directory').notNull(),
  pid: integer('pid'),
  containerId: text('container_id'),
  output: text('output'),
  outputPosition: integer('output_position').default(0),
  exitCode: integer('exit_code'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const gitIntegrations = pgTable('git_integrations', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  organizationId: integer('organization_id').references(() => organizations.id),
  provider: gitProviderEnum('provider').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  scope: text('scope'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  content: text('content'),
  data: jsonb('data'),
  read: boolean('read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

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

export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskExecution = typeof taskExecutions.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
