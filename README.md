# My Expense Tracker

A multi-user expense tracker. Each user registers, logs in, and manages only their own income and expenses.

## Tech stack

| Part | Technology | Why |
|------|-----------|-----|
| Frontend | HTML, CSS, JavaScript, Chart.js | Runs in the browser, shows pages and charts |
| Backend | Node.js + Express | Checks login tokens and validates data before it reaches the database |
| Database + Auth | Supabase (PostgreSQL) | Stores users and transactions; Row Level Security keeps each user's data private |
| Hosting | Vercel (planned) | Serves the pages and runs the Express API as a serverless function |

## Folder structure

```
my-expense-tracker/
  frontend/          pages, CSS and browser JavaScript
  backend/src/       Express app (app.js, server.js, routes, middleware)
  api/index.js       entry point used by Vercel
  database/          schema.sql and policies.sql (run in Supabase)
  .env.example       template for your private settings
  package.json
  vercel.json
```

## Run locally

1. Install Node.js (LTS) from https://nodejs.org
2. In the project folder: `npm install`
3. Copy `.env.example` to `.env` and fill in your Supabase URL and anon key
4. In Supabase SQL Editor run `database/schema.sql`, then `database/policies.sql`
5. `npm start`, then open http://localhost:3000

## Security notes

- Never commit `.env`. It is listed in `.gitignore`.
- Only the Supabase URL and the public anon key are used. The service_role (secret) key is never used.
- `user_id` is taken from the verified login token on the server, not from the browser.
- Row Level Security in the database blocks access to other users' rows even if the app code had a bug.

## Known limitations

- Supabase free projects pause after 1 week of inactivity (resume from the dashboard).
- The app loads up to 1000 transactions per user at once (Supabase default row limit).
