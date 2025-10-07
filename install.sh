#!/bin/bash

# Suno Automation - Installation Script
echo "================================================"
echo "  Suno Automation System - Installation"
echo "================================================"
echo ""

# Check Node.js version
echo "Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js 18 or higher from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version is too old (found v$NODE_VERSION, need v18+)"
    echo "Please upgrade Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version $(node -v) detected"
echo ""

# Install dependencies
echo "Installing Node.js dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ npm install failed!"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Install Playwright browsers
echo "Installing Playwright Chromium browser..."
npx playwright install chromium

if [ $? -ne 0 ]; then
    echo "❌ Playwright installation failed!"
    exit 1
fi

echo "✅ Playwright installed"
echo ""

# Create necessary directories
echo "Creating directories..."
mkdir -p downloads
mkdir -p playwright/.auth

echo "✅ Directories created"
echo ""

# Setup complete
echo "================================================"
echo "  Installation Complete! 🎉"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Start the server: npm start"
echo "  2. Open your browser: http://localhost:3000"
echo "  3. Configure settings and create your first song!"
echo ""
echo "For more information, see README.md"
echo ""
