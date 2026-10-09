export const categories = [
  {
    id: "mix",
    name: "Van alles wat",
    emoji: "🎲",
    description: "Een verrassende mix van alles",
  },
  {
    id: "people",
    name: "Bekende mensen",
    emoji: "⭐",
    description: "Van popsterren tot wereldleiders",
  },
  {
    id: "characters",
    name: "Personages",
    emoji: "🪄",
    description: "Helden uit films, series en boeken",
  },
  {
    id: "animals",
    name: "Dieren",
    emoji: "🐼",
    description: "Van huiskat tot koning van de jungle",
  },
] as const;
export type Category = (typeof categories)[number]["id"];
export type Phase = "lobby" | "game" | "results";
export type IdentityImage = {
  src: string;
  source: string;
  artist?: string;
  license?: string;
  licenseUrl?: string;
};
export type PlayerView = {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  finished: boolean;
  identity: string | null;
  identityImage: IdentityImage | null;
};
export type IdentityOption = { identity: string; image: IdentityImage | null };
export type RoomView = {
  code: string;
  hostId: string;
  phase: Phase;
  category: Category;
  rounds: number;
  round: number;
  currentId: string | null;
  players: PlayerView[];
  options: IdentityOption[];
};
export type Reply = {
  ok: boolean;
  error?: string;
  token?: string;
  playerId?: string;
  code?: string;
};
