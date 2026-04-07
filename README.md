# OpenCode Wrapper

A Linear-like project management platform with multi-user kanban boards and server-side opencode CLI execution.

## Features

- **Multi-tenant Organization Support**: Isolated environments per organization
- **Kanban Boards**: Drag-and-drop task management with @dnd-kit
- **CLI Execution Engine**: Docker-isolated environments for running opencode commands
- **Real-time Terminal Output**: Polling-based output streaming
- **Git Integration**: GitHub and GitLab repository management
- **Clerk Authentication**: OAuth with GitHub/GitLab

## Tech Stack

- **Frontend**: Next.js 14 App Router + TypeScript + shadcn/ui + Tailwind CSS
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Clerk with GitHub/GitLab OAuth
- **CLI Execution**: Docker + Node.js child_process
- **Deployment**: Railway + Coolify with Docker

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Docker (for CLI execution isolation)
- Clerk account for authentication

### Environment Variables

Create a `.env.local` file with:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/opencode"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."

# Encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY="..."

# Git OAuth (optional)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GITLAB_CLIENT_ID=""
GITLAB_CLIENT_SECRET=""

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Installation

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

### Docker Deployment

```bash
docker-compose up -d
```

## Project Structure

```
├── app/
│   ├── (app)/           # Authenticated app routes
│   │   ├── dashboard/   # Dashboard home
│   │   ├── projects/    # Project kanban boards
│   │   ├── tasks/       # Task detail views
│   │   ├── executions/  # CLI execution details
│   │   ├── inbox/       # Notifications
│   │   ├── issues/      # My issues
│   │   └── settings/    # Settings pages
│   ├── (auth)/          # Auth pages
│   └── api/             # API routes
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── layout/          # Sidebar, header, command palette
│   ├── kanban/          # Kanban board components
│   ├── tasks/           # Task components
│   ├── terminal/        # Terminal output viewer
│   └── git/             # Git integration components
├── lib/
│   ├── db/              # Database schema and client
│   ├── actions/         # Server actions
│   ├── server/          # Server utilities
│   └── git/             # Git API clients
└── types/               # TypeScript declarations
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:generate` - Generate database migrations
- `npm run db:push` - Push schema to database
- `npm run db:studio` - Open Drizzle Studio

## License

MIT
