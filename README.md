# Credit Card Tracker

A personal credit card management application built with React, TypeScript, Tailwind CSS, and Supabase.

## Features

- Track multiple credit cards with full details
- Monitor payment due dates and history
- Categorize transactions per statement
- Milestone-based reward tracking
- Financial year analytics dashboard
- Upload statement files to Supabase Storage
- Mobile-friendly responsive design

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **UI:** shadcn/ui, Tailwind CSS, Radix UI
- **Backend:** Supabase (PostgreSQL + Storage)
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod

## Setup

### 1. Clone the repository

```sh
git clone <YOUR_GIT_URL>
cd Credit-card-tracker
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **anon/public API key** from Project Settings → API

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```sh
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
```

### 4. Run the database schema

Run the SQL schema in your Supabase project to create the required tables:

**Option A – Supabase Dashboard (SQL Editor):**
1. Open your Supabase project → SQL Editor
2. Paste the contents of `schema.sql` and click **Run**

**Option B – Supabase CLI:**
```sh
npx supabase db push
```

### 5. Start the development server

```sh
npm run dev
```

The app will be available at `http://localhost:8080`

## Scripts

```sh
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Lint code
npm run test       # Run tests
```

## Database Schema

The schema creates three tables:

- **`credit_cards`** – Card details, limits, billing cycles, reward milestones
- **`payments`** – Statement records with payment status and amounts
- **`transactions`** – Individual transactions per payment statement

See `schema.sql` for the full schema with RLS policies and indexes.
