"""
Arundhati Gurukulam — website backend.

FastAPI + SQLite. Serves the public site content as JSON, accepts admission
enquiries, and exposes an authenticated admin API that can edit every section,
navigation entry and setting on the site.

Run:  uvicorn backend.app:app --reload --port 8099
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field

# ─────────────────────────── configuration ───────────────────────────

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("AG_DB", BASE_DIR / "arundhati.db"))
STATIC_DIR = BASE_DIR / "static"
SECRET = os.environ.get("AG_SECRET", "change-this-secret-in-production")
TOKEN_TTL = 60 * 60 * 8  # 8 hours

DEFAULT_ADMIN_USER = os.environ.get("AG_ADMIN_USER", "admin")
DEFAULT_ADMIN_PASS = os.environ.get("AG_ADMIN_PASS", "admin123")


# ─────────────────────────── database ───────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt          TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ticker (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    label     TEXT NOT NULL,
    highlight INTEGER NOT NULL DEFAULT 0,
    position  INTEGER NOT NULL DEFAULT 0,
    visible   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS nav_groups (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    label    TEXT NOT NULL,
    href     TEXT NOT NULL DEFAULT '#',
    kind     TEXT NOT NULL DEFAULT 'link',   -- link | wide | column
    intro    TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0,
    visible  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS nav_links (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES nav_groups(id) ON DELETE CASCADE,
    label    TEXT NOT NULL,
    href     TEXT NOT NULL DEFAULT '#',
    blurb    TEXT NOT NULL DEFAULT '',
    heading  TEXT NOT NULL DEFAULT '',       -- column flyouts group under a heading
    position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sections (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    slug      TEXT NOT NULL UNIQUE,
    kind      TEXT NOT NULL,                 -- hero|split|cards|vision|gold|band|index|admissions|contact
    eyebrow   TEXT NOT NULL DEFAULT '',
    title     TEXT NOT NULL DEFAULT '',
    subtitle  TEXT NOT NULL DEFAULT '',
    body      TEXT NOT NULL DEFAULT '',      -- blank line separates paragraphs
    aside     TEXT NOT NULL DEFAULT '',
    cta_label TEXT NOT NULL DEFAULT '',
    cta_href  TEXT NOT NULL DEFAULT '',
    cta2_label TEXT NOT NULL DEFAULT '',
    cta2_href  TEXT NOT NULL DEFAULT '',
    theme     TEXT NOT NULL DEFAULT 'plain', -- plain|tint|gold|dark
    position  INTEGER NOT NULL DEFAULT 0,
    visible   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS section_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    title      TEXT NOT NULL DEFAULT '',
    body       TEXT NOT NULL DEFAULT '',
    href       TEXT NOT NULL DEFAULT '',
    position   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS enquiries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    phone      TEXT NOT NULL DEFAULT '',
    grade      TEXT NOT NULL DEFAULT '',
    message    TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'new',  -- new | contacted | closed
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def rows(cur: sqlite3.Cursor) -> list[dict[str, Any]]:
    return [dict(r) for r in cur.fetchall()]


# ─────────────────────────── passwords & tokens ───────────────────────────

def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000).hex()


def make_token(username: str) -> str:
    expiry = int(time.time()) + TOKEN_TTL
    payload = f"{username}:{expiry}"
    sig = hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"


def read_token(token: str) -> Optional[str]:
    try:
        username, expiry, sig = token.rsplit(":", 2)
    except ValueError:
        return None
    expected = hmac.new(SECRET.encode(), f"{username}:{expiry}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    if int(expiry) < time.time():
        return None
    return username


def require_admin(authorization: str = Header(default="")) -> str:
    token = authorization.removeprefix("Bearer ").strip()
    username = read_token(token) if token else None
    if not username:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired — please sign in again.")
    return username


# ─────────────────────────── seed data ───────────────────────────

SEED_SETTINGS = {
    "school_name": "Arundhati Gurukulam",
    "tagline": "Surakshita · Sushikshita · Susheela",
    "promise": "Rooted in Character. Inspired by Wisdom. Empowered for the Future.",
    "locality": "Shankarapuram, Basavanagudi, Bengaluru",
    "hours": "Monday to Saturday · 9.00 am – 4.00 pm",
    "address": ("No. 2, Arundhati Gurukulam, Raghavasadanam, Pampa Mahakavi Road, "
                "Uttaradi Math Compound, Shankarapuram, Basavanagudi, Bengaluru, Karnataka 560004"),
    "phone": "+91 96860 32212",
    "email": "support@arundhatigurukulam.com",
    "admission_year": "2026–27",
    "cta_label": "Get In Touch",
    "footer_note": "Rooted in Character. Inspired by Wisdom. Empowered for the Future.",
}

SEED_TICKER = [
    ("Admissions Open 2026–27", 1), ("Academic Year 2026–27", 0),
    ("Nursery to Grade 5", 1), ("Limited Seats Available", 0),
    ("Schedule a Campus Tour", 1), ("Surakshita · Sushikshita · Susheela", 0),
]

SEED_NAV = [
    {"label": "Home", "href": "#top", "kind": "link", "intro": "", "links": []},
    {
        "label": "About us", "href": "#about", "kind": "wide",
        "intro": "A learning space where education goes beyond textbooks, examinations and marks.",
        "links": [
            ("Our Vision & Mission", "#vision", "What we are building, and how we intend to get there.", ""),
            ("Educational Philosophy", "#philosophy", "Why learning here is a way of life, not a timetable.", ""),
            ("Why Arundhati Gurukulam", "#why", "What makes a child's years with us different.", ""),
            ("Faculty & Mentoring", "#faculty", "The teachers who walk alongside each learner.", ""),
        ],
    },
    {
        "label": "Academics", "href": "#heritage", "kind": "wide",
        "intro": "Timeless wisdom from Indian knowledge traditions, meeting the curiosity of the modern world.",
        "links": [
            ("Indian Knowledge & Heritage", "#heritage", "Roots that make the future stronger, not smaller.", ""),
            ("Beyond the Classroom", "#beyond", "Experience, exploration and discovery as method.", ""),
            ("How We Teach", "#philosophy", "Question, explore, create, collaborate, reflect.", ""),
            ("What We Nurture", "#vision", "Confidence, empathy, discipline, responsibility.", ""),
        ],
    },
    {
        "label": "Campus Life", "href": "#sitemap", "kind": "wide",
        "intro": "A community of learners — children, educators and parents growing together.",
        "links": [
            ("Child Safety & Well-being", "#safety", "How we keep every child safe, seen and supported.", ""),
            ("Campus & Facilities", "#campus", "Spaces for study, play, art, movement and quiet.", ""),
            ("News & Events", "#news", "Festivals, workshops and what's happening this term.", ""),
        ],
    },
    {
        "label": "Admissions", "href": "#admissions", "kind": "column", "intro": "",
        "links": [
            ("Admission process", "#admissions", "", "For Parents"),
            ("Parent partnership", "#parents", "", "For Parents"),
            ("What we look for", "#vision", "", "For Parents"),
            ("Book a campus visit", "#contact", "", "Visit Us"),
            ("Campus & facilities", "#campus", "", "Visit Us"),
        ],
    },
    {"label": "Contact Us", "href": "#contact", "kind": "link", "intro": "", "links": []},
]

SEED_SECTIONS = [
    {
        "slug": "hero", "kind": "hero", "theme": "gold",
        "eyebrow": "Shankarapuram, Basavanagudi, Bengaluru",
        "title": "Rooted in Character.\nInspired by Wisdom.\nEmpowered for the Future.",
        "subtitle": "",
        "body": ("Arundhati Gurukulam is an exemplary institution of learning where education transcends "
                 "conventional academics. True education shapes not only what a student learns, "
                 "but the character, intellect, and leadership they embody."),
        "cta_label": "Apply for 2026–27", "cta_href": "#admissions",
        "cta2_label": "Explore the Gurukulam", "cta2_href": "#about",
        "items": [
            ("Indian Roots", "Timeless heritage integrated into contemporary learning", ""),
            ("Modern Pedagogy", "Fostering inquiry, critical thinking, and innovation", ""),
            ("Holistic Development", "Nurturing mind, character, and emotional well-being", ""),
        ],
    },
    {
        "slug": "about", "kind": "split", "theme": "plain",
        "eyebrow": "About Arundhati Gurukulam",
        "title": "Timeless wisdom, meeting a curious modern world",
        "body": ("At Arundhati Gurukulam, the timeless wisdom of Indian knowledge traditions meets the "
                 "curiosity, creativity and possibilities of the modern world. We seek to nurture learners "
                 "who are thoughtful, confident, compassionate and intellectually fearless.\n\n"
                 "Our approach encourages children to question, explore, create, collaborate and reflect — "
                 "while remaining grounded in values, culture and respect."),
        "items": [],
    },
    {
        "slug": "philosophy", "kind": "cards", "theme": "tint",
        "eyebrow": "Our Educational Philosophy",
        "title": "Where learning becomes a way of life",
        "body": "A child does not learn only inside a classroom.",
        "items": [
            ("", "A question can begin a lesson.", ""),
            ("", "A story can open a new world.", ""),
            ("", "A mistake can become a teacher.", ""),
            ("", "A tradition can become a doorway to understanding.", ""),
            ("", "And curiosity can become the beginning of lifelong learning.", ""),
        ],
    },
    {
        "slug": "vision", "kind": "vision", "theme": "plain",
        "eyebrow": "Our Vision & Mission",
        "title": "What we are building, and how",
        "subtitle": "Every child discovers the joy of learning",
        "body": ("To create an institution where every child develops a strong sense of self and grows "
                 "into a responsible, capable and compassionate citizen of the world."),
        "aside": "Our Mission",
        "items": [
            ("", "To provide a stimulating and inclusive learning environment.", ""),
            ("", "To develop curiosity, critical thinking, creativity and problem-solving abilities.", ""),
            ("", "To integrate Indian cultural heritage and values meaningfully into contemporary education.", ""),
            ("", "To encourage learning through experience, exploration and discovery.", ""),
            ("", "To nurture confidence, empathy, discipline and responsibility.", ""),
            ("", "To prepare learners for a rapidly changing world without disconnecting them from their roots.", ""),
        ],
    },
    {
        "slug": "heritage", "kind": "gold", "theme": "gold",
        "eyebrow": "Indian Knowledge & Cultural Heritage",
        "title": "Education that connects roots with possibilities",
        "body": ("We do not believe that being modern means leaving our roots behind. We believe the future "
                 "becomes stronger when children understand where they come from.\n\n"
                 "Arundhati Gurukulam therefore brings together academic excellence, Indian knowledge "
                 "traditions, scientific temper, creativity, technology, physical well-being, arts and "
                 "ethical values."),
        "subtitle": ("Our goal is not simply to raise children who can compete with the world. "
                     "Our goal is to raise children who can contribute to it."),
        "items": [
            ("Academic excellence", "Strong foundations, taught well", ""),
            ("Scientific temper", "Ask, test, understand", ""),
            ("Arts & creativity", "Expression as a daily habit", ""),
            ("Physical well-being", "Movement, play and rest", ""),
        ],
    },
    {
        "slug": "beyond", "kind": "split", "theme": "plain",
        "eyebrow": "Beyond the Classroom",
        "title": "More than a school — a community of learners",
        "body": ("Arundhati Gurukulam aspires to be a community where children, educators and parents grow "
                 "together. Here, education is not measured only by report cards.\n\n"
                 "It is also seen in the confidence to ask a question, the courage to try again, the kindness "
                 "shown to another person, the ability to think independently and the willingness to take "
                 "responsibility."),
        "items": [],
    },
    {
        "slug": "why", "kind": "band", "theme": "dark",
        "title": "Every child has a story. Every mind has a possibility.",
        "subtitle": "Every possibility deserves the right environment.",
        "body": "Welcome to Arundhati Gurukulam",
        "items": [("Learn", "", ""), ("Explore", "", ""), ("Grow", "", ""), ("Lead", "", "")],
    },
    {
        "slug": "sitemap", "kind": "index", "theme": "plain",
        "eyebrow": "Explore the Gurukulam",
        "title": "The rest of our story",
        "body": "These pages are being written now and will open here shortly.",
        "items": [
            ("Child Safety & Well-being", "How we keep every child safe, seen and supported through the school day.", "#safety"),
            ("Faculty & Mentoring", "The teachers and mentors who walk alongside each learner.", "#faculty"),
            ("Campus & Facilities", "Our spaces for study, play, art, movement and quiet.", "#campus"),
            ("News & Events", "Festivals, workshops, assemblies and what's happening this term.", "#news"),
        ],
    },
    {
        "slug": "admissions", "kind": "admissions", "theme": "tint",
        "eyebrow": "Admissions 2026–27",
        "title": "Begin the conversation",
        "body": ("Admissions for the academic year 2026–27 are open. We meet every family personally — "
                 "a visit to the campus tells you far more about us than any brochure can."),
        "aside": "Parent Partnership",
        "subtitle": ("Children, educators and parents grow together here. Families are part of the "
                     "learning — not an audience for it."),
        "cta_label": "Book a campus visit", "cta_href": "#contact",
        "cta2_label": "Talk to the office", "cta2_href": "#contact",
        "items": [],
    },
    {
        "slug": "contact", "kind": "contact", "theme": "tint",
        "eyebrow": "Contact Us",
        "title": "Come and see the Gurukulam",
        "aside": "Enquire about 2026–27",
        "body": ("Tell us a little about your child and we will arrange a visit. You will meet the team, "
                 "walk the campus and ask everything you want to ask."),
        "items": [],
    },
]


def seed() -> None:
    with db() as conn:
        conn.executescript(SCHEMA)

        cur = conn.execute("SELECT COUNT(*) c FROM users")
        if cur.fetchone()["c"] == 0:
            salt = secrets.token_hex(16)
            conn.execute(
                "INSERT INTO users (username, password_hash, salt) VALUES (?,?,?)",
                (DEFAULT_ADMIN_USER, hash_password(DEFAULT_ADMIN_PASS, salt), salt),
            )

        for key, value in SEED_SETTINGS.items():
            conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)", (key, value))

        if conn.execute("SELECT COUNT(*) c FROM ticker").fetchone()["c"] == 0:
            for i, (label, hi) in enumerate(SEED_TICKER):
                conn.execute(
                    "INSERT INTO ticker (label, highlight, position) VALUES (?,?,?)", (label, hi, i)
                )

        if conn.execute("SELECT COUNT(*) c FROM nav_groups").fetchone()["c"] == 0:
            for i, g in enumerate(SEED_NAV):
                cur = conn.execute(
                    "INSERT INTO nav_groups (label, href, kind, intro, position) VALUES (?,?,?,?,?)",
                    (g["label"], g["href"], g["kind"], g["intro"], i),
                )
                gid = cur.lastrowid
                for j, (label, href, blurb, heading) in enumerate(g["links"]):
                    conn.execute(
                        "INSERT INTO nav_links (group_id, label, href, blurb, heading, position)"
                        " VALUES (?,?,?,?,?,?)",
                        (gid, label, href, blurb, heading, j),
                    )

        if conn.execute("SELECT COUNT(*) c FROM sections").fetchone()["c"] == 0:
            for i, s in enumerate(SEED_SECTIONS):
                cur = conn.execute(
                    """INSERT INTO sections
                       (slug, kind, eyebrow, title, subtitle, body, aside,
                        cta_label, cta_href, cta2_label, cta2_href, theme, position)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (s["slug"], s["kind"], s.get("eyebrow", ""), s.get("title", ""),
                     s.get("subtitle", ""), s.get("body", ""), s.get("aside", ""),
                     s.get("cta_label", ""), s.get("cta_href", ""),
                     s.get("cta2_label", ""), s.get("cta2_href", ""),
                     s.get("theme", "plain"), i),
                )
                sid = cur.lastrowid
                for j, (title, body, href) in enumerate(s.get("items", [])):
                    conn.execute(
                        "INSERT INTO section_items (section_id, title, body, href, position)"
                        " VALUES (?,?,?,?,?)",
                        (sid, title, body, href, j),
                    )


# ─────────────────────────── schemas ───────────────────────────

class LoginIn(BaseModel):
    username: str
    password: str


class PasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class SettingsIn(BaseModel):
    values: dict[str, str]


class TickerIn(BaseModel):
    label: str = Field(min_length=1)
    highlight: int = 0
    position: int = 0
    visible: int = 1


class NavGroupIn(BaseModel):
    label: str = Field(min_length=1)
    href: str = "#"
    kind: str = "link"
    intro: str = ""
    position: int = 0
    visible: int = 1


class NavLinkIn(BaseModel):
    group_id: int
    label: str = Field(min_length=1)
    href: str = "#"
    blurb: str = ""
    heading: str = ""
    position: int = 0


class SectionIn(BaseModel):
    slug: str = Field(min_length=1)
    kind: str = "split"
    eyebrow: str = ""
    title: str = ""
    subtitle: str = ""
    body: str = ""
    aside: str = ""
    cta_label: str = ""
    cta_href: str = ""
    cta2_label: str = ""
    cta2_href: str = ""
    theme: str = "plain"
    position: int = 0
    visible: int = 1


class SectionItemIn(BaseModel):
    section_id: int
    title: str = ""
    body: str = ""
    href: str = ""
    position: int = 0


class EnquiryIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(default="", max_length=40)
    grade: str = Field(default="", max_length=60)
    message: str = Field(default="", max_length=2000)


class EnquiryStatusIn(BaseModel):
    status: str


# ─────────────────────────── app ───────────────────────────

app = FastAPI(title="Arundhati Gurukulam", version="1.0.0", docs_url="/api/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    seed()


# ── public ────────────────────────────────────────────────────

@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "db": str(DB_PATH.name)}


@app.get("/api/content")
def content() -> dict[str, Any]:
    """Everything the public site needs, in one request."""
    with db() as conn:
        settings = {r["key"]: r["value"] for r in conn.execute("SELECT * FROM settings")}
        ticker = rows(conn.execute(
            "SELECT * FROM ticker WHERE visible=1 ORDER BY position, id"))

        groups = rows(conn.execute(
            "SELECT * FROM nav_groups WHERE visible=1 ORDER BY position, id"))
        links = rows(conn.execute("SELECT * FROM nav_links ORDER BY position, id"))
        for g in groups:
            g["links"] = [l for l in links if l["group_id"] == g["id"]]

        sections = rows(conn.execute(
            "SELECT * FROM sections WHERE visible=1 ORDER BY position, id"))
        items = rows(conn.execute("SELECT * FROM section_items ORDER BY position, id"))
        for s in sections:
            s["items"] = [i for i in items if i["section_id"] == s["id"]]

    return {"settings": settings, "ticker": ticker, "nav": groups, "sections": sections}


@app.post("/api/enquiries", status_code=201)
def create_enquiry(payload: EnquiryIn) -> dict[str, Any]:
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO enquiries (name, email, phone, grade, message) VALUES (?,?,?,?,?)",
            (payload.name.strip(), str(payload.email), payload.phone.strip(),
             payload.grade.strip(), payload.message.strip()),
        )
    return {"id": cur.lastrowid, "message": "Thank you. The admissions office will be in touch shortly."}


# ── auth ──────────────────────────────────────────────────────

@app.post("/api/auth/login")
def login(payload: LoginIn) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username=?", (payload.username.strip(),)
        ).fetchone()
    if not row or not hmac.compare_digest(
        row["password_hash"], hash_password(payload.password, row["salt"])
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect username or password.")
    return {"token": make_token(row["username"]), "username": row["username"]}


@app.get("/api/auth/me")
def me(user: str = Depends(require_admin)) -> dict[str, str]:
    return {"username": user}


@app.post("/api/auth/password")
def change_password(payload: PasswordIn, user: str = Depends(require_admin)) -> dict[str, str]:
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE username=?", (user,)).fetchone()
        if not hmac.compare_digest(
            row["password_hash"], hash_password(payload.current_password, row["salt"])
        ):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect.")
        salt = secrets.token_hex(16)
        conn.execute(
            "UPDATE users SET password_hash=?, salt=? WHERE username=?",
            (hash_password(payload.new_password, salt), salt, user),
        )
    return {"message": "Password updated."}


# ── admin: settings ───────────────────────────────────────────

@app.get("/api/admin/settings")
def get_settings(user: str = Depends(require_admin)) -> dict[str, str]:
    with db() as conn:
        return {r["key"]: r["value"] for r in conn.execute("SELECT * FROM settings ORDER BY key")}


@app.put("/api/admin/settings")
def put_settings(payload: SettingsIn, user: str = Depends(require_admin)) -> dict[str, str]:
    with db() as conn:
        for k, v in payload.values.items():
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?,?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (k, v),
            )
    return {"message": "Settings saved."}


# ── generic CRUD helpers ──────────────────────────────────────

def _list(table: str, order: str = "position, id") -> list[dict[str, Any]]:
    with db() as conn:
        return rows(conn.execute(f"SELECT * FROM {table} ORDER BY {order}"))


def _insert(table: str, data: dict[str, Any]) -> dict[str, Any]:
    cols = ", ".join(data)
    marks = ", ".join("?" for _ in data)
    with db() as conn:
        cur = conn.execute(f"INSERT INTO {table} ({cols}) VALUES ({marks})", tuple(data.values()))
        row = conn.execute(f"SELECT * FROM {table} WHERE id=?", (cur.lastrowid,)).fetchone()
    return dict(row)


def _update(table: str, item_id: int, data: dict[str, Any]) -> dict[str, Any]:
    sets = ", ".join(f"{k}=?" for k in data)
    with db() as conn:
        cur = conn.execute(
            f"UPDATE {table} SET {sets} WHERE id=?", (*data.values(), item_id)
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "Not found.")
        row = conn.execute(f"SELECT * FROM {table} WHERE id=?", (item_id,)).fetchone()
    return dict(row)


def _delete(table: str, item_id: int) -> dict[str, str]:
    with db() as conn:
        cur = conn.execute(f"DELETE FROM {table} WHERE id=?", (item_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Not found.")
    return {"message": "Deleted."}


# ── admin: ticker ─────────────────────────────────────────────

@app.get("/api/admin/ticker")
def ticker_list(user: str = Depends(require_admin)):
    return _list("ticker")


@app.post("/api/admin/ticker", status_code=201)
def ticker_create(payload: TickerIn, user: str = Depends(require_admin)):
    return _insert("ticker", payload.model_dump())


@app.put("/api/admin/ticker/{item_id}")
def ticker_update(item_id: int, payload: TickerIn, user: str = Depends(require_admin)):
    return _update("ticker", item_id, payload.model_dump())


@app.delete("/api/admin/ticker/{item_id}")
def ticker_delete(item_id: int, user: str = Depends(require_admin)):
    return _delete("ticker", item_id)


# ── admin: navigation ─────────────────────────────────────────

@app.get("/api/admin/nav")
def nav_list(user: str = Depends(require_admin)):
    with db() as conn:
        groups = rows(conn.execute("SELECT * FROM nav_groups ORDER BY position, id"))
        links = rows(conn.execute("SELECT * FROM nav_links ORDER BY position, id"))
    for g in groups:
        g["links"] = [l for l in links if l["group_id"] == g["id"]]
    return groups


@app.post("/api/admin/nav", status_code=201)
def nav_create(payload: NavGroupIn, user: str = Depends(require_admin)):
    return _insert("nav_groups", payload.model_dump())


@app.put("/api/admin/nav/{group_id}")
def nav_update(group_id: int, payload: NavGroupIn, user: str = Depends(require_admin)):
    return _update("nav_groups", group_id, payload.model_dump())


@app.delete("/api/admin/nav/{group_id}")
def nav_delete(group_id: int, user: str = Depends(require_admin)):
    return _delete("nav_groups", group_id)


@app.post("/api/admin/nav-links", status_code=201)
def nav_link_create(payload: NavLinkIn, user: str = Depends(require_admin)):
    return _insert("nav_links", payload.model_dump())


@app.put("/api/admin/nav-links/{link_id}")
def nav_link_update(link_id: int, payload: NavLinkIn, user: str = Depends(require_admin)):
    return _update("nav_links", link_id, payload.model_dump())


@app.delete("/api/admin/nav-links/{link_id}")
def nav_link_delete(link_id: int, user: str = Depends(require_admin)):
    return _delete("nav_links", link_id)


# ── admin: sections ───────────────────────────────────────────

@app.get("/api/admin/sections")
def sections_list(user: str = Depends(require_admin)):
    with db() as conn:
        secs = rows(conn.execute("SELECT * FROM sections ORDER BY position, id"))
        items = rows(conn.execute("SELECT * FROM section_items ORDER BY position, id"))
    for s in secs:
        s["items"] = [i for i in items if i["section_id"] == s["id"]]
    return secs


@app.post("/api/admin/sections", status_code=201)
def section_create(payload: SectionIn, user: str = Depends(require_admin)):
    with db() as conn:
        exists = conn.execute("SELECT 1 FROM sections WHERE slug=?", (payload.slug,)).fetchone()
    if exists:
        raise HTTPException(400, f"A section with the slug '{payload.slug}' already exists.")
    return _insert("sections", payload.model_dump())


@app.put("/api/admin/sections/{section_id}")
def section_update(section_id: int, payload: SectionIn, user: str = Depends(require_admin)):
    return _update("sections", section_id, payload.model_dump())


@app.delete("/api/admin/sections/{section_id}")
def section_delete(section_id: int, user: str = Depends(require_admin)):
    return _delete("sections", section_id)


@app.post("/api/admin/section-items", status_code=201)
def item_create(payload: SectionItemIn, user: str = Depends(require_admin)):
    return _insert("section_items", payload.model_dump())


@app.put("/api/admin/section-items/{item_id}")
def item_update(item_id: int, payload: SectionItemIn, user: str = Depends(require_admin)):
    return _update("section_items", item_id, payload.model_dump())


@app.delete("/api/admin/section-items/{item_id}")
def item_delete(item_id: int, user: str = Depends(require_admin)):
    return _delete("section_items", item_id)


# ── admin: enquiries ──────────────────────────────────────────

@app.get("/api/admin/enquiries")
def enquiries_list(
    status_filter: str = Query(default="", alias="status"),
    user: str = Depends(require_admin),
):
    with db() as conn:
        if status_filter:
            cur = conn.execute(
                "SELECT * FROM enquiries WHERE status=? ORDER BY id DESC", (status_filter,))
        else:
            cur = conn.execute("SELECT * FROM enquiries ORDER BY id DESC")
        return rows(cur)


@app.put("/api/admin/enquiries/{enquiry_id}")
def enquiry_update(enquiry_id: int, payload: EnquiryStatusIn, user: str = Depends(require_admin)):
    if payload.status not in {"new", "contacted", "closed"}:
        raise HTTPException(400, "Status must be new, contacted or closed.")
    return _update("enquiries", enquiry_id, {"status": payload.status})


@app.delete("/api/admin/enquiries/{enquiry_id}")
def enquiry_delete(enquiry_id: int, user: str = Depends(require_admin)):
    return _delete("enquiries", enquiry_id)


@app.get("/api/admin/stats")
def stats(user: str = Depends(require_admin)) -> dict[str, int]:
    with db() as conn:
        one = lambda q: conn.execute(q).fetchone()[0]
        return {
            "sections": one("SELECT COUNT(*) FROM sections"),
            "visible_sections": one("SELECT COUNT(*) FROM sections WHERE visible=1"),
            "nav_groups": one("SELECT COUNT(*) FROM nav_groups"),
            "ticker": one("SELECT COUNT(*) FROM ticker"),
            "enquiries": one("SELECT COUNT(*) FROM enquiries"),
            "new_enquiries": one("SELECT COUNT(*) FROM enquiries WHERE status='new'"),
        }


# ── static site (mounted last so /api wins) ───────────────────

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/styles.css", include_in_schema=False)
    def styles():
        return FileResponse(STATIC_DIR / "styles.css", media_type="text/css")

    @app.get("/{rest:path}", include_in_schema=False)
    def spa(rest: str = ""):
        return FileResponse(STATIC_DIR / "index.html")


@app.exception_handler(HTTPException)
def http_error(request, exc: HTTPException):
    if exc.status_code == 404 and not request.url.path.startswith("/api"):
        if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
            return FileResponse(STATIC_DIR / "index.html")
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


@app.exception_handler(404)
def not_found_handler(request, exc):
    if not request.url.path.startswith("/api"):
        if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
            return FileResponse(STATIC_DIR / "index.html")
    return JSONResponse({"detail": "Not Found"}, status_code=404)


if __name__ == "__main__":
    import uvicorn

    seed()
    uvicorn.run("backend.app:app", host="0.0.0.0", port=8099, reload=True)

