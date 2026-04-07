#!/bin/bash

# OpenCode Wrapper - Development Start Script

set -e

echo "🏃 Starting OpenCode Wrapper development server..."

# Load environment variables
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs)
fi

# Check if database is running
if ! pg_isready -q 2>/dev/null; then
    echo "⚠️  PostgreSQL doesn't seem to be running. Make sure your database is available."
fi

# Start dev server
echo "🌐 Starting Next.js development server..."
npm run dev
