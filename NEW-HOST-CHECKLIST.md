# Setting this up for a new host

This site was built for one host (Jesse, The Heart Of CB). Replicating it for someone else means
copying the codebase and working through this list - most of it is either editing one config
file, or a real decision only the new host can make.

## 1. Backend accounts (each host needs their own - this isn't multi-tenant)

- **Supabase** project - run `migrations/001_unified_reservations.sql` against the new project's
  `reservations` table (create the table first if it doesn't exist - see that file for the shape).
- **Resend** account (transactional email) - new API key.
- **JSONBin.io** bin (pricing storage only, everything else moved off JSONBin) - new bin + key.
- **Netlify** site + **GitHub** repo - new deploy pipeline, new env vars for all of the above plus
  `LINK_SECRET`, `ADMIN_SESSION_SECRET`, `GITHUB_TOKEN` (for `publish-photos.js`) - generate fresh
  random secrets, never reuse Jesse's.
- **Airbnb** (or whatever OTA) - new listing URLs, new iCal feed URLs if the calendar-conflict
  check is kept.

## 2. Edit `host-config.json` - the one file with host-specific values

Business name/tagline/email/phone/address, per-property names and short labels, payment handles
(Venmo/CashApp/Zelle), tax rates, Airbnb listing URLs, and the navy/gold brand colors. Update
every field - this is the fastest, lowest-risk part of the setup.

**Known limitation:** `host-config.json` is wired into the *new* backend pieces (`_reservations.js`'s
property-label lookup) but NOT yet into the older, larger files - `index.html`, `book.html`,
`house-rules.html`, and the guest-facing email templates in `reminder.js`/`checkout-reminder.js`/
`quote-followup.js` still have Jesse's phone number, address, and payment handles hardcoded
directly in the markup/strings (grep for `9105998118`, `213 Harper`, `Jesse-Jones-85`, `dubblejay31`
to find every spot). Wiring these to read from `host-config.json` instead is real remaining work,
not done as part of this rebuild - budget time for it, or do a careful find-and-replace per new host
in the meantime.

## 3. Decisions that don't transfer (must ask the new host, don't just copy Jesse's)

- **Cancellation policy** - the specific day thresholds and refund percentages are hardcoded logic
  in `_cancelDates()` (book.html) and mirrored in `house-rules.html`'s copy. A new host may want a
  different policy (stricter, more lenient, different platform's named policy). This is a business
  decision, not a config value - rewrite the logic and the copy together, and make sure they still
  agree with each other (the signed agreement and the house-rules page drifted out of sync once
  already in this repo's history - fixed 2026-09-19, worth re-reading that fix for what to watch for).
- **Occupancy/sales tax rates** - vary by state and county. `host-config.json` has the fields, but
  someone needs to look up the actual correct rates for the new property's jurisdiction.
- **Legal entity name on the rental agreement** - book.html's signed-agreement text names "Jesse
  Jones" as Host by name in the contract language itself, not just via config.
- **Emergency contact** - a real second person the new host actually wants listed, not a stand-in.
- **Cleaning fee / cash discount / credit card fee %** - business choices, not technical ones.

## 4. What's already fully portable (no per-host work needed)

The reservation lifecycle itself (code generation, status transitions, the unified admin list),
the pricing calendar UI, the photos-publishing flow, and the admin auth system are all generic -
they work the same for any host once the backend accounts above are wired up and `host-config.json`
is filled in.
