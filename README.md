> **Warning:** This project is vibe coded.

# Wie ben ik?

A local multiplayer party game. Dutch interface, Next.js App Router, TypeScript, Tailwind CSS and Socket.IO. No accounts, database, external APIs or paid services.

## Run locally

Requires Node.js 20.9 or later.

```sh
npm install
npm run dev
```

Open http://localhost:3000. To play on phones, open `http://YOUR-LAN-IP:3000` on every device connected to the same Wi-Fi. On macOS, `ipconfig getifaddr en0` usually gives your Wi-Fi IP. Allow incoming connections to Node if your firewall asks. When creating a room on localhost, the server automatically uses a local network address for the QR code and invitation link. If your computer has multiple network interfaces or a VPN and the suggested address is unreachable, create the room from your Wi-Fi IP address instead. `localhost` on a phone points to that phone.

## Production

```sh
npm run build
npm start
```

Both Next.js and Socket.IO use the same HTTP server, bound to `0.0.0.0:3000`. Set `PORT` to override the port. This requires a long-running Node server, not static or serverless hosting.

Optional: if you already have the free Cloudflare Tunnel CLI installed, run `cloudflared tunnel --url http://localhost:3000`. Open the resulting HTTPS URL before creating a room so invitations use the tunnel address. The app itself does not require Cloudflare or make external API calls.

## Playing

Create a room, share its five-character code or QR link, and join with 2–10 players. The host chooses a category and 1–10 rounds. Questions and answers happen out loud. A yes keeps the turn; a no uses **Volgende beurt**. A correct verbal guess uses **Goed geraden** and awards points by finishing order: with N players, the first finisher earns N points, then N−1, down to 1 for the last. For four players this is 4, 3, 2, 1. Scores accumulate across rounds. The award equals the number of unfinished players still in the room, so removing an unfinished player reduces subsequent awards. **Fout geraden** passes the turn without a point. Only the current player can use these actions. Finished players are skipped. The host starts each following round; tied scores produce joint winners.

## Sessions and disconnects

Refresh preserves the player through a random secret token in sessionStorage in the same browser tab. Each tab can be a separate player, useful for local testing. Closing the tab may lose the session; use the same tab for the whole game. The server transfers host controls to a connected player when the host disconnects. A disconnected current player has a 15-second refresh grace period, then is skipped. Disconnected unfinished players remain in the round: they can reconnect or the host can remove them. A new round needs two connected players.

All rooms live only in server memory. Restarting the server loses rooms. Abandoned rooms expire after six hours. Identity decks are local in `lib/identities.ts`; identities are unique within a round and do not repeat until the selected deck runs low. The server builds a separate response per player and never sends their own unfinished identity. Identities are revealed after a correct guess and on the results screen. Scoring is on the honor system because guesses happen face-to-face.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

Tests cover personalized identity protection, turn and host authorization, scoring, round transitions, reconnection, capacity and input validation.

With the server already running, `npm run test:integration` verifies a full two-round game using three real Socket.IO clients, including authorization, hidden identities and reconnects.

## Identity pictures

All 150 identities have a locally bundled image in `public/identities`. The server only links image paths and credits to a player once their assigned identity is visible. Candidate images are also shown on the shared guessing board without identifying their player. Hidden players receive `identityImage: null`; filenames and image metadata cannot reveal their own identity in the room payload. Results show everyone's images.

`lib/identity-images.json` retains source-file links and available author/license metadata. The in-game image credit links and `/beeldbronnen` list the sources. Some character references are copyrighted images or film posters from Wikipedia; see each source's terms. The app does not fetch images from external services during play.

To refresh bundled source assets during development, run `python3 scripts/fetch-identity-images.py` after `npm install` (requires curl and internet access). Existing assets are kept.

## Personal guessing boards

Each category contains 50 identities. At round start the server supplies the same 50-option board to every player, including all assigned identities and random decoys for the mixed category. Options contain names and images but no player IDs or correct-answer markers. A player's own assignment still has null identity/image fields until revealed.

Click an option to cross it out, click again to restore it, or reset the whole board. Cross-outs are private to the current browser tab and saved in sessionStorage per room, round and player; refresh restores them and a new round starts a fresh board. The turn banner stays visible while scrolling, animates when it is your turn, and respects reduced-motion preferences.
