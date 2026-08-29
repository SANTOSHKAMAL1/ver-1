import React, { useCallback, useEffect, useState } from "react";
import { api, token } from "./api";
import { Mandala } from "./common";

/* ───────────────────────── small building blocks ───────────────────────── */

function Field({ label, hint, children }) {
  return (
    <label className="af">
      <span className="af-label">{label}</span>
      {children}
      {hint && <em className="af-hint">{hint}</em>}
    </label>
  );
}

function Toast({ note, onClose }) {
  useEffect(() => {
    if (!note) return undefined;
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [note, onClose]);
  if (!note) return null;
  return <div className={`toast ${note.kind}`}>{note.text}</div>;
}

function Confirm({ ask, onYes, onNo }) {
  if (!ask) return null;
  return (
    <div className="modal-back" onClick={onNo}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{ask.title}</h3>
        <p>{ask.body}</p>
        <div className="modal-btns">
          <button className="ab ghost" onClick={onNo} type="button">
            Cancel
          </button>
          <button className="ab danger" onClick={onYes} type="button">
            {ask.confirm || "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── login ───────────────────────── */

function Login({ onIn }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await api.login(form.username, form.password);
      token.set(res.token);
      onIn(res.username);
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <Mandala className="mandala login-mandala" />
      <form className="login-card" onSubmit={submit}>
        <div className="seal sm">AG</div>
        <h1>Arundhati Gurukulam</h1>
        <p className="sub">Content management console</p>

        <Field label="Username">
          <input
            autoFocus
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="admin"
            autoComplete="username"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Field>

        {err && <p className="form-err">{err}</p>}

        <button className="ab solid wide" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <a className="back-link" href="/">
          ← Back to the website
        </a>
      </form>
    </div>
  );
}

/* ───────────────────────── dashboard ───────────────────────── */

function Dashboard({ go }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  const tiles = [
    { k: "sections", label: "Sections", note: "content blocks on the site" },
    { k: "visible_sections", label: "Published", note: "currently visible to visitors" },
    { k: "nav_groups", label: "Menu items", note: "top-level navigation entries" },
    { k: "new_enquiries", label: "New enquiries", note: "awaiting a response" },
  ];

  return (
    <div className="pane">
      <header className="pane-head">
        <div>
          <h2>Overview</h2>
          <p>Everything on the public website is managed from here.</p>
        </div>
      </header>

      <div className="tiles">
        {tiles.map((t) => (
          <div className="tile" key={t.k}>
            <b>{stats ? stats[t.k] : "—"}</b>
            <span>{t.label}</span>
            <em>{t.note}</em>
          </div>
        ))}
      </div>

      <div className="quick">
        <h3>Common tasks</h3>
        <div className="quick-grid">
          <button className="qcard" onClick={() => go("sections")} type="button">
            <b>Edit a page section</b>
            <span>Change headings, body copy, buttons and list items.</span>
          </button>
          <button className="qcard" onClick={() => go("nav")} type="button">
            <b>Update the menu</b>
            <span>Add a menu item or change what appears inside a flyout.</span>
          </button>
          <button className="qcard" onClick={() => go("ticker")} type="button">
            <b>Change the announcement strip</b>
            <span>The scrolling gold bar at the top of every page.</span>
          </button>
          <button className="qcard" onClick={() => go("enquiries")} type="button">
            <b>Review admission enquiries</b>
            <span>Messages submitted through the contact form.</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── settings ───────────────────────── */

const SETTING_LABELS = {
  school_name: ["School name", "Shown in the header, footer and browser tab."],
  tagline: ["Tagline", "The Sanskrit motto printed under the name."],
  promise: ["Promise line", "Displayed on the opening splash screen."],
  locality: ["Locality", "Appears in the thin bar above the menu."],
  hours: ["Office hours", "Shown in the top bar and the contact section."],
  address: ["Full address", "Used in the contact section and the footer."],
  phone: ["Phone number", "Rendered as a tap-to-call link."],
  email: ["Email address", "Rendered as a mailto link."],
  admission_year: ["Admission year", "Referenced in the footer line."],
  cta_label: ["Header button label", "The dark button at the right of the menu."],
  footer_note: ["Footer note", "One line under the school name in the footer."],
};

function Settings({ notify }) {
  const [values, setValues] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getSettings().then(setValues).catch((e) => notify("err", e.message));
  }, [notify]);

  if (!values) return <div className="pane">Loading…</div>;

  const save = async () => {
    setBusy(true);
    try {
      await api.putSettings(values);
      notify("ok", "Settings saved.");
    } catch (e) {
      notify("err", e.message);
    }
    setBusy(false);
  };

  const keys = Object.keys(SETTING_LABELS).filter((k) => k in values);
  const extras = Object.keys(values).filter((k) => !(k in SETTING_LABELS));

  return (
    <div className="pane">
      <header className="pane-head">
        <div>
          <h2>Site settings</h2>
          <p>Details that appear across every part of the website.</p>
        </div>
        <button className="ab solid" onClick={save} disabled={busy} type="button">
          {busy ? "Saving…" : "Save changes"}
        </button>
      </header>

      <div className="card-form">
        {[...keys, ...extras].map((k) => {
          const [label, hint] = SETTING_LABELS[k] || [k, ""];
          const long = k === "address" || k === "footer_note";
          return (
            <Field key={k} label={label} hint={hint}>
              {long ? (
                <textarea
                  rows={3}
                  value={values[k]}
                  onChange={(e) => setValues({ ...values, [k]: e.target.value })}
                />
              ) : (
                <input
                  value={values[k]}
                  onChange={(e) => setValues({ ...values, [k]: e.target.value })}
                />
              )}
            </Field>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── sections ───────────────────────── */

const KINDS = [
  ["hero", "Hero — the opening banner"],
  ["split", "Split — heading beside body text"],
  ["cards", "Cards — a grid of short statements"],
  ["vision", "Vision & mission — two panels"],
  ["gold", "Gold band — two columns with highlights"],
  ["band", "Quote band — dark, centred"],
  ["index", "Index — linked cards"],
  ["admissions", "Admissions — text, buttons and a note"],
  ["contact", "Contact — details and the enquiry form"],
];

const THEMES = [
  ["plain", "Cream"],
  ["tint", "Warm cream"],
  ["gold", "Gold"],
  ["dark", "Maroon"],
];

const BLANK_SECTION = {
  slug: "",
  kind: "split",
  eyebrow: "",
  title: "",
  subtitle: "",
  body: "",
  aside: "",
  cta_label: "",
  cta_href: "",
  cta2_label: "",
  cta2_href: "",
  theme: "plain",
  position: 99,
  visible: 1,
};

function SectionEditor({ section, onSave, onDelete, onItems, notify }) {
  const [draft, setDraft] = useState(section);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(section), [section]);

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? (e.target.checked ? 1 : 0) : e.target.value;
    setDraft({ ...draft, [k]: v });
  };

  const save = async () => {
    setBusy(true);
    try {
      const { id, items, ...payload } = draft;
      payload.position = Number(payload.position) || 0;
      await onSave(id, payload);
      notify("ok", `“${payload.title || payload.slug}” saved.`);
    } catch (e) {
      notify("err", e.message);
    }
    setBusy(false);
  };

  return (
    <div className="editor">
      <div className="editor-head">
        <div>
          <h3>{draft.title || draft.slug || "New section"}</h3>
          <code>#{draft.slug}</code>
        </div>
        <div className="editor-actions">
          <label className="switch">
            <input type="checkbox" checked={!!draft.visible} onChange={set("visible")} />
            <span>{draft.visible ? "Published" : "Hidden"}</span>
          </label>
          <button className="ab solid" onClick={save} disabled={busy} type="button">
            {busy ? "Saving…" : "Save section"}
          </button>
          {draft.id && (
            <button className="ab danger" onClick={() => onDelete(draft)} type="button">
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid-2">
        <Field label="Slug" hint="Used as the anchor link, e.g. #about.">
          <input value={draft.slug} onChange={set("slug")} />
        </Field>
        <Field label="Layout" hint="Determines how the content is arranged.">
          <select value={draft.kind} onChange={set("kind")}>
            {KINDS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Background" hint="Colour behind this section.">
          <select value={draft.theme} onChange={set("theme")}>
            {THEMES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Order" hint="Lower numbers appear higher on the page.">
          <input type="number" value={draft.position} onChange={set("position")} />
        </Field>
      </div>

      <Field label="Eyebrow" hint="The small uppercase label above the heading.">
        <input value={draft.eyebrow} onChange={set("eyebrow")} />
      </Field>
      <Field label="Heading">
        <textarea rows={2} value={draft.title} onChange={set("title")} />
      </Field>
      <Field label="Body" hint="Leave a blank line between paragraphs.">
        <textarea rows={5} value={draft.body} onChange={set("body")} />
      </Field>
      <Field label="Secondary text" hint="Vision statement, pull quote or supporting line.">
        <textarea rows={2} value={draft.subtitle} onChange={set("subtitle")} />
      </Field>
      <Field label="Panel heading" hint="Heading of the side panel, where the layout has one.">
        <input value={draft.aside} onChange={set("aside")} />
      </Field>

      <div className="grid-2">
        <Field label="Primary button">
          <input value={draft.cta_label} onChange={set("cta_label")} placeholder="Label" />
        </Field>
        <Field label="Primary button link">
          <input value={draft.cta_href} onChange={set("cta_href")} placeholder="#admissions" />
        </Field>
        <Field label="Secondary button">
          <input value={draft.cta2_label} onChange={set("cta2_label")} placeholder="Label" />
        </Field>
        <Field label="Secondary button link">
          <input value={draft.cta2_href} onChange={set("cta2_href")} placeholder="#about" />
        </Field>
      </div>

      {draft.id && <ItemList section={draft} onItems={onItems} notify={notify} />}
    </div>
  );
}

function ItemList({ section, onItems, notify }) {
  const [items, setItems] = useState(section.items || []);
  useEffect(() => setItems(section.items || []), [section]);

  const change = (id, k, v) =>
    setItems(items.map((i) => (i.id === id ? { ...i, [k]: v } : i)));

  const save = async (item) => {
    try {
      await api.updateItem(item.id, {
        section_id: section.id,
        title: item.title,
        body: item.body,
        href: item.href,
        position: Number(item.position) || 0,
      });
      notify("ok", "Item saved.");
      onItems();
    } catch (e) {
      notify("err", e.message);
    }
  };

  const add = async () => {
    try {
      await api.createItem({
        section_id: section.id,
        title: "",
        body: "New item",
        href: "",
        position: items.length,
      });
      onItems();
    } catch (e) {
      notify("err", e.message);
    }
  };

  const remove = async (id) => {
    try {
      await api.deleteItem(id);
      notify("ok", "Item removed.");
      onItems();
    } catch (e) {
      notify("err", e.message);
    }
  };

  return (
    <div className="items">
      <div className="items-head">
        <h4>List items</h4>
        <button className="ab ghost sm" onClick={add} type="button">
          + Add item
        </button>
      </div>
      <p className="items-note">
        Cards, mission points, highlights and index links are stored here. Empty titles are fine —
        card layouts use the body text alone.
      </p>
      {items.length === 0 && <p className="empty">No items yet.</p>}
      {items.map((i) => (
        <div className="item-row" key={i.id}>
          <input
            className="i-title"
            value={i.title}
            placeholder="Title"
            onChange={(e) => change(i.id, "title", e.target.value)}
          />
          <input
            className="i-body"
            value={i.body}
            placeholder="Description"
            onChange={(e) => change(i.id, "body", e.target.value)}
          />
          <input
            className="i-href"
            value={i.href}
            placeholder="#link"
            onChange={(e) => change(i.id, "href", e.target.value)}
          />
          <input
            className="i-pos"
            type="number"
            value={i.position}
            onChange={(e) => change(i.id, "position", e.target.value)}
          />
          <button className="ab ghost sm" onClick={() => save(i)} type="button">
            Save
          </button>
          <button className="ab danger sm" onClick={() => remove(i.id)} type="button">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function Sections({ notify }) {
  const [list, setList] = useState([]);
  const [pick, setPick] = useState(null);
  const [ask, setAsk] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.listSections();
      setList(data);
      setPick((p) => (p && p.id ? data.find((s) => s.id === p.id) || data[0] : p || data[0]));
    } catch (e) {
      notify("err", e.message);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (id, payload) => {
    if (id) await api.updateSection(id, payload);
    else await api.createSection(payload);
    await load();
  };

  const doDelete = async () => {
    try {
      await api.deleteSection(ask.section.id);
      notify("ok", "Section deleted.");
      setAsk(null);
      setPick(null);
      await load();
    } catch (e) {
      notify("err", e.message);
      setAsk(null);
    }
  };

  return (
    <div className="pane">
      <header className="pane-head">
        <div>
          <h2>Page sections</h2>
          <p>Each block on the public page, in the order visitors meet it.</p>
        </div>
        <button
          className="ab solid"
          onClick={() => setPick({ ...BLANK_SECTION, position: list.length })}
          type="button"
        >
          + New section
        </button>
      </header>

      <div className="split-pane">
        <aside className="list">
          {list.map((s) => (
            <button
              key={s.id}
              className={`row ${pick && pick.id === s.id ? "act" : ""}`}
              onClick={() => setPick(s)}
              type="button"
            >
              <b>{s.title || s.slug}</b>
              <span>
                {s.kind} · #{s.slug}
              </span>
              {!s.visible && <em className="pill-hidden">Hidden</em>}
            </button>
          ))}
        </aside>

        <div className="detail">
          {pick ? (
            <SectionEditor
              key={pick.id || "new"}
              section={pick}
              onSave={save}
              onDelete={(s) =>
                setAsk({
                  section: s,
                  title: "Delete this section?",
                  body: `“${s.title || s.slug}” and its list items will be removed from the website. This cannot be undone.`,
                })
              }
              onItems={load}
              notify={notify}
            />
          ) : (
            <p className="empty">Select a section on the left, or create a new one.</p>
          )}
        </div>
      </div>

      <Confirm ask={ask} onYes={doDelete} onNo={() => setAsk(null)} />
    </div>
  );
}

/* ───────────────────────── navigation ───────────────────────── */

function Navigation({ notify }) {
  const [groups, setGroups] = useState([]);
  const [ask, setAsk] = useState(null);

  const load = useCallback(async () => {
    try {
      setGroups(await api.listNav());
    } catch (e) {
      notify("err", e.message);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const saveGroup = async (g) => {
    try {
      const payload = {
        label: g.label,
        href: g.href,
        kind: g.kind,
        intro: g.intro,
        position: Number(g.position) || 0,
        visible: g.visible ? 1 : 0,
      };
      if (g.id) await api.updateNav(g.id, payload);
      else await api.createNav(payload);
      notify("ok", "Menu item saved.");
      load();
    } catch (e) {
      notify("err", e.message);
    }
  };

  const addGroup = () =>
    setGroups([
      ...groups,
      { label: "New item", href: "#", kind: "link", intro: "", position: groups.length, visible: 1, links: [] },
    ]);

  const change = (idx, k, v) =>
    setGroups(groups.map((g, i) => (i === idx ? { ...g, [k]: v } : g)));

  const saveLink = async (l, groupId) => {
    try {
      const payload = {
        group_id: groupId,
        label: l.label,
        href: l.href,
        blurb: l.blurb,
        heading: l.heading,
        position: Number(l.position) || 0,
      };
      if (l.id) await api.updateNavLink(l.id, payload);
      else await api.createNavLink(payload);
      notify("ok", "Link saved.");
      load();
    } catch (e) {
      notify("err", e.message);
    }
  };

  return (
    <div className="pane">
      <header className="pane-head">
        <div>
          <h2>Navigation</h2>
          <p>Menu items and the panels that open beneath them.</p>
        </div>
        <button className="ab solid" onClick={addGroup} type="button">
          + New menu item
        </button>
      </header>

      {groups.map((g, idx) => (
        <div className="nav-block" key={g.id || `new-${idx}`}>
          <div className="grid-4">
            <Field label="Label">
              <input value={g.label} onChange={(e) => change(idx, "label", e.target.value)} />
            </Field>
            <Field label="Link">
              <input value={g.href} onChange={(e) => change(idx, "href", e.target.value)} />
            </Field>
            <Field label="Type">
              <select value={g.kind} onChange={(e) => change(idx, "kind", e.target.value)}>
                <option value="link">Plain link</option>
                <option value="wide">Wide panel</option>
                <option value="column">Column panel</option>
              </select>
            </Field>
            <Field label="Order">
              <input
                type="number"
                value={g.position}
                onChange={(e) => change(idx, "position", e.target.value)}
              />
            </Field>
          </div>

          {g.kind === "wide" && (
            <Field label="Panel introduction" hint="Shown in the dark block on the left of the flyout.">
              <textarea rows={2} value={g.intro} onChange={(e) => change(idx, "intro", e.target.value)} />
            </Field>
          )}

          <div className="nav-actions">
            <label className="switch">
              <input
                type="checkbox"
                checked={!!g.visible}
                onChange={(e) => change(idx, "visible", e.target.checked ? 1 : 0)}
              />
              <span>{g.visible ? "Visible" : "Hidden"}</span>
            </label>
            <button className="ab solid sm" onClick={() => saveGroup(g)} type="button">
              Save
            </button>
            {g.id && (
              <button
                className="ab danger sm"
                type="button"
                onClick={() =>
                  setAsk({
                    kind: "group",
                    id: g.id,
                    title: "Delete this menu item?",
                    body: `“${g.label}” and its panel links will be removed from the menu.`,
                  })
                }
              >
                Delete
              </button>
            )}
          </div>

          {g.id && (
            <NavLinks
              group={g}
              onSave={saveLink}
              onDelete={(l) =>
                setAsk({
                  kind: "link",
                  id: l.id,
                  title: "Remove this link?",
                  body: `“${l.label}” will no longer appear in the ${g.label} panel.`,
                  confirm: "Remove",
                })
              }
            />
          )}
        </div>
      ))}

      <Confirm
        ask={ask}
        onNo={() => setAsk(null)}
        onYes={async () => {
          try {
            if (ask.kind === "group") await api.deleteNav(ask.id);
            else await api.deleteNavLink(ask.id);
            notify("ok", "Removed.");
          } catch (e) {
            notify("err", e.message);
          }
          setAsk(null);
          load();
        }}
      />
    </div>
  );
}

function NavLinks({ group, onSave, onDelete }) {
  const [links, setLinks] = useState(group.links);
  useEffect(() => setLinks(group.links), [group]);

  const change = (id, k, v) => setLinks(links.map((l) => (l.id === id ? { ...l, [k]: v } : l)));

  return (
    <div className="items">
      <div className="items-head">
        <h4>Panel links</h4>
        <button
          className="ab ghost sm"
          type="button"
          onClick={() =>
            onSave(
              { label: "New link", href: "#", blurb: "", heading: "", position: links.length },
              group.id
            )
          }
        >
          + Add link
        </button>
      </div>
      {links.length === 0 && <p className="empty">No links — this behaves as a plain menu link.</p>}
      {links.map((l) => (
        <div className="item-row wide" key={l.id}>
          <input
            className="i-title"
            value={l.label}
            placeholder="Label"
            onChange={(e) => change(l.id, "label", e.target.value)}
          />
          <input
            className="i-href"
            value={l.href}
            placeholder="#link"
            onChange={(e) => change(l.id, "href", e.target.value)}
          />
          <input
            className="i-body"
            value={l.blurb}
            placeholder="Description (wide panels)"
            onChange={(e) => change(l.id, "blurb", e.target.value)}
          />
          <input
            className="i-head"
            value={l.heading}
            placeholder="Group (column panels)"
            onChange={(e) => change(l.id, "heading", e.target.value)}
          />
          <input
            className="i-pos"
            type="number"
            value={l.position}
            onChange={(e) => change(l.id, "position", e.target.value)}
          />
          <button className="ab ghost sm" onClick={() => onSave(l, group.id)} type="button">
            Save
          </button>
          <button className="ab danger sm" onClick={() => onDelete(l)} type="button">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── ticker ───────────────────────── */

function Ticker({ notify }) {
  const [list, setList] = useState([]);
  const load = useCallback(async () => {
    try {
      setList(await api.listTicker());
    } catch (e) {
      notify("err", e.message);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const change = (id, k, v) => setList(list.map((t) => (t.id === id ? { ...t, [k]: v } : t)));

  const save = async (t) => {
    try {
      const payload = {
        label: t.label,
        highlight: t.highlight ? 1 : 0,
        position: Number(t.position) || 0,
        visible: t.visible ? 1 : 0,
      };
      if (t.id) await api.updateTicker(t.id, payload);
      else await api.createTicker(payload);
      notify("ok", "Announcement saved.");
      load();
    } catch (e) {
      notify("err", e.message);
    }
  };

  return (
    <div className="pane">
      <header className="pane-head">
        <div>
          <h2>Announcement strip</h2>
          <p>The scrolling gold bar. Highlighted entries are shown in red.</p>
        </div>
        <button
          className="ab solid"
          type="button"
          onClick={() => save({ label: "New announcement", highlight: 0, position: list.length, visible: 1 })}
        >
          + New announcement
        </button>
      </header>

      <div className="card-form">
        {list.map((t) => (
          <div className="item-row" key={t.id}>
            <input
              className="i-body"
              value={t.label}
              onChange={(e) => change(t.id, "label", e.target.value)}
            />
            <label className="switch sm">
              <input
                type="checkbox"
                checked={!!t.highlight}
                onChange={(e) => change(t.id, "highlight", e.target.checked ? 1 : 0)}
              />
              <span>Highlight</span>
            </label>
            <label className="switch sm">
              <input
                type="checkbox"
                checked={!!t.visible}
                onChange={(e) => change(t.id, "visible", e.target.checked ? 1 : 0)}
              />
              <span>Visible</span>
            </label>
            <input
              className="i-pos"
              type="number"
              value={t.position}
              onChange={(e) => change(t.id, "position", e.target.value)}
            />
            <button className="ab ghost sm" onClick={() => save(t)} type="button">
              Save
            </button>
            <button
              className="ab danger sm"
              type="button"
              onClick={async () => {
                await api.deleteTicker(t.id);
                notify("ok", "Removed.");
                load();
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── enquiries ───────────────────────── */

function Enquiries({ notify }) {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    try {
      setList(await api.listEnquiries(filter));
    } catch (e) {
      notify("err", e.message);
    }
  }, [filter, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id, status) => {
    await api.updateEnquiry(id, status);
    notify("ok", "Enquiry updated.");
    load();
  };

  return (
    <div className="pane">
      <header className="pane-head">
        <div>
          <h2>Admission enquiries</h2>
          <p>Messages submitted through the contact form on the website.</p>
        </div>
        <select className="filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All enquiries</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="closed">Closed</option>
        </select>
      </header>

      {list.length === 0 && <p className="empty">No enquiries yet.</p>}

      <div className="enq-list">
        {list.map((e) => (
          <div className={`enq-card ${e.status}`} key={e.id}>
            <div className="enq-top">
              <div>
                <b>{e.name}</b>
                <span>
                  <a href={`mailto:${e.email}`}>{e.email}</a>
                  {e.phone && ` · ${e.phone}`}
                  {e.grade && ` · ${e.grade}`}
                </span>
              </div>
              <em className={`badge ${e.status}`}>{e.status}</em>
            </div>
            {e.message && <p>{e.message}</p>}
            <div className="enq-foot">
              <span>{e.created_at}</span>
              <div>
                <button className="ab ghost sm" onClick={() => setStatus(e.id, "contacted")} type="button">
                  Mark contacted
                </button>
                <button className="ab ghost sm" onClick={() => setStatus(e.id, "closed")} type="button">
                  Close
                </button>
                <button
                  className="ab danger sm"
                  type="button"
                  onClick={async () => {
                    await api.deleteEnquiry(e.id);
                    load();
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── account ───────────────────────── */

function Account({ user, notify }) {
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) {
      notify("err", "The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(form.current_password, form.new_password);
      notify("ok", "Password updated.");
      setForm({ current_password: "", new_password: "", confirm: "" });
    } catch (e2) {
      notify("err", e2.message);
    }
    setBusy(false);
  };

  return (
    <div className="pane">
      <header className="pane-head">
        <div>
          <h2>Account</h2>
          <p>Signed in as {user}.</p>
        </div>
      </header>

      <form className="card-form narrow" onSubmit={submit}>
        <p className="warn">
          This installation still uses the default password. Please change it before the site goes live.
        </p>
        <Field label="Current password">
          <input
            type="password"
            value={form.current_password}
            onChange={(e) => setForm({ ...form, current_password: e.target.value })}
          />
        </Field>
        <Field label="New password" hint="At least six characters.">
          <input
            type="password"
            value={form.new_password}
            onChange={(e) => setForm({ ...form, new_password: e.target.value })}
          />
        </Field>
        <Field label="Confirm new password">
          <input
            type="password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </Field>
        <button className="ab solid" type="submit" disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

/* ───────────────────────── shell ───────────────────────── */

const TABS = [
  ["dash", "Overview"],
  ["sections", "Page sections"],
  ["nav", "Navigation"],
  ["ticker", "Announcements"],
  ["settings", "Site settings"],
  ["enquiries", "Enquiries"],
  ["account", "Account"],
];

export default function Admin() {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState("dash");
  const [note, setNote] = useState(null);
  const [menu, setMenu] = useState(false);

  const notify = useCallback((kind, text) => setNote({ kind, text }), []);

  useEffect(() => {
    if (!token.get()) {
      setChecked(true);
      return;
    }
    api
      .me()
      .then((r) => setUser(r.username))
      .catch(() => token.clear())
      .finally(() => setChecked(true));
  }, []);

  if (!checked) return <div className="admin-boot">Loading console…</div>;
  if (!user) return <Login onIn={setUser} />;

  const signOut = () => {
    token.clear();
    setUser(null);
  };

  const panes = {
    dash: <Dashboard go={setTab} />,
    sections: <Sections notify={notify} />,
    nav: <Navigation notify={notify} />,
    ticker: <Ticker notify={notify} />,
    settings: <Settings notify={notify} />,
    enquiries: <Enquiries notify={notify} />,
    account: <Account user={user} notify={notify} />,
  };

  return (
    <div className={`admin ${menu ? "menu-open" : ""}`}>
      <aside className="side">
        <a className="side-brand" href="/">
          <span className="mk">AG</span>
          <span>
            <b>Arundhati Gurukulam</b>
            <i>Content console</i>
          </span>
        </a>
        <nav>
          {TABS.map(([k, label]) => (
            <button
              key={k}
              className={tab === k ? "act" : ""}
              onClick={() => {
                setTab(k);
                setMenu(false);
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <a href="/" target="_blank" rel="noreferrer">
            View website ↗
          </a>
          <button onClick={signOut} type="button">
            Sign out
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <div className="admin-top">
          <button className="hamb" onClick={() => setMenu((v) => !v)} type="button" aria-label="Menu">
            <i />
            <i />
            <i />
          </button>
          <b>{TABS.find(([k]) => k === tab)[1]}</b>
          <a className="ab ghost sm" href="/" target="_blank" rel="noreferrer">
            View site ↗
          </a>
        </div>
        {panes[tab]}
      </div>

      <div className="side-scrim" onClick={() => setMenu(false)} />
      <Toast note={note} onClose={() => setNote(null)} />
    </div>
  );
}
