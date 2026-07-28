"use client";

import { useEffect, useRef, useState } from "react";
import { appVersion, releases } from "../lib/changelog";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function VersionWidget() {
  const [open, setOpen] = useState(false);
  const widgetRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!widgetRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <details
      className="version-widget no-print"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
      ref={widgetRef}
    >
      <summary aria-label={`Open the Quicky Resume version ${appVersion} changelog`}>v{appVersion}</summary>
      <aside aria-label="Quicky Resume changelog" className="changelog-card">
        <div className="changelog-heading">
          <h2>Changelog</h2>
          <span>Latest</span>
        </div>
        {releases.map((release) => (
          <section className="changelog-release" key={release.version}>
            <div>
              <strong>v{release.version}</strong>
              <time dateTime={release.date}>
                {dateFormatter.format(new Date(`${release.date}T00:00:00Z`))}
              </time>
            </div>
            <ul>
              {release.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        ))}
        <p className="font-credit">
          HVD Peace by{" "}
          <a href="https://www.fontspace.com/hvd-peace-font-f23071" rel="noreferrer" target="_blank">
            HVD Fonts
          </a>{" "}
          · CC BY 3.0
        </p>
      </aside>
    </details>
  );
}
