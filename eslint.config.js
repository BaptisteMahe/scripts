// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = defineConfig([
  eslintPluginPrettierRecommended,
  {
    ignores: ["dist/*"],
    rules: {
      "import/no-cycle": "error",
    },
  },
]);
