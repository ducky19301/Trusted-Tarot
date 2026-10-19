# Moving your tarot app to free, always-on hosting

About 15 minutes. You make two free accounts and copy a few values. No card or payment is needed for either one.
Your current app keeps running the whole time, so nothing breaks while you do this.

## 1. Supabase (keeps your logins, readings, guests and photos)

1. Go to **supabase.com**, tap **Start your project**, and sign up with GitHub (use the same GitHub account as the Trusted-Tarot repo).
2. Tap **New project**.
   - Name: `trusted-tarot`
   - Database password: tap **Generate a password**. You won't need it again, so you don't have to save it.
   - Region: **West US** (the one closest to you)
   - Plan: **Free**
   - Tap **Create new project**, then wait about 2 minutes.
3. On the left, tap **SQL Editor**, then **New query**. Paste the whole contents of `supabase/schema.sql` (I'll send it to you as one block), then tap **Run**. You should see "Success. No rows returned".
4. On the left, tap **Authentication**, then **Sign In / Providers**, then **Email**. Turn **Confirm email** **off** and tap **Save**.
   (The app signs people in with a username, so nobody gets emails.)
5. On the left, tap **Project Settings** (the gear), then **API Keys**. Send me these three things:
   - **Project URL**, which looks like `https://abcdxyz.supabase.co` (shown under Settings > Data API, or at the top of API Keys)
   - **Publishable key**, which starts with `sb_publishable_` (if you only see "anon", that one is fine too)
   - **Secret key**: tap **Reveal**. It starts with `sb_secret_` (or is the "service_role" key). This one is private. It lets me move your data over and run your daily backup. Send it in our private chat only, and never post it anywhere else.

## 2. Cloudflare (shows the app's screens, free, always on)

1. Go to **dash.cloudflare.com** and sign up (free).
2. Tap **Compute (Workers & Pages)**, then **Create**, then the **Pages** tab, then **Import an existing Git repository**.
3. Connect GitHub and choose the **Trusted-Tarot** repo.
4. On the settings screen:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `public`
   - Tap **Save and Deploy**.
5. When it finishes, send me the link it shows. It looks like `https://trusted-tarot.pages.dev`.

## 3. Then I take it from there

I'll move your journal, guests (including Nick), practice progress and photos into it and set your password. Then I'll check every screen and send you the new link. Open it on your phone and use **Share > Add to Home Screen** like before.
You'll sign in with username **natalie** and the password I give you.

## 4. Daily backup (optional, 1 minute, free)

In GitHub, open the Trusted-Tarot repo and go to **Settings > Secrets and variables > Actions > New repository secret**. Add:
- `SUPABASE_URL`: your Project URL
- `SUPABASE_SERVICE_KEY`: your Secret key

From then on, a private backup runs every night and is kept for 30 days. It also counts as activity, so the free Supabase project never goes to sleep.
