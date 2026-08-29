import React from "react";

export default function NotFound() {
  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  const handleGoHome = () => {
    window.location.href = "/";
  };

  return (
    <div className="not-found-page">
      <div className="nf-container">
        <span className="nf-badge">404 error</span>
        <h1 className="nf-title">We can't find that page</h1>
        <p className="nf-desc">
          Sorry, the page you are looking for doesn't exist or has been moved.
        </p>
        <div className="nf-actions">
          <button className="nf-btn ghost" onClick={handleGoBack} type="button">
            <svg
              className="nf-arrow-icon"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M15.8332 10H4.1665M4.1665 10L9.99984 15.8333M4.1665 10L9.99984 4.16667"
                stroke="currentColor"
                strokeWidth="1.67"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Go back
          </button>
          <button className="nf-btn primary" onClick={handleGoHome} type="button">
            Take me home
          </button>
        </div>
      </div>
    </div>
  );
}

