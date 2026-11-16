import { expect, test } from "bun:test";
import { discordTables } from "../src/messenger/discord-tables.ts";

test("a pipe table never reaches Discord as literal pipes", () => {
  const text = ["결과:", "| 입력 | 판정 |", "|---|---|", "| 실제 후보 | 확인 |", "| 가짜 가격 | 미검증 |"].join("\n");
  const out = discordTables(text);
  // Discord renders no table syntax; every table row must be gone.
  const tableRows = out.split("\n").filter((l) => l.includes("|"));
  expect(tableRows).toEqual([]);
  expect(out).toContain("```");
  expect(out).toContain("실제 후보");
  expect(out).toContain("가짜 가격");
  // Surrounding prose survives.
  expect(out.startsWith("결과:")).toBe(true);
});

test("cells stay aligned in a code block so columns line up in monospace", () => {
  const out = discordTables(["| a | b |", "|---|---|", "| 짧음 | x |", "| 긴이름 | y |"].join("\n"));
  const [head, , first] = out.split("\n").slice(1, 4);
  // Korean cells occupy two monospace columns, so compare display columns, not
  // JS string indices: indexOf would under-count one per wide character.
  const column = (line: string, needle: string): number =>
    [...line.slice(0, line.indexOf(needle))].reduce(
      (n, ch) => n + (/[\p{Script=Hangul}\p{Script=Han}]/u.test(ch) ? 2 : 1),
      0,
    );
  expect(column(head!, "b")).toBe(column(first!, "x"));
});

test("a wide table degrades to bullets instead of an unwrappable code block", () => {
  const long = "아주긴설명".repeat(6);
  const out = discordTables(
    [`| 항목 | 값 | 비고 | 메모 |`, `|---|---|---|---|`, `| ${long} | ${long} | ${long} | ${long} |`].join("\n"),
  );
  expect(out).not.toContain("```");
  expect(out).toContain("• 항목: ");
});

test("prose containing a single pipe is left alone", () => {
  const text = "a | b 는 표가 아니다";
  expect(discordTables(text)).toBe(text);
});
