import { FlatCompat } from "@eslint/eslintrc";

/**
 * ESLint 9 (flat config).
 *
 * `eslint-config-next` todavía se distribuye en el formato viejo, así que se
 * lo adapta con `FlatCompat`.
 */
const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "next-env.d.ts",
      "prisma/migrations/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Los formularios usan `FormData`, donde los campos opcionales llegan
      // como `null`; el patrón `?? null` es intencional y no un descuido.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
