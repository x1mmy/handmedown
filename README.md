# Hand Me Down

A private family recipe book for the browser. Recipes live in household kitchens inside a shared book. The example book is named The Fam. Anyone with the link can view, upload, and edit. There is no sign-in.

Owner: Zimraan Anjum / Stash Labs.

## Run the demo

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and keep `HMD_DATA_ADAPTER=demo`. Open http://localhost:3000. You land in the example book: recipes, cook mode, album, kitchens, and the A5 preview. Nothing is written to Supabase.

To start your own book, use **Start our own book** and submit the draft. Repeating that submit with the same draft key returns the same book. An empty title is stored as The Fam.

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Environment

Copy `.env.example`.

| Name | Where it is read |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server. The project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server. The publishable client key. |
| `SUPABASE_SECRET_KEY` | Server only. Private storage uploads and PDF bytes when the Supabase adapter is on. Never commit a real value. |
| `HMD_DATA_ADAPTER` | `demo` only when set explicitly. Unset means `supabase`. |

`HMD_DATA_ADAPTER=demo` uses the isolated file-backed adapter in `.data/`. The example book and its six photographs ship in `public/seed/`. Leaving the variable unset does not fall back to demo. Supabase mode throws if the URL, publishable key, or `SUPABASE_SECRET_KEY` is missing. The secret key stays on the server. The browser never writes tables or the private `media` bucket directly. Object paths are derived from the book and object ids. Completion functions are not executable by `anon` or `authenticated`.

Set `HMD_DATA_ADAPTER=supabase` only after the migrations have been applied to a database you mean to use. They are not applied to the remote project.

## Migrations

SQL lives in `supabase/migrations/`. It creates the book, kitchen, recipe, invite, media, and export tables, composite foreign keys, row level security on every table, and privileged functions in the `private` schema. Public functions are security invoker wrappers.

**These migrations are not applied to the remote project** (`https://gknpxsexkmkhomsclpwi.supabase.co`). Do not run them there until that target is approved.

Local checks, against a Supabase stack on your machine:

```bash
supabase start
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```

`supabase/tests/rls.sql` rolls back. It checks that an outsider sees no rows, a self-grant into `kitchen_members` fails, and a cross-book recipe insert fails the foreign key. The unit tests in `tests/demo-repository.test.ts` cover the same rules on the demo adapter, including replay, concurrent cooks, stale edits, the 6 second undo window, and the kitchen-delete guard. `npm test` does not need Docker.

## What is real, and what is still pending

Real in this repo:

- Light-mode mobile-first UI for recipes, cook mode, editing, albums, kitchens, and A5 preview.
- Exact integer fraction scaling (`1 1/4 × 2 = 2 1/2`).
- Session-local ingredient and step checks. Screen Wake Lock, with a plain instruction when the browser refuses it.
- Soft delete with a 6 second undo, per-user favourites, and an idempotent cooked counter.
- The book name and kitchen names are editable inline. The masthead, page title, and print cover use the current name. The default is The Fam.
- Upload checks reject non-images. Accepted files are re-encoded to JPEG and the EXIF segment is stripped.
- Print preview and the PDF worker share one pagination model. The worker is Playwright with every network request aborted. Page size is A5 148×210mm, or 154×216mm when bleed is on.

Pending until you opt in:

- The Supabase adapter is implemented and typechecked. It is the mode used when demo is not opted in. The remote database does not have these tables yet.
- Private Storage uploads in that adapter need `SUPABASE_SECRET_KEY`. The demo stores new photos in process memory, so they disappear when the server restarts. Seed photos stay on disk.
- PDF export needs Chromium: `npx playwright install chromium`. If the browser is missing, the preview still works and the export reports the failure.
- The PDF uses built-in serif and sans stacks because the worker is not allowed to fetch fonts. Page breaks still come from the shared model, not from measuring a live layout.
- There is no login. A demo cookie is not accepted as a real book session.
- Local Supabase RLS (`supabase start`) was not run in this environment. That integration check is blocked until Docker and the Supabase CLI are available. Do not apply the migration remotely.

## Deploy on Vercel

The hosted app is one shared book. The browser never talks to Postgres or Storage. Set these on the Vercel project, then apply `supabase/migrations/20261107160000_hand_me_down.sql` to a database you mean to use. Do not apply it to the remote project until that target is approved.

| Name | Value |
| --- | --- |
| `HMD_DATA_ADAPTER` | `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL` | The project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The publishable key. The server checks that it is set. The browser does not use it to write. |
| `SUPABASE_SECRET_KEY` | Server only. Table and private Storage access. |
| `HMD_BOOK_ID` | Optional. Defaults to `10000000-0000-4000-8000-000000000001`, the seeded book titled The Fam. |

PDF export uses Playwright and Chromium. Vercel serverless cannot run that worker, so when `VERCEL=1` the export button is replaced with the browser print dialog and the export endpoint returns a clear error. The on-screen A5 preview still works. `next build` externalizes `playwright` so the build does not need a browser.

## Footer

Every page ends with the exact words “Built by Stash Labs”, set in small caps, linking to `STASH_LABS_URL` in `src/lib/constants.ts` (`https://www.stashlabs.com.au/`).
