#!/bin/bash
# React TV Dashboard Starter Script for Mac/Linux

echo "==================================="
echo " React TV Dashboard Startup Script"
echo "==================================="
echo ""

install_docker_mac() {
  echo "Attempting to install Docker on macOS..."
  if command -v brew &> /dev/null; then
    echo "Installing Docker using Homebrew..."
    brew install --cask docker
    echo "Docker Desktop installed. Please open Docker Desktop application and follow setup."
    echo "Then run this script again."
    read -p "Press Enter to exit..."
    exit 0
  else
    echo "Homebrew not found. Installing Homebrew first..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [ $? -eq 0 ]; then
      echo "Homebrew installed. Installing Docker Desktop..."
      brew install --cask docker
      echo "Docker Desktop installed. Please open Docker Desktop application and follow setup."
      echo "Then run this script again."
    else
      echo "Failed to install Homebrew. Please install Docker Desktop manually from:"
      echo "https://www.docker.com/products/docker-desktop"
    fi
    read -p "Press Enter to exit..."
    exit 0
  fi
}

install_docker_linux() {
  echo "Attempting to install Docker on Linux..."
  # Try to detect the Linux distribution
  if command -v apt-get &> /dev/null; then
    # Debian/Ubuntu
    echo "Detected Debian/Ubuntu. Installing Docker..."
    sudo apt-get update
    sudo apt-get install -y docker.io
    sudo systemctl enable --now docker
    sudo usermod -aG docker $USER
    echo "Docker installed. You may need to log out and back in for group changes to take effect."
  elif command -v dnf &> /dev/null; then
    # Fedora/RHEL/CentOS
    echo "Detected Fedora/RHEL/CentOS. Installing Docker..."
    sudo dnf -y install dnf-plugins-core
    sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
    sudo dnf -y install docker-ce docker-ce-cli containerd.io
    sudo systemctl enable --now docker
    sudo usermod -aG docker $USER
    echo "Docker installed. You may need to log out and back in for group changes to take effect."
  else
    echo "Could not detect package manager. Please install Docker manually from:"
    echo "https://docs.docker.com/engine/install/"
    read -p "Press Enter to exit..."
    exit 1
  fi
  echo "Please restart this script after logging out and back in."
  read -p "Press Enter to exit..."
  exit 0
}

install_git() {
  echo "Attempting to install Git..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if command -v brew &> /dev/null; then
      brew install git
    else
      echo "Homebrew not found. Please install Git manually from:"
      echo "https://git-scm.com/download/mac"
      read -p "Press Enter to exit..."
      exit 1
    fi
  else
    # Linux
    if command -v apt-get &> /dev/null; then
      sudo apt-get update
      sudo apt-get install -y git
    elif command -v dnf &> /dev/null; then
      sudo dnf install -y git
    else
      echo "Could not detect package manager. Please install Git manually from:"
      echo "https://git-scm.com/download/linux"
      read -p "Press Enter to exit..."
      exit 1
    fi
  fi
  echo "Git installed successfully."
}

# Check if Git is installed
if ! command -v git &> /dev/null; then
  echo "Git is not installed."
  install_git
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo "Docker is not installed or not in your PATH!"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    install_docker_mac
  else
    # Linux
    install_docker_linux
  fi
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