import path from "node:path";
import { constants } from "node:fs";
import { cp, mkdir } from "node:fs/promises";

// Keep this module independent of envSchema: promotion schemas import storage.
export const dataDirectory = () => path.resolve(process.env.DATA_DIRECTORY || process.cwd());
export const uploadsDirectory = () => path.join(dataDirectory(), "uploads");
export const receiptsDirectory = () => path.join(dataDirectory(), ".private", "expense-receipts");

export async function initializeStorage() {
  await mkdir(uploadsDirectory(), { recursive: true });
  await mkdir(receiptsDirectory(), { recursive: true, mode: 0o700 });
  // Copy the bundled public demo assets onto a new disk; never replace uploads.
  await cp(path.resolve(__dirname, "../../assets/uploads"), uploadsDirectory(), {
    recursive: true,
    force: false,
    errorOnExist: false,
    mode: constants.COPYFILE_EXCL,
  });
}
