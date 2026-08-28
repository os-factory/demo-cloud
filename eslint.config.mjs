import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    // .next is Next.js build output; .har is the agent harness (its .cjs
    // templates/generated files are plain Node scripts, not app source).
    // ecosystem.agent.*.config.cjs is generated per-slot at the repo root by
    // .har/launch.sh (gitignored) — same reason.
    ignores: [
      ".next/**",
      ".har/**",
      "supabase/.temp/**",
      "ecosystem.agent.*.config.cjs",
      "tests/**",
      "playwright.config.js",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
