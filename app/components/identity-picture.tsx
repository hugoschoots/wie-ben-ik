import type { IdentityImage } from "../../lib/types";

export function IdentityPicture({
  identity,
  image,
  compact = false,
}: {
  identity: string | null;
  image: IdentityImage | null | undefined;
  compact?: boolean;
}) {
  if (!identity || !image) return null;
  return (
    <figure className={`identity-picture${compact ? " compact-picture" : ""}`}>
      <img
        src={image.src}
        alt={identity}
        loading="lazy"
        decoding="async"
        width={320}
        height={240}
      />
      {!compact && (
        <figcaption>
          <a
            href={image.source}
            target="_blank"
            rel="noopener noreferrer"
            title={[image.artist, image.license].filter(Boolean).join(" · ")}
            aria-label={`Beeldbron van ${identity}`}
          >
            Beeldbron ↗
          </a>
        </figcaption>
      )}
    </figure>
  );
}
