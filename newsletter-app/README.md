# Chévere Weekly

Companion Next.js service for Chévere's subscriber list, shared weekly roundup, issue editor, email rendering, test sends, subscription management, provider-event logging, homepage publication, and Friday email scheduling.

The production scheduler is intentionally disabled unless `NEWSLETTER_CRON_ENABLED=true`.

## Architecture

- **Public site:** remains on GitHub Pages. Its shared signup form posts to `https://newsletter.itschevere.com/api/subscribe`.
- **Newsletter service:** deploy this directory as a separate Vercel project whose root directory is `newsletter-app`.
- **Database and admin login:** Supabase Postgres and Supabase Auth.
- **Email:** Resend, using a verified sender domain and a signed webhook for delivery, open, click, bounce, complaint, and failure events.
- **Shared weekly roundup:** each newsletter issue owns exactly three ordered roundup cards. The same stored fields power both the homepage API and the email-safe newsletter renderer.
- **Manual Featured Reads:** three ordered published articles live in `homepage_featured_reads`. They are selected, reordered, previewed, and published from the dedicated admin page, independently of newsletter issues.
- **Recurring editorial Series:** posts keep their normal category while optionally belonging to Weekly Roundup, The Month Ahead, or Seasonal Guides. The public `GET /api/series/the-month-ahead` endpoint returns `{ item }`, where `item` is the explicitly homepage-featured published edition or the newest published edition; it returns `null` when none is available. The endpoint allows public cross-origin reads and uses a short shared cache with stale revalidation so the static homepage can fall back gracefully.
- **Homepage schedule:** an issue can be published immediately or scheduled for Sunday at 8:00 a.m. in `America/Chicago`. `/api/roundup` resolves the newest eligible valid issue on the server, so no browser timer or cron job is required. The previous valid issue remains active until its replacement is eligible.
- **Seasonal guide:** the standalone seasonal guide is managed under `/admin/site-content`. The editor controls the active season and year, label, headline, description, destination, CTA, visibility, publication window, and an ordered selection of up to 12 published posts. Everything is stored together in `site-content.json`; `summer-guide.html` reads that file and the published article index so the guide updates without hand-editing its cards.
- **Email schedule:** `NEWSLETTER_SEND_TIME` stores the Friday time in `America/Chicago`. Vercel calls the protected endpoint at the matching UTC times in `vercel.json`; the endpoint checks Chicago wall-clock time so daylight-saving changes are handled correctly.

## Initial setup

1. Create a Supabase project.
2. Run every file in `supabase/migrations` in numeric order in the Supabase SQL editor. Existing installations must run `009_weekly_roundup.sql` for the shared roundup, then `010_homepage_featured_reads.sql` and `011_featured_reads_static_posts.sql` for admin-controlled Featured Reads, followed by `012_post_series.sql` for recurring Series metadata, before deploying the matching application code.
3. In Supabase Auth, create Sabrina's admin user with the same email configured in `ADMIN_EMAIL`. Keep public user registration disabled because only the administrator signs in.
4. Create a Resend account, verify `itschevere.com`, and configure SPF/DKIM as Resend instructs. Add a signed webhook pointing to `https://newsletter.itschevere.com/api/webhooks/resend` and subscribe it to email delivery, failure, bounce, complaint, open, and click events.
5. Deploy this directory to Vercel with `newsletter.itschevere.com` as its custom domain.
6. Add every variable from `.env.example` to Vercel. Use long random values for `TOKEN_SECRET` and `CRON_SECRET`, and copy the webhook signing secret into `RESEND_WEBHOOK_SECRET`.
7. Keep `NEWSLETTER_CRON_ENABLED=false` through all verification steps.
8. Point the `newsletter` DNS record to Vercel only after the deployment is healthy.

## Required verification before activation

- All Supabase migrations completed. Private newsletter and snapshot tables have RLS enabled and are inaccessible to public roles.
- The admin account can sign in and no other account can access `/admin` or its APIs.
- A public signup immediately creates or reactivates one active subscriber without a confirmation email.
- Repeated signup attempts do not create duplicate addresses.
- The footer unsubscribe link, one-click unsubscribe request, and subscription-management page immediately mark the subscriber unsubscribed.
- A draft can be saved, edited, reordered, duplicated, and previewed at desktop and mobile widths.
- Homepage publication is rejected unless exactly three cards have an image, meaningful alt text, title, and valid destination URL.
- Publishing immediately returns the same ordered card fields from `/api/roundup`.
- Scheduling without a custom time selects the next Sunday at 8:00 a.m. in America/Chicago, including across daylight-saving changes.
- Archiving the current issue falls back to the most recent earlier valid issue.
- A published website article can populate The Chévere Read.
- A test email reaches the private `ADMIN_EMAIL` with correct images, links, sender details, and footer.
- An incomplete issue cannot be approved.
- An approved issue shows the next Friday at `NEWSLETTER_SEND_TIME` in America/Chicago.
- Resend webhook signatures are verified, duplicate webhook IDs are ignored, and supported delivery metrics appear in the dashboard.
- A manual request to `/api/cron/newsletter` with the correct Bearer secret records a disabled skip while the safety switch is false.
- Resend's sender domain is verified and its production sending limits are appropriate.

Only after every item passes, change `NEWSLETTER_CRON_ENABLED` to `true` and redeploy. Do not manually call the scheduled endpoint for a real issue unless the current Chicago time is within its allowed Friday window.

## Create the first issue

1. Open `/admin` and sign in.
2. Choose **Create issue**.
3. Complete all newsletter fields and exactly three roundup cards. Each card needs an image, alt text, title, and destination URL.
4. Choose a published site article under **The Chévere Read** or enter its details manually.
5. Save the draft.
6. Use **Preview** and switch between desktop and mobile. Review the inline homepage roundup preview as well.
7. Choose **Schedule homepage** for the stored Sunday time, or **Publish homepage now** for immediate publication.
8. Use **Send test** and inspect the received message.
9. Return to the issue, make any pre-publication changes, save again, and repeat the test if needed.
10. Check the per-issue approval box, then choose **Approve & schedule email** only when the final issue is ready. This schedules it for the selected email-delivery time, or the next Friday at `NEWSLETTER_SEND_TIME` in America/Chicago when no time was selected.

Drafts, empty issues, unapproved issues, previously sent issues, inactive subscribers, and unsubscribed addresses are never selected for delivery. If no eligible issue exists, that Friday is logged as skipped and nothing is sent. When an issue begins sending, an immutable issue and HTML snapshot is stored so future edits cannot rewrite the historical email.

## Local development

Copy `.env.example` to `.env.local`, fill in non-production test credentials, then run:

```text
pnpm install
pnpm dev
```

The public website can override the companion URL during local testing by defining `window.CHEVERE_NEWSLETTER_API_URL` before `site.js` loads.
