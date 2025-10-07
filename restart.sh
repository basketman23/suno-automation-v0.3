#!/bin/bash

# Suno Automation - Restart Script
# Kills any existing process on port 3000 and starts the server

echo "================================================"
echo "  Suno Automation - Restart"
echo "================================================"
echo ""

# Find process on port 3000
PID=$(lsof -ti:3000)

if [ -n "$PID" ]; then
  echo "Found existing process on port 3000 (PID: $PID)"
  echo "Stopping it..."
  kill $PID 2>/dev/null
  sleep 2
  echo "✅ Process stopped"
  echo ""
fi

echo "Starting Suno Automation server..."
echo ""
npm start
