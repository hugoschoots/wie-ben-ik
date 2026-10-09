import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import type { Reply, RoomView } from "../lib/types";
const sockets: Socket[] = [];
const views = new Map<Socket, RoomView>();
async function connect() {
  const socket = io("http://localhost:3000", {
    autoConnect: false,
    reconnection: false,
  });
  sockets.push(socket);
  socket.on("room", (room) => views.set(socket, room));
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
    socket.connect();
  });
  return socket;
}
function send(socket: Socket, event: string, data = {}): Promise<Reply> {
  return new Promise((resolve, reject) =>
    socket
      .timeout(5000)
      .emit(event, data, (error: Error | null, reply: Reply) =>
        error ? reject(error) : resolve(reply),
      ),
  );
}
async function state(socket: Socket, predicate: (room: RoomView) => boolean) {
  const current = views.get(socket);
  if (current && predicate(current)) return current;
  return new Promise<RoomView>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("room", listener);
      reject(new Error("Timed out waiting for synchronized room"));
    }, 5000);
    const listener = (room: RoomView) => {
      if (predicate(room)) {
        clearTimeout(timeout);
        socket.off("room", listener);
        resolve(room);
      }
    };
    socket.on("room", listener);
  });
}
try {
  const a = await connect();
  const b = await connect();
  let c = await connect();
  const host = await send(a, "create", { name: "Sam" });
  assert.ok(host.ok);
  const guest = await send(b, "join", { code: host.code, name: "Alex" });
  assert.ok(guest.ok);
  const third = await send(c, "join", { code: host.code, name: "Robin" });
  assert.ok(third.ok);
  await state(a, (room) => room.players.length === 3);
  assert.equal(
    (await send(b, "settings", { category: "animals", rounds: 2 })).ok,
    false,
  );
  assert.ok((await send(a, "settings", { category: "animals", rounds: 2 })).ok);
  assert.ok((await send(a, "start")).ok);
  for (const [socket, id] of [
    [a, host.playerId],
    [b, guest.playerId],
    [c, third.playerId],
  ] as const) {
    const view = await state(socket, (room) => room.phase === "game");
    assert.equal(view.options.length, 50);
    assert.equal(
      new Set(view.options.map((option) => option.identity)).size,
      50,
    );
    assert.deepEqual(view.options, views.get(a)!.options);
    assert.ok(view.options.every((option) => option.image));
    assert.equal(view.players.find((p) => p.id === id)?.identity, null);
    assert.equal(view.players.find((p) => p.id === id)?.identityImage, null);
    assert.ok(
      view.players
        .filter((p) => p.id !== id)
        .every((p) => p.identityImage?.src.startsWith("/identities/")),
    );
    assert.ok(view.players.filter((p) => p.id !== id).every((p) => p.identity));
    assert.ok(!JSON.stringify(view).includes(host.token!));
  }
  assert.equal((await send(b, "turn", { action: "correct" })).ok, false);
  assert.ok((await send(a, "turn", { action: "incorrect" })).ok);
  await state(b, (room) => room.currentId === guest.playerId);
  assert.ok((await send(b, "turn", { action: "correct" })).ok);
  await state(c, (room) => room.currentId === third.playerId);
  c.disconnect();
  c = await connect();
  assert.ok(
    (await send(c, "resume", { code: host.code, token: third.token })).ok,
  );
  const resumed = await state(c, (room) => room.currentId === third.playerId);
  assert.equal(
    resumed.players.find((p) => p.id === third.playerId)?.identity,
    null,
  );
  assert.ok((await send(c, "turn", { action: "correct" })).ok);
  await state(a, (room) => room.currentId === host.playerId);
  assert.ok((await send(a, "turn", { action: "correct" })).ok);
  const results = await state(a, (room) => room.phase === "results");
  assert.ok(results.players.every((p) => p.identity));
  assert.deepEqual(
    results.players.map((p) => p.score),
    [1, 3, 2],
  );
  assert.ok((await send(a, "start")).ok);
  await state(b, (room) => room.round === 2 && room.phase === "game");
  for (const socket of [b, c, a]) {
    assert.ok((await send(socket, "turn", { action: "correct" })).ok);
  }
  for (const socket of [a, b, c]) {
    const final = await state(
      socket,
      (room) => room.round === 2 && room.phase === "results",
    );
    assert.deepEqual(
      final.players.map((p) => p.score),
      [2, 6, 4],
    );
  }
  assert.equal((await send(a, "start")).ok, false);
  for (const socket of [c, b, a]) assert.ok((await send(socket, "leave")).ok);
  console.log(
    "PASS: three real Socket.IO clients, protected identities, authorization, refresh, two rounds, synchronized final scores, cleanup.",
  );
} finally {
  sockets.forEach((socket) => socket.disconnect());
}
