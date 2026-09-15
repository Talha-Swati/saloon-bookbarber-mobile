import { defineConfig } from "vitest/config";
import path from "path";

// Scoped to pure logic in utils/ and services/ that has no React Native runtime
// dependency. Component and screen testing would need jest-expo and a native mock
// layer; that is a larger decision than this phase should make, and is recorded as
// technical debt rather than half-introduced here.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
