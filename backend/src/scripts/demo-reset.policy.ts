export const DEMO_RESET_CONFIRMATION = "--confirm-local-demo-reset";

export const quoteSqlIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

export const buildDemoTruncateSql = (tableNames: string[]) => {
  if (tableNames.length === 0) throw new Error("No public application tables were found.");
  return `TRUNCATE TABLE ${[...tableNames].sort().map(quoteSqlIdentifier).join(", ")} RESTART IDENTITY CASCADE`;
};

export const assertDemoResetSafety = (input: { nodeEnv: string; databaseUrl: string; confirmation: string | undefined }) => {
  if (input.confirmation !== DEMO_RESET_CONFIRMATION) {
    throw new Error(`Demo reset requires ${DEMO_RESET_CONFIRMATION}.`);
  }
  if (input.nodeEnv !== "development") {
    throw new Error("Demo reset is development-only.");
  }
  const url = new URL(input.databaseUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("Demo reset requires PostgreSQL.");
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
    throw new Error("Demo reset only accepts a local PostgreSQL host.");
  }
  const databaseName = url.pathname.slice(1);
  if (!databaseName || databaseName === "postgres") {
    throw new Error("Demo reset requires a named application database, not the postgres maintenance database.");
  }
};
