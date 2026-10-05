# Year End Vacation Planner: Project Plan & Log

A mobile app for planning a year-end trip with friends. Everyone signs in, then
suggests places, marks the dates they're free and the leave days they have,
proposes trip dates, and adds comments, links and photos.

**Last updated:** 6 Oct 2026
**Target:** app in friends' hands by early November 2026

---

## 📍 Current status (read this first)

- **Where we are (6 Oct 2026):** Phases 3, 4 and 6 are built. **Update 3** is published to
  **https://yearend-trip.expo.app**: browser tab renamed **"Welcome 2027"**, plus **Phase 6**
  (photos and comments on each place, and a trip-wide Group chat).
- Rahul says DB update 002 has been run. To confirm, run the read-only check
  [`supabase/check_002.sql`](supabase/check_002.sql): both rows should say ✅.
- **Next action:** Rahul tests the signed-in features (Places, place detail with photo upload & comments,
  Group chat, removing the "test" member). After that comes **Phase 7 (polish)**, and then friends get the link.
- **Plan agreed with Rahul:** friends get the link only once the app is complete.

---

## Quick reference

| Item | Value |
|---|---|
| Project folder | `C:\DBiz.ai\Work Files\CC_Projects\vacation-planner` |
| Supabase project | "Year End Vacation Planner": `https://dtlrimbzcswegrolptbe.supabase.co` |
| Supabase region / plan | Free plan (Nano compute) |
| Node.js | v24.21.0 LTS, installed per-user via **fnm** (no admin rights) |
| Expo SDK | 57 (Expo Router, React Native 0.86, TypeScript) |
| Test phone | Android, via the **Expo Go** app |
| **Live app (share this)** | **https://yearend-trip.expo.app** |
| Expo account / project | `@rahulsbiju/vacation-planner` (EAS project ID `2feb4c16-6c84-4ec0-9d12-df108cc113db`) |
| Hosting dashboard | https://expo.dev/projects/2feb4c16-6c84-4ec0-9d12-df108cc113db/hosting/deployments |

### Daily start-up

```powershell
cd "C:\DBiz.ai\Work Files\CC_Projects\vacation-planner"
npx expo start --tunnel
```

Scan the QR code with Expo Go. Keep the terminal open while working.
Shake the phone, then tap **Reload** if the app gets stuck.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| App | React Native + **Expo** (Expo Router) | One codebase for Android, iPhone and web |
| Backend | **Supabase** (Auth + Postgres database + Storage) | Sign-in, data and photos with no server to run; free tier |
| Language | TypeScript | |
| Editor | VS Code | |
| Hosting | Netlify or Vercel (web), EAS Build (Android APK) | Free |

---

## Progress log (done so far)

### Phase 0: Planning ✅
- [x] Defined the MVP feature list (below)
- [x] Chose the stack: Expo + Supabase

### Phase 1: Dev environment ✅ (6 Oct 2026)
- [x] Installed **fnm** (Fast Node Manager) for the current user via `winget`.
      The normal Node.js installer needed admin rights, which aren't available on this laptop.
- [x] Installed **Node.js v24.21.0 LTS** with fnm.
- [x] Added the Node folder to the **user PATH**:
      `C:\Users\RahulSBiju\AppData\Roaming\fnm\node-versions\v24.21.0\installation`
- [x] Created the Expo project with `npx create-expo-app@latest vacation-planner` (default template, SDK 57)
- [x] Ran the starter app on an Android phone through Expo Go

**Gotchas learned:**
- fnm's normal shell setup (`fnm env`) does **not** work on this laptop, because Windows
  blocks running programs through folder junctions. That's why PATH points straight at
  the real Node folder. ⚠️ If Node is ever upgraded with `fnm install`, the PATH entry must be updated by hand.
- Terminals opened *before* a PATH change keep the old PATH. Restart the terminal,
  VS Code or the Claude app after any PATH change.
- `npx expo start` must be run **inside** the `vacation-planner` folder, not its parent.
- The QR code from plain `npx expo start` didn't connect on the office network.
  **Use `npx expo start --tunnel`** (installed `@expo/ngrok` globally for this).
- The tunnel can also fail (`failed to start tunnel` / `remote gone away`) when the network
  blocks ngrok, even when ngrok has no outage. Fallbacks:
  1. Connect the laptop to the **phone's hotspot**, then run plain `npx expo start`.
  2. Test in the laptop browser at **http://localhost:8081** (use Incognito for a 2nd account).
- After installing a new package, restart the dev server **with a clean cache**:
  `npx expo start --clear`. Otherwise you get errors like "Unable to resolve module lodash/isEmpty".
- `npm audit` reports ~30 "vulnerabilities" in Expo's build tools. These are normal.
  **Do not run `npm audit fix --force`**, because it breaks the project.

### Phase 2: Backend (Supabase) ✅ (6 Oct 2026)
- [x] Created the Supabase project "Year End Vacation Planner" (free plan)
- [x] Installed the client libraries with `npx expo install`:
      `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`
- [x] Wrote the database schema in [`supabase/schema.sql`](supabase/schema.sql) and ran it in the Supabase SQL Editor
- [x] Created the Supabase connection file [`src/lib/supabase.ts`](src/lib/supabase.ts)
- [x] Stored the URL and **publishable** key in `.env.local` (Git ignores this file)
- [x] Turned **off** "Confirm email" (Auth → Providers → Email), because the free built-in
      email service only sends a few emails per hour
- [x] Verified: the key works, all tables respond, and email sign-up is enabled

**Database tables** (all protected by Row Level Security):

| Table | Holds |
|---|---|
| `profiles` | Display name and avatar for each user (created automatically on sign-up) |
| `trips` | Trip name and 6-character **invite code** |
| `trip_members` | Who's in which trip, their role (owner/member) and **leave days** |
| `locations` | Suggested places: name, description, link |
| `location_votes` | One upvote per person per place |
| `location_images` | Photos on a place (files stored in the `trip-images` bucket) |
| `availability` | Date ranges each person is free |
| `date_suggestions` | Proposed trip dates |
| `comments` | Comments (with optional link) on the trip, a place or a date suggestion |

**Database SQL files, in the order they were run:**
1. `supabase/schema.sql`: all tables, security rules, photo bucket ✅ run 6 Oct
2. `supabase/002_organiser_removes_members.sql`: organiser removes members + cleanup trigger ✅ run by Rahul
   (confirm with the read-only `supabase/check_002.sql`)

**Database functions called from the app:** `create_trip(name)` and `join_trip(code)`

**Security rules in plain words:**
- You only see trips you've joined, plus the people in them.
- You can only edit or delete your own places, dates, comments and photos.
- You can change your own leave days, but not your role.
- Photos are private (5 MB limit) and only members of that trip can see them.

**Key rule:** only the **publishable / anon** key goes in the app.
Never put the **secret / service_role** key in the app or in Git.

---

## Roadmap (still to do)

### Phase 3: Sign-in & trips ✅ done (6 Oct 2026)
- [x] Sign-up / sign-in screen (email + password, display name): `src/app/sign-in.tsx`
- [x] Keep users signed in (`src/lib/auth-context.tsx`), plus sign-out
- [x] Redirect to sign-in when signed out (Expo Router `Stack.Protected`): `src/app/_layout.tsx`
- [x] "My Trips" screen: list my trips with member counts, pull to refresh (`src/app/index.tsx`)
- [x] Create a trip, then open it
- [x] Join a trip by invite code
- [x] Trip screen (`src/app/trip/[id].tsx`): invite code + Share button, members list,
      set my leave days, leave trip
- [x] Shared UI pieces: `src/components/ui/button.tsx`, `src/components/ui/text-field.tsx`;
      added brand colours to `src/constants/theme.ts`
- [x] Removed the starter template's Explore tab and tab bar
- [x] `npx tsc --noEmit` passes. `npx expo lint` installed ESLint; its only error is in the
      template file `src/hooks/use-color-scheme.web.ts`, none in our code
- [x] Rahul signed up on the live site and created the gang's trip
- [x] **Feedback fix 1:** password fields now have a **Show/Hide** toggle (built into
      `src/components/ui/text-field.tsx`, so every password field gets it)
- [x] ✅ Done: Rahul added a "test" account as a second member, and it worked
- [x] **Organiser can remove members** (Update 2). Organisers (👑) see "Remove" on other members, with a
      confirm step. Needs DB update `supabase/002_organiser_removes_members.sql`, which:
  - adds the policy "members: organiser removes others" (an organiser can't remove themselves)
  - adds the trigger `on_trip_member_removed`, which deletes a removed or departed member's **dates and votes**
    for that trip (their places and comments stay)
- [x] **QR code & invite links** (Update 2), `src/components/trip/invite-card.tsx`
  - Invite link format: `https://yearend-trip.expo.app/join/<CODE>` (`src/lib/config.ts`)
  - "Show QR code" displays that link as a QR (always black-on-white so cameras can read it)
  - "Share invite" message now includes the tap-to-join link and the code
  - `src/app/join/[code].tsx` is reachable signed in or out. Signed in → joins immediately.
    Signed out → saves the code (`src/lib/pending-invite.ts`), shows an "You've been invited" banner on
    sign-in (defaults to Create account), and joins automatically after sign-in (`src/app/index.tsx`)
  - Tested in the browser: the signed-out link → sign-in with banner works, and the code is upper-cased
- [x] **Trip page reorganised** (Update 2), `src/app/trip/[id]/index.tsx`. Order:
  1. **Members**, with each person's leave days **and preferred dates merged in**
     (`src/components/trip/members-section.tsx`)
  2. **⭐ Best dates** (`src/components/trip/best-dates-card.tsx`)
  3. **Your availability**: leave days + calendar in one card (`src/components/trip/my-availability-card.tsx`)
  4. **📍 Places** link (shows the suggestion count)
  5. **Invite friends** (code, QR, share)
- [x] Secondary buttons now use a stronger grey so they don't blend into the cards

### Phase 4: Places ✅ built (6 Oct 2026, Update 2), waiting for real use
- [x] Places screen at `src/app/trip/[id]/places.tsx`, opened from the "📍 Places" card on the trip page.
      Instead of tabs, the trip page links to it.
- [x] "＋ Suggest a place": name, "why go?" description, optional link (adds `https://` if missing,
      rejects junk links)
- [x] Ranked by votes (🏆 on the leader). The ▲ vote button toggles your vote and updates instantly.
- [x] Links open in the in-app browser (`expo-web-browser`), shown as a short domain (e.g. 🔗 airbnb.com)
- [x] "Suggested by …". The author can delete their own suggestion (with confirm).
- [x] No database change needed (uses the `locations` and `location_votes` tables from schema.sql)
- [ ] Place detail screen with comments & photos → moved to Phase 6
- ⚠️ Not previewed in the browser (needs a signed-in account). Typecheck passes. Rahul to try it.

### Phase 5: Dates & availability (target: by 22 Oct, partly done early)
- [x] Enter my leave days (on the trip screen, built in Phase 3, unchanged)
- [x] **Feedback fix 2: calendar date-range picker** (6 Oct 2026), `src/components/availability-section.tsx`
  - Uses `react-native-calendars` (pure JS, so it works in Expo Go and on web)
  - Tap a start date, then an end date (or save a single day). Supports **multiple ranges per person**.
  - Selectable from **today up to 31 Dec 2026** (`LAST_SELECTABLE_DATE` constant). Past dates are greyed out.
  - Your saved ranges are tinted on the calendar. "Preferred dates" lists everyone's ranges by person,
    with **Remove** on your own.
  - Saved in the existing `availability` table (no database change needed)
  - Date helpers in `src/lib/dates.ts` use UTC maths so time zones can't shift a date
  - Bug found and fixed while testing: the calendar jumped to the wrong month after a tap
    (`current` → `initialDate`)
- [x] **⭐ Best dates view** (Update 2), with the logic in `src/lib/best-dates.ts`
  - For every group of people free together, finds the longest runs of consecutive days they're all free
  - Ranked: most people → longest stretch → earliest. Shows the top 5 with who's free / not free, and
    "Everyone 🎉" when the whole group is free
  - Drops stretches already covered by a bigger group over a longer period
  - Only counts current members, and only dates from today to 31 Dec 2026
  - Checked with sample data: 4 people, top result "24–28 Dec, 3 of 4" ✓
- [ ] Possible later: warn when a stretch is longer than someone's leave days (needs weekends/holidays logic)
- [ ] Propose trip date ranges (may not be needed: preferred ranges + best dates could cover it)
- [ ] **"Best dates" view**: which days most members are free (heatmap or ranked list)

### Phase 6: Comments, links & photos ✅ built (6 Oct 2026, Update 3)
- [x] **Place detail screen** `src/app/trip/[id]/place/[placeId].tsx`: tap any place in the Places list.
      It shows the place info, a ▲ vote button, then Photos, then Comments. Pull to refresh.
- [x] Places list cards now show "💬 n · 📷 n · Open ›" and open the detail screen
- [x] **Photos** (`src/components/photo-gallery.tsx`, `src/lib/photos.ts`)
  - "＋ Add photos" picks up to 5 at once (`expo-image-picker`; works in Expo Go and on the web)
  - Each photo is shrunk to max 1600px wide and saved as JPEG at 70% quality (`expo-image-manipulator`),
    roughly 200–400 KB each, to stay within Supabase's free 1 GB
  - Uploaded to the private bucket at `trip-images/<tripId>/<placeId>/<file>.jpg` (`base64-arraybuffer` decode)
    and recorded in `location_images`
  - Viewed through 1-hour signed links (the bucket is private). Tap a thumbnail for full size. The uploader
    can delete it.
- [x] **Comments** (`src/components/comments-section.tsx`), reused for places and the trip
  - Post / delete your own. Shows the author and "5m ago"-style times (`src/lib/time.ts`)
  - **Links pasted into a comment become tappable** (`splitLinks` in `src/lib/links.ts`). Trailing
    punctuation is excluded.
- [x] **💬 Group chat** for the whole trip: `src/app/trip/[id]/discussion.tsx`, linked from the trip page with a
      message count (comments with `target_type = 'trip'`)
- [x] Shared helpers pulled out: `src/lib/links.ts` (normalise / open / split links), `src/lib/votes.ts`
- [x] No database change needed (uses the `comments` and `location_images` tables and the storage bucket from schema.sql)
- [x] Fixed all lint errors, including the template one: `use-color-scheme.web.ts` no longer needs its
      static-rendering workaround. **`npx expo lint` is now fully clean.**
- ⚠️ Photo upload and comments were checked in the browser only for their empty states (they need a signed-in
  account). Rahul to test with real data.

### Phase 7: Polish (target: by 30 Oct)
- [ ] Loading spinners, error messages, empty states
- [ ] Pull-to-refresh (and optionally live updates with Supabase Realtime)
- [ ] App name, icon and splash screen in `app.json`
- [ ] Edit / delete my own items
- [ ] Run `npx expo lint`, `npx tsc --noEmit` and `npx expo-doctor`
- [ ] Set up Git and push to a private GitHub repo

### Phase 8: Deployment (started early, 6 Oct 2026, so friends can test)
- [x] Chose **EAS Hosting** (Expo's own free web hosting, `https://<name>.expo.app`) over Netlify/Vercel
- [x] Changed `app.json` → `web.output` from `"static"` to `"single"` (single-page app). Protected
      (signed-in) routes aren't generated as static pages, so `"static"` would break links and refreshes.
- [x] `npx expo export --platform web` builds successfully into `dist/` (about 1.4 MB). The Supabase
      URL and key from `.env.local` are baked into the build at this step.
- [x] Logged in to Expo as `@rahulsbiju` (`npx eas-cli@latest login`)
- [x] First deploy with `npx eas-cli@latest deploy --prod`. It created the EAS project (adds
      `extra.eas.projectId` to `app.json`) and chose the preview URL name `yearend-trip`
- [x] **Live at https://yearend-trip.expo.app.** Checked that it loads the sign-in screen with no errors
- **To publish updates later** (run both in the project folder):
  ```powershell
  npx expo export --platform web
  npx eas-cli@latest deploy --prod
  ```
  ⚠️ Always run the export first. `deploy` uploads whatever is already in `dist/`.
  ⚠️ If npx asks "Need to install eas-cli@x.y.z, Ok to proceed?", use `npx --yes eas-cli@latest deploy --prod`.
  ⚠️ Browsers may show the old version for a while after a deploy. Fully close and reopen the tab or
  home-screen app, or pull to refresh.
- [x] **Update 1 deployed (6 Oct 2026):** password Show/Hide + calendar date-range picker.
      Checked on the live site.
- [x] **Update 2 deployed (6 Oct 2026):** Best dates, organiser removes members, QR/link invites,
      reordered trip page, Places & votes (Phase 4)
- [x] **Update 4 deployed (6 Oct 2026): app icon** from Rahul's SVG (luggage + umbrella)
  - Master file: `assets/images/app-icon.svg`. All PNGs are generated from it with `sharp`, run from a scratch
    folder so it isn't a project dependency. To change the icon later, replace the SVG and regenerate.
  - **Browser tab:** `public/favicon.svg`, plus `assets/images/favicon.png` (196px; Expo turns it into `favicon.ico`)
  - **iPhone home screen:** `public/apple-touch-icon.png` (180px, on white)
  - **Android home screen:** `public/manifest.json` + `icon-192.png`, `icon-512.png`, and `icon-maskable-512.png`
    (extra padding so Android's circle/squircle shapes don't crop it)
  - Head tags live in **`public/index.html`**, the page template created with `npx expo customize public/index.html`.
    Edit it to add more `<head>` tags.
  - Native builds (future APK): `icon.png` (1024), the adaptive icon foreground on a white background, and the
    splash screen is now the icon on white (`app.json`). Removed the old Expo-logo iOS icon and the Android
    background/monochrome images.
  - Phones cache home-screen icons: **delete the old shortcut and "Add to Home Screen" again** to see the new one.
- [x] **Update 3 deployed (6 Oct 2026):** browser tab / app name **"Welcome 2027"** (`app.json` → `name`,
      `web.name`, `web.shortName`. The `slug` stays `vacation-planner` because the EAS project is linked to it),
      plus Phase 6 (photos, comments, Group chat)
- [ ] Friends open the link and use "Add to Home Screen" (works on Android and iPhone)
- [ ] **Android APK (optional, free):** `npx eas-cli@latest build -p android --profile preview`, share the link
- [ ] **iPhone native (optional):** needs an Apple Developer account ($99/yr), then TestFlight
- [ ] Beta test with 2–3 friends, fix issues, then invite everyone

### Phase 9: After launch (nice-to-haves)
- [ ] Custom email service (e.g. Resend, free tier) so "Confirm email" and password reset can be switched on
- [ ] Push notifications ("Priya added a new place")
- [ ] Final decision: lock in the destination and dates
- [ ] Budget / expense splitting, maps, packing list

---

## Watch-outs
- **The live link doesn't need Rahul's laptop.** https://yearend-trip.expo.app is hosted by Expo, and the data
  lives in Supabase. Terminal tabs (dev server, deploy) are only needed while building or publishing updates.
- **Supabase pauses free projects after 7 days without activity.** Restore from the dashboard if needed.
- Supabase free storage is 1 GB, so compress photos before upload.
- Expo Go only includes Expo's built-in native modules. Adding other native libraries needs a
  development build (`eas build --profile development`).
- Always add packages with `npx expo install <pkg>`, not `npm install`, so versions match the SDK.
