#!/bin/bash
# React TV Dashboard Shutdown Script for Mac/Linux

echo "==================================="
echo " React TV Dashboard Shutdown Script"
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

echo "Stopping React TV Dashboard..."
if ! docker stop react-tv-dashboard &> /dev/null; then
  echo "React TV Dashboard is not running."
else
  echo "React TV Dashboard has been stopped."
fi

echo ""
echo "You can start it again by running: ./start-dashboard.sh"
echo ""
read -p "Press Enter to exit..."