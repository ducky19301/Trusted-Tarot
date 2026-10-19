/* Filled in once from Supabase > Project Settings > API. Both values are public by design (safe in a browser);
   your data is protected by the row-level security rules in supabase/schema.sql. Never put the service_role key here. */
window.TAROT_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT-REF.supabase.co",
  supabaseKey: "YOUR-ANON-OR-PUBLISHABLE-KEY",
  emailDomain: "users.trustedtarot.app",   // usernames become <username>@this-domain behind the scenes; no email is ever sent
};
