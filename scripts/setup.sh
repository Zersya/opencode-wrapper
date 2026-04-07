#!/bin/bash

# OpenCode Wrapper - Setup Script

set -e

echo "🚀 Setting up OpenCode Wrapper..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version 20+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✓ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy .env.example to .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from template..."
    cp .env.example .env.local
    echo "✓ Created .env.local - please edit it with your actual values"
else
    echo "✓ .env.local already exists"
fi

# Generate encryption key if not set
if grep -q "your-64-character-hex-key-here" .env.local; then
    echo "🔐 Generating encryption key..."
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    sed -i.bak "s/your-64-character-hex-key-here/$ENCRYPTION_KEY/g" .env.local
    rm .env.local.bak
    echo "✓ Generated encryption key"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your actual environment variables"
echo "2. Set up your PostgreSQL database"
echo "3. Run 'npm run db:push' to create database tables"
echo "4. Run 'npm run dev' to start the development server"
echo ""
echo "For more information, see README.md"
