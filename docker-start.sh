#!/bin/bash

# Oasis Docker Startup Script

echo "🐳 Starting Oasis with Docker..."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Create data directories if they don't exist
echo "📁 Creating data directories..."
mkdir -p backend/data/logs
mkdir -p backend/data/models

# Build and start containers
echo ""
echo "🔨 Building and starting containers..."
docker-compose up --build -d

# Wait for services to be ready
echo ""
echo "⏳ Waiting for services to start..."
sleep 5

# Check if containers are running
if docker ps | grep -q "oasis-backend"; then
    echo "✅ Backend is running on http://localhost:8000"
else
    echo "❌ Backend failed to start. Check logs with: docker logs oasis-backend"
fi

if docker ps | grep -q "oasis-frontend"; then
    echo "✅ Frontend is running on http://localhost:5173"
else
    echo "❌ Frontend failed to start. Check logs with: docker logs oasis-frontend"
fi

echo ""
echo "📊 Container status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "📝 Useful commands:"
echo "   View logs:     docker-compose logs -f"
echo "   Stop:          docker-compose down"
echo "   Restart:       docker-compose restart"
echo "   Backend logs:  docker logs -f oasis-backend"
echo "   Frontend logs: docker logs -f oasis-frontend"
echo ""
echo "🚀 Oasis is ready!"

