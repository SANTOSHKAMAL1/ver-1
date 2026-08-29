# Arundhati Gurukulam — website & content console

React front end, FastAPI back end, SQLite database. The public site reads all of
its content from the database, and everything on it — sections, menu, ticker,
contact details — is editable from the admin console at `/admin`.

```
backend/app.py      FastAPI app: schema, seed data, public + admin API, static serving
frontend/src/       React source (Site, Admin, shared pieces, API client)
static/             index.html, styles.css, assets/bundle.js  ← what gets served
deploy/             systemd unit and nginx server block
build.sh            rebuilds the React bundle
```

## Run locally

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn backend.app:app --reload --port 8099
```

Open `http://localhost:8099` for the site and `http://localhost:8099/admin` for
the console. The database is created and seeded on first start.

| | |
|---|---|
| Admin username | `admin` |
| Admin password | `admin123` |

Change it under **Account** before the site goes live, or set `AG_ADMIN_USER` /
`AG_ADMIN_PASS` before the first run to seed different credentials.

## Rebuild the front end

Only needed after editing anything in `frontend/src/`:

```bash
./build.sh
```

Node 18+ required. Output goes to `static/assets/bundle.js`, which is committed
so the VPS never needs Node.

## Deploy to the VPS

Same pattern as the other juooa.cloud projects:

```bash
cd /var/www && git clone git@github.com:ooa-jain/arundhati-gurukulam.git
cd arundhati-gurukulam
python3 -m venv venv && venv/bin/pip install -r requirements.txt

cp deploy/arundhati.service /etc/systemd/system/
#  edit AG_SECRET inside it first
systemctl daemon-reload && systemctl enable --now arundhati

cp deploy/nginx.conf /etc/nginx/sites-available/arundhati
ln -s /etc/nginx/sites-available/arundhati /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d arundhati.juooa.cloud
```

Updates: `git pull && systemctl restart arundhati`.

Back up `arundhati.db` — it holds every edit made through the console.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `AG_SECRET` | `change-this-secret-in-production` | Signs admin session tokens. **Set this.** |
| `AG_DB` | `./arundhati.db` | SQLite file path |
| `AG_ADMIN_USER` | `admin` | Seeded on first run only |
| `AG_ADMIN_PASS` | `admin123` | Seeded on first run only |

## Content model

| Table | Holds |
|---|---|
| `settings` | Name, tagline, address, phone, email, hours, button labels |
| `ticker` | The scrolling gold announcement strip |
| `nav_groups` / `nav_links` | Menu items and the flyout panels beneath them |
| `sections` | Every block on the page, ordered by `position` |
| `section_items` | Cards, mission points, highlights and index links |
| `enquiries` | Submissions from the contact form |
| `users` | Admin logins (PBKDF2-SHA256, 120k iterations, per-user salt) |

### Adding a section

In the console: **Page sections → New section**. Give it a slug (used as the
`#anchor`), pick a layout and a background, write the copy, save, then add list
items if the layout uses them.

To ship a section as part of the code instead, add a dictionary to
`SEED_SECTIONS` in `backend/app.py` and delete `arundhati.db` so it reseeds.

### Layouts

| `kind` | Renders as |
|---|---|
| `hero` | Opening gold banner with two buttons and a row of highlights |
| `split` | Heading on the left, paragraphs on the right |
| `cards` | Grid of short statement cards (uses `section_items`) |
| `vision` | Vision panel beside a dark mission panel (mission points are items) |
| `gold` | Gold band, two prose columns, pull quote, highlight strip |
| `band` | Dark centred quote with pill words |
| `index` | Grid of linked cards |
| `admissions` | Text, two buttons and a side note |
| `contact` | Contact details beside the live enquiry form |

Body fields split on blank lines, so a blank line between paragraphs is enough.

## API

Public — no authentication:

| Method | Path | |
|---|---|---|
| `GET` | `/api/content` | Everything the site renders, in one call |
| `POST` | `/api/enquiries` | Contact form submission |
| `GET` | `/api/health` | Health check |

Admin — send `Authorization: Bearer <token>` from `POST /api/auth/login`:

```
GET    /api/admin/stats
GET    /api/admin/settings          PUT /api/admin/settings
GET    /api/admin/sections          POST/PUT/DELETE /api/admin/sections[/{id}]
                                    POST/PUT/DELETE /api/admin/section-items[/{id}]
GET    /api/admin/nav               POST/PUT/DELETE /api/admin/nav[/{id}]
                                    POST/PUT/DELETE /api/admin/nav-links[/{id}]
GET    /api/admin/ticker            POST/PUT/DELETE /api/admin/ticker[/{id}]
GET    /api/admin/enquiries         PUT/DELETE /api/admin/enquiries/{id}
POST   /api/auth/password
```

Interactive documentation is at `/api/docs`.

## Notes

- Tokens are HMAC-signed and expire after 8 hours; there is no server-side session store.
- Sections with **Published** switched off disappear from `/api/content` immediately.
- Deleting a section removes its items; deleting a menu item removes its links.
- The site carries no images — the mandala is inline SVG generated in the browser.
