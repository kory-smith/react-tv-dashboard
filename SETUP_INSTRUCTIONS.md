# Setup Instructions

Follow these steps to run the React TV Dashboard:

## Prerequisites
- Install [Bun](https://bun.sh/) if you don't have it already
- Git

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd react-tv-dashboard
```

2. Install dependencies:
```bash
bun install
```

3. Setup the application:
```bash
bun run setup
```
This command will:
- Build the application
- Set up the database with migrations
- Seed the database with initial data

## Running the application

To start the development server:
```bash
bun run dev
```

The application should now be running at http://localhost:3000 (or the port shown in your terminal).

## Updating to new versions

When pulling updates, run:
```bash
git pull
bun install
bun run build
```

Your existing database will be preserved.

## Note for existing users

If you already have an existing database that you want to keep, no need to run the `setup` command. Just run:
```bash
git pull
bun install
bun run build
bun run dev
```

Your existing data will remain intact.