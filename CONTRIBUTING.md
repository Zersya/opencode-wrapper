# Contributing to OpenCode Wrapper

Thank you for your interest in contributing to OpenCode Wrapper! This document provides guidelines and information for contributors.

## Development Setup

### Quick Start

```bash
# Run the automated setup script
./scripts/setup.sh

# Or manually:
npm install
cp .env.example .env.local
# Edit .env.local with your values
npm run db:push
npm run dev
```

### Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
- `CLERK_SECRET_KEY` - Clerk secret key
- `ENCRYPTION_KEY` - Generate with `openssl rand -hex 32`

Optional:
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - GitHub OAuth
- `GITLAB_CLIENT_ID` / `GITLAB_CLIENT_SECRET` - GitLab OAuth

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── (app)/             # Authenticated routes
│   ├── (auth)/            # Auth pages
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/                # shadcn/ui components
│   ├── layout/            # Layout components
│   ├── kanban/            # Kanban board
│   ├── tasks/             # Task components
│   ├── terminal/          # Terminal output
│   └── git/               # Git integration
├── lib/                   # Utilities & server code
│   ├── db/                # Database schema & client
│   ├── actions/           # Server actions
│   ├── server/            # Server utilities
│   └── git/               # Git API clients
├── scripts/               # Development scripts
└── types/                 # TypeScript declarations
```

## Code Style

### TypeScript

- Use strict TypeScript settings
- Define types for all props and function parameters
- Use `interface` for object shapes, `type` for unions/complex types

### Components

- Use functional components with hooks
- Keep components focused and single-responsibility
- Use composition over inheritance
- Prefix custom hooks with `use`

### Server Actions

- Always validate input with Zod
- Use proper error handling with try-catch
- Return meaningful error messages
- Revalidate paths after mutations

### Database

- Use Drizzle ORM for all database operations
- Define relations in schema
- Use transactions for multi-table operations
- Never expose raw SQL to client

## Testing

```bash
# Run linting
npm run lint

# Build for production
npm run build
```

## Commit Messages

Follow conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting
- `refactor:` - Code restructuring
- `test:` - Tests
- `chore:` - Maintenance

Example:
```
feat: add real-time execution output streaming

- Implement polling-based output updates
- Add terminal component with syntax highlighting
- Create execution detail page
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run linting and build
5. Commit with conventional commit messages
6. Push to your fork
7. Open a Pull Request

### PR Requirements

- Clear description of changes
- Screenshots for UI changes
- Updated documentation if needed
- All checks passing

## Code Review

- Be respectful and constructive
- Explain the "why" behind suggestions
- Approve when satisfied, request changes when needed

## Getting Help

- Open an issue for bugs or feature requests
- Join discussions for questions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
