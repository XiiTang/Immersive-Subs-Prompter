import { describe, expect, it } from "vitest";
import { renderWordLookupMarkdown } from "./wordLookupMarkdown";

describe("renderWordLookupMarkdown", () => {
  it("renders common markdown while escaping raw html", () => {
    const html = renderWordLookupMarkdown("# Title\n\n**bold** <script>alert(1)</script>\n\n- item");

    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("<ul>");
  });

  it("only renders http and https links", () => {
    const html = renderWordLookupMarkdown("[safe](https://example.com) [bad](javascript:alert(1))");

    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain("javascript:");
    expect(html).toContain("bad");
  });
});
