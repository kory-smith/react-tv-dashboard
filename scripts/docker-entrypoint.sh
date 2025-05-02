#!/bin/bash
set -e

# Check if this is the first run by looking for the .initialized file
INIT_FLAG="/app/data/.initialized"
DB_FILE="/app/data/dev.db"

# Debug information
echo "📂 Checking data directory..."
ls -la /app/data || mkdir -p /app/data
echo "📂 Data directory status: $(ls -la /app/data)"

if [ ! -f "$INIT_FLAG" ]; then
    echo "🔧 First-time setup: Running initial database migration..."
    
    # Ensure the data directory exists
    mkdir -p /app/data
    
    # Create a symbolic link for the database
    if [ ! -f "$DB_FILE" ]; then
        # Generate the Prisma client
        bunx prisma generate
        
        # Run migrations
        DATABASE_URL="file:/app/data/dev.db" bunx prisma migrate deploy
        
        # Seed the database with initial data
        echo "🌱 Seeding database with initial data..."
        DATABASE_URL="file:/app/data/dev.db" bun app/lib/seed.ts
        
        # Mark as initialized
        touch "$INIT_FLAG"
        echo "✅ Initial setup complete!"
    fi
else
    echo "🔄 Database already initialized, checking for migrations..."
    
    # Always regenerate Prisma client in case schema changed
    bunx prisma generate
    
    # Run any pending migrations without wiping data
    DATABASE_URL="file:/app/data/dev.db" bunx prisma migrate deploy
    
    echo "✅ Database is up to date!"
fi

# Start the application
echo "🚀 Starting application..."
exec bun run start