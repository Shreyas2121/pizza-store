import { describe, expect, it } from "vitest";
import { validateExpenseReceipt } from "./expense-attachment.policy";

const pdf = Buffer.from("%PDF-1.7\nreceipt");
describe("expense receipt validation", () => {
  it("accepts a bounded receipt when content, media type, and extension agree", () => {
    expect(validateExpenseReceipt({ originalname: "invoice.pdf", mimetype: "application/pdf", size: pdf.length, buffer: pdf })).toMatchObject({ originalName: "invoice.pdf", mediaType: "application/pdf", extension: ".pdf" });
  });
  it("rejects traversal names and spoofed content", () => {
    expect(() => validateExpenseReceipt({ originalname: "../invoice.pdf", mimetype: "application/pdf", size: pdf.length, buffer: pdf })).toThrowError(expect.objectContaining({ code: "INVALID_RECEIPT_FILENAME" }));
    expect(() => validateExpenseReceipt({ originalname: "invoice.png", mimetype: "image/png", size: pdf.length, buffer: pdf })).toThrowError(expect.objectContaining({ code: "INVALID_RECEIPT_TYPE" }));
  });
});
