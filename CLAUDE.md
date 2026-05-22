# StudentBKGS Project Summary

## Purpose

StudentBKGS is a school classroom management system for Thai teachers and administrators. It supports teacher/admin login, classroom and student management, attendance tracking, score entry, grade results, QR card printing, and academic document export such as ปพ.1, ปพ.5, and ปพ.6.

The app is designed to run as a full-stack TypeScript application. Render/Docker remains the stable deployment path for the full Node + Python workflow, while Vercel is supported through serverless API routing and a Node-native Excel runtime.

## Project Structure

- `client/` - Vite React frontend.
  - `client/src/pages/` contains route-level pages such as `Home`, `Dashboard`, `AdminPage`, `ClassroomDetail`, `AttendancePage`, `ScorePage`, and print/export views.
  - `client/src/components/` contains shared layout and feature components.
  - `client/src/components/ui/` contains shadcn/Radix-style UI primitives.
  - `client/src/lib/trpc.ts` and `client/src/main.tsx` wire the React app to the tRPC API at `/api/trpc`.
- `server/` - Express/tRPC backend and application services.
  - `server/_core/index.ts` creates the Express app, registers REST endpoints, OAuth routes, tRPC middleware, and starts the local/Render server.
  - `server/routers.ts` defines the main tRPC router and domain procedures.
  - `server/db.ts` contains Drizzle/Postgres data access helpers.
  - `server/storage.ts` handles object storage uploads for generated documents.
  - `server/_core/` contains auth, cookies, OAuth, Excel import/export, template, AI, map, and system helpers.
- `api/` - Vercel serverless entrypoint.
  - `api/index.ts` imports `createApp()` and routes Vercel `/api/*` traffic through the same Express app.
- `shared/` - Types, role helpers, constants, and shared errors used by client and server.
- `drizzle/` - Database schema, relations, and migrations.
- `templates/academic/` - Academic Excel templates used by document export.
- Root Excel files such as `ตัวอย่างมัธยม.xlsx` and `เก็บคะแนนประถม.xlsx` are legacy/export templates.
- Deployment/config files:
  - `Dockerfile` and `render.yaml` for Render/Docker.
  - `vercel.json` for Vercel build, output, functions, and rewrites.
  - `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`.

## Key Backend Files

- `server/_core/index.ts`
  - Main Express app factory.
  - Registers:
    - `GET /api/student-import-template`
    - `GET /api/templates/:templateId`
    - OAuth callback routes
    - `/api/trpc` tRPC middleware
  - Uses dynamic Vite/static imports only when starting the standalone server, so Vercel API functions do not load Vite dev-server code.

- `server/routers.ts`
  - Main tRPC API surface.
  - Includes auth, teacher profile, classrooms, students, attendance, scores, documents, academic years, subjects, teaching assignments, and admin operations.

- `server/db.ts`
  - Drizzle ORM access layer over Postgres.
  - Lazily creates a `pg` pool from `DATABASE_URL`.
  - Contains most CRUD helpers used by tRPC procedures.

- `server/_core/sdk.ts`
  - Auth/session SDK.
  - Handles Supabase Auth login, local session JWT signing/verification, optional OAuth service integration, and user resolution.

- `server/_core/studentImport.ts`
  - Imports students from uploaded Excel files.
  - Chooses Python parser by default and Node parser when `process.env.VERCEL` or `EXCEL_RUNTIME=node`.

- `server/_core/excelExport.ts`
  - Builds academic/export workbooks.
  - Chooses Python/openpyxl by default and Node/ExcelJS when `process.env.VERCEL` or `EXCEL_RUNTIME=node`.

- `server/_core/nodeExcel.ts`
  - Vercel-compatible ExcelJS implementation for:
    - student workbook parsing
    - student import template generation
    - class/student export workbook generation
  - Avoids `python3` and only writes output files to caller-provided temp paths.

- `server/_core/excel_importer.py`, `excel_exporter.py`, `student_import_template.py`
  - Legacy Python/openpyxl Excel pipeline.
  - Kept for Render/Docker compatibility and should not be removed unless Render no longer depends on it.

- `server/_core/excelRuntime.ts`
  - Small runtime selector.
  - `node` runtime is used on Vercel or with `EXCEL_RUNTIME=node`.
  - `python` runtime remains the default elsewhere.

## Frontend Flow

1. `client/src/main.tsx` creates the tRPC client with `url: "/api/trpc"`.
2. `client/src/App.tsx` defines app routing.
3. Page components call `trpc.*` hooks for data and mutations.
4. Direct file downloads use REST endpoints under `/api/templates/*` and `/api/student-import-template`.
5. Auth state is managed by `client/src/_core/hooks/useAuth.ts` and related login pages.

## Backend/Data Flow

1. Browser sends tRPC requests to `/api/trpc`.
2. Express routes the request through `createExpressMiddleware`.
3. `server/_core/context.ts` authenticates the request through `sdk.authenticateRequest`.
4. tRPC procedures in `server/routers.ts` call DB helpers in `server/db.ts`.
5. DB helpers use Drizzle schema from `drizzle/schema.ts`.
6. Excel import/export routes use runtime-specific implementations:
   - Render/default: spawn Python scripts.
   - Vercel/`EXCEL_RUNTIME=node`: use ExcelJS in-process.
7. Generated documents can be uploaded through `server/storage.ts` when saved to cloud/object storage.

## Tech Stack

- Frontend: React 19, Vite 7, TypeScript, Wouter, TanStack Query, tRPC React, Tailwind CSS v4, Radix UI/shadcn-style components, Lucide icons.
- Backend: Express 4, tRPC 11, TypeScript/tsx, Drizzle ORM, `pg`, Zod, Jose JWT, Supabase Auth.
- Excel:
  - Render/default: Python 3 + openpyxl.
  - Vercel/Node runtime: ExcelJS.
- Database: Postgres via `DATABASE_URL`; Supabase-compatible URLs are supported with SSL.
- Testing: Vitest.
- Package manager: pnpm via Corepack.
- Deployment:
  - Render/Docker for full Node + Python runtime.
  - Vercel for static frontend plus serverless Express API function.

## Important Conventions

- Keep Render compatibility intact.
  - Do not remove Python scripts, `requirements.txt`, `Dockerfile`, or Render config without an explicit migration decision.
  - Python Excel remains the default outside Vercel.

- Use `EXCEL_RUNTIME=node` to force the Vercel-compatible ExcelJS path locally.
  - Useful for testing Node Excel behavior without deploying.

- Use `/api/trpc` for application API calls.
  - Do not hardcode absolute API origins in the client unless introducing a deliberate split frontend/backend deployment.

- Vercel API functions must not import Vite dev-server code.
  - `server/_core/index.ts` should keep Vite/static server imports inside `startServer()`, not at module top level.

- Temporary generated files should be written under `os.tmpdir()`.
  - This is required for serverless compatibility.

- Environment variables are centralized through `server/_core/env.ts`.
  - Important production variables include `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ID`, and optional OAuth/storage/AI variables.

- Use existing UI primitives under `client/src/components/ui/`.
  - Prefer existing patterns and page structure over introducing a new component system.

- Use `corepack pnpm` commands.
  - Common checks:
    - `corepack pnpm check`
    - `corepack pnpm build`
    - `corepack pnpm test`

- Database changes should go through Drizzle schema/migrations.
  - Keep `drizzle/schema.ts`, migrations, and tests aligned.

## Current Deployment Notes

- `vercel.json` uses Corepack pnpm commands and routes `/api/:path*` to `api/index`.
- Vercel bundles `api/index.ts` as the serverless API entrypoint.
- Vercel should use the Node Excel runtime automatically because `process.env.VERCEL` is set.
- Render should continue to use the Python/openpyxl Excel runtime by default.
