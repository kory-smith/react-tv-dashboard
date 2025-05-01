#!/bin/bash

# This script sets up the D1 database for development and production

# Check for wrangler
if ! command -v wrangler &> /dev/null; then
    echo "Error: wrangler is required but not installed."
    echo "Install it with: bun add -g wrangler"
    exit 1
fi

# Default to development mode
MODE="dev"

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --prod) MODE="prod";;
        --dev) MODE="dev";;
        *) echo "Unknown parameter: $1"; exit 1;;
    esac
    shift
done

echo "Running in $MODE mode"

# Create D1 database
if [ "$MODE" = "prod" ]; then
    echo "Creating production D1 database..."
    RESULT=$(wrangler d1 create react_tv_dashboard 2>&1)
else
    echo "Creating local D1 database..."
    RESULT=$(wrangler d1 create react_tv_dashboard --local 2>&1)
fi

echo "$RESULT"

# Extract database_id if created
if [[ "$RESULT" == *"database_id ="* ]]; then
    DB_ID=$(echo "$RESULT" | grep -o 'database_id = "[^"]*"' | cut -d'"' -f2)
    echo "D1 database created with ID: $DB_ID"
    
    # Create KV namespace
    if [ "$MODE" = "prod" ]; then
        echo "Creating production KV namespace..."
        KV_RESULT=$(wrangler kv:namespace create SESSION_STORE 2>&1)
    else
        echo "Creating local KV namespace..."
        KV_RESULT=$(wrangler kv:namespace create SESSION_STORE --preview 2>&1)
    fi
    
    echo "$KV_RESULT"
    
    # Extract KV ID if created
    if [[ "$KV_RESULT" == *"id ="* ]]; then
        KV_ID=$(echo "$KV_RESULT" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
        echo "KV namespace created with ID: $KV_ID"
        
        # Update wrangler.toml
        sed -i.bak "s/database_id = \"placeholder-id\"/database_id = \"$DB_ID\"/" wrangler.toml
        sed -i.bak "s/id = \"placeholder-id\"/id = \"$KV_ID\"/" wrangler.toml
        rm wrangler.toml.bak
        
        echo "Updated wrangler.toml with database and KV IDs"
        
        # Apply database schema
        echo "Applying database schema..."
        if [ "$MODE" = "prod" ]; then
            wrangler d1 execute react_tv_dashboard --file=./d1/schema.sql
        else
            wrangler d1 execute react_tv_dashboard --local --file=./d1/schema.sql
        fi
        
        # Apply database seed data
        echo "Seeding database..."
        if [ "$MODE" = "prod" ]; then
            wrangler d1 execute react_tv_dashboard --file=./d1/seed.sql
        else
            wrangler d1 execute react_tv_dashboard --local --file=./d1/seed.sql
        fi
        
        echo "Setup complete!"
    else
        echo "Failed to create KV namespace"
        exit 1
    fi
else
    echo "Failed to create D1 database or database already exists"
    exit 1
fi 