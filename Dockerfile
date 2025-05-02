FROM oven/bun:1-debian as base

# Install Node.js and necessary packages
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs curl sqlite3 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.json and lockfile
COPY package.json bun.lock ./

# Install dependencies
RUN bun install

# Copy application code
COPY . .

# Build the application
RUN bun run build

# Make entrypoint script executable
RUN chmod +x ./scripts/docker-entrypoint.sh

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV SESSION_SECRET="change-me-in-production-this-is-just-a-default-secret"
ENV ADMIN_PASSWORD="change-me-in-production-default-admin-password"
ENV DATABASE_URL="file:/app/data/dev.db"

# Create volume for persistent data
VOLUME /app/data

# Expose the port
EXPOSE 3000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Use the entrypoint script
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]