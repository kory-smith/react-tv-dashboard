# Docker Instructions for React TV Dashboard

This application has been containerized using Docker. Below are instructions for running the application using Docker.

## Prerequisites

- Docker installed on your machine
- Docker Compose installed on your machine (included with Docker Desktop for Windows/Mac)

## Building and Running with Docker

### Option 1: Using Docker Compose (Recommended for Development)

1. Build and start the application:

```bash
docker-compose up -d
```

2. Access the application at http://localhost:3000

3. Stop the application:

```bash
docker-compose down
```

### Option 2: Using Docker directly

1. Build the Docker image:

```bash
docker build -t react-tv-dashboard .
```

2. Run the container:

```bash
docker run -p 3000:3000 \
  -e SESSION_SECRET=your-secure-session-secret \
  -e ADMIN_PASSWORD=your-secure-admin-password \
  react-tv-dashboard
```

3. Check container logs if you encounter issues:

```bash
docker logs [container_id]
```

3. Access the application at http://localhost:3000

## Database Persistence

The SQLite database is stored in the container. If you want to persist the database between container restarts:

1. Add a volume to the docker-compose.yml file:

```yaml
volumes:
  - ./prisma:/app/prisma  # This is already included in the default setup
```

## Deployment

The Docker image can be deployed to any platform that supports Docker containers:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway

## Customization

### Environment Variables

You can customize the application by providing environment variables:

```bash
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e SESSION_SECRET=your-secure-secret \
  -e ADMIN_PASSWORD=your-secure-admin-password \
  react-tv-dashboard
```

Or in your docker-compose.yml:

```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
  - SESSION_SECRET=your-secure-secret
  - ADMIN_PASSWORD=your-secure-admin-password
```

**Important security notes:** 
- Always set strong, unique values for both `SESSION_SECRET` and `ADMIN_PASSWORD` in production environments
- The default admin email is `you@example.com` with the password set in `ADMIN_PASSWORD`

## Troubleshooting

If you encounter issues:

1. Check if the container is running:
```bash
docker ps
```

2. View container logs:
```bash
docker logs <container_id>
```

3. For Docker Compose:
```bash
docker-compose logs
```