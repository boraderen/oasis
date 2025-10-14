#!/bin/bash

# Oasis Docker Stop Script

echo "🛑 Stopping Oasis containers..."
echo ""

docker-compose down

echo ""
echo "✅ All containers stopped and removed."
echo ""
echo "💡 To start again, run: ./docker-start.sh"

