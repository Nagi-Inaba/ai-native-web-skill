"use client";

import { useEffect, useRef, useState } from "react";

export default function DisclosureMenu() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return (
    <nav aria-label="Product categories">
      <button
        ref={buttonRef}
        id="menu-button"
        type="button"
        aria-expanded={open}
        aria-controls="category-links"
        onClick={() => setOpen((value) => !value)}
      >
        Categories
      </button>
      <ul id="category-links" hidden={!open}>
        <li><a href="/new">New arrivals</a></li>
        <li><a href="/sale">Sale products</a></li>
      </ul>
    </nav>
  );
}
