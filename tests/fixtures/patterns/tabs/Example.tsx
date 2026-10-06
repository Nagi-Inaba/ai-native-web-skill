"use client";

import { useRef, useState } from "react";

const tabs = [
  { id: "overview", label: "Overview", content: "A lightweight model for everyday use." },
  { id: "specs", label: "Specifications", content: "It weighs 1.2 kg." }
] as const;

export default function Tabs() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function moveFocus(index: number) {
    const next = (index + tabs.length) % tabs.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <>
      <div role="tablist" aria-label="Product information">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => { tabRefs.current[index] = node; }}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active === index}
            aria-controls={`panel-${tab.id}`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") moveFocus(index + 1);
              else if (event.key === "ArrowLeft") moveFocus(index - 1);
              else if (event.key === "Home") moveFocus(0);
              else if (event.key === "End") moveFocus(tabs.length - 1);
              else return;
              event.preventDefault();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <section
          key={tab.id}
          id={`panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          tabIndex={0}
          hidden={active !== index}
        >
          <p>{tab.content}</p>
        </section>
      ))}
    </>
  );
}
