# React TV Dashboard

A TV dashboard for displaying employee performance metrics.

## Features

- User authentication with role-based access control
- Employee performance tracking
- Real-time score updates
- Trend visualization
- Responsive design for TV displays

## Tech Stack

- [Bun](https://bun.sh) - JavaScript runtime
- [Hono](https://hono.dev) - Web framework
- [SQLite](https://www.sqlite.org) - Database
- [React](https://react.dev) - UI library
- [TypeScript](https://www.typescriptlang.org) - Type safety

## Getting Started

1. Install dependencies:

```bash
bun install
```

2. Start the development server:

```bash
bun run dev
```

3. Open your browser and navigate to `http://localhost:3000`

## Development

The project uses Bun as the JavaScript runtime and package manager. The development server uses SQLite for local development.

### Database

The database schema is defined in `src/db/schema.ts`. The database is initialized and seeded with sample data when the development server starts.

### API Routes

- `GET /api/users` - Get all users
- `GET /api/employees` - Get all employees
- `GET /api/scores` - Get all scores
- `GET /api/trends` - Get all trend points

## Deployment

The project can be deployed to any platform that supports Bun. For production deployment, you'll need to:

1. Build the project:

```bash
bun run build
```

2. Start the production server:

```bash
bun run start
```

## License

MIT
