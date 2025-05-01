# React TV Dashboard with Cloudflare Workers and D1

This project is a TV dashboard application built with React for the frontend and Cloudflare Workers with D1 for the backend. It features employee performance tracking, scoring, and trend analysis.

## Features

- **User Authentication**: Secure login/logout with role-based access control
- **Employee Management**: Create, read, update, and delete employee records
- **Performance Tracking**: Score tracking with historical trend data
- **Dashboard Views**: Visualize employee performance metrics
- **Wrong Number Tracking**: Track and impact scores based on wrong numbers

## Technology Stack

- **Frontend**: React, React Router, TailwindCSS, Recharts
- **Backend**: Cloudflare Workers, D1 (SQLite-compatible database)
- **Authentication**: Session-based authentication with KV store
- **Deployment**: Cloudflare Pages and Workers

## Local Development Setup

### Prerequisites

- Node.js 18+
- Bun (for package management)
- Wrangler CLI (for Cloudflare Workers development)

### Initial Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd react-tv-dashboard
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Configure Wrangler**:
   If you haven't already, install and authenticate the Wrangler CLI:
   ```bash
   bun add -g wrangler
   wrangler login
   ```

4. **Create local D1 database**:
   ```bash
   wrangler d1 create react_tv_dashboard
   ```
   
   Update the `wrangler.toml` file with your database ID:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "react_tv_dashboard"
   database_id = "<your-db-id>" # Replace with actual DB ID
   ```

5. **Create KV namespace**:
   ```bash
   wrangler kv:namespace create SESSION_STORE
   ```
   
   Update the `wrangler.toml` file with your KV namespace ID:
   ```toml
   [[kv_namespaces]]
   binding = "SESSION_STORE"
   id = "<your-kv-id>" # Replace with actual KV ID
   ```

6. **Initialize the database schema**:
   ```bash
   wrangler d1 execute react_tv_dashboard --file=./d1/schema.sql
   ```

7. **Seed the database with test data**:
   ```bash
   wrangler d1 execute react_tv_dashboard --file=./d1/seed.sql
   ```

### Running Locally

1. **Start the development server**:
   ```bash
   bun run dev
   ```

2. **Open your browser** to http://localhost:8788

## Deployment

### Deploy to Cloudflare

1. **Build the application**:
   ```bash
   bun run build
   ```

2. **Deploy to Cloudflare Workers**:
   ```bash
   wrangler deploy
   ```

### Database Migrations in Production

1. **Create a new migration file** in `d1/migrations/` with a timestamp prefix (e.g., `0001_add_new_field.sql`)

2. **Apply the migration to production**:
   ```bash
   wrangler d1 execute react_tv_dashboard --file=./d1/migrations/0001_add_new_field.sql
   ```

## Project Structure

```
react-tv-dashboard/
├── app/                  # React application code
│   ├── routes/           # React Router routes
│   ├── components/       # React components
│   └── hooks/            # Custom React hooks
├── d1/                   # D1 database files
│   ├── migrations/       # Database migrations
│   ├── schema.sql        # Database schema
│   └── seed.sql          # Seed data
├── src/                  # Worker code
│   ├── auth/             # Authentication logic
│   ├── db/               # Database access layer
│   ├── routes/           # API routes
│   ├── types.ts          # TypeScript type definitions
│   └── worker.ts         # Main worker entry point
├── public/               # Static assets
├── wrangler.toml         # Wrangler configuration
└── package.json          # Project dependencies
```

## Authentication

The application uses session-based authentication with Cloudflare Workers KV store for session storage. Passwords are hashed using bcryptjs.

Default admin credentials:
- Email: admin@example.com
- Password: password123

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/me` - Get current user info

### User Management
- `GET /api/users` - List all users (admin only)
- `POST /api/users` - Create a user (admin only)
- `GET /api/users/:id` - Get a specific user
- `PUT /api/users/:id` - Update a user
- `DELETE /api/users/:id` - Delete a user (admin only)

### Employee Management
- `GET /api/employees` - List all employees
- `POST /api/employees` - Create an employee
- `GET /api/employees/:id` - Get a specific employee
- `PUT /api/employees/:id` - Update an employee
- `DELETE /api/employees/:id` - Delete an employee

### Score Management
- `GET /api/employees/:id/score` - Get an employee's score
- `PUT /api/employees/:id/score` - Update an employee's score
- `POST /api/employees/:id/wrong-number` - Increment wrong number count
- `GET /api/dashboard` - Get dashboard data

### Trend Tracking
- `GET /api/employees/:id/trends` - Get an employee's trend points

## License

[MIT](LICENSE)
