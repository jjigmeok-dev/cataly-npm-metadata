/**
 * Discord has no markdown table syntax: pipes arrive as literal text and a
 * pasted markdown table reads as noise. Convert pipes to what Discord does
 * render — a fenced block with column-aligned rows, or bullets when the table
 * is too wide for a code block to fit a phone screen.
 */

/** A code block wider than this wraps awkwardly on a narrow client. */
const MAX_CODE_WIDTH = 68;

const cellWidth = (text: string): number =>
  [...text].reduce(
    (n, ch) => n + (/\p{Script=Han}|\p{Script=Hangul}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(ch) ? 2 : 1),
    0,
  );

const splitRow = (line: string): string[] => {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
};

/** Emphasis/code markers do not render inside a fence, so strip them. */
const plain = (text: string): string =>
  text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .trim();

const renderTable = (header: readonly string[], rows: readonly (readonly string[])[]): string => {
  const cols = header.length;
  const head = header.map(plain);
  const body = rows.map((row) => Array.from({ length: cols }, (_, i) => plain(row[i] ?? "")));
  const widths = head.map((h, i) => Math.max(cellWidth(h), ...body.map((r) => cellWidth(r[i]!))));
  const total = widths.reduce((a, b) => a + b, 0) + 2 * (cols - 1);

  if (total <= MAX_CODE_WIDTH && body.every((r) => r.every((c) => !c.includes("\n")))) {
    const line = (cells: readonly string[]): string =>
      cells
        .map((c, i) => c + " ".repeat(Math.max(0, widths[i]! - cellWidth(c))))
        .join("  ")
        .trimEnd();
    const lines = [line(head), widths.map((w) => "-".repeat(w)).join("  "), ...body.map(line)];
    return ["```", ...lines, "```"].join("\n");
  }

  // Too wide for a code block: two columns read as a mapping, more as key: value.
  return body
    .map((r) =>
      cols === 2
        ? `• ${r[0]}${r[1] ? ` → ${r[1]}` : ""}`
        : `• ${head
            .map((h, i) => (r[i] ? `${h}: ${r[i]}` : ""))
            .filter(Boolean)
            .join(" · ")}`,
    )
    .join("\n");
};

/** Replace every pipe table in `text` with something Discord renders. */
export const discordTables = (text: string): string => {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const next = lines[i + 1];
    // A table is a pipe row followed by a |---| separator row.
    const separator = next === undefined ? [] : splitRow(next);
    const isTable = line.includes("|") && separator.length > 0 && separator.every((c) => /^:?-{2,}:?$/.test(c));
    if (isTable) {
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i]!.includes("|") && lines[i]!.trim() !== "") {
        rows.push(splitRow(lines[i]!));
        i++;
      }
      out.push(renderTable(header, rows));
      continue;
    }
    out.push(line);
    i++;
  }
  return out.join("\n");
};
