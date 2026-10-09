import imageManifest from "./identity-images.json";
import type { IdentityImage } from "./types";

// Imported only by the game server. Hidden players receive neither a filename
// nor image attribution that could reveal their identity.
export function getIdentityImage(identity: string): IdentityImage | null {
  const entry = (imageManifest as Record<string, IdentityImage>)[identity];
  if (!entry) return null;
  return {
    src: entry.src,
    source: entry.source,
    artist: entry.artist,
    license: entry.license,
    licenseUrl: entry.licenseUrl,
  };
}
