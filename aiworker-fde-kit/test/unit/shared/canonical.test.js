import { describe, expect, test } from "vitest";

import {
  canonicalBytes,
  normalizeMarkdown,
  sha256Bytes,
  sortRelativePaths,
} from "../../../src/shared/canonical.js";
import { SAFE_DATA_LIMITS } from "../../../src/contracts/safe-data.js";

describe("canonicalBytes", () => {
  test("matches the RFC 8785 serialization example", () => {
    const value = {
      numbers: [
        333333333.33333329,
        1e30,
        4.5,
        2e-3,
        0.000000000000000000000000001,
      ],
      string: "€$\u000f\nA'B\"\\\\\"/",
      literals: [null, true, false],
    };

    expect(canonicalBytes(value).toString("utf8")).toBe(
      "{\"literals\":[null,true,false],\"numbers\":[333333333.3333333,1e+30,4.5,0.002,1e-27],\"string\":\"€$\\u000f\\nA'B\\\"\\\\\\\\\\\"/\"}",
    );
  });

  test("orders object keys recursively by RFC 8785 UTF-16 order and retains array order", () => {
    const value = {
      "\u20ac": "Euro Sign",
      "\r": "Carriage Return",
      "\ufb33": "Hebrew Letter Dalet With Dagesh",
      1: "One",
      "😀": "Emoji: Grinning Face",
      "\u0080": "Control",
      ö: { z: 1, a: 2 },
      items: ["third", "first", "second"],
    };

    expect(canonicalBytes(value).toString("utf8")).toBe(
      "{\"\\r\":\"Carriage Return\",\"1\":\"One\",\"items\":[\"third\",\"first\",\"second\"],\"\":\"Control\",\"ö\":{\"a\":2,\"z\":1},\"€\":\"Euro Sign\",\"😀\":\"Emoji: Grinning Face\",\"דּ\":\"Hebrew Letter Dalet With Dagesh\"}",
    );
  });

  test("does not normalize Unicode strings", () => {
    const composed = "\u00e9";
    const decomposed = "e\u0301";

    expect(canonicalBytes({ value: decomposed })).not.toEqual(
      canonicalBytes({ value: composed }),
    );
  });

  test("rejects malformed Unicode strings as required by RFC 8785", () => {
    expect(() => canonicalBytes({ value: "\ud800" })).toThrowError(
      expect.objectContaining({ code: "E_CANONICAL_UNICODE" }),
    );
  });

  test("rejects values outside the JSON data model", () => {
    expect(() => canonicalBytes({ value: new Date() })).toThrowError(
      expect.objectContaining({ code: "E_SAFE_UNSUPPORTED_TYPE" }),
    );
  });

  test("enforces the shared depth limit before canonicalization", () => {
    let value = null;
    for (let depth = 0; depth < 20_000; depth += 1) {
      value = [value];
    }

    expect(() => canonicalBytes(value)).toThrowError(
      expect.objectContaining({
        code: "E_SAFE_DEPTH",
        sourceName: "<canonical-value>",
      }),
    );
  });

  test("enforces the shared node budget before canonicalization", () => {
    const value = Array.from(
      { length: SAFE_DATA_LIMITS.maxNodes },
      () => null,
    );
    expect(() => canonicalBytes(value)).toThrowError(
      expect.objectContaining({
        code: "E_SAFE_NODE_LIMIT",
        sourceName: "<canonical-value>",
      }),
    );
  });
});

describe("sha256Bytes", () => {
  test("returns a lowercase SHA-256 hex digest", () => {
    expect(sha256Bytes(Buffer.from("abc", "utf8"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("normalizeMarkdown", () => {
  test("normalizes line endings, strips trailing horizontal whitespace, and writes one final LF", () => {
    expect(
      normalizeMarkdown("# Title  \r\n\rLine\t \rLast line\r\n\r\n"),
    ).toBe("# Title\n\nLine\nLast line\n");
  });

  test("uses exactly one final LF when no trailing blank lines are present", () => {
    expect(normalizeMarkdown("value")).toBe("value\n");
    expect(normalizeMarkdown("value\n")).toBe("value\n");
    expect(normalizeMarkdown("value\n\n")).toBe("value\n");
    expect(normalizeMarkdown("")).toBe("\n");
  });
});

describe("sortRelativePaths", () => {
  test("normalizes separators and sorts by UTF-8 bytes without changing spelling", () => {
    expect(
      sortRelativePaths([
        "z/file.md",
        "ä/file.md",
        "a\\nested\\file.md",
        "é/file.md",
      ]),
    ).toEqual([
      "a/nested/file.md",
      "z/file.md",
      "ä/file.md",
      "é/file.md",
    ]);
  });

  test.each([
    ["", "E_PATH_EMPTY"],
    ["/absolute/file", "E_PATH_ABSOLUTE"],
    ["C:\\absolute\\file", "E_PATH_ABSOLUTE"],
    ["https://example.com/file", "E_PATH_URL"],
    ["file:///tmp/file", "E_PATH_URL"],
    ["contains\u0000nul", "E_PATH_NUL"],
    [".", "E_PATH_TRAVERSAL"],
    ["..", "E_PATH_TRAVERSAL"],
    ["a/./file", "E_PATH_TRAVERSAL"],
    ["a/../file", "E_PATH_TRAVERSAL"],
    ["\ud800", "E_PATH_UNICODE"],
    ["\udc00", "E_PATH_UNICODE"],
    ["path/\ud800/file", "E_PATH_UNICODE"],
  ])("rejects unsafe path %s", (unsafePath, code) => {
    expect(() => sortRelativePaths([unsafePath])).toThrowError(
      expect.objectContaining({ code }),
    );
  });

  test("rejects duplicates after separator normalization", () => {
    expect(() =>
      sortRelativePaths(["a/nested/file.md", "a\\nested\\file.md"]),
    ).toThrowError(expect.objectContaining({ code: "E_PATH_DUPLICATE" }));
  });

  test("keeps a literal replacement character as valid Unicode", () => {
    expect(sortRelativePaths(["\ufffd/file.md", "a/file.md"])).toEqual([
      "a/file.md",
      "\ufffd/file.md",
    ]);
  });
});
