import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const folder = resolve(process.cwd(), "migrations");
const journal = JSON.parse(readFileSync(resolve(folder, "meta/_journal.json"), "utf8")) as { entries: Array<{ tag: string }> };

describe("migration composite foreign-key prerequisites", () => {
  it.each(journal.entries)("creates later-added unique keys before their foreign-key consumers in $tag", ({ tag }) => {
    const statements = readFileSync(resolve(folder, `${tag}.sql`), "utf8").split("--> statement-breakpoint");
    expect(statements.some((statement) => statement.trim() === "+"), `${tag}: stray patch marker`).toBe(false);
    const normalize = (columns: string) => columns.replace(/\s/g, "");
    statements.forEach((statement, uniqueIndex) => {
      const unique = statement.match(/ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" UNIQUE\(([^)]+)\)/);
      if (!unique) return;
      statements.forEach((consumer, foreignKeyIndex) => {
        const reference = consumer.match(/FOREIGN KEY[\s\S]*?REFERENCES "public"\."([^"]+)"\(([^)]+)\)/);
        if (reference && reference[1] === unique[1] && normalize(reference[2]) === normalize(unique[3])) {
          expect(uniqueIndex, `${tag}: ${unique[2]} must precede its foreign key`).toBeLessThan(foreignKeyIndex);
        }
      });
    });
  });
});
