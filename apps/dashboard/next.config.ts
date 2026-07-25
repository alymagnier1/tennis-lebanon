import { config } from "dotenv";
import path from "node:path";
import type { NextConfig } from "next";

// Load shared env from the monorepo root (.env), not only apps/dashboard/.env.
config({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {/* config options here */};

export default nextConfig;
