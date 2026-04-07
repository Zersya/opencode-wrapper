#!/bin/bash

# OpenCode Wrapper - Database Migration Script

set -e

echo "🗄️ Setting up database..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    if [ -f .env.local ]; then
        export $(grep -v '^#' .env.local | xargs)
    fi
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL is not set. Please set it in .env.local"
    exit 1
fi

echo "📦 Checking drizzle-kit version..."
npx drizzle-kit --version

echo "📊 Generating database migrations..."
npx drizzle-kit generate

echo "🚀 Pushing schema to database..."
npx drizzle-kit push

echo "✅ Database setup complete!"
