import { describe, it, expect } from "bun:test";
import { sanitizeSlug, isValidUrl } from "../workers/modules/links/links.service";

describe("Link Validation Logic", () => {
  it("rejects invalid URLs and non-http/https protocols", () => {
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("ftp://files.example.com")).toBe(false);
    expect(isValidUrl("https://zulfifazhar.dev")).toBe(true);
    expect(isValidUrl("http://localhost:3000")).toBe(true);
  });

  it("sanitizes and validates custom slugs", () => {
    expect(sanitizeSlug("My-Slug_123")).toBe("My-Slug_123");
    expect(sanitizeSlug("api")).toBeNull(); // reserved
    expect(sanitizeSlug("dashboard")).toBeNull(); // reserved
    expect(sanitizeSlug("invalid space")).toBeNull();
  });
});
