import eslint from "@eslint/js";
import prettier from "eslint-plugin-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "build/**",
      "coverage/**",
      "node_modules/**",
      "*.d.ts",
      "vite.config.ts",
      "eslint.config.*",
      "scripts/**/*.cjs",
      "public/sw.js",
      "artifacts/**",
      "tests/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      prettier,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    rules: {
      "no-console": "warn",
      "no-debugger": "error",
      "no-alert": "error",
      "no-var": "error",
      "prefer-const": "error",
      "no-empty": "error",
      "no-restricted-globals": [
        "error",
        {
          name: "Math.random",
          message:
            "Usa gameRandom.random() en lugar de Math.random() para mantener determinismo. Importa desde utils/deterministicRandom",
        },
      ],
      "@typescript-eslint/explicit-function-return-type": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "warn",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "prettier/prettier": "error",
    },
  },
  {
    files: [
      "scripts/**/*.{js,mjs,ts}",
      "src/examples/**/*.ts",
      "src/utils/logger.ts",
    ],
    languageOptions: {
      globals: {
        console: "readonly",
      },
    },
    rules: {
      "no-console": "off",
    },
  },
);
