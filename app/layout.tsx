import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Wie ben ik? — Samen aan tafel, samen in het spel",
  description:
    "Het leukste raadspel voor vrienden. Eén kamer, een geheime identiteit en eindeloos veel vragen.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
