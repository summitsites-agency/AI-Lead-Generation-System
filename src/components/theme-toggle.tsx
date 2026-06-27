"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

/** Toggles the `light` class on <html> and persists the choice. */
export function ThemeToggle() {
  const [light, setLight] = useState(false);

  // Sync initial state from the class the pre-hydration script already applied.
  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  const toggle = () => {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("theme", next ? "light" : "dark");
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      onClick={toggle}
      title={light ? "Switch to dark" : "Switch to light"}
      aria-label="Toggle theme"
      className="grid h-8 w-8 place-items-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
    >
      {light ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
