# Client Deployment Guide

This guide explains how to deploy and update the React TV Dashboard application using Docker. The setup ensures that your data persists between updates.

## First-Time Installation

### Prerequisites

- Docker installed on your server
- Docker Compose installed (included with Docker Desktop)
- 1GB+ of free RAM
- 1GB+ of free disk space

### Installation Steps

1. **Create a project directory** on your server:

```bash
mkdir -p ~/react-tv-dashboard
cd ~/react-tv-dashboard
```

2. **Download the application files** (from the provided source or repository):

```bash
# If you received a ZIP file:
unzip dashboard.zip -d .

# If you have access to git repository:
git clone <repository-url> .
```

3. **Configure the application**

Create a `.env` file from the sample:

```bash
cp .env.sample .env
```

Edit the `.env` file and change at least these values:
- `SESSION_SECRET`: A random string for security (at least 32 characters)
- `ADMIN_PASSWORD`: Your admin password

You can generate secure random values with:
```bash
openssl rand -base64 32  # For SESSION_SECRET
openssl rand -base64 16  # For ADMIN_PASSWORD
```

4. **Start the application** using Docker Compose (recommended):

```bash
docker-compose up -d
```

5. **Verify installation** by visiting `http://your-server-ip:3000` in your web browser.

6. **Initial login** using:
   - Email: `you@example.com`
   - Password: The value you set for `ADMIN_PASSWORD`

### Alternative: Running with Docker run

If you prefer to use Docker run instead of Docker Compose:

```bash
# Create a named volume for data persistence
docker volume create dashboard-data

# Run the container with the volume
docker run -d \
  --name react-tv-dashboard \
  -p 3000:3000 \
  -v dashboard-data:/app/data \
  -e SESSION_SECRET=your-secure-secret \
  -e ADMIN_PASSWORD=your-secure-password \
  react-tv-dashboard
```

## Updating the Application

When a new version of the application is released, follow these steps to update:

1. **Navigate to your project directory**:

```bash
cd ~/react-tv-dashboard
```

2. **Download the updated files**:

```bash
# If you received a ZIP file:
# (Back up your .env first)
cp .env .env.backup
unzip -o dashboard.zip -d .
cp .env.backup .env

# If using git:
git pull
```

3. **Rebuild and restart** the application (Docker Compose):

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

For Docker run users:
```bash
# Stop and remove the old container (but keep the volume)
docker stop react-tv-dashboard
docker rm react-tv-dashboard

# Build the new image
docker build -t react-tv-dashboard .

# Run with the same volume to preserve data
docker run -d \
  --name react-tv-dashboard \
  -p 3000:3000 \
  -v dashboard-data:/app/data \
  -e SESSION_SECRET=your-secure-secret \
  -e ADMIN_PASSWORD=your-secure-password \
  react-tv-dashboard
```

## Important Notes About Updates

- Your database and all stored data will be preserved during updates as long as you:
  - Use Docker Compose with the provided docker-compose.yml file, OR
  - Use Docker run with the `-v dashboard-data:/app/data` volume option
- Any customizations to configuration files will need to be reapplied after updating
- Always back up your `.env` file before updating

## Database Backup and Restoration

### Creating a Backup

```bash
# Find container ID
docker ps

# Copy database file from container
docker cp <container_id>:/app/data/dev.db ./backup-$(date +%Y%m%d).db
```

### Restoring from Backup

```bash
# Stop the application
docker-compose down

# Create temporary container to restore data
docker run --rm -v dashboard-data:/data -v $(pwd):/backup alpine sh -c "cp /backup/your-backup-file.db /data/dev.db && chown 1000:1000 /data/dev.db"

# Start the application
docker-compose up -d
```

## Troubleshooting

### Viewing Logs

```bash
# View logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# View logs with docker run
docker logs react-tv-dashboard
```

### Accessing the Container

```bash
# Get container ID
docker ps

# Access shell
docker exec -it <container_id> /bin/bash
```

### Common Issues

1. **Application doesn't start**: Check logs for errors and ensure environment variables are set correctly

2. **Can't log in**: Verify your ADMIN_PASSWORD in the .env file, stop the application and remove the volume to reset:
   ```bash
   docker-compose down
   docker volume rm react-tv-dashboard_dashboard-data
   docker-compose up -d
   ```
   
3. **Port conflict**: If port 3000 is in use, change the port mapping in docker-compose.yml:
   ```yaml
   ports:
     - "8080:3000"  # Change 8080 to any available port
   ```

4. **Data not persisting between restarts**: Ensure you're using the volume correctly:
   - With docker-compose: check that the volume is defined in docker-compose.yml
   - With docker run: make sure you're using the `-v dashboard-data:/app/data` option