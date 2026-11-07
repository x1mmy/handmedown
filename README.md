# Hand Me Down

A private recipe book for one family, built for phones first. Recipes live in household kitchens inside one shared book, named The Fam by default. Anyone in the family with the link can view, add and edit. There is no sign-in.

Owner: Zimraan Anjum / Stash Labs.

## Run it locally

1. Copy `.env.example` to `.env` and paste the Supabase secret key into `SUPABASE_SECRET_KEY`.
2. Apply `supabase/migrations/20261107160000_hand_me_down.sql` to the Supabase project (see Migrations).
3. Install and start:

```bash
npm install
npm run dev
```

Open http://localhost:3000. Checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Pages

| Path | What it is |
| --- | --- |
| `/` | All recipes, search, course and kitchen filters |
| `/recipes/new` | Add a recipe |
| `/recipes/:id` | Cook view: scaling, checklists, cook mode |
| `/recipes/:id/edit` | Edit a recipe |
| `/album` | Family photo albums |
| `/kitchens` | Households in the family |
| `/print` | A5 print preview and PDF |

On phones the sections sit in a bottom tab bar with the add button in the middle. On wider screens they move into the header.

## Environment

Copy `.env.example` to `.env`. `.env` is gitignored.

| Name | Where it is read |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server. The project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server. The publishable client key. |
| `SUPABASE_SECRET_KEY` | Server only. Tables, private photo storage and PDF bytes. Never commit a real value. |
| `HMD_BOOK_ID` | Server. Optional UUID of the one family book. Defaults to the seeded book. |
| `HMD_PDF_EXPORT` | Server. `off` hides PDF export. Always off when `VERCEL=1`. |

Supabase is the only data store. The app throws on start if the URL, publishable key or secret key is missing. The secret key stays on the server. The browser never writes tables or the private `media` bucket directly. Object paths are derived from the book and object ids. Completion functions are not executable by `anon` or `authenticated`.

## Migrations

SQL lives in `supabase/migrations/`. It creates the book, kitchen, recipe, invite, media, and export tables, composite foreign keys, row level security on every table, and privileged functions in the `private` schema. Public functions are security invoker wrappers.

**These migrations are not applied to the remote project** (`https://gknpxsexkmkhomsclpwi.supabase.co`). Do not run them there until that target is approved.

Local checks, against a Supabase stack on your machine:

```bash
supabase start
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```

`supabase/tests/rls.sql` rolls back. It checks that an outsider sees no rows, a self-grant into `kitchen_members` fails, and a cross-book recipe insert fails the foreign key. `npm test` covers fractions, pagination, uploads, storage paths and the migration contract, and does not need Docker.

## What is real, and what is still pending

Real in this repo:

- Light-mode, phone-first UI for recipes, cook mode, editing, albums, kitchens and the A5 preview.
- Exact integer fraction scaling (`1 1/4 × 2 = 2 1/2`).
- Session-local ingredient and step checks. Screen Wake Lock, with a plain instruction when the browser refuses it.
- Soft delete with a 6 second undo, per-user favourites, and an idempotent cooked counter.
- The book name and kitchen names are editable inline. The masthead, page title, and print cover use the current name. The default is The Fam.
- Upload checks reject non-images. Accepted files are re-encoded to JPEG and the EXIF segment is stripped.
- Print preview and the PDF worker share one pagination model. The worker is Playwright with every network request aborted. Page size is A5 148×210mm, or 154×216mm when bleed is on.

Still pending:

- The migration has not been applied to the remote Supabase project. Until it is, every page fails with a Supabase error.
- PDF export needs Chromium: `npx playwright install chromium`. If the browser is missing, the preview still works and the export reports the failure.
- The PDF uses built-in serif and sans stacks because the worker is not allowed to fetch fonts. Page breaks still come from the shared model, not from measuring a live layout.
- Local Supabase RLS (`supabase start`) was not run in this environment. That check needs Docker and the Supabase CLI.

## Deploy on Vercel

The hosted app is one shared book. The browser never talks to Postgres or Storage. Set these on the Vercel project, then apply `supabase/migrations/20261107160000_hand_me_down.sql` to a database you mean to use. Do not apply it to the remote project until that target is approved.

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | The project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The publishable key. The server checks that it is set. The browser does not use it to write. |
| `SUPABASE_SECRET_KEY` | Server only. Table and private Storage access. |
| `HMD_BOOK_ID` | Optional. Defaults to `10000000-0000-4000-8000-000000000001`, the seeded book titled The Fam. |

PDF export uses Playwright and Chromium. Vercel serverless cannot run that worker, so when `VERCEL=1` the export button is replaced with the browser print dialog and the export endpoint returns a clear error. The on-screen A5 preview still works. `next build` externalizes `playwright` so the build does not need a browser.

## Footer

Every page ends with the credit “Built by Stash Labs.” (the Stash Labs mark and wordmark, with its orange full stop, as on stashlabs.com.au), linking to `STASH_LABS_URL` in `src/lib/constants.ts` (`https://www.stashlabs.com.au/`).
