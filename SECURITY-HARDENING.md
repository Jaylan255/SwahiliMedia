# SwaMedia Security Hardening

This project now includes application-level protections for:

- HTTPS enforcement and secure headers
- Firebase Authentication for admin access
- Admin UID-based access control
- File-based rate limiting and attack logging
- Hardened payment and webhook endpoints
- Daily backup automation
- Basic client-side content protection and suspicious-event logging

## 1. Configure admin secrets

Set these environment variables in Apache, XAMPP, or your host:

- `MONGIKE_API_KEY`
- `FORCE_HTTPS=1`

## 2. Enable HTTPS/SSL

Application redirects to HTTPS automatically, but you still need a real certificate at the server or CDN layer.

- Apache/XAMPP: enable SSL and bind the site to `https://`
- Cloudflare: enable `Full (strict)` SSL/TLS
- Render/Netlify/Vercel static hosting will not run the new PHP security layer

## 3. Firewall, DDoS, bot protection

These must be enabled at the infrastructure edge, not only in code.

- Put the site behind Cloudflare or another WAF/CDN
- Turn on managed WAF rules
- Enable bot fight mode / bot management
- Enable DDoS protection and rate limiting rules
- Restrict admin access by IP if possible

## 4. Admin security notes

- Admin login is now at `/admin/login.html`
- Admin panel requires Firebase Email/Password login
- Only Firebase UID `NeMltnUXXmX5IW66aiOsKaBnzL23` is allowed into admin pages
- Login failures and suspicious events are logged in `storage/logs/`

## 5. Payment/API security

- `MONGIKE_API_KEY` is no longer hardcoded in PHP/JS
- Webhook validation uses constant-time comparison
- Requests are validated and rate-limited
- Raw webhook payloads are hashed in logs instead of stored in clear text

## 6. Daily backups

Run this Windows Task Scheduler command once per day:

```powershell
powershell -ExecutionPolicy Bypass -File C:\xampp\htdocs\swamedia2\scripts\daily-backup.ps1
```

Backups are stored in `storage/backups/` and files older than 14 days are pruned automatically.

## 7. Logging and monitoring

- Security logs: `storage/logs/security-YYYY-MM-DD.log`
- Rate-limit counters: `storage/ratelimits/`
- Client-side suspicious activity posts to `/api/security/log-client-event.php`

Feed the log directory into:

- Windows Event Forwarding
- a SIEM tool
- fail2ban or equivalent on Linux hosting

## 8. Important remaining gap

The public site and admin panel still read and write Firebase directly from the browser. For true high-security admin control, also tighten Firebase Realtime Database rules so browser clients cannot write sensitive admin content directly without proper Firebase Auth and role checks.
