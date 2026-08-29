import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { BootScreen, Lines, Mandala, Paragraphs, RocketIcon } from "./common";

/* ───────────────────────── scroll-driven UI components ───────────────────────── */

function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total <= 0) {
        setProgress(0);
        return;
      }
      const current = window.scrollY;
      setProgress(Math.min(Math.max((current / total) * 100, 0), 100));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="scroll-progress-container" aria-hidden="true">
      <div className="scroll-progress-bar" style={{ width: `${progress}%` }} />
    </div>
  );
}

function ScrollTopBtn() {
  const [visible, setVisible] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const pct = total > 0 ? Math.min(Math.max(scrollY / total, 0), 1) : 0;
      setScrollPercent(pct);
      setVisible(scrollY > 280);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const circumference = 2 * Math.PI * 18;
  const strokeDashoffset = circumference - scrollPercent * circumference;

  return (
    <button
      className={`scroll-top-btn ${visible ? "visible" : ""}`}
      onClick={scrollToTop}
      aria-label="Scroll to top of page"
      title="Back to top"
      type="button"
    >
      <svg className="scroll-progress-circle" width="46" height="46" viewBox="0 0 46 46">
        <circle className="circle-bg" cx="23" cy="23" r="18" />
        <circle
          className="circle-meter"
          cx="23"
          cy="23"
          r="18"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: strokeDashoffset,
          }}
        />
      </svg>
      <span className="arrow-icon">↑</span>
    </button>
  );
}



function AnimatedStat({ value }) {
  const [display, setDisplay] = useState(value);
  const ref = useRef(null);
  const animated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;

    const str = String(value || "");
    const match = str.match(/\d+/);
    if (!match) return;

    const targetNum = parseInt(match[0], 10);
    const prefix = str.slice(0, match.index);
    const suffix = str.slice(match.index + match[0].length);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !animated.current) {
            animated.current = true;
            const duration = 1200;
            const startTime = performance.now();

            const step = (now) => {
              const elapsed = now - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const ease = 1 - Math.pow(1 - progress, 4);
              const current = Math.floor(ease * targetNum);
              setDisplay(`${prefix}${current}${suffix}`);
              if (progress < 1) {
                requestAnimationFrame(step);
              } else {
                setDisplay(str);
              }
            };
            requestAnimationFrame(step);
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={ref} className="stat-animated-num">{display}</span>;
}

/* ───────────────────────── navigation ───────────────────────── */

function Flyout({ group }) {
  if (group.kind === "column") {
    const headings = [];
    group.links.forEach((l) => {
      const h = l.heading || "";
      const found = headings.find((x) => x.name === h);
      if (found) found.links.push(l);
      else headings.push({ name: h, links: [l] });
    });
    return (
      <div className="fly col">
        <div className="card-in">
          {headings.map((h) => (
            <React.Fragment key={h.name}>
              {h.name && <p className="grp">{h.name}</p>}
              {h.links.map((l) => (
                <a className="lnk" key={l.id} href={l.href}>
                  {l.label}
                </a>
              ))}
            </React.Fragment>
          ))}
          <a className="btn-out" href="#contact">
            Talk to the office
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="fly wide">
      <div className="card-in">
        <div className="aside">
          <b>{group.label}</b>
          <p>{group.intro}</p>
          <a className="more" href={group.href}>
            Learn more <span>→</span>
          </a>
        </div>
        <div className={`grid${group.links.length === 3 ? " one" : ""}`}>
          {group.links.map((l) => (
            <a className="it" key={l.id} href={l.href}>
              <b>{l.label}</b>
              <span>{l.blurb}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function Nav({ settings, nav }) {
  const [open, setOpen] = useState(null); // id of the open flyout
  const [drawer, setDrawer] = useState(false);
  const barRef = useRef(null);
  const timers = useRef({});

  const isMobile = () => window.matchMedia("(max-width:1080px)").matches;

  useEffect(() => {
    document.body.classList.toggle("nav-open", drawer);
    return () => document.body.classList.remove("nav-open");
  }, [drawer]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(null);
        setDrawer(false);
      }
    };
    const onResize = () => {
      setOpen(null);
      if (window.innerWidth > 1080) setDrawer(false);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  /* keep an open flyout, and its caret, inside the viewport */
  const place = useCallback((li) => {
    const fly = li.querySelector(".fly");
    const card = fly && fly.querySelector(".card-in");
    if (!fly || !card) return;
    fly.style.left = "0px";
    const w = card.offsetWidth;
    const r = li.querySelector("a").getBoundingClientRect();
    const mid = r.left + r.width / 2;
    const gutter = 16;
    let left = mid - w / 2;
    if (left < gutter) left = gutter;
    if (left + w > window.innerWidth - gutter) left = window.innerWidth - gutter - w;
    const host = fly.offsetParent || li;
    const pr = host.getBoundingClientRect();
    fly.style.left = `${left - pr.left}px`;
    fly.style.setProperty("--caret", `${mid - left}px`);
  }, []);

  const enter = (g) => (e) => {
    if (isMobile()) return;
    clearTimeout(timers.current[g.id]);
    setOpen(g.id);
    place(e.currentTarget);
  };
  const leave = (g) => () => {
    if (isMobile()) return;
    timers.current[g.id] = setTimeout(() => setOpen((v) => (v === g.id ? null : v)), 130);
  };
  const click = (g) => (e) => {
    if (!isMobile() || !g.links.length) return;
    e.preventDefault();
    setOpen((v) => (v === g.id ? null : g.id));
  };

  return (
    <>
      <div className="util">
        <div className="row">
          <span className="bit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.6" />
            </svg>
            {settings.locality}
          </span>
          <span className="sep hide-sm" />
          <span className="bit hide-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3.2 2" />
            </svg>
            {settings.hours}
          </span>
          <span className="right">
            <a href={`tel:${(settings.phone || "").replace(/\s/g, "")}`} className="hide-sm">
              {settings.phone}
            </a>
            <a href="#contact">Contact us</a>
          </span>
        </div>
      </div>

      <header className="nav">
        <div className="fbar" ref={barRef}>
          <a href="#top" className="logo">
            <span className="mk">AG</span>
            <span className="wm">
              <b>{settings.school_name}</b>
              <i>{settings.tagline}</i>
            </span>
          </a>

          <button
            className="burger"
            aria-label={drawer ? "Close menu" : "Open menu"}
            aria-expanded={drawer}
            onClick={() => setDrawer((v) => !v)}
            type="button"
          >
            <i />
            <i />
            <i />
          </button>

          <nav className="pill" aria-label="Primary">
            <ul className="menu">
              {nav.map((g) => (
                <li
                  key={g.id}
                  className={`${g.links.length ? "has" : ""} ${open === g.id ? "on" : ""}`.trim()}
                  onMouseEnter={g.links.length ? enter(g) : undefined}
                  onMouseLeave={g.links.length ? leave(g) : undefined}
                >
                  <a
                    href={g.href}
                    aria-haspopup={g.links.length ? "true" : undefined}
                    aria-expanded={g.links.length ? open === g.id : undefined}
                    onClick={(e) => {
                      click(g)(e);
                      if (!g.links.length) setDrawer(false);
                    }}
                  >
                    {g.label}
                    {g.links.length > 0 && <i className="car" />}
                  </a>
                  {g.links.length > 0 && <Flyout group={g} />}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <div className="scrim" onClick={() => setDrawer(false)} />
    </>
  );
}

/* ───────────────────────── sections ───────────────────────── */

const themeClass = { plain: "", tint: " tint", gold: " on-gold", dark: "" };

function Hero({ s, settings }) {
  return (
    <section className="hero" id={s.slug}>
      <div className="silk" />
      <Mandala className="medal" />
      <div className="wrap">
        <div className="hgrid">
          <h1>
            <Lines text={s.title} />
          </h1>
          <p className="lede">{s.body}</p>
          <div className="btns">
            {s.cta_label && (
              <a className="btn solid" href={s.cta_href || "#admissions"}>
                {s.cta_label}
              </a>
            )}
            {s.cta2_label && (
              <a className="btn ghost" href={s.cta2_href || "#about"}>
                {s.cta2_label}
              </a>
            )}
          </div>
          {s.items.length > 0 && (
            <div className="marks">
              {s.items.map((i) => (
                <div key={i.id}>
                  <b>
                    <AnimatedStat value={i.title} />
                  </b>
                  <span>{i.body}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Split({ s }) {
  return (
    <section className={`sec${themeClass[s.theme] || ""}`} id={s.slug}>
      <Mandala style={{ opacity: 0.5 }} />
      <div className="wrap split">
        <div>
          {s.eyebrow && <p className="eyebrow">{s.eyebrow}</p>}
          <h2 className="head">{s.title}</h2>
        </div>
        <div className="lead-col">
          <Paragraphs text={s.body} />
        </div>
      </div>
    </section>
  );
}

function Cards({ s }) {
  return (
    <section className={`sec${themeClass[s.theme] || ""}`} id={s.slug}>
      <div className="wrap">
        {s.eyebrow && <p className="eyebrow">{s.eyebrow}</p>}
        <h2 className="head">{s.title}</h2>
        {s.body && <p className="sec-lede">{s.body}</p>}
        <div className="cards-grid">
          {s.items.map((i, idx) => (
            <div className="card-item rv" key={i.id}>
              <div className="go-corner" aria-hidden="true">
                <div className="go-arrow">→</div>
              </div>
              <div className="card-content">
                <span className="card-num">{String(idx + 1).padStart(2, "0")}</span>
                <p className="card-text">{i.body || i.title}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Vision({ s }) {
  const visionPillars = [
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ),
      title: "Joy of Self-Discovery",
      desc: "Igniting curiosity, independent thinking, and natural enthusiasm for lifelong learning."
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      title: "Rooted Character & Ethics",
      desc: "Instilling timeless Indian values, moral courage, empathy, and integrity in daily conduct."
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
      title: "Empowered Global Citizens",
      desc: "Preparing adaptable, confident learners ready to excel in an interconnected global future."
    }
  ];

  return (
    <section className="sec" id={s.slug}>
      <Mandala style={{ opacity: 0.55 }} />
      <div className="wrap">
        {s.eyebrow && <p className="eyebrow">{s.eyebrow}</p>}
        <h2 className="head">{s.title}</h2>
        <div className="vm">
          <div className="panel rv">
            <p className="eyebrow" style={{ marginBottom: ".6em" }}>
              Our Vision
            </p>
            <h3>{s.subtitle}</h3>
            <p className="vision-main-text">{s.body}</p>

            <div className="vision-pillars">
              {visionPillars.map((vp, idx) => (
                <div className="vp-item" key={idx}>
                  <span className="vp-icon">{vp.icon}</span>
                  <div>
                    <b>{vp.title}</b>
                    <p>{vp.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel dark rv">
            <p className="eyebrow" style={{ marginBottom: "1em" }}>
              {s.aside || "Our Mission"}
            </p>
            <ul className="mission">
              {s.items.map((i, idx) => (
                <li key={i.id}>
                  <span className="m-num">0{idx + 1}</span>
                  <span>{i.body || i.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Gold({ s }) {
  const paras = String(s.body || "").split(/\n{2,}/);
  return (
    <section className="sec on-gold" id={s.slug}>
      <Mandala />
      <div className="wrap">
        {s.eyebrow && (
          <p className="eyebrow" style={{ color: "var(--maroon-dk)" }}>
            {s.eyebrow}
          </p>
        )}
        <h2 className="head">{s.title}</h2>
        <div className="prose-2">
          <div>{paras[0] && <p>{paras[0]}</p>}</div>
          <div>
            {paras.slice(1).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {s.subtitle && <p className="pull">{s.subtitle}</p>}
          </div>
        </div>
        {s.items.length > 0 && (
          <div className="stat-strip">
            {s.items.map((i) => (
              <div className="stat" key={i.id}>
                <b>
                  <AnimatedStat value={i.title} />
                </b>
                <span>{i.body}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Band({ s }) {
  return (
    <section className="band" id={s.slug}>
      <Mandala />
      <div className="wrap">
        <h2>{s.title}</h2>
        {s.subtitle && <p className="lines">{s.subtitle}</p>}
        {s.body && <p className="welcome">{s.body}</p>}
        {s.items.length > 0 && (
          <div className="verbs">
            {s.items.map((i) => (
              <span key={i.id}>{i.title || i.body}</span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function IndexGrid({ s }) {
  return (
    <section className={`sec${themeClass[s.theme] || ""}`} id={s.slug}>
      <Mandala style={{ opacity: 0.45 }} />
      <div className="wrap">
        {s.eyebrow && <p className="eyebrow">{s.eyebrow}</p>}
        <h2 className="head">{s.title}</h2>
        <div className="idx">
          {s.items.map((i) => (
            <a className="ix rv" key={i.id} href={i.href || "#"} id={(i.href || "").replace("#", "")}>
              <b>{i.title}</b>
              <span>{i.body}</span>
            </a>
          ))}
        </div>
        {s.body && <p className="note">{s.body}</p>}
      </div>
    </section>
  );
}

function Admissions({ s }) {
  return (
    <section className={`sec${themeClass[s.theme] || ""}`} id={s.slug}>
      <div className="wrap split">
        <div>
          {s.eyebrow && <p className="eyebrow">{s.eyebrow}</p>}
          <h2 className="head">{s.title}</h2>
        </div>
        <div className="lead-col">
          <Paragraphs text={s.body} />
          <div className="btns" style={{ marginTop: 22 }}>
            {s.cta_label && (
              <a className="btn solid" href={s.cta_href || "#contact"}>
                {s.cta_label}
              </a>
            )}
            {s.cta2_label && (
              <a className="btn ghost" href={s.cta2_href || "#contact"}>
                {s.cta2_label}
              </a>
            )}
          </div>
          {s.aside && (
            <div className="panel rv" id="parents" style={{ marginTop: 30, padding: "24px 26px" }}>
              <p className="eyebrow" style={{ marginBottom: ".6em" }}>
                {s.aside}
              </p>
              <p style={{ margin: 0, color: "#4E2410" }}>{s.subtitle}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function EnquiryForm({ heading, blurb }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", grade: "", message: "" });
  const [state, setState] = useState({ busy: false, ok: "", err: "" });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, ok: "", err: "" });
    try {
      const res = await api.sendEnquiry(form);
      setState({ busy: false, ok: res.message, err: "" });
      setForm({ name: "", email: "", phone: "", grade: "", message: "" });
    } catch (err) {
      setState({ busy: false, ok: "", err: err.message });
    }
  };

  return (
    <div className="cnote">
      {heading && <h3>{heading}</h3>}
      {blurb && <p className="cnote-blurb">{blurb}</p>}
      <form className="enq-form" onSubmit={submit}>
        <div className="two">
          <label>
            <span>Parent / Guardian Name</span>
            <input required minLength={2} value={form.name} onChange={set("name")} placeholder="Full name" />
          </label>
          <label>
            <span>Email Address</span>
            <input required type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" />
          </label>
        </div>
        <div className="two">
          <label>
            <span>Phone</span>
            <input value={form.phone} onChange={set("phone")} placeholder="+91 00000 00000" />
          </label>
          <label>
            <span>Applying For</span>
            <input value={form.grade} onChange={set("grade")} placeholder="Nursery, Grade 1 …" />
          </label>
        </div>
        <label>
          <span>Anything you would like us to know</span>
          <textarea rows={3} value={form.message} onChange={set("message")} placeholder="Enter message or questions (optional)" />
        </label>
        <button className="btn enq-submit-btn" type="submit" disabled={state.busy}>
          {state.busy ? "Sending…" : "Send Enquiry"} <span>↗</span>
        </button>
        {state.ok && <p className="form-ok">{state.ok}</p>}
        {state.err && <p className="form-err">{state.err}</p>}
      </form>
    </div>
  );
}

function Contact({ s, settings }) {
  const rows = [
    {
      label: "Campus",
      value: settings.address,
      icon: (
        <>
          <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.6" />
        </>
      ),
    },
    {
      label: "Phone",
      value: <a href={`tel:${(settings.phone || "").replace(/\s/g, "")}`}>{settings.phone}</a>,
      icon: <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />,
    },
    {
      label: "Email",
      value: <a href={`mailto:${settings.email}`}>{settings.email}</a>,
      icon: (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </>
      ),
    },
    {
      label: "Office hours",
      value: settings.hours,
      icon: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.2 2" />
        </>
      ),
    },
  ];

  return (
    <section className="contact" id={s.slug}>
      <Mandala />
      <div className="wrap">
        {s.eyebrow && <p className="eyebrow">{s.eyebrow}</p>}
        <h2 className="head">{s.title}</h2>
        <div className="cgrid">
          <div className="cbox rv">
            {rows.map((r) => (
              <div className="crow" key={r.label}>
                <span className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {r.icon}
                  </svg>
                </span>
                <div>
                  <b>{r.label}</b>
                  <p>{r.value}</p>
                </div>
              </div>
            ))}
          </div>
          <EnquiryForm heading={s.aside || "Enquire"} blurb={s.body} />
        </div>
      </div>
    </section>
  );
}

const RENDERERS = {
  hero: Hero,
  split: Split,
  cards: Cards,
  vision: Vision,
  gold: Gold,
  band: Band,
  index: IndexGrid,
  admissions: Admissions,
  contact: Contact,
};

/* ───────────────────────── floating contact & call buttons ───────────────────────── */

function FloatingCallBtn({ phone }) {
  const number = phone || "+91 00000 00000";
  const cleanNumber = number.replace(/\s/g, "");
  return (
    <a
      href={`tel:${cleanNumber}`}
      className="floating-call-btn"
      aria-label={`Call us: ${number}`}
      title={`Call Us: ${number}`}
    >
      <span className="call-ring" />
      <span className="call-icon-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </span>
      <span className="call-tooltip">{number}</span>
    </a>
  );
}

function FloatingRocketBtn({ onClick }) {
  return (
    <button
      className="floating-rocket-btn"
      onClick={onClick}
      aria-label="Open Quick Contact Drawer"
      title="Quick Contact & Enquiry"
      type="button"
    >
      <span className="rocket-icon-wrap">
        <RocketIcon size={18} />
      </span>
      <span className="btn-label">Get In Touch</span>
    </button>
  );
}

function ContactDrawer({ open, onClose, settings }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`drawer-scrim ${open ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`contact-drawer-side ${open ? "open" : ""}`}
        aria-label="Contact and Enquiry"
      >
        <div className="drawer-head">
          <div className="drawer-brand">
            <span className="rocket-badge-icon">
              <RocketIcon size={22} />
            </span>
            <div>
              <h3>Get In Touch</h3>
              <p>Admissions Open {settings.admission_year || "2026–27"}</p>
            </div>
          </div>
          <button
            className="drawer-close"
            onClick={onClose}
            aria-label="Close Contact Drawer"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-contact-chips">
            <a
              href={`tel:${(settings.phone || "").replace(/\s/g, "")}`}
              className="dchip"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
              </svg>
              <span>{settings.phone || "+91 96860 32212"}</span>
            </a>
            <a href={`mailto:${settings.email}`} className="dchip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              <span>{settings.email || "support@arundhatigurukulam.com"}</span>
            </a>
          </div>

          <div className="drawer-address-box">
            <b>Campus Location</b>
            <p>{settings.address}</p>
            <span className="dh">{settings.hours}</span>
          </div>

          <div className="drawer-form-wrap">
            <h4>Send Admission Enquiry</h4>
            <EnquiryForm
              heading=""
              blurb="Leave your details below and our admissions office will reach out to you."
            />
          </div>
        </div>
      </aside>
    </>
  );
}

/* ───────────────────────── footer ───────────────────────── */

function Footer({ settings, nav, onReplayIntro, onOpenContact }) {
  const columns = nav.filter((g) => g.links.length).slice(0, 2);
  return (
    <footer>
      <Mandala />
      <div className="wrap">
        <div className="fgrid">
          <div className="fbrand">
            <b>{settings.school_name}</b>
            <i>{settings.tagline}</i>
            <p>{settings.footer_note}</p>
          </div>
          {columns.map((g) => (
            <div key={g.id}>
              <h4>{g.label}</h4>
              <ul>
                {g.links.map((l) => (
                  <li key={l.id}>
                    <a href={l.href}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h4>Reach us</h4>
            <p className="fcontact">
              {settings.address}
              <br />
              <br />
              <a href={`tel:${(settings.phone || "").replace(/\s/g, "")}`}>{settings.phone}</a>
              <br />
              <a href={`mailto:${settings.email}`}>{settings.email}</a>
            </p>
          </div>
        </div>
        <div className="fbot">
          <span>
            © {new Date().getFullYear()} {settings.school_name}, Bengaluru. All rights reserved.
          </span>
          <span>
            Admissions open for {settings.admission_year} ·{" "}
            <a
              href="#contact"
              onClick={(e) => {
                if (onOpenContact) {
                  e.preventDefault();
                  onOpenContact();
                }
              }}
            >
              Contact us
            </a>{" "}
            ·{" "}
            {onReplayIntro && (
              <>
                <a
                  href="#welcome"
                  onClick={(e) => {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    onReplayIntro();
                  }}
                >
                  Welcome Greeting
                </a>{" "}
                ·{" "}
              </>
            )}
            <a href="/admin">Staff login</a>
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ───────────────────────── page ───────────────────────── */

export default function Site() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [booted, setBooted] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    api
      .content()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    document.body.classList.toggle("booting", !booted);
    return () => document.body.classList.remove("booting");
  }, [booted]);

  /* reveal-on-scroll for cards and panels */
  useEffect(() => {
    if (!booted || !data) return undefined;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = document.querySelectorAll(".rv");
    if (reduced || !("IntersectionObserver" in window)) {
      nodes.forEach((n) => n.classList.add("in"));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e, i) => {
          if (e.isIntersecting) {
            const el = e.target;
            setTimeout(() => el.classList.add("in"), i * 70);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [booted, data]);

  const settings = (data && data.settings) || {};

  return (
    <>
      {!booted && (
        <BootScreen
          name={settings.school_name || "Arundhati Gurukulam"}
          tagline={settings.tagline || "Surakshita · Sushikshita · Susheela"}
          promise={settings.promise || "Rooted in Character. Inspired by Wisdom. Empowered for the Future."}
          onDone={() => setBooted(true)}
        />
      )}

      {error && (
        <div className="fatal">
          <h2>The site could not load</h2>
          <p>{error}</p>
        </div>
      )}

      {data && (
        <div className={`shell ${booted ? "shell-ready" : ""}`}>
          <ScrollProgressBar />
          <Nav settings={data.settings} nav={data.nav} />

          <ScrollTopBtn />
          <FloatingRocketBtn onClick={() => setContactOpen(true)} />
          <FloatingCallBtn phone={data.settings.phone} />

          <ContactDrawer
            open={contactOpen}
            onClose={() => setContactOpen(false)}
            settings={data.settings}
          />

          <div className="ticker" aria-label="Announcements">
            <div className="track">
              {[0, 1].map((copy) => (
                <div className="grp" key={copy} aria-hidden={copy === 1}>
                  {data.ticker.map((t) => (
                    <span key={`${copy}-${t.id}`} className={t.highlight ? "hi" : ""}>
                      {t.label}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <main id="top">
            {data.sections.map((s) => {
              const R = RENDERERS[s.kind] || Split;
              return <R key={s.id} s={s} settings={data.settings} />;
            })}
          </main>

          <Footer
            settings={data.settings}
            nav={data.nav}
            onReplayIntro={() => setBooted(false)}
            onOpenContact={() => setContactOpen(true)}
          />
        </div>
      )}
    </>
  );
}
