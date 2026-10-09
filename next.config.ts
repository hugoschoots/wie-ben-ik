import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

const localAddresses = Object.values(networkInterfaces())
  .flatMap((addresses) => addresses ?? [])
  .filter((address) => address.family === "IPv4")
  .map((address) => address.address);

const config: NextConfig = {
  // The custom server binds to 0.0.0.0, but browsers use the machine's Wi-Fi
  // address. Allow those addresses for Next.js development assets and HMR.
  allowedDevOrigins: [...new Set(localAddresses)],
};

export default config;
