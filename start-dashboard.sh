#!/bin/bash
# React TV Dashboard Starter Script for Mac/Linux

echo "==================================="
echo " React TV Dashboard Startup Script"
echo "==================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo "Docker is not installed or not in your PATH!"
  echo "Please install Docker from https://www.docker.com/products/docker-desktop"
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi

# Check Docker service
if ! docker info &> /dev/null; then
  echo "Docker service is not running!"
  echo "Please start Docker first."
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi

echo "Checking for existing dashboard..."
if docker ps -a | grep react-tv-dashboard &> /dev/null; then
  echo "Found existing dashboard container - stopping and removing it..."
  docker stop react-tv-dashboard &> /dev/null
  docker rm react-tv-dashboard &> /dev/null
fi

echo "Creating data volume if needed..."
if ! docker volume inspect dashboard-data &> /dev/null; then
  echo "Creating dashboard data volume..."
  docker volume create dashboard-data &> /dev/null
fi

echo "Building the application container..."
echo "(This might take a few minutes the first time)"
docker build -t react-tv-dashboard . &> /dev/null

# Check if .env file exists, create it if it doesn't
if [ ! -f .env ]; then
  echo "Creating default .env file..."
  cat > .env << EOF
SESSION_SECRET=default-secret-please-change-in-production
ADMIN_PASSWORD=admin123
EOF
  echo "Created .env file with default credentials:"
  echo "  Admin Email: you@example.com"
  echo "  Admin Password: admin123"
  echo ""
  echo "NOTE: Please change these in the .env file for security!"
else
  echo "Using existing .env configuration."
fi

# Read values from .env file
source .env

echo "Starting React TV Dashboard..."
docker run -d --name react-tv-dashboard -p 3000:3000 \
  -v dashboard-data:/app/data \
  -e SESSION_SECRET="${SESSION_SECRET}" \
  -e ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
  --restart unless-stopped \
  react-tv-dashboard &> /dev/null

# Check if container started successfully
sleep 3
if ! docker ps | grep react-tv-dashboard &> /dev/null; then
  echo "Failed to start the dashboard! Showing logs:"
  docker logs react-tv-dashboard
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi

echo "====================================================="
echo " React TV Dashboard is running!"
echo " Open http://localhost:3000 in your web browser"
echo ""
echo " Login with:"
echo "   Email: you@example.com"
echo "   Password: See ADMIN_PASSWORD in .env file"
echo "====================================================="
echo ""
echo "To stop the dashboard, run: ./stop-dashboard.sh"
echo "To view logs, run: ./show-logs.sh"
echo ""
read -p "Press Enter to exit..."