import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { identities } from "./identities";
import { getIdentityImage } from "./identity-image";
import { categories, type Category, type Phase, type RoomView } from "./types";
export type Player = {
  id: string;
  token: string;
  name: string;
  score: number;
  identity: string | null;
  finished: boolean;
  socketId: string | null;
};
export type Room = {
  code: string;
  hostId: string;
  phase: Phase;
  category: Category;
  rounds: number;
  round: number;
  currentId: string | null;
  players: Player[];
  updatedAt: number;
  used: Set<string>;
  options: string[];
};
export class GameError extends Error {}
export class GameStore {
  rooms = new Map<string, Room>();
  name(value: unknown) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 24)
      throw new GameError("Vul een naam in van maximaal 24 tekens.");
    return value.trim();
  }
  create(name: unknown, socketId: string) {
    if (this.rooms.size >= 1000)
      throw new GameError("De server zit vol. Probeer het later opnieuw.");
    let code: string;
    do {
      code = Array.from(
        { length: 5 },
        () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(32)],
      ).join("");
    } while (this.rooms.has(code));
    const player = this.player(name, socketId);
    const room: Room = {
      code,
      hostId: player.id,
      phase: "lobby",
      category: "mix",
      rounds: 3,
      round: 0,
      currentId: null,
      players: [player],
      updatedAt: Date.now(),
      used: new Set(),
      options: [],
    };
    this.rooms.set(code, room);
    return { room, player };
  }
  player(name: unknown, socketId: string): Player {
    return {
      id: randomUUID(),
      token: randomBytes(32).toString("hex"),
      name: this.name(name),
      score: 0,
      identity: null,
      finished: false,
      socketId,
    };
  }
  join(code: unknown, name: unknown, socketId: string) {
    const room = this.get(code);
    if (room.phase !== "lobby")
      throw new GameError(
        "Dit spel is al begonnen. Wacht tot er een nieuw spel wordt gemaakt.",
      );
    if (room.players.length >= 10)
      throw new GameError("Deze kamer zit vol (maximaal 10 spelers).");
    const player = this.player(name, socketId);
    if (
      room.players.some(
        (p) => p.name.toLowerCase() === player.name.toLowerCase(),
      )
    )
      throw new GameError("Deze naam is al in gebruik. Kies een andere naam.");
    room.players.push(player);
    room.updatedAt = Date.now();
    return { room, player };
  }
  get(code: unknown) {
    if (typeof code !== "string")
      throw new GameError("Vul een geldige kamercode in.");
    const room = this.rooms.get(code.trim().toUpperCase());
    if (!room)
      throw new GameError(
        "Kamer niet gevonden. Controleer de code of maak een nieuw spel.",
      );
    return room;
  }
  resume(code: unknown, token: unknown, socketId: string) {
    const room = this.get(code);
    const player = room.players.find((p) => p.token === token);
    if (!player) throw new GameError("Je sessie is verlopen. Doe opnieuw mee.");
    const previousSocket = player.socketId;
    player.socketId = socketId;
    room.updatedAt = Date.now();
    if (!room.players.some((p) => p.id === room.hostId && p.socketId))
      room.hostId = player.id;
    if (room.phase === "game" && !room.currentId && !player.finished)
      room.currentId = player.id;
    return { room, player, previousSocket };
  }
  view(room: Room, viewerId: string): RoomView {
    return {
      code: room.code,
      hostId: room.hostId,
      phase: room.phase,
      category: room.category,
      rounds: room.rounds,
      round: room.round,
      currentId: room.currentId,
      options: room.options.map((identity) => ({
        identity,
        image: getIdentityImage(identity),
      })),
      players: room.players.map((p) => {
        const visible =
          room.phase === "results" || p.id !== viewerId || p.finished;
        const identity = visible ? p.identity : null;
        return {
          id: p.id,
          name: p.name,
          score: p.score,
          finished: p.finished,
          connected: !!p.socketId,
          identity,
          identityImage: identity ? getIdentityImage(identity) : null,
        };
      }),
    };
  }
  host(room: Room, player: Player) {
    if (room.hostId !== player.id)
      throw new GameError("Alleen de spelleider kan dit doen.");
  }
  settings(room: Room, player: Player, category: unknown, rounds: unknown) {
    this.host(room, player);
    if (room.phase !== "lobby")
      throw new GameError(
        "Instellingen kunnen alleen in de wachtkamer worden gewijzigd.",
      );
    if (
      !categories.some((c) => c.id === category) ||
      !Number.isInteger(rounds) ||
      Number(rounds) < 1 ||
      Number(rounds) > 10
    )
      throw new GameError("Kies een geldige categorie en 1 tot 10 rondes.");
    room.category = category as Category;
    room.rounds = Number(rounds);
  }
  start(room: Room, player: Player) {
    this.host(room, player);
    if (
      room.phase === "game" ||
      (room.phase === "results" && room.round >= room.rounds)
    )
      throw new GameError("Deze actie is nu niet beschikbaar.");
    if (room.players.filter((p) => p.socketId).length < 2)
      throw new GameError("Er zijn minimaal 2 verbonden spelers nodig.");
    const source =
      room.category === "mix"
        ? Object.values(identities).flat()
        : identities[room.category];
    let pool = source.filter((identity) => !room.used.has(identity));
    if (pool.length < room.players.length) {
      room.used.clear();
      pool = [...source];
    }
    room.players.forEach((p) => {
      const index = randomInt(pool.length);
      p.identity = pool.splice(index, 1)[0];
      room.used.add(p.identity);
      p.finished = false;
    });
    // One shared, unordered candidate set for everyone. Include all assigned
    // identities, then fill with random decoys; never mark a player's answer.
    const options = new Set(room.players.map((p) => p.identity!));
    const decoys = source.filter((identity) => !options.has(identity));
    while (options.size < Math.min(50, source.length)) {
      options.add(decoys.splice(randomInt(decoys.length), 1)[0]);
    }
    room.options = [...options].sort((a, b) => a.localeCompare(b, "nl"));
    room.round++;
    room.phase = "game";
    room.currentId = room.players[(room.round - 1) % room.players.length].id;
    if (!room.players.find((p) => p.id === room.currentId)?.socketId)
      this.advance(room);
  }
  advance(room: Room) {
    if (room.players.every((p) => p.finished)) {
      room.phase = "results";
      room.currentId = null;
      return;
    }
    const index = room.players.findIndex((p) => p.id === room.currentId);
    room.currentId = null;
    for (let offset = 1; offset <= room.players.length; offset++) {
      const next =
        room.players[
          (index + offset + room.players.length) % room.players.length
        ];
      if (!next.finished && next.socketId) {
        room.currentId = next.id;
        break;
      }
    }
  }
  turn(room: Room, player: Player, action: unknown) {
    if (
      room.phase !== "game" ||
      room.currentId !== player.id ||
      player.finished
    )
      throw new GameError("Alleen de speler die aan de beurt is kan dit doen.");
    if (!["next", "correct", "incorrect"].includes(String(action)))
      throw new GameError("Ongeldige actie.");
    if (action === "correct") {
      player.score += room.players.filter((p) => !p.finished).length;
      player.finished = true;
    }
    this.advance(room);
  }
  remove(room: Room, actor: Player, targetId: unknown) {
    const target = room.players.find((p) => p.id === targetId);
    if (!target) throw new GameError("Speler niet gevonden.");
    if (target.id !== actor.id) {
      this.host(room, actor);
      if (target.socketId)
        throw new GameError(
          "Je kunt alleen een niet-verbonden speler verwijderen.",
        );
    }
    const wasCurrent = room.currentId === target.id;
    // Advance before removal so player ordering is preserved.
    target.finished = true;
    if (wasCurrent) this.advance(room);
    room.players = room.players.filter((p) => p.id !== target.id);
    if (!room.players.length) {
      this.rooms.delete(room.code);
      return;
    }
    if (room.hostId === target.id)
      room.hostId = (
        room.players.find((p) => p.socketId) ?? room.players[0]
      ).id;
    if (room.phase === "game" && room.players.every((p) => p.finished)) {
      room.phase = "results";
      room.currentId = null;
    }
  }
  disconnect(room: Room, player: Player) {
    player.socketId = null;
    if (room.hostId === player.id)
      room.hostId = (room.players.find((p) => p.socketId) ?? player).id;
    // Give refreshes a grace period; the server advances after 15 seconds.
  }
}
