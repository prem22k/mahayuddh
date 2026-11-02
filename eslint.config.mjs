import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // New in eslint-config-next 16 (react-hooks v7, the React Compiler rule
    // set). The app does not run the compiler, and 65 effects predate these
    // rules, so they report as warnings until each one is refactored on its
    // own. static-components, refs and purity stay errors.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  // Same scope `next lint` had: the app source. Build output, generated
  // files, static assets and the node scripts/tests stay out.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/**",
    "scripts/**",
    "tests/**",
    ".github/**",
    ".claude/**",
  ]),
]);
