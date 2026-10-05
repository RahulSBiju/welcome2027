# Email setup: password reset + email confirmation

The app now has **Forgot password?** and **confirm your email with a code**. For these, Supabase has to
send emails. Its built-in sender only manages a few emails per hour, so we connect your own Gmail
as the sender (free, up to ~500 emails/day, plenty for a friend group).

> Why Gmail and not Resend? Resend's free plan only sends to *your own* address unless you own a web
> domain. Gmail works for everyone straight away.

---

## Step 1: Create a Gmail "app password" (5 min)

An app password is a separate 16-character password just for Supabase. Your real Gmail password
is never shared.

1. Go to **myaccount.google.com → Security**.
2. Turn on **2-Step Verification** if it isn't already on (Google requires it for app passwords).
3. Go to **myaccount.google.com/apppasswords**.
4. App name: `Welcome 2027` → **Create**.
5. Copy the 16-character password it shows. You'll paste it into Supabase in the next step.

## Step 2: Tell Supabase to send through Gmail

Supabase dashboard → **Authentication → Emails → SMTP Settings** → turn on **Enable custom SMTP**:

| Field | Value |
|---|---|
| Sender email | your Gmail address |
| Sender name | `Welcome 2027` |
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | your Gmail address |
| Password | the 16-character app password from step 1 |

Click **Save**.

Then go to **Authentication → Rate Limits** and set **emails per hour** to `30`.

## Step 3: Put the code in the emails

The app asks people to type a **code** from the email (more reliable than links on phones).
Go to **Authentication → Emails → Templates**:

### "Confirm signup" template
**Subject:** `Your Welcome 2027 code: {{ .Token }}`
**Body:**
```html
<h2>Welcome to the trip planning! 🌴</h2>
<p>Enter this code in the app to confirm your email:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>If you didn't sign up, you can ignore this email.</p>
```

### "Reset password" template
**Subject:** `Your Welcome 2027 password reset code: {{ .Token }}`
**Body:**
```html
<h2>Reset your password 🔑</h2>
<p>Enter this code in the app to set a new password:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>If you didn't ask for this, you can ignore this email. Your password won't change.</p>
```

Click **Save** on each.

## Step 4: Site URL

**Authentication → URL Configuration** → **Site URL** = `https://yearend-trip.expo.app` → Save.

## Step 5: Turn email confirmation back on (optional but recommended)

**Authentication → Sign In / Providers → Email** → turn **Confirm email** ON → Save.

New friends will then get a code by email after signing up. Existing accounts aren't affected.

---

## Test it
1. On the sign-in screen tap **Forgot password?** → enter your email → you should get the code
   email within a minute (check spam the first time and mark it "Not spam").
2. Enter the code + a new password → you're signed in.
