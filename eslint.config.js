import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

export default defineConfig([
  globalIgnores([
    "**/licenses/**",
    "**/.cache/**",
    "**/.generated/**",
    "**/.turbo/**",
    "**/.nx/**",
    "**/coverage/**",
    "**/dist/**",
    "projects/submodules/**",
  ]),
  // Projects without their own config inherit basic JavaScript correctness rules
  {
    files: ["**/*.{js,mjs,cjs}"],
    ...js.configs.recommended,
  },
  // Node globals belong to shell automation and configuration files, not all apps
  {
    files: ["**/*.config.{js,mjs,cjs}", "scripts/node/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
