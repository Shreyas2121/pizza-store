export const normalizeMasterName = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-IN");

export const escapeLikePattern = (value: string) =>
  value.replace(/[\\%_]/gu, "\\$&");
