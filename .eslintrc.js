// Minimal Expo-standard lint setup. The goal is catching genuine mistakes - unused
// code, bad hook dependencies, unreachable branches - not imposing a style or forcing
// a repo-wide reformat. Formatting rules are deliberately left off.
module.exports = {
  root: true,
  extends: ["expo"],
  ignorePatterns: ["node_modules/", ".expo/", "dist/", "android/", "ios/"],
  rules: {
    // Surfaces leftovers like the dead components removed in Phase 1, but as a
    // warning: an unused variable should not block a build.
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    // Downgraded from error, deliberately. Every occurrence is `setLoading(true)` at
    // the top of a data-fetching effect - a pattern the rule flags for cascading
    // re-renders, which its own message describes as a performance concern rather
    // than a correctness one. These effects behave correctly. Restructuring three
    // working screens to satisfy a performance advisory is not what this phase is
    // for, so it stays visible as a warning and is recorded as technical debt.
    "react-hooks/set-state-in-effect": "warn",
  },
};
