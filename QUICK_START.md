# React TV Dashboard - Quick Start Guide

This guide provides simple instructions for running the React TV Dashboard application without needing to type complex Docker commands.

## Prerequisites

You must have Docker installed on your computer:
- Windows: [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
- Mac: [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)
- Linux: [Docker Engine](https://docs.docker.com/engine/install/)

## Starting the Dashboard (One-Click)

### For Windows Users

1. Double-click the `start-dashboard.bat` file
2. Wait for the application to start (this might take a few minutes the first time)
3. Open your web browser and go to: http://localhost:3000

### For Mac/Linux Users

1. Open Terminal in the application folder
2. Make scripts executable if needed: `chmod +x *.sh`
3. Run: `./start-dashboard.sh`
4. Wait for the application to start (this might take a few minutes the first time)
5. Open your web browser and go to: http://localhost:3000

## Logging In

The default login credentials are:
- Email: you@example.com
- Password: admin123 (unless you changed it in the .env file)

**IMPORTANT**: For security, you should change the default password after first login.

## Stopping the Dashboard

### For Windows Users
- Double-click the `stop-dashboard.bat` file

### For Mac/Linux Users
- Run: `./stop-dashboard.sh`

## Viewing Logs

If you need to see the application logs (for troubleshooting):

### For Windows Users
- Double-click the `show-logs.bat` file

### For Mac/Linux Users
- Run: `./show-logs.sh`

## Data Persistence

Your data is automatically saved in a Docker volume called `dashboard-data`. This means:

1. Your data is preserved even when you stop and restart the application
2. Your data is preserved when you update the application
3. Updates to the application code won't affect your existing data

## Getting Updates

When you receive updates to the application:

1. Stop the dashboard
2. Replace the application files with the new version (keep your .env file)
3. Start the dashboard again using the same script

## Troubleshooting

If the dashboard doesn't start:

1. Check that Docker is running
2. View the logs to see any error messages
3. Contact support if you continue to have issues

For more detailed information, see the full documentation in CLIENT_DEPLOYMENT.md.