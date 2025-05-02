#!/bin/bash
# React TV Dashboard Logs Script for Mac/Linux

echo "====================================="
echo " React TV Dashboard Logs"
echo "====================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo "Docker is not installed or not in your PATH!"
  echo "Please install Docker from https://www.docker.com/products/docker-desktop"
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi

echo "Checking if dashboard is running..."
if ! docker ps | grep react-tv-dashboard &> /dev/null; then
  echo "React TV Dashboard is not running."
  echo "Please start it first with ./start-dashboard.sh"
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi

echo "Showing logs for React TV Dashboard..."
echo "(Press Ctrl+C to exit)"
echo ""
docker logs -f react-tv-dashboard