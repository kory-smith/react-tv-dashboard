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

# Create D1 database (no --local flag supported for creation)
echo "Creating D1 database..."
DB_RESULT=$(wrangler d1 create react_tv_dashboard 2>&1)
echo "$DB_RESULT"

# Check if database creation worked or if database already exists
DB_ID=""

if [[ "$DB_RESULT" == *"database_id ="* ]]; then
    # Database was created successfully
    DB_ID=$(echo "$DB_RESULT" | grep -o 'database_id = "[^"]*"' | cut -d'"' -f2)
    echo "D1 database created with ID: $DB_ID"
elif [[ "$DB_RESULT" == *"already exists"* ]]; then
    # Database already exists, try to get the ID from wrangler.toml
    echo "Database already exists, checking wrangler.toml for database_id"
    EXISTING_DB_ID=$(grep -o 'database_id = "[^"]*"' wrangler.toml | head -1 | cut -d'"' -f2)
    
    if [[ "$EXISTING_DB_ID" != "placeholder-id" && -n "$EXISTING_DB_ID" ]]; then
        DB_ID=$EXISTING_DB_ID
        echo "Using existing database ID: $DB_ID"
    else
        echo "Could not find database ID in wrangler.toml. Please update manually."
        echo "Get your database ID using: wrangler d1 list"
        exit 1
    fi
else
    # Some other error
    echo "Failed to create D1 database."
    exit 1
fi

# Create KV namespace
echo "Creating KV namespace..."
KV_RESULT=$(wrangler kv namespace create SESSION_STORE 2>&1)
echo "$KV_RESULT"

# Extract KV ID if created
KV_ID=""
if [[ "$KV_RESULT" == *"id ="* ]]; then
    KV_ID=$(echo "$KV_RESULT" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
    echo "KV namespace created with ID: $KV_ID"
elif [[ "$KV_RESULT" == *"already exists"* ]]; then
    # KV namespace already exists, check wrangler.toml
    echo "KV namespace already exists, checking wrangler.toml for KV ID"
    EXISTING_KV_ID=$(grep -o 'id = "[^"]*"' wrangler.toml | head -1 | cut -d'"' -f2)
    
    if [[ "$EXISTING_KV_ID" != "placeholder-id" && -n "$EXISTING_KV_ID" ]]; then
        KV_ID=$EXISTING_KV_ID
        echo "Using existing KV namespace ID: $KV_ID"
    else
        echo "Could not find KV namespace ID in wrangler.toml. Please update manually."
        echo "Get your KV namespace ID using: wrangler kv namespace list"
        exit 1
    fi
else
    # Some other error
    echo "Failed to create KV namespace."
    exit 1
fi

# Update wrangler.toml if we have both IDs
if [[ -n "$DB_ID" && -n "$KV_ID" ]]; then
    # Update wrangler.toml
    sed -i.bak "s/database_id = \"[^\"]*\"/database_id = \"$DB_ID\"/" wrangler.toml
    sed -i.bak "s/id = \"[^\"]*\"/id = \"$KV_ID\"/" wrangler.toml
    rm -f wrangler.toml.bak
    
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
        wrangler d1 execute react_tv_dashboard --local --file=./d1/schema.sql
        wrangler d1 execute react_tv_dashboard --local --file=./d1/seed.sql
    fi
    
    echo "Setup complete!"
else
    echo "Missing required IDs, setup incomplete."
    exit 1
fi 