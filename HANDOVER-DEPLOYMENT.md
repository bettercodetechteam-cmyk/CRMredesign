# Zica-Zima CRM — Hosting & Access Handover

Short guide for new team members: how to access, deploy, and maintain the CRM.

---

## Live URLs

| What | URL |
|------|-----|
| **Production CRM** | https://crm.zicazimapcmc.com |
| **Server IP** | 43.204.163.55 (AWS EC2, Mumbai `ap-south-1`) |
| **GitHub repo** | https://github.com/bettercode1/Zica-Zima-CRM |

Main domain `zicazimapcmc.com` is on GoDaddy — only subdomain `crm` points to AWS.

---

## Who needs what access

| Access | Purpose | Who provides it |
|--------|---------|-----------------|
| **CRM login** | Use the app | Centre admin / director |
| **GitHub** | Pull code | Team lead |
| **AWS EC2** | Server SSH, deploy | AWS admin (btctechteam) |
| **GoDaddy DNS** | Domain records | Domain owner |
| **Firebase Console** | Auth, database, service account | Project owner |
| **SSH key (`CRM-KEY.pem`)** | Connect to server | AWS admin |

---

## How to use the CRM (end user)

1. Open **https://crm.zicazimapcmc.com**
2. Sign in with email + password (Firebase Auth)
3. If login fails: ensure `crm.zicazimapcmc.com` is in Firebase → Authentication → Authorized domains (`zica-zima-crm` project)

---

## Local development (testing database)

```bash
cd Zica-Zima-CRM
npm install --legacy-peer-deps
npm run dev
```

- Opens at **http://localhost:5000** (or port shown in terminal)
- Uses **testing** Firebase: `zica-zima-testing` (via `client/.env` / `.env.example`)
- **Do not** use production credentials for daily dev

---

## Production vs testing Firebase

| Environment | Firebase project | Config file |
|-------------|------------------|-------------|
| **Local dev** | `zica-zima-testing` | `client/.env.example` (see `.env.production.example` for prod template) |
| **AWS live site** | `zica-zima-crm` | Server `/home/ubuntu/Zica-Zima-CRM/.env` (copy from `.env.production.example`) |
| **Marketing website (Contabo)** | `zica-zima-crm` | VPS `/var/www/zicazimapcmc/Zica-zima-Website-/.env` |

**CRM and website must use the same Firebase project (`zica-zima-crm`) in production** so blogs published in CRM appear on zicazimapcmc.com.

**Important:** The browser uses Firebase config **baked into `dist` at build time**. Changing server `.env` alone does not change what users see — you must **rebuild** on the server.

### Production `.env` template (no secrets in Git)

Use repo root **`.env.production.example`** on EC2. Required client vars:

- `VITE_FIREBASE_PROJECT_ID=zica-zima-crm`
- `VITE_FIREBASE_AUTH_DOMAIN=zica-zima-crm.firebaseapp.com`
- `VITE_FIREBASE_STORAGE_BUCKET=zica-zima-crm.firebasestorage.app`

Admin vars must be from a **`zica-zima-crm`** service account (`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).

### Contabo website (blogs / What's Live)

Path: `/var/www/zicazimapcmc/Zica-zima-Website-/`

Use the **same Web app config** as CRM with `NEXT_PUBLIC_` prefix (see `zica-zima-website/.env.production.example`):

```bash
NEXT_PUBLIC_FIREBASE_PROJECT_ID=zica-zima-crm
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=zica-zima-crm.firebaseapp.com
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=zica-zima-crm.firebasestorage.app
# ... apiKey, appId, messagingSenderId from Firebase Console
```

Then rebuild: `./deploy.sh` or `npm run build` + restart.

Deploy Firestore rules after changes: `firebase deploy --only firestore:rules` (uses `.firebaserc` default `zica-zima-crm`).

---

## SSH into production server

**Windows (Command Prompt):**

```cmd
ssh -i "C:\path\to\CRM-KEY.pem" ubuntu@43.204.163.55
```

First time on Windows, fix key permissions:

```cmd
icacls "C:\path\to\CRM-KEY.pem" /inheritance:r
icacls "C:\path\to\CRM-KEY.pem" /grant:r "YOUR_USERNAME:(R)"
```

---

## Deploy updates to production (on server)

After code is merged to `main` on GitHub:

```bash
ssh -i CRM-KEY.pem ubuntu@43.204.163.55

cd /home/ubuntu/Zica-Zima-CRM
git pull
cp .env client/.env
export NODE_OPTIONS="--max-old-space-size=1536"
npm install --legacy-peer-deps
npm run build
pm2 restart zica-crm --update-env
```

**Verify:**

```bash
curl http://127.0.0.1:3000/api/health
pm2 status
```

Then hard-refresh browser: **Ctrl+Shift+R** on https://crm.zicazimapcmc.com

---

## Server stack (what runs where)

```
Browser → https://crm.zicazimapcmc.com
       → Nginx (port 443, SSL via Let's Encrypt)
       → Node.js app (port 3000, managed by PM2)
       → Firebase (zica-zima-crm)
```

| Tool | Role |
|------|------|
| **PM2** | Keeps Node app running (`pm2 status`, `pm2 logs zica-crm`) |
| **Nginx** | Reverse proxy + HTTPS (`/etc/nginx/sites-available/crm`) |
| **Certbot** | Auto-renews SSL (expires ~every 90 days) |

---

## Key files on server

| Path | Purpose |
|------|---------|
| `/home/ubuntu/Zica-Zima-CRM/` | App code |
| `/home/ubuntu/Zica-Zima-CRM/.env` | Production secrets (never commit) |
| `/home/ubuntu/Zica-Zima-CRM/dist/` | Built app (frontend + server) |
| `/home/ubuntu/.pm2/` | PM2 process logs |

---

## AWS EC2 checklist

- **Instance:** CRM-ZICAZIM… (`t3.micro`, Ubuntu 26.04)
- **Elastic IP:** 43.204.163.55
- **Security group:** ports **22**, **80**, **443** open
- **Swap:** 2GB enabled (needed for `npm run build` on small instance)

---

## GoDaddy DNS

| Type | Name | Value |
|------|------|-------|
| A | `crm` | `43.204.163.55` |

Do not change `@` or `www` records for the main site.

---

## Common issues

| Problem | Fix |
|---------|-----|
| Site not loading | Check PM2: `pm2 status`; check Nginx: `sudo systemctl status nginx` |
| Wrong database (testing data on live) | Rebuild on server with production `.env` from `.env.production.example`, restart PM2, hard-refresh browser |
| Blogs not on website | Ensure CRM + Contabo both use `zica-zima-crm`; publish blog (not draft); deploy Firestore rules; rebuild website |
| Firebase Admin mismatch warning | `FIREBASE_CLIENT_EMAIL` must be from `zica-zima-crm`, not testing |
| Login fails on live domain | Add `crm.zicazimapcmc.com` in Firebase authorized domains |
| `npm run build` killed on server | Ensure swap is on: `free -h` (should show 2G Swap) |
| SSL expired | `sudo certbot renew` |

---

## Secrets — never commit to Git

- `CRM-KEY.pem` (AWS SSH)
- `.env` (root and `client/.env`)
- Firebase service account JSON

Get values from: Firebase Console → Project settings → Service accounts → Generate key.

---

## Useful commands quick reference

```bash
# Server health
curl http://127.0.0.1:3000/api/health

# App logs
pm2 logs zica-crm --lines 50

# Restart app
pm2 restart zica-crm --update-env

# Nginx test & reload
sudo nginx -t && sudo systemctl reload nginx

# Check Firebase config served to browser
cat /home/ubuntu/Zica-Zima-CRM/dist/public/config/firebase.json
```

---

## Repo deploy scripts (reference)

| File | Purpose |
|------|---------|
| `scripts/aws-server-setup.sh` | One-time server setup (Node, Nginx, PM2) |
| `scripts/deploy-aws.sh` | Build + PM2 restart on server |
| `scripts/aws-nginx-crm.conf` | Nginx config template |
| `.env.production.example` | Template for server `.env` (EC2 production) |
| `client/.env.production.example` | Same values for `client/.env` during build |

---

## Contact for access requests

- **AWS / SSH key:** AWS account admin (btctechteam)
- **GitHub repo:** Repository owner
- **GoDaddy DNS:** Domain admin
- **Firebase:** Firebase project owner

---

*Last updated: June 2026 — Production URL: https://crm.zicazimapcmc.com*
