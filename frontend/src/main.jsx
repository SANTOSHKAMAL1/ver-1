import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Site from "./Site";
import Admin from "./Admin";
import NotFound from "./NotFound";

function App() {
  const [currentPath, setCurrentPath] = useState(
    window.location.pathname.replace(/\/+$/, "")
  );

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname.replace(/\/+$/, ""));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const isHome =
    currentPath === "" || currentPath === "/" || currentPath === "/index.html";
  const isAdmin = currentPath === "/admin";

  let content;
  if (isAdmin) {
    content = <Admin />;
  } else if (isHome) {
    content = <Site />;
  } else {
    content = <NotFound />;
  }

  return content;
}

createRoot(document.getElementById("root")).render(<App />);

