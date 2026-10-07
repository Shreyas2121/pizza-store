export const accessKeys = {
  all: ["access"] as const,
  // Keep this prefix so realtime/403 invalidation reaches every principal.
  me: () => ["access", "me"] as const,
  principal: (userId: number | undefined) =>
    [...accessKeys.me(), userId] as const,
};
