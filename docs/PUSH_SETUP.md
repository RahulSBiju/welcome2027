# Push notifications setup

Push notifications have three parts:

1. **The app** asks permission and registers each phone or browser. ✅ Already built and deployed.
2. **The database** notices new places, comments, people joining, and the plan being pinned. ✅ Built by `supabase/003_pin_packing_push.sql`.
3. **The `send-push` Edge Function** sends the notifications. ⏳ You deploy this once, using the steps below.

Do these steps **after** running `003_pin_packing_push.sql`.

---

## Step 1: Deploy the Edge Function (5 min)

1. Supabase dashboard → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Function name: `send-push` (exactly this).
3. Delete the sample code, then paste in the whole of `supabase/functions/send-push/index.ts`.
4. Click **Deploy function**.
5. Open the function's **Details / Settings**, turn **OFF "Verify JWT with legacy secret"** (or "Enforce JWT
   verification"), and save. The database calls it with its own secret instead (step 3).

## Step 2: Add the function's secrets

Supabase dashboard → **Edge Functions → Secrets** → add these four:

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | copy from `push-keys.local.txt` in the project folder |
| `VAPID_PRIVATE_KEY` | copy from `push-keys.local.txt` (keep this one private) |
| `VAPID_SUBJECT` | `mailto:` + your email, e.g. `mailto:you@gmail.com` |
| `PUSH_WEBHOOK_SECRET` | make up a long random password (30+ letters and numbers) |

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically, so you don't add them.)

## Step 3: Give the database the same webhook secret

Supabase → **SQL Editor** → new query → paste, **replacing the text in quotes with the
`PUSH_WEBHOOK_SECRET` you just made up** → Run:

```sql
select vault.create_secret('PASTE-YOUR-PUSH_WEBHOOK_SECRET-HERE', 'push_webhook_secret');
```

That's it. Until this secret exists, the database quietly skips sending.

> Changed your mind about the secret later? Update it in both places:
> `select vault.update_secret((select id from vault.secrets where name = 'push_webhook_secret'), 'NEW-SECRET');`

---

## Step 4: Test it
1. On **your phone**, open the app → My Trips → **🔔 Turn on notifications** → Allow.
   - iPhone: first **Share → Add to Home Screen**, open the app **from the home-screen icon**, then turn on.
2. From **another account** (e.g. the "test" account in a laptop browser), post a Group chat message in your trip.
3. Your phone should buzz within a few seconds: *"💬 test in Group chat: …"*.

### If nothing arrives
- Supabase → Edge Functions → `send-push` → **Logs**: a `401` means the two secrets in steps 2–3 don't match.
- Supabase → SQL Editor → `select * from net._http_response order by created desc limit 5;` shows the
  database's recent calls to the function.
- On the phone: notifications for the browser or app must be allowed in the phone's settings.

## What triggers a notification

You never get notified about your own actions.

| Event | Example notification |
|---|---|
| New place suggested | 📍 Priya suggested Gokarna |
| Comment on a place | 💬 Arjun on Gokarna: looks amazing… |
| Group chat message | 💬 Arjun in Group chat: budget ~15k? |
| Someone joins | 👋 Meera joined the trip! |
| Organiser pins the plan | 📌 It's decided, we're going to Gokarna · dates locked: 24 Dec – 28 Dec! 🎉 |
