# Setup Guide

## Prerequisites

- **Node.js** 20+ and **pnpm** package manager
- **PostgreSQL** 15+ running locally or remotely
- A terminal (PowerShell, CMD, or bash)

## 1. Clone the repository

```bash
git clone <repository-url>
cd food
```

## 2. Backend setup

### Install dependencies

```bash
cd backend
pnpm install
```

### Configure environment

Create a `.env` file in the `backend/` directory:

```env
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=pizzastore

# Auth
JWT_SECRET=your_jwt_secret_here

# Frontend URL (for CORS and Socket.IO)
FE_URL=http://localhost:3150

# Razorpay (configure all three together when online payments are enabled)
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your_test_key_secret
RAZORPAY_WEBHOOK_SECRET=your_test_webhook_secret
```

All variables are validated at startup via Zod. The server will not start if any required variable is missing or invalid.

#### Environment variable reference

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | Yes | Server port (must be exactly 4 digits, e.g. `3000`) |
| `DB_HOST` | No* | PostgreSQL host |
| `DB_PORT` | No* | PostgreSQL port |
| `DB_USER` | No* | PostgreSQL username |
| `DB_PASSWORD` | No* | PostgreSQL password |
| `DB_NAME` | No* | PostgreSQL database name |
| `DATABASE_URL` | No* | Full connection URL (alternative to individual DB_* vars) |
| `JWT_SECRET` | Yes | Secret key for signing JSON Web Tokens |
| `FE_URL` | Yes | Frontend origin URL for CORS configuration |
| `RAZORPAY_KEY_ID` | No** | Public Razorpay Test/Live Key ID |
| `RAZORPAY_KEY_SECRET` | No** | Server-only Razorpay API key secret |
| `RAZORPAY_WEBHOOK_SECRET` | No** | Server-only secret used to validate webhook signatures |

\* Either `DATABASE_URL` or the individual `DB_*` variables must be provided.

\** Razorpay variables may be omitted while the application is COD-only. If any one is set, all three are required. Use separate Test and Live credentials, and never expose either secret to the frontend.

### Create the database

```bash
# Using psql
psql -U postgres -c "CREATE DATABASE pizzastore;"
```

### Apply the schema

```bash
npx drizzle-kit push
```

This uses the Drizzle configuration in `drizzle.config.ts` to push the schema defined in `src/db/schema.ts` directly to the database.

### Seed test data (optional)

The project includes seed scripts in `src/scripts/`:

```bash
# Seed users (creates test user and admin accounts)
pnpm run seed:users

# Seed addresses for test users
pnpm run seed:addresses

# Seed sample orders with items and customizations
pnpm run seed:orders
```

### Start the development server

```bash
pnpm run dev
```

The backend will start on `http://localhost:3000` (or whatever `PORT` is set to). The API is available at `http://localhost:3000/api/v1/`.

## 3. Frontend setup

### Install dependencies

```bash
cd frontend
pnpm install
```

### Configure environment

Create a `.env` file in the `frontend/` directory:

```env
VITE_BACKEND_URL=http://localhost:3000
```

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_BACKEND_URL` | Yes | Base URL of the backend API server |

### Start the development server

```bash
pnpm run dev
```

The frontend will start on `http://localhost:3150`. It connects to the backend URL specified in `.env`.

## 4. Verify the setup

1. Open `http://localhost:3150` in a browser.
2. You should see the PizzaStore home page with the menu section.
3. Register a new account or log in with a seeded user.
4. Browse products, add items to cart, and test the checkout flow.

### Access the admin panel

1. Log in with an admin account (created via seeding or by manually setting `role = 'admin'` in the database).
2. Navigate to `/admin` in the browser.
3. You should see the admin dashboard with metrics and charts.

## 5. Available scripts

### Backend (`backend/package.json`)

| Script | Command | Description |
| --- | --- | --- |
| `dev` | `tsx watch src/index.ts` | Start dev server with hot reload |
| `seed:users` | `tsx src/scripts/users.ts` | Seed user accounts |
| `seed:addresses` | `tsx src/scripts/address.ts` | Seed delivery addresses |
| `seed:orders` | `tsx src/scripts/order.ts` | Seed sample orders |

### Frontend (`frontend/package.json`)

| Script | Command | Description |
| --- | --- | --- |
| `dev` | `vite --port 3150` | Start Vite dev server |
| `build` | `tsc -b && vite build` | Type-check and build for production |
| `lint` | `eslint .` | Run ESLint |
| `preview` | `vite preview` | Preview production build locally |

## 6. Database migrations

To generate a new migration after changing `src/db/schema.ts`:

```bash
npx drizzle-kit generate
```

To apply pending migrations:

```bash
npx drizzle-kit push
```

To open Drizzle Studio (visual database browser):

```bash
npx drizzle-kit studio
```

## File upload directory

Product and menu images are uploaded to `backend/uploads/`. This directory is created automatically on first upload and served statically by Express. It is excluded from version control via `.gitignore`.

## Troubleshooting

### "Access denied, no token provided"
The request requires authentication. Ensure you're logged in and the `Authorization: Bearer <token>` header is being sent.

### Database connection errors
Verify that PostgreSQL is running and the credentials in `.env` match your database configuration. Test with `psql -U <user> -d <dbname>`.

### CORS errors in the browser
Ensure `FE_URL` in the backend `.env` matches the exact origin of your frontend (including protocol and port).

### Images not loading
Verify the `VITE_BACKEND_URL` in the frontend `.env` points to the correct backend URL. Images are served from `<backend-url>/uploads/<filename>`.
