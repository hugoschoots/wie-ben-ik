import { test } from "node:test";
import assert from "node:assert/strict";
import { GameStore } from "../lib/game";
import { identities } from "../lib/identities";
import { getIdentityImage } from "../lib/identity-image";
import { existsSync } from "node:fs";
import { join } from "node:path";
function setup() {
  const store = new GameStore();
  const { room, player: host } = store.create("Sam", "a");
  const { player: guest } = store.join(room.code, "Alex", "b");
  return { store, room, host, guest };
}
test("identities stay hidden only from their owner and are unique", () => {
  const { store, room, host, guest } = setup();
  store.start(room, host);
  assert.equal(store.view(room, host.id).players[0].identity, null);
  assert.equal(store.view(room, guest.id).players[1].identity, null);
  assert.equal(store.view(room, guest.id).players[0].identity, host.identity);
  assert.notEqual(host.identity, guest.identity);
  const ownView = store.view(room, host.id).players[0];
  assert.equal(ownView.identityImage, null);
  assert.deepEqual(
    store.view(room, guest.id).players[0].identityImage,
    getIdentityImage(host.identity!),
  );

  assert.ok(!JSON.stringify(store.view(room, host.id)).includes(host.token));
});
test("only host can change settings or start; only current player can act", () => {
  const { store, room, host, guest } = setup();
  assert.throws(() => store.start(room, guest));
  assert.throws(() => store.settings(room, guest, "animals", 2));
  assert.throws(() => store.settings(room, host, "bad", 2));
  store.start(room, host);
  assert.throws(() => store.turn(room, guest, "correct"));
  assert.throws(() => store.settings(room, host, "animals", 2));
  store.turn(room, host, "incorrect");
  assert.equal(room.currentId, guest.id);
  assert.equal(host.score, 0);
});
test("completed players are skipped; points awarded once; final round cannot restart", () => {
  const { store, room, host, guest } = setup();
  store.settings(room, host, "animals", 1);
  store.start(room, host);
  store.turn(room, host, "correct");
  assert.equal(host.score, 2);
  assert.equal(room.currentId, guest.id);
  assert.throws(() => store.turn(room, host, "correct"));
  store.turn(room, guest, "incorrect");
  assert.equal(room.currentId, guest.id);
  store.turn(room, guest, "correct");
  assert.equal(room.phase, "results");
  assert.equal(guest.score, 1);
  assert.equal(store.view(room, host.id).players[0].identity, host.identity);
  assert.deepEqual(
    store.view(room, host.id).players[0].identityImage,
    getIdentityImage(host.identity!),
  );
  assert.throws(() => store.start(room, host));
});
test("refresh restores identity and score; host transfers; disconnected players can be removed", () => {
  const { store, room, host, guest } = setup();
  store.start(room, host);
  const identity = host.identity;
  store.disconnect(room, host);
  assert.equal(room.hostId, guest.id);
  assert.throws(() => store.resume(room.code, "bad-token", "c"));
  store.resume(room.code, host.token, "c");
  assert.equal(host.identity, identity);
  assert.equal(host.socketId, "c");
  store.turn(room, host, "correct");
  store.disconnect(room, host);
  store.remove(room, guest, host.id);
  assert.equal(room.players.length, 1);
  store.turn(room, guest, "correct");
  assert.equal(room.phase, "results");
});
test("rounds preserve scores, rotate starters, and avoid repeated identities", () => {
  const { store, room, host, guest } = setup();
  store.start(room, host);
  const first = [host.identity, guest.identity];
  store.turn(room, host, "correct");
  store.turn(room, guest, "correct");
  store.start(room, host);
  assert.equal(room.round, 2);
  assert.equal(room.currentId, guest.id);
  assert.equal(host.score, 2);
  assert.equal(host.finished, false);
  assert.ok(!first.includes(host.identity));
  assert.ok(!first.includes(guest.identity));
});
test("room capacity, duplicate names, late joins and invalid actions are rejected", () => {
  const { store, room, host } = setup();
  assert.throws(() => store.join(room.code, "sam", "c"));
  for (let i = 2; i < 10; i++) store.join(room.code, `Speler ${i}`, `s${i}`);
  assert.throws(() => store.join(room.code, "Extra", "extra"));
  store.start(room, host);
  assert.throws(() => store.join(room.code, "Laat", "late"));
  assert.throws(() => store.turn(room, host, "hack"));
});

test("every playable identity has a bundled image and source credit", () => {
  for (const identity of Object.values(identities).flat()) {
    const image = getIdentityImage(identity);
    assert.ok(image, `Missing image: ${identity}`);
    assert.ok(
      existsSync(join(process.cwd(), "public", image.src)),
      `Missing file: ${image.src}`,
    );
    assert.ok(image.source.startsWith("https://"));
  }
});

test("candidate boards contain 50 shared options including every assigned identity without marking the answer", () => {
  for (const category of ["mix", "people", "characters", "animals"] as const) {
    const { store, room, host, guest } = setup();
    store.settings(room, host, category, 2);
    store.start(room, host);
    const view = store.view(room, host.id);
    assert.equal(view.options.length, 50);
    assert.equal(
      new Set(view.options.map((option) => option.identity)).size,
      50,
    );
    assert.ok(view.options.every((option) => option.image));
    assert.ok(
      room.players.every((player) =>
        view.options.some((option) => option.identity === player.identity),
      ),
    );
    assert.deepEqual(view.options, store.view(room, guest.id).options);
    assert.equal(
      view.players.find((player) => player.id === host.id)?.identity,
      null,
    );
    assert.equal(
      view.players.find((player) => player.id === host.id)?.identityImage,
      null,
    );
    assert.ok(
      view.options.every(
        (option) => Object.keys(option).sort().join() === "identity,image",
      ),
    );
    if (category !== "mix")
      assert.ok(
        view.options.every((option) =>
          identities[category].includes(option.identity),
        ),
      );
    const board = [...room.options];
    store.disconnect(room, host);
    store.resume(room.code, host.token, "refresh");
    assert.deepEqual(room.options, board);
    store.turn(room, host, "correct");
    store.turn(room, guest, "correct");
    store.start(room, room.hostId === host.id ? host : guest);
    assert.equal(room.options.length, 50);
    assert.ok(
      room.players.every((player) => room.options.includes(player.identity!)),
    );
  }
});

test("four players earn 4, 3, 2, 1 points by finishing order across rounds", () => {
  const { store, room, host, guest } = setup();
  const { player: third } = store.join(room.code, "Robin", "c");
  const { player: fourth } = store.join(room.code, "Kim", "d");
  store.start(room, host);
  store.turn(room, host, "incorrect");
  assert.equal(host.score, 0);
  for (const player of [guest, third, fourth, host])
    store.turn(room, player, "correct");
  assert.deepEqual(
    [guest.score, third.score, fourth.score, host.score],
    [4, 3, 2, 1],
  );
  assert.throws(() => store.turn(room, host, "correct"));
  store.start(room, host);
  for (const player of [guest, third, fourth, host])
    store.turn(room, player, "correct");
  assert.deepEqual(
    [guest.score, third.score, fourth.score, host.score],
    [8, 6, 4, 2],
  );
});

test("removing players never changes earned points and unfinished players determine remaining awards", () => {
  const { store, room, host, guest } = setup();
  const { player: third } = store.join(room.code, "Robin", "c");
  const { player: fourth } = store.join(room.code, "Kim", "d");
  store.start(room, host);
  store.turn(room, host, "correct");
  store.disconnect(room, host);
  store.remove(room, guest, host.id);
  store.disconnect(room, third);
  store.remove(room, guest, third.id);
  assert.equal(host.score, 4);
  store.turn(room, guest, "correct");
  store.turn(room, fourth, "correct");
  assert.equal(guest.score, 2);
  assert.equal(fourth.score, 1);
  assert.equal(room.phase, "results");
});
