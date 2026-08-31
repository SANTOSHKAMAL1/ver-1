import React, { useEffect, useMemo, useState } from "react";

/** The eight-fold petal figure printed on the school's notebook covers. */
export function MandalaDefs() {
  const petals = useMemo(() => {
    const out = [];
    for (let k = 0; k < 16; k++) {
      const rot = k * 22.5;
      out.push(
        <path
          key={`a${k}`}
          transform={`rotate(${rot} 200 200)`}
          opacity={k % 2 ? 0.45 : 0.8}
          d="M200 24 C232 84 246 128 246 168 C246 206 226 232 200 232 C174 232 154 206 154 168 C154 128 168 84 200 24z"
        />
      );
      out.push(
        <path
          key={`b${k}`}
          transform={`rotate(${rot + 11.25} 200 200)`}
          opacity={0.35}
          d="M200 96 C218 132 226 152 226 172 C226 192 214 204 200 204 C186 204 174 192 174 172 C174 152 182 132 200 96z"
        />
      );
    }
    return out;
  }, []);

  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <symbol id="mandala" viewBox="0 0 400 400">
        <g fill="currentColor">{petals}</g>
        <g fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="200" cy="200" r="42" opacity="0.6" />
          <circle cx="200" cy="200" r="58" />
          <circle cx="200" cy="200" r="105" opacity="0.5" strokeDasharray="3 4" />
          <circle cx="200" cy="200" r="150" />
          <circle cx="200" cy="200" r="186" />
        </g>
      </symbol>
    </svg>
  );
}

export function Mandala({ className = "mandala", style }) {
  return (
    <svg className={className} style={style} aria-hidden="true">
      <use href="#mandala" />
    </svg>
  );
}

/**
 * The Sarasvatī line drawing from the printed cover. Rendered as a CSS mask so a
 * single file can be tinted per background (maroon on gold, gold on maroon).
 */
export function Emblem({ className = "", style }) {
  return <span className={`emblem ${className}`.trim()} style={style} aria-hidden="true" />;
}

/** The Gurukulam mark lifted off the back cover of the same design. */
export function BrandLogo({ className, alt = "Arundhati Gurukulam" }) {
  return (
    <img
      className={className}
      src="/assets/img/logo.webp"
      width="520"
      height="356"
      alt={alt}
    />
  );
}

export function RocketIcon({ className = "rocket-svg", size = 20 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

/** Splits a text field on blank lines so editors can write real paragraphs. */
export function Paragraphs({ text, className }) {
  if (!text) return null;
  return (
    <>
      {String(text)
        .split(/\n{2,}/)
        .map((p, i) => (
          <p key={i} className={className}>
            {p.trim()}
          </p>
        ))}
    </>
  );
}

export function Lines({ text }) {
  if (!text) return null;
  const parts = String(text).split("\n");
  return parts.map((line, i) => (
    <React.Fragment key={i}>
      {line}
      {i < parts.length - 1 && <br />}
    </React.Fragment>
  ));
}

/**
 * Magic UI Style Dynamic Animated Text Reveal Component
 * Staggers each character with smooth upward motion, blur dispersion and radiant shimmering gradient.
 */
export function DiaTextReveal({
  text = "",
  className = "",
  colors = ["#3B1608", "#CB5B1B", "#D4A114", "#5E260C"],
  delay = 0.04,
}) {
  const characters = Array.from(text);
  const colorGradient = colors && colors.length ? colors.join(", ") : "#3B1608, #CB5B1B, #D4A114";

  return (
    <span
      className={`dia-text-reveal ${className}`.trim()}
      aria-label={text}
      style={{
        "--dia-gradient": `linear-gradient(135deg, ${colorGradient})`,
      }}
    >
      {characters.map((char, index) => {
        if (char === " ") {
          return (
            <span key={index} className="dia-space">
              {" "}
            </span>
          );
        }
        return (
          <span
            key={index}
            className="dia-char"
            style={{
              animationDelay: `${index * delay + 0.12}s`,
            }}
            aria-hidden="true"
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Clean, Simple & Elegant Gurukulam Intro Greeting
 * Click anywhere, scroll, or press Enter/Space to slide up and reveal the website.
 */
export function BootScreen({ name, tagline, promise, onDone }) {
  const [slidingUp, setSlidingUp] = useState(false);
  const [mounted, setMounted] = useState(true);

  const handleEnter = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (slidingUp) return;
    setSlidingUp(true);
    setTimeout(() => {
      setMounted(false);
      if (onDone) onDone();
    }, 720);
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "Escape") {
        handleEnter();
      }
    };
    const handleWheel = (e) => {
      if (e.deltaY > 10) {
        handleEnter();
      }
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [slidingUp]);

  if (!mounted) return null;

  return (
    <div
      id="boot"
      className={slidingUp ? "boot-slide-up" : ""}
      onClick={handleEnter}
      role="button"
      tabIndex={0}
      aria-label="Click anywhere to enter site"
    >
      <div id="intro" className={`simple-intro ${slidingUp ? "out" : ""}`}>
        <div className="intro-in">
          <Emblem className="intro-emblem" />

          <div className="intro-badge">
            <span>GURUKULA PARAMPARA</span>
          </div>

          <h1 className="intro-title">
            <DiaTextReveal
              text={name || "Arundhati Gurukulam"}
              colors={["#3B1608", "#CB5B1B", "#D4A114", "#5E260C"]}
            />
          </h1>
          
          <p className="tag">
            <span className="sanskrit-text">॥ {tagline || "Surakshita · Sushikshita · Susheela"} ॥</span>
          </p>

          <div className="intro-divider">
            <span className="div-line" />
            <span className="div-om">ॐ</span>
            <span className="div-line" />
          </div>

          <p className="say">
            {promise || "Rooted in Character. Inspired by Wisdom. Empowered for the Future."}
          </p>

          <div className="intro-actions">
            <button className="enter-btn" onClick={handleEnter} type="button">
              <span>Enter Gurukulam</span>
              <span className="btn-icon">➔</span>
            </button>
            <span className="intro-click-hint">Click anywhere or scroll to enter</span>
          </div>
        </div>
      </div>
    </div>
  );
}
