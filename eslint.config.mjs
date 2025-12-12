import { defineConfig, globalIgnores } from "eslint/config";

// Minimal ESLint config for Next.js 15
// Note: eslint-config-next/core-web-vitals uses old format, not compatible with flat config
const eslintConfig = defineConfig([
  // Override default ignores
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),
]);

export default eslintConfig;
