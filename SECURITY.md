# Keeping the club's records safe

The app holds personal data about players: names, phone numbers, NIN, next of kin, dates of birth and medical notes. Uganda's **Data Protection and Privacy Act, 2019** applies. Same approach as TM Bweyogerere.

| Risk | What the system does |
|---|---|
| **Someone outside the club gets in** | Accounts are invite-only and sign-ups are off in Supabase. A new login sees nothing until an admin gives it a role. Passwords are 10+ characters, chosen by each person; nobody sends passwords. |
| **The public key is misused** | The tables can't be reached from the internet at all. The app works only through `cc_*` functions that check, inside the database, who is signed in (`supabase/schema.sql`). Checked with 39 tests before going live. |
| **A phone is lost** | Records are never stored on the phone, only loaded while the app is open. An admin switches the account off in Settings → Accounts and it stops working at once. Sign out on shared phones. |
| **Records are changed or deleted quietly** | Every save, sign-in, role change and delete-all is logged with who and when (Settings → Activity). Nobody can edit or delete that log. |
| **Data is lost** | Settings → Backup downloads everything. Supabase's free plan keeps no backups you can download, so an admin downloads one **every month** and keeps it in Thomas's Google Drive. |
| **Data ends up in the code** | The GitHub repository holds only code and made-up sample players. The build refuses to publish anything that looks like a real phone number or email. |
| **The website is attacked** | Strict security headers: scripts only from the app itself, no embedding in other sites, no referrer leaks. Everything typed is escaped before it is shown. |
| **The accounts depend on one person** | Supabase and Cloudflare are under Thomas's email, and there are four admins. |

## Habits

1. Use your own phone. On a shared one, tap **Sign out** when you finish.
2. Tell another admin straight away if a phone with the app is lost.
3. Keep notes about players factual and kind. Players can ask what is recorded about them.
4. Download a backup monthly.
