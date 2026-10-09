"use client";

import { useState } from "react";
import { RotateCcw, X } from "lucide-react";
import type { IdentityOption } from "../../lib/types";

export function IdentityBoard({
  options,
  storageKey,
}: {
  options: IdentityOption[];
  storageKey: string;
}) {
  const [eliminated, setEliminated] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(
        sessionStorage.getItem(storageKey) || "[]",
      );
      return Array.isArray(saved)
        ? [...new Set(saved)].filter(
            (name): name is string =>
              typeof name === "string" &&
              options.some((option) => option.identity === name),
          )
        : [];
    } catch {
      return [];
    }
  });
  const [hideEliminated, setHideEliminated] = useState(false);
  function update(next: string[]) {
    setEliminated(next);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* The board still works if browser storage is unavailable. */
    }
  }
  function toggle(identity: string) {
    update(
      eliminated.includes(identity)
        ? eliminated.filter((name) => name !== identity)
        : [...eliminated, identity],
    );
  }
  const remaining = options.length - eliminated.length;
  return (
    <section className="panel identity-board" aria-labelledby="board-title">
      <div className="board-heading">
        <div>
          <span className="eyebrow">ÉÉN VAN DEZE BEN JIJ</span>
          <h2 id="board-title">
            Jouw raadbord{" "}
            <span className="count-badge" aria-live="polite">
              {remaining} van {options.length} over
            </span>
          </h2>
          <p>
            Stel je vragen hardop. Tik op een kaartje om het weg te strepen; tik
            nog eens om het terug te zetten.
          </p>
        </div>
        <button
          className="text-button"
          disabled={!eliminated.length}
          onClick={() => update([])}
        >
          <RotateCcw size={15} /> Alles terugzetten
        </button>
      </div>
      <div className="board-toolbar">
        <span>Alleen jij ziet wat je wegstreept.</span>
        <label>
          <input
            type="checkbox"
            checked={hideEliminated}
            onChange={(event) => setHideEliminated(event.target.checked)}
          />{" "}
          Verberg weggestreepte opties
        </label>
      </div>
      {remaining === 0 && (
        <p className="board-empty" role="status">
          Alles weggestreept? Zet een kaartje terug of begin opnieuw met ‘Alles
          terugzetten’.
        </p>
      )}
      <div className="option-grid">
        {options
          .filter(
            (option) =>
              !hideEliminated || !eliminated.includes(option.identity),
          )
          .map((option) => {
            const crossed = eliminated.includes(option.identity);
            return (
              <button
                key={option.identity}
                type="button"
                className={`option-card${crossed ? " eliminated" : ""}`}
                aria-pressed={crossed}
                aria-label={`${option.identity}: ${crossed ? "terugzetten" : "wegstrepen"}`}
                onClick={() => toggle(option.identity)}
              >
                <span className="option-image">
                  {option.image && (
                    <img
                      src={option.image.src}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={160}
                      height={140}
                    />
                  )}
                  <span className="option-cross" aria-hidden="true">
                    <X size={34} />
                  </span>
                </span>
                <span className="option-name">{option.identity}</span>
              </button>
            );
          })}
      </div>
    </section>
  );
}
