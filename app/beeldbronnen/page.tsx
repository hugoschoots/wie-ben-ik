import images from "../../lib/identity-images.json";
import type { IdentityImage } from "../../lib/types";
export default function ImageCredits() {
  return (
    <main className="site-shell image-credits">
      <a className="text-button" href="/">
        ← Terug naar het spel
      </a>
      <div className="room-title">
        <span className="eyebrow">DE GEZICHTEN ACHTER DE KAARTJES</span>
        <h1>Beeldbronnen</h1>
        <p>
          De afbeeldingen zijn lokaal opgeslagen. Hier vind je de makers,
          bronnen en vermelde licenties.
        </p>
      </div>
      <div className="credits-grid">
        {Object.entries(images)
          .sort(([a], [b]) => a.localeCompare(b, "nl"))
          .map(([identity, data]) => {
            const image: IdentityImage = data;
            return (
              <article className="panel credit-card" key={identity}>
                <img
                  src={image.src}
                  alt={identity}
                  loading="lazy"
                  width={100}
                  height={100}
                />
                <div>
                  <h2>{identity}</h2>
                  {image.artist && <p>{image.artist}</p>}
                  <p>
                    {image.license ||
                      "Zie de bron voor de gebruiksvoorwaarden."}
                  </p>
                  <a
                    href={image.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-button"
                  >
                    Oorspronkelijke beeldbron ↗
                  </a>
                  {image.licenseUrl && (
                    <a
                      href={image.licenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-button"
                    >
                      Licentie ↗
                    </a>
                  )}
                </div>
              </article>
            );
          })}
      </div>
    </main>
  );
}
