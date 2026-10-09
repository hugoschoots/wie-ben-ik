import { Sparkles } from "lucide-react";

export function TurnBanner({
  myTurn,
  name,
}: {
  myTurn: boolean;
  name?: string;
}) {
  return (
    <div
      className={`turn-banner${myTurn ? " turn-banner-active" : ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="turn-banner-symbol" aria-hidden="true">
        {myTurn ? <Sparkles size={26} /> : "💬"}
      </span>
      <div>
        <strong>
          {myTurn
            ? "Jouw beurt!"
            : name
              ? `${name} is aan de beurt`
              : "Wachten op een speler"}
        </strong>
        <span>
          {myTurn
            ? "Het gezelschap luistert. Stel je vraag hardop!"
            : "Luister mee en geef je antwoord hardop."}
        </span>
      </div>
      {myTurn && <span className="turn-live-dot" aria-hidden="true" />}
    </div>
  );
}
