const BLOCK_TAGS = new Set(["ul", "ol", "pre", "table"]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function renderInline(raw: string): string {
  let text = escapeHtml(raw);
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, href: string) => {
    const safeLabel = renderInline(label);
    if (!isSafeHttpUrl(href)) {
      return safeLabel;
    }
    return `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${safeLabel}</a>`;
  });
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return text;
}

function flushParagraph(blocks: string[], paragraph: string[]) {
  if (!paragraph.length) return;
  blocks.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  paragraph.length = 0;
}

function flushList(blocks: string[], listItems: string[], listType: "ul" | "ol" | null) {
  if (!listType || !listItems.length) return;
  blocks.push(`<${listType}>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</${listType}>`);
  listItems.length = 0;
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function renderTable(lines: string[]): string {
  const rows = lines.map((line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim())
  );
  const [head, , ...body] = rows;
  if (!head) return "";
  return [
    "<table>",
    `<thead><tr>${head.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead>`,
    `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`,
    "</table>"
  ].join("");
}

export function renderWordLookupMarkdown(markdown: string): string {
  const blocks: string[] = [];
  const paragraph: string[] = [];
  const listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let inFence = false;
  let fenceLines: string[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph(blocks, paragraph);
      flushList(blocks, listItems, listType);
      listType = null;
      if (inFence) {
        blocks.push(`<pre><code>${escapeHtml(fenceLines.join("\n"))}</code></pre>`);
        fenceLines = [];
        inFence = false;
      } else {
        inFence = true;
      }
      continue;
    }

    if (inFence) {
      fenceLines.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph(blocks, paragraph);
      flushList(blocks, listItems, listType);
      listType = null;
      continue;
    }

    if (index + 1 < lines.length && trimmed.includes("|") && isTableSeparator(lines[index + 1] ?? "")) {
      flushParagraph(blocks, paragraph);
      flushList(blocks, listItems, listType);
      listType = null;
      const tableLines = [line, lines[index + 1] ?? ""];
      index += 2;
      while (index < lines.length && (lines[index] ?? "").trim().includes("|")) {
        tableLines.push(lines[index] ?? "");
        index += 1;
      }
      index -= 1;
      blocks.push(renderTable(tableLines));
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph(blocks, paragraph);
      flushList(blocks, listItems, listType);
      listType = null;
      const level = heading[1]!.length;
      blocks.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`);
      continue;
    }

    const unordered = /^[-*+]\s+(.+)$/.exec(trimmed);
    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (unordered || ordered) {
      flushParagraph(blocks, paragraph);
      const nextType = unordered ? "ul" : "ol";
      if (listType && listType !== nextType) {
        flushList(blocks, listItems, listType);
      }
      listType = nextType;
      listItems.push((unordered?.[1] ?? ordered?.[1] ?? "").trim());
      continue;
    }

    const quote = /^>\s?(.+)$/.exec(trimmed);
    if (quote) {
      flushParagraph(blocks, paragraph);
      flushList(blocks, listItems, listType);
      listType = null;
      blocks.push(`<blockquote>${renderInline(quote[1]!)}</blockquote>`);
      continue;
    }

    flushList(blocks, listItems, listType);
    listType = null;
    paragraph.push(trimmed);
  }

  if (inFence) {
    blocks.push(`<pre><code>${escapeHtml(fenceLines.join("\n"))}</code></pre>`);
  }
  flushParagraph(blocks, paragraph);
  flushList(blocks, listItems, listType);

  return blocks.filter((block) => block && (BLOCK_TAGS.has(block.slice(1, block.indexOf(">"))) || block.trim())).join("");
}
