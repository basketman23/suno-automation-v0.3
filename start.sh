#!/bin/bash

# Suno Automation - Start Script
# This script starts the server and stops it when you press Ctrl+C

echo "🎵 Starting Suno Automation Server..."
echo ""

# Check if server is already running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 3000 is already in use. Stopping existing server..."
    pkill -f "node.*server.js"
    sleep 1
fi

# Trap Ctrl+C and cleanup
trap 'echo ""; echo "🛑 Stopping server..."; kill $SERVER_PID 2>/dev/null; exit 0' INT TERM

# Start the server in background
npm start &
SERVER_PID=$!

echo "✅ Server started (PID: $SERVER_PID)"
echo "🌐 URL: http://localhost:3000"
echo ""

# Wait for server to be ready (2 seconds)
sleep 2

# Open Chrome browser
echo "🌐 Opening Chrome browser..."
open -a "Google Chrome" "http://localhost:3000"

echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Wait for the server process
wait $SERVER_PID
