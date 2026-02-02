# Ops Desktop

Internal operations management web app for publishing/marketing teams. Replaces tools like Asana/Monday with a streamlined workflow based on "triggers" that create standardized work items.

## Features

- **Trigger-based workflows**: Submit simple forms that create work items with templated subtasks and due dates
- **Kanban board**: Drag-and-drop work items across status columns (Backlog → Ready → In Progress → Blocked → In Review → Needs QA → Done)
- **Advanced filtering**: Filter by owner, type, priority, due date range, overdue items, and blocked items
- **Dashboard**: KPIs, workload charts, and upcoming deadlines at a glance
- **Go High Level integration**: Bi-directional sync with inbound webhooks and outbound API calls
- **Admin panel**: Manage users, roles, trigger templates, and GHL integration settings
- **Role-based access**: Admin and Staff roles with appropriate permissions
- **Real-time updates**: Polling-based updates keep the board fresh (15-second intervals)

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth v5 with credentials (password) authentication
- **Charts**: Recharts
- **Logging**: Pino

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm
- PostgreSQL database

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your database URL and secrets

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed demo data (users + work items + templates)
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Demo Mode Login

After running the seed script, log in with:
- **Email**: Value of `ADMIN_EMAIL` env var (or default `you@gmail.com`)
- **Password**: Value of `SEED_ADMIN_PASSWORD` env var (or default `StrongAdminPass`)

Staff users can log in with:
- **Email**: Any email in `ALLOWED_EMAILS` env var
- **Password**: Value of `SEED_STAFF_PASSWORD` env var (or default `TempStaffPass`)

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```env
# =============================================================================
# REQUIRED
# =============================================================================

# Database connection string (PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ops_desktop?schema=public"

# NextAuth secret - generate with: openssl rand -base64 32
AUTH_SECRET="your-secret-here"

# NextAuth callback URL
AUTH_URL="http://localhost:3000"

# =============================================================================
# AUTHENTICATION
# =============================================================================

# Admin email (will be seeded as admin user)
ADMIN_EMAIL="admin@yourcompany.com"

# Comma-separated list of allowed email addresses
ALLOWED_EMAILS="admin@yourcompany.com,staff1@yourcompany.com,staff2@yourcompany.com"

# Seed passwords (change in production!)
SEED_ADMIN_PASSWORD="StrongAdminPass"
SEED_STAFF_PASSWORD="TempStaffPass"

# =============================================================================
# GO HIGH LEVEL INTEGRATION
# =============================================================================

# Webhook secret for verifying inbound webhooks
GHL_WEBHOOK_SECRET="your-webhook-secret"

# API key for outbound API calls
GHL_API_KEY="your-api-key"

# Your GHL location ID
GHL_LOCATION_ID="your-location-id"

# Enable outbound sync (set to "true" to enable)
GHL_OUTBOUND_ENABLED="false"

# =============================================================================
# EMAIL (for magic link auth - optional)
# =============================================================================

EMAIL_SERVER_HOST="smtp.ethereal.email"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="your-smtp-user"
EMAIL_SERVER_PASSWORD="your-smtp-password"
EMAIL_FROM="noreply@yourapp.com"

# =============================================================================
# APP CONFIG
# =============================================================================

# Demo mode for development
DEMO_MODE="true"

# Logging level (debug, info, warn, error)
LOG_LEVEL="debug"
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests (Vitest) |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema changes to database |
| `npm run db:migrate` | Run database migrations |
| `npm run db:migrate:prod` | Deploy migrations (production) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |

## Deployment

### Production Checklist

1. **Database**: Set up PostgreSQL (Fly Postgres, Supabase, Neon, Railway, etc.)
2. **Environment**: Configure all required environment variables
3. **Auth Secret**: Generate a secure `AUTH_SECRET` with `openssl rand -base64 32`
4. **Demo Mode**: Set `DEMO_MODE=false` in production
5. **Email**: Configure SMTP for magic link authentication (if using)
6. **GHL Webhook**: Configure webhook URL in GHL: `https://your-app.com/api/webhooks/ghl`
7. **Run migrations**: `npm run db:migrate:prod`

### Docker

```bash
# Build and run with Docker Compose
docker-compose up --build
```

### Fly.io

```bash
# Initial setup
fly launch --no-deploy

# Create Postgres database
fly postgres create

# Attach database to app
fly postgres attach --app your-app-name your-postgres-name

# Set secrets
fly secrets set AUTH_SECRET=$(openssl rand -base64 32) \
  ADMIN_EMAIL=admin@yourcompany.com \
  ALLOWED_EMAILS=admin@yourcompany.com \
  SEED_ADMIN_PASSWORD=SecurePassword123 \
  DEMO_MODE=false

# Deploy
fly deploy

# Run migrations
fly ssh console -C "npm run db:migrate:prod"

# Seed data (optional for production)
fly ssh console -C "npm run db:seed"
```

### Render / Railway / Heroku

1. Connect your GitHub repository
2. Set build command: `npm run build`
3. Set start command: `npm run start`
4. Add environment variables
5. Add PostgreSQL database add-on
6. Deploy and run migrations

## API Endpoints

### Work Items
- `GET /api/work-items` - List work items (filterable by status, owner, type)
- `POST /api/work-items` - Create work item
- `GET /api/work-items/:id` - Get work item with subtasks and comments
- `PATCH /api/work-items/:id` - Update work item
- `DELETE /api/work-items/:id` - Delete work item

### Subtasks
- `GET /api/work-items/:id/subtasks` - List subtasks
- `POST /api/work-items/:id/subtasks` - Create subtask
- `PATCH /api/subtasks/:id` - Update subtask (toggle completion)

### Comments
- `GET /api/work-items/:id/comments` - List comments
- `POST /api/work-items/:id/comments` - Add comment

### Templates (Admin)
- `GET /api/templates` - List trigger templates
- `POST /api/templates` - Create template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template

### Users (Admin)
- `GET /api/users` - List team members
- `PATCH /api/admin/users/:id/role` - Change user role
- `PATCH /api/admin/users/:id/password` - Reset user password

### Webhooks
- `POST /api/webhooks/ghl` - Go High Level webhook receiver

### Dashboard
- `GET /api/stats` - Dashboard statistics
- `GET /api/admin/integration-events` - GHL integration logs (admin only)

## Work Item Types

| Type | Description | Default Due |
|------|-------------|-------------|
| Book Campaign | Full marketing cycle for a new title | Publication date |
| Social Asset Request | Graphics or copy for social media | 14 days before campaign or 7 days |
| Sponsored Editorial Review | Process a paid review request | 30 days after receipt |
| TX Book Preview Lead | Texas Book Preview author lead | 14 days |
| Website Event | Add event to the calendar | 3 days before event |
| Access Request | System login or permissions | 2 days |
| General | Miscellaneous tasks | 7 days |

## Project Structure

```
ops-desktop/
├── prisma/
│   ├── schema.prisma    # Database schema
│   ├── migrations/      # Database migrations
│   └── seed.ts          # Demo data seeder
├── src/
│   ├── app/
│   │   ├── (app)/       # Authenticated routes
│   │   │   ├── page.tsx         # Dashboard
│   │   │   ├── board/           # Kanban board
│   │   │   ├── trigger/         # New trigger form
│   │   │   └── admin/           # Admin console
│   │   │       └── templates/   # Template management
│   │   ├── api/         # API routes
│   │   │   ├── work-items/
│   │   │   ├── templates/
│   │   │   ├── webhooks/ghl/
│   │   │   └── admin/
│   │   └── auth/        # Auth pages
│   ├── components/      # React components
│   └── lib/
│       ├── auth.ts      # NextAuth config
│       ├── db.ts        # Prisma client
│       ├── ghl/         # GHL integration module
│       │   ├── client.ts     # API client
│       │   ├── mappings.ts   # Type mappings
│       │   └── sync.ts       # Sync service
│       ├── hooks.ts     # React hooks + API client
│       ├── logger.ts    # Pino logger
│       ├── utils.ts     # Utility functions
│       └── validations.ts  # Zod schemas
└── tests/               # Vitest tests
```

## GHL Integration

### Inbound Webhooks

Configure your GHL webhook to point to `/api/webhooks/ghl`. The webhook handler:

1. Verifies signature using `GHL_WEBHOOK_SECRET` (via HMAC-SHA256)
2. Logs all events to `integration_events` table
3. Automatically creates work items for certain event types (e.g., `ContactCreate`)

### Outbound Sync (Feature-Flagged)

When `GHL_OUTBOUND_ENABLED=true`, the app can:

1. Create/update contacts in GHL when work items change
2. Create/update opportunities for campaigns
3. Link GHL records to work items for tracking

Configure mappings in `src/lib/ghl/mappings.ts`.

## TODOs / Nice-to-Have

- [ ] Real-time websocket updates (replace polling)
- [ ] Slack notifications for status changes
- [ ] File upload attachments
- [ ] Work item detail page (full page, not modal)
- [ ] Calendar view for due dates
- [ ] Export to CSV/PDF
- [ ] Time tracking
- [ ] Custom fields per work item type
- [ ] Recurring tasks / deadlines
- [ ] Email notifications for assignments

## License

Private - Internal use only
