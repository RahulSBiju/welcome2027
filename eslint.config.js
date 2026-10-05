// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions runs on Supabase's servers (Deno), not in the app; public/sw.js runs in the browser's background.
    ignores: ["dist/*", "supabase/functions/*", "public/sw.js"],
  }
]);
