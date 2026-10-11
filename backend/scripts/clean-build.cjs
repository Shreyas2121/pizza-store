const fs = require("node:fs");
const path = require("node:path");
const backendRoot = path.resolve(__dirname, "..");
const output = path.resolve(backendRoot, "dist");
if (path.dirname(output) !== backendRoot || path.basename(output) !== "dist") {
  throw new Error("Invalid build output directory");
}
// Remove stale compiled modules that Node could resolve before newer directories.
fs.rmSync(output, { recursive: true, force: true });
