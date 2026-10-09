"use client";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import { IdentityPicture } from "./components/identity-picture";
import { IdentityBoard } from "./components/identity-board";
import { TurnBanner } from "./components/turn-banner";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Crown,
  HelpCircle,
  LogOut,
  Minus,
  Plus,
  Radio,
  RotateCcw,
  Sparkles,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { categories, type Reply, type RoomView } from "../lib/types";
type Session = { code: string; token: string; playerId: string };
const colors = ["peach", "lavender", "lime", "blue", "pink"];
export default function Home() {
  const socket = useRef<Socket | null>(null);
  const session = useRef<Session | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"create" | "join" | "rules" | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setOrigin(window.location.origin);
    const queryCode = new URLSearchParams(window.location.search).get("room");
    if (queryCode) {
      setCode(queryCode.toUpperCase());
      setModal("join");
    }
    try {
      const saved = sessionStorage.getItem("wie-ben-ik");
      if (saved) session.current = JSON.parse(saved);
    } catch {
      sessionStorage.removeItem("wie-ben-ik");
    }
    const client = io({ autoConnect: false });
    socket.current = client;
    client.on("connect", () => {
      setConnected(true);
      setError("");
      if (session.current)
        client
          .timeout(8000)
          .emit(
            "resume",
            session.current,
            (timeout: Error | null, response: Reply) => {
              if (timeout) {
                setError(
                  "Verbinding herstellen duurt langer. Probeer opnieuw.",
                );
                setReady(true);
                return;
              }
              if (!response.ok) {
                session.current = null;
                sessionStorage.removeItem("wie-ben-ik");
                setRoom(null);
                setError(response.error || "Je sessie is verlopen.");
              } else {
                setPlayerId(response.playerId!);
                setModal(null);
                setError("");
              }
              setReady(true);
            },
          );
      else setReady(true);
    });
    client.on("lan-origin", (address: string) => {
      if (
        ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
      )
        setOrigin(address);
    });
    client.on("disconnect", () => setConnected(false));
    client.on("connect_error", () => {
      setReady(true);
      setError("Geen verbinding met de server. We proberen opnieuw.");
    });
    client.on("room", (view: RoomView) => setRoom(view));
    client.on("replaced", () => {
      session.current = null;
      sessionStorage.removeItem("wie-ben-ik");
      setRoom(null);
      setError("Je sessie is op een ander tabblad geopend.");
    });
    client.connect();
    return () => {
      client.disconnect();
      socket.current = null;
    };
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [room?.phase]);

  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".modal");
    const focusables = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), a[href]",
        ) ?? [],
      );
    if (!dialog?.contains(document.activeElement))
      (dialog?.querySelector<HTMLElement>("input") ?? focusables()[0])?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setModal(null);
      if (event.key !== "Tab") return;
      const elements = focusables();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [modal, busy]);
  function request(event: string, data: object = {}) {
    if (!socket.current?.connected) {
      setError("Wacht tot de verbinding is hersteld.");
      return;
    }
    setBusy(true);
    setError("");
    socket.current
      .timeout(8000)
      .emit(event, data, (timeout: Error | null, reply: Reply) => {
        setBusy(false);
        if (timeout) {
          setError(
            "Geen antwoord ontvangen. De actie kan al zijn uitgevoerd; controleer het spel.",
          );
          return;
        }
        if (!reply.ok) {
          setError(reply.error || "Er ging iets mis.");
          return;
        }
        if (reply.token) {
          const nextSession = {
            code: reply.code!,
            token: reply.token,
            playerId: reply.playerId!,
          };
          session.current = nextSession;
          sessionStorage.setItem("wie-ben-ik", JSON.stringify(nextSession));
          setPlayerId(reply.playerId!);
          setModal(null);
          window.history.replaceState(null, "", `/?room=${reply.code}`);
        }
        if (event === "leave") {
          session.current = null;
          sessionStorage.removeItem("wie-ben-ik");
          setRoom(null);
          setPlayerId("");
          window.history.replaceState(null, "", "/");
        }
      });
  }
  const isHost = room?.hostId === playerId;
  const me = room?.players.find((p) => p.id === playerId);
  const current = room?.players.find((p) => p.id === room.currentId);
  const myTurn = !!room && room.currentId === playerId;
  const final = !!room && room.round >= room.rounds;
  const winners = room
    ? room.players.filter(
        (p) => p.score === Math.max(...room.players.map((p) => p.score)),
      )
    : [];
  const invite = room ? `${origin}/?room=${room.code}` : "";
  async function copy() {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Kopiëren lukt hier niet. Deel de kamercode hieronder.");
    }
  }
  const controlsDisabled = !connected || busy;
  return (
    <div className="site-shell">
      <header className="header">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            if (room) event.preventDefault();
          }}
          aria-label="Wie ben ik? startpagina"
        >
          <span className="brand-mark">
            w<span>?</span>
          </span>
          <span>
            wie ben ik<span className="brand-question">?</span>
          </span>
        </a>
        <div className="header-right">
          <span className="desktop-label">
            Minder scherm. Meer gezelligheid.
          </span>
          <button
            className="icon-button"
            aria-label="Spelregels"
            onClick={() => setModal("rules")}
          >
            <HelpCircle size={21} />
          </button>
        </div>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button
            className="icon-button"
            aria-label="Melding sluiten"
            onClick={() => setError("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {room && !connected && (
        <div className="connection-banner" role="status">
          <Wifi size={18} /> Verbinding herstellen… Je spel blijft bewaard.
        </div>
      )}
      {!room ? (
        <main className="home">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="tiny-dot" /> HET RAADSPEL VOOR GOED GEZELSCHAP
              </div>
              <h1>
                Iedereen weet
                <br />
                wie je bent.
                <br />
                <span>Behalve jij.</span>
                <span className="title-spark">✳</span>
              </h1>
              <p className="hero-description">
                Een geheime identiteit. Een tafel vol vrienden.
                <br className="desktop-label" /> En heel veel goede (of slechte)
                vragen.
              </p>
              <div className="hero-actions">
                <button
                  className="button primary"
                  onClick={() => {
                    setError("");
                    setModal("create");
                  }}
                >
                  Nieuw spel maken <ArrowRight size={19} />
                </button>
                <button
                  className="button secondary"
                  onClick={() => {
                    setError("");
                    setModal("join");
                  }}
                >
                  Meedoen <ArrowUpRight size={19} />
                </button>
              </div>
              <div className="hero-facts">
                <span>
                  <Users size={16} /> 2–10 spelers
                </span>
                <span className="fact-dot">·</span>
                <span>Alleen je telefoon nodig</span>
              </div>
            </div>
            <div
              className="hero-art"
              aria-label="Voorbeeld: je vrienden zien je identiteit, jij ziet vraagtekens"
            >
              <span className="art-spark spark-one">✳</span>
              <span className="art-doodle">↘</span>
              <div className="identity-art art-back">
                <div className="mini-card-top">
                  JIJ ZIET <span>✦</span>
                </div>
                <div className="character-emoji">🧙‍♂️</div>
                <div className="art-name">Harry Potter</div>
                <div className="art-caption">De identiteit van je vriend</div>
              </div>
              <div className="identity-art art-front">
                <div className="mini-card-top">
                  JOUW IDENTITEIT <span>☺</span>
                </div>
                <div className="mystery-face">
                  <span>?</span>
                  <span>?</span>
                  <div className="face-smile" />
                </div>
                <div className="art-name">Wie ben ik?</div>
                <div className="art-caption">Dat weten de anderen wel.</div>
                <div className="card-tape" />
              </div>
              <span className="art-spark spark-two">✦</span>
              <div className="art-note">Niet spieken. Wel vragen.</div>
              <div className="art-pill">
                <span className="tiny-dot" /> 100% samen, in het echt
              </div>
            </div>
          </section>
          <section className="how-section" id="spelregels">
            <div className="section-heading">
              <div>
                <span className="eyebrow">ZO SIMPEL IS HET</span>
                <h2>Telefoon erbij. Spel aan.</h2>
              </div>
              <button className="text-button" onClick={() => setModal("rules")}>
                Alle spelregels <ArrowUpRight size={17} />
              </button>
            </div>
            <div className="steps">
              <div className="step">
                <span className="step-number">01</span>
                <div>
                  <h3>Verzamel je mensen</h3>
                  <p>
                    Maak een kamer en deel de code.
                    <br />
                    Iedereen doet mee op z’n eigen telefoon.
                  </p>
                </div>
                <Users className="step-icon" size={25} />
              </div>
              <div className="step">
                <span className="step-number">02</span>
                <div>
                  <h3>Vraag maar raak</h3>
                  <p>
                    Ben ik beroemd? Ben ik een dier?
                    <br />
                    Stel je ja/nee-vragen hardop.
                  </p>
                </div>
                <HelpCircle className="step-icon" size={25} />
              </div>
              <div className="step">
                <span className="step-number">03</span>
                <div>
                  <h3>Raad wie je bent</h3>
                  <p>
                    Hoe eerder je raadt, hoe meer punten!
                    <br />
                    Wie verzamelt de meeste punten?
                  </p>
                </div>
                <Sparkles className="step-icon" size={25} />
              </div>
            </div>
          </section>
          <div className="home-bottom">
            <span>
              <span className="tiny-dot" /> Geen accounts. Geen downloads.
              Gewoon spelen.
            </span>
            <span>
              Gemaakt voor aan tafel <span className="small-heart">♡</span>
            </span>
          </div>
        </main>
      ) : (
        <main className="room-main">
          <div className="room-topline">
            <span className="eyebrow">
              <span className="tiny-dot" />{" "}
              {room.phase === "lobby"
                ? "DE GEZELLIGHEID BEGINT HIER"
                : `RONDE ${room.round} VAN ${room.rounds}`}
            </span>
            <button
              className="text-button"
              disabled={controlsDisabled}
              onClick={() => {
                if (
                  window.confirm(
                    "Wil je de kamer verlaten? Je punten en plek worden verwijderd.",
                  )
                )
                  request("leave");
              }}
            >
              <LogOut size={16} /> Verlaten
            </button>
          </div>
          {room.phase === "lobby" ? (
            <>
              <div className="room-title">
                <h1>Iedereen erbij?</h1>
                <p>
                  Deel de code, kies een categorie en laat het raden beginnen.
                </p>
              </div>
              <div className="lobby-grid">
                <section className="panel invite-panel">
                  <span className="eyebrow">JULLIE KAMERCODE</span>
                  <div className="room-code">{room.code}</div>
                  <button className="text-button" onClick={copy}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
                    {copied ? "Link gekopieerd!" : "Uitnodigingslink kopiëren"}
                  </button>
                  <div className="qr-wrap">
                    {origin && (
                      <QRCodeSVG
                        value={invite}
                        size={154}
                        bgColor="#ffffff"
                        fgColor="#282923"
                        marginSize={2}
                      />
                    )}
                  </div>
                  <p className="muted small">
                    Scan de QR-code om mee te doen.
                    <br />
                    Gebruik allemaal dezelfde wifi of tunnellink.
                  </p>
                </section>
                <div className="lobby-right">
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>
                        Het gezelschap{" "}
                        <span className="count-badge">
                          {room.players.length}/10
                        </span>
                      </h2>
                      <Users size={22} />
                    </div>
                    <div className="player-list">
                      {room.players.map((p, index) => (
                        <div className="player-row" key={p.id}>
                          <span className={`avatar ${colors[index % 5]}`}>
                            {p.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="player-name">
                            {p.name}{" "}
                            {p.id === playerId && (
                              <span className="muted">(jij)</span>
                            )}
                            <small>
                              {p.id === room.hostId
                                ? "Spelleider"
                                : p.connected
                                  ? "Klaar om te spelen"
                                  : "Niet verbonden"}
                            </small>
                          </span>
                          {p.id === room.hostId ? (
                            <Crown size={18} />
                          ) : (
                            <span
                              className={`status-dot ${p.connected ? "online" : ""}`}
                            />
                          )}{" "}
                          {!p.connected && isHost && (
                            <button
                              className="icon-button"
                              disabled={controlsDisabled}
                              aria-label={`${p.name} verwijderen`}
                              onClick={() =>
                                request("remove", { playerId: p.id })
                              }
                            >
                              <X size={17} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {room.players.length < 2 && (
                      <p className="small muted waiting">
                        <Radio size={16} /> Wachten op minstens één andere
                        speler…
                      </p>
                    )}
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Wat gaan we raden?</h2>
                      <span className="small muted">
                        {isHost ? "Jij kiest" : "De spelleider kiest"}
                      </span>
                    </div>
                    <div className="category-grid">
                      {categories.map((c) => (
                        <button
                          key={c.id}
                          className={`category ${room.category === c.id ? "selected" : ""}`}
                          disabled={!isHost || controlsDisabled}
                          onClick={() =>
                            request("settings", {
                              category: c.id,
                              rounds: room.rounds,
                            })
                          }
                        >
                          <span className="category-emoji">{c.emoji}</span>
                          <span>
                            <strong>{c.name}</strong>
                            <small>{c.description}</small>
                          </span>
                          {room.category === c.id && <Check size={17} />}
                        </button>
                      ))}
                    </div>
                    <div className="round-setting">
                      <div>
                        <strong>Aantal rondes</strong>
                        <p className="small muted">
                          Elke ronde een nieuwe identiteit
                        </p>
                      </div>
                      <div className="stepper">
                        <button
                          aria-label="Minder rondes"
                          disabled={
                            !isHost || controlsDisabled || room.rounds <= 1
                          }
                          onClick={() =>
                            request("settings", {
                              category: room.category,
                              rounds: room.rounds - 1,
                            })
                          }
                        >
                          <Minus size={16} />
                        </button>
                        <span>{room.rounds}</span>
                        <button
                          aria-label="Meer rondes"
                          disabled={
                            !isHost || controlsDisabled || room.rounds >= 10
                          }
                          onClick={() =>
                            request("settings", {
                              category: room.category,
                              rounds: room.rounds + 1,
                            })
                          }
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </section>
                  <button
                    className="button primary full"
                    disabled={
                      !isHost ||
                      controlsDisabled ||
                      room.players.filter((p) => p.connected).length < 2
                    }
                    onClick={() => request("start")}
                  >
                    {isHost
                      ? "Iedereen klaar? Start het spel"
                      : "Wachten tot de spelleider start"}
                    <ArrowRight size={19} />
                  </button>
                </div>
              </div>
            </>
          ) : room.phase === "game" ? (
            <>
              <TurnBanner
                key={room.currentId ?? "waiting"}
                myTurn={myTurn}
                name={current?.name}
              />
              <div className="room-title">
                <h1>
                  {myTurn
                    ? "Jij bent aan de beurt."
                    : current
                      ? `${current.name} is aan de beurt.`
                      : "Even wachten op de anderen."}
                </h1>
                <p>
                  {myTurn
                    ? "Stel je vraag hardop. Bij een ja mag je doorvragen!"
                    : "Luister mee en antwoord hardop. Houd de identiteit geheim!"}{" "}
                  <span className="category-label">
                    {categories.find((c) => c.id === room.category)?.emoji}{" "}
                    {categories.find((c) => c.id === room.category)?.name}
                  </span>
                </p>
              </div>
              <div className="game-layout">
                <section
                  className={`own-card${myTurn ? " own-card-active" : ""}`}
                >
                  <span className="eyebrow">JOUW GEHEIME IDENTITEIT</span>
                  {me?.finished ? (
                    <IdentityPicture
                      identity={me.identity}
                      image={me.identityImage}
                    />
                  ) : (
                    <div className="own-mystery">???</div>
                  )}
                  <h2>
                    {me?.finished ? me.identity : "Wie ben jij ook alweer?"}
                  </h2>
                  <p>
                    {me?.finished
                      ? "Goed geraden! Help de anderen nog even."
                      : "De anderen weten het. Jij mag het raden."}
                  </p>
                  <div className="own-card-footer">
                    <span>{me?.name}</span>
                    <span>
                      {me?.score} {me?.score === 1 ? "punt" : "punten"}
                    </span>
                  </div>
                </section>
                <section className="others">
                  <div className="panel-heading">
                    <h2>Wie zijn de anderen?</h2>
                    <span className="small muted">Niet hardop lezen 🤫</span>
                  </div>
                  <div className="identity-grid">
                    {room.players
                      .filter((p) => p.id !== playerId)
                      .map((p, index) => (
                        <article
                          className={`friend-card ${colors[index % 5]} ${p.id === room.currentId ? "active-card" : ""}`}
                          key={p.id}
                        >
                          <div className="friend-top">
                            <span>{p.name}</span>
                            {p.finished ? (
                              <Check size={18} />
                            ) : p.id === room.currentId ? (
                              <span className="turn-badge">Aan de beurt</span>
                            ) : !p.connected ? (
                              <Wifi size={16} />
                            ) : null}
                          </div>
                          <IdentityPicture
                            identity={p.identity}
                            image={p.identityImage}
                          />
                          <h3>{p.identity}</h3>
                          <div className="friend-bottom">
                            <span>
                              {p.finished
                                ? "Goed geraden!"
                                : !p.connected
                                  ? "Niet verbonden"
                                  : "Nog aan het raden"}
                            </span>
                            <span>{p.score} pt</span>
                          </div>
                          {!p.connected && isHost && (
                            <button
                              className="text-button small"
                              disabled={controlsDisabled}
                              onClick={() =>
                                request("remove", { playerId: p.id })
                              }
                            >
                              Speler verwijderen <X size={14} />
                            </button>
                          )}
                        </article>
                      ))}
                  </div>
                </section>
              </div>
              <section className={`turn-panel ${myTurn ? "your-turn" : ""}`}>
                <div>
                  <h2>
                    {myTurn
                      ? "Wat zei het gezelschap?"
                      : "Gezelligheid gebeurt aan tafel."}
                  </h2>
                  <p>
                    {myTurn
                      ? "Een nee? Geef de beurt door. Een gok? Kies of die goed of fout was."
                      : current
                        ? `Alleen ${current.name} kan de beurt bedienen.`
                        : "Een speler moet opnieuw verbinden om verder te gaan."}
                  </p>
                </div>
                <div className="turn-actions">
                  <button
                    className="button secondary"
                    disabled={!myTurn || controlsDisabled}
                    onClick={() => request("turn", { action: "next" })}
                  >
                    Volgende beurt <ChevronRight size={18} />
                  </button>
                  <button
                    className="button correct"
                    disabled={!myTurn || controlsDisabled}
                    onClick={() => request("turn", { action: "correct" })}
                  >
                    <Check size={18} /> Goed geraden (+
                    {room.players.filter((p) => !p.finished).length})
                  </button>
                  <button
                    className="button incorrect"
                    disabled={!myTurn || controlsDisabled}
                    onClick={() => request("turn", { action: "incorrect" })}
                  >
                    <X size={18} /> Fout geraden
                  </button>
                </div>
              </section>
              <IdentityBoard
                key={`${room.code}:${room.round}:${playerId}`}
                options={room.options ?? []}
                storageKey={`wie-ben-ik:board:${room.code}:${room.round}:${playerId}`}
              />
              <p className="game-progress">
                {room.players.filter((p) => p.finished).length} van{" "}
                {room.players.length} spelers hebben hun identiteit geraden{" "}
                <span>·</span> Kamer {room.code}
              </p>
            </>
          ) : (
            <>
              <div className="room-title results-title">
                <div className="winner-icon">{final ? "🏆" : "🎉"}</div>
                <h1>
                  {final
                    ? winners.length === 1
                      ? `${winners[0].name} wint!`
                      : "Gedeelde eerste plek!"
                    : "Iedereen ontmaskerd!"}
                </h1>
                <p>
                  {final
                    ? `${winners.map((p) => p.name).join(" & ")} ${winners.length === 1 ? "is" : "zijn"} de ${winners.length === 1 ? "raadkampioen" : "raadkampioenen"} van vandaag.`
                    : "De punten zijn verdeeld. Op naar de volgende ronde."}
                </p>
              </div>
              <section className="panel scoreboard">
                <div className="panel-heading">
                  <h2>{final ? "De eindstand" : "De tussenstand"}</h2>
                  <span className="small muted">
                    Ronde {room.round}/{room.rounds}
                  </span>
                </div>
                {[...room.players]
                  .sort((a, b) => b.score - a.score)
                  .map((p, index) => (
                    <div className="score-row" key={p.id}>
                      <span className="rank">
                        {index === 0 ? <Crown size={22} /> : index + 1}
                      </span>
                      <IdentityPicture
                        identity={p.identity}
                        image={p.identityImage}
                        compact
                      />
                      <div className="score-name">
                        <strong>
                          {p.name}{" "}
                          {p.id === playerId && (
                            <span className="muted">(jij)</span>
                          )}
                        </strong>
                        <small>Je was: {p.identity}</small>
                      </div>
                      <strong className="score-points">
                        {p.score}
                        <small>{p.score === 1 ? "punt" : "punten"}</small>
                      </strong>
                      {!p.connected && isHost && (
                        <button
                          className="icon-button"
                          disabled={controlsDisabled}
                          aria-label={`${p.name} verwijderen`}
                          onClick={() => request("remove", { playerId: p.id })}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
              </section>
              <div className="results-actions">
                {!final ? (
                  <button
                    className="button primary"
                    disabled={
                      !isHost ||
                      controlsDisabled ||
                      room.players.filter((p) => p.connected).length < 2
                    }
                    onClick={() => request("start")}
                  >
                    {isHost ? "Volgende ronde" : "Wachten op de spelleider"}
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <button
                    className="button primary"
                    disabled={controlsDisabled}
                    onClick={() => request("leave")}
                  >
                    <RotateCcw size={18} /> Terug naar het begin
                  </button>
                )}
                <p className="muted small">
                  {final
                    ? "Nog een keer? Maak een nieuwe kamer voor een nieuw spel."
                    : "De spelleider start de volgende ronde zodra iedereen klaar is."}
                </p>
              </div>
            </>
          )}
        </main>
      )}
      <footer className="footer">
        <span>Een beetje mysterie. Heel veel gezelligheid.</span>
        <a href="/beeldbronnen" target="_blank" rel="noopener noreferrer">
          Beeldbronnen ↗
        </a>
        <span>wie ben ik?</span>
      </footer>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget && !busy) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <button
              className="modal-close icon-button"
              aria-label="Sluiten"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              <X size={22} />
            </button>
            {modal === "rules" ? (
              <>
                <span className="eyebrow">HET SPEL IN EEN NOTENDOP</span>
                <h2 id="modal-title">Wie ben ik? Zo speel je.</h2>
                <ol className="rules-list">
                  <li>
                    <strong>Ga samen aan tafel zitten.</strong> Eén speler maakt
                    een kamer. De rest doet mee met de code of QR-code.
                  </li>
                  <li>
                    <strong>Iedereen krijgt een identiteit.</strong> Je ziet die
                    van de anderen, maar je eigen kaart blijft geheim.
                  </li>
                  <li>
                    <strong>Stel ja/nee-vragen hardop.</strong> Bij een ja blijf
                    je vragen. Bij een nee tik je op ‘Volgende beurt’.
                  </li>
                  <li>
                    <strong>Doe je gok hardop.</strong> Goed? Tik ‘Goed
                    geraden’: je bent klaar voor deze ronde. De eerste krijgt
                    zoveel punten als er spelers zijn, daarna steeds één punt
                    minder. Met vier spelers: 4, 3, 2 en 1 punt. Fout? Tik ‘Fout
                    geraden’: je beurt gaat verder naar de volgende speler.
                  </li>
                  <li>
                    <strong>Iedereen klaar? Nieuwe ronde!</strong> Na de laatste
                    ronde wint wie de meeste punten heeft. Een gelijke stand
                    betekent samen winnen.
                  </li>
                </ol>
                <div className="rules-note">
                  Telefoons zijn jullie kaartjes. De vragen, antwoorden en
                  gezelligheid gebeuren in het echt.
                </div>
                <button
                  className="button primary full"
                  onClick={() => setModal(null)}
                >
                  Helemaal duidelijk <Check size={18} />
                </button>
              </>
            ) : (
              <>
                <span className="eyebrow">
                  {modal === "create"
                    ? "JIJ REGELT HET GEZELSCHAP"
                    : "SCHUIF GEZELLIG AAN"}
                </span>
                <h2 id="modal-title">
                  {modal === "create"
                    ? "Een nieuw avontuur."
                    : "Daar ben je!"}{" "}
                </h2>
                <p className="muted">
                  {modal === "create"
                    ? "Hoe mogen je vrienden je noemen?"
                    : "Vul je naam en de kamercode in om mee te doen."}
                </p>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    request(modal, { name, code });
                  }}
                >
                  <label htmlFor="name">Jouw naam</label>
                  <input
                    id="name"
                    autoFocus
                    required
                    maxLength={24}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Bijvoorbeeld: Sam"
                    autoComplete="nickname"
                    disabled={busy}
                  />
                  {modal === "join" && (
                    <>
                      <label htmlFor="code">Kamercode</label>
                      <input
                        id="code"
                        className="code-input"
                        required
                        minLength={5}
                        maxLength={5}
                        value={code}
                        onChange={(event) =>
                          setCode(
                            event.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, ""),
                          )
                        }
                        placeholder="ABCDE"
                        autoComplete="off"
                        disabled={busy}
                      />
                    </>
                  )}
                  {error && (
                    <p role="alert" className="form-error">
                      {error}
                    </p>
                  )}
                  <button
                    className="button primary full"
                    type="submit"
                    disabled={busy || !connected || !ready}
                  >
                    {busy
                      ? "Even geduld…"
                      : !connected
                        ? "Verbinding maken…"
                        : modal === "create"
                          ? "Maak mijn kamer"
                          : "Doe mee"}
                    <ArrowRight size={18} />
                  </button>
                </form>
                <p className="small muted modal-footnote">
                  Geen account nodig. Je bent zo binnen.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
