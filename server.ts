import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import next from "next";
import { Server } from "socket.io";
import { GameStore, GameError, type Room, type Player } from "./lib/game";
const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname: "0.0.0.0", port });
await app.prepare();
const http = createServer(app.getRequestHandler());
const io = new Server(http, { maxHttpBufferSize: 8192 });
const store = new GameStore();
const broadcast = (room: Room) => {
  room.updatedAt = Date.now();
  for (const player of room.players)
    if (player.socketId)
      io.to(player.socketId).emit("room", store.view(room, player.id));
};
const interfaces = networkInterfaces();
const localAddress = Object.keys(interfaces)
  .sort((a, b) => {
    const preferred = ["en0", "en1", "wlan0", "eth0"];
    const rank = (name: string) =>
      preferred.indexOf(name) < 0 ? 100 : preferred.indexOf(name);
    return rank(a) - rank(b);
  })
  .flatMap((name) => interfaces[name] ?? [])
  .find((address) => address.family === "IPv4" && !address.internal)?.address;

io.on("connection", (socket) => {
  if (
    localAddress &&
    /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(
      socket.handshake.headers.host ?? "",
    )
  ) {
    socket.emit("lan-origin", `http://${localAddress}:${port}`);
  }
  let session: { room: Room; player: Player } | null = null;
  let count = 0;
  let windowStart = Date.now();
  const handle = (event: string, fn: (data: any) => object | void) =>
    socket.on(event, (data, reply) => {
      if (typeof reply !== "function") return;
      if (Date.now() - windowStart > 10_000) {
        count = 0;
        windowStart = Date.now();
      }
      if (++count > 40)
        return reply({
          ok: false,
          error: "Even rustig aan. Probeer het zo opnieuw.",
        });
      try {
        const result = fn(data ?? {});
        reply({ ok: true, ...result });
        if (session && store.rooms.has(session.room.code))
          broadcast(session.room);
      } catch (error) {
        reply({
          ok: false,
          error:
            error instanceof GameError
              ? error.message
              : "Er ging iets mis. Probeer het opnieuw.",
        });
        if (!(error instanceof GameError)) console.error(error);
      }
    });
  const active = () => {
    if (
      !session ||
      session.player.socketId !== socket.id ||
      !session.room.players.includes(session.player) ||
      !store.rooms.has(session.room.code)
    )
      throw new GameError("Verbind opnieuw om verder te spelen.");
    return session;
  };
  const establish = (result: { room: Room; player: Player }) => {
    session = result;
    return {
      token: result.player.token,
      playerId: result.player.id,
      code: result.room.code,
    };
  };
  handle("create", (data) => {
    if (session) throw new GameError("Je zit al in een kamer.");
    return establish(store.create(data.name, socket.id));
  });
  handle("join", (data) => {
    if (session) throw new GameError("Je zit al in een kamer.");
    return establish(store.join(data.code, data.name, socket.id));
  });
  handle("resume", (data) => {
    if (session) throw new GameError("Je zit al in een kamer.");
    const result = store.resume(data.code, data.token, socket.id);
    if (result.previousSocket && result.previousSocket !== socket.id) {
      io.to(result.previousSocket).emit("replaced");
      io.sockets.sockets.get(result.previousSocket)?.disconnect(true);
    }
    return establish(result);
  });
  handle("settings", (data) => {
    const { room, player } = active();
    store.settings(room, player, data.category, data.rounds);
  });
  handle("start", () => {
    const { room, player } = active();
    store.start(room, player);
  });
  handle("turn", (data) => {
    const { room, player } = active();
    store.turn(room, player, data.action);
  });
  handle("remove", (data) => {
    const { room, player } = active();
    store.remove(room, player, data.playerId);
  });
  handle("leave", () => {
    const { room, player } = active();
    store.remove(room, player, player.id);
    if (store.rooms.has(room.code)) broadcast(room);
    session = null;
  });
  socket.on("disconnect", () => {
    if (!session || session.player.socketId !== socket.id) return;
    const { room, player } = session;
    store.disconnect(room, player);
    broadcast(room);
    setTimeout(() => {
      if (
        store.rooms.has(room.code) &&
        !player.socketId &&
        room.phase === "game" &&
        room.currentId === player.id
      ) {
        store.advance(room);
        broadcast(room);
      }
    }, 15_000).unref();
  });
});
setInterval(() => {
  for (const [code, room] of store.rooms)
    if (
      !room.players.some((p) => p.socketId) &&
      Date.now() - room.updatedAt > 6 * 60 * 60 * 1000
    )
      store.rooms.delete(code);
}, 60_000).unref();
http.listen(port, "0.0.0.0", () =>
  console.log(
    `Wie ben ik? → http://localhost:${port} (ook bereikbaar via je lokale IP-adres)`,
  ),
);
