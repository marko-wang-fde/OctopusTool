import { describe, expect, test } from "vitest";

import {
  SAFE_DATA_LIMITS,
  assertJsonDataModel,
  parseSafeJson,
  parseSafeYaml,
} from "../../../src/contracts/safe-data.js";

function expectSafeError(action, code, sourceName) {
  expect(action).toThrowError(
    expect.objectContaining({
      code,
      sourceName,
    }),
  );
}

describe("parseSafeYaml", () => {
  test("parses an ordinary nested YAML document into plain JSON data", () => {
    const value = parseSafeYaml(
      [
        "name: worker",
        "enabled: true",
        "count: 3",
        "ratio: 1.5",
        "missing: null",
        "items:",
        "  - one",
        "  - nested:",
        "      key: value",
      ].join("\n"),
      "ordinary.yaml",
    );

    expect(value).toEqual({
      name: "worker",
      enabled: true,
      count: 3,
      ratio: 1.5,
      missing: null,
      items: ["one", { nested: { key: "value" } }],
    });
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
  });

  test("allows explicit tags only for JSON-compatible scalar types", () => {
    expect(
      parseSafeYaml(
        "text: !!str value\ncount: !!int 2\nratio: !!float 1.5\nenabled: !!bool true\nmissing: !!null null\n",
        "explicit-scalars.yaml",
      ),
    ).toEqual({
      text: "value",
      count: 2,
      ratio: 1.5,
      enabled: true,
      missing: null,
    });
  });

  test.each([
    ["string tag on a map", "value: !!str {a: 1}"],
    ["integer tag on a sequence", "value: !!int [1, 2]"],
  ])("rejects an allowed scalar tag applied to a %s", (_label, text) => {
    expectSafeError(
      () => parseSafeYaml(text, "non-scalar-tag.yaml"),
      "E_YAML_TAG",
      "non-scalar-tag.yaml",
    );
  });

  test.each([
    ["custom tag", "value: !danger payload", "E_YAML_TAG"],
    ["timestamp tag", "value: !!timestamp 2026-07-24", "E_YAML_TAG"],
    ["binary tag", "value: !!binary SGVsbG8=", "E_YAML_TAG"],
    ["set tag", "value: !!set\n  one: null", "E_YAML_TAG"],
    ["anchor", "value: &shared one", "E_YAML_ANCHOR"],
    ["alias", "value: *missing", "E_YAML_ALIAS"],
    [
      "merge key",
      "base: &base\n  one: 1\nvalue:\n  <<: *base",
      "E_YAML_MERGE_KEY",
    ],
    ["duplicate key", "value: one\nvalue: two", "E_YAML_DUPLICATE_KEY"],
    ["numeric mapping key", "1: value", "E_YAML_NON_STRING_KEY"],
    ["sequence mapping key", "? [one, two]\n: value", "E_YAML_NON_STRING_KEY"],
    ["NaN", "value: .nan", "E_SAFE_NON_FINITE"],
    ["positive infinity", "value: .inf", "E_SAFE_NON_FINITE"],
    ["negative infinity", "value: -.inf", "E_SAFE_NON_FINITE"],
    ["prototype key", "nested:\n  prototype: value", "E_SAFE_FORBIDDEN_KEY"],
    ["constructor key", "nested:\n  constructor: value", "E_SAFE_FORBIDDEN_KEY"],
    ["proto key", "nested:\n  __proto__: value", "E_SAFE_FORBIDDEN_KEY"],
  ])("rejects %s", (_label, text, code) => {
    expectSafeError(() => parseSafeYaml(text, "unsafe.yaml"), code, "unsafe.yaml");
  });

  test("rejects merge keys even when aliases are otherwise reached later", () => {
    expectSafeError(
      () =>
        parseSafeYaml(
          "value:\n  <<: { one: 1 }\n",
          "merge-key.yaml",
        ),
      "E_YAML_MERGE_KEY",
      "merge-key.yaml",
    );
  });

  test("rejects multiple YAML documents", () => {
    expectSafeError(
      () => parseSafeYaml("one: 1\n---\ntwo: 2\n", "multiple.yaml"),
      "E_YAML_MULTI_DOCUMENT",
      "multiple.yaml",
    );
  });

  test("reports malformed YAML with its source", () => {
    expectSafeError(
      () => parseSafeYaml("value: [", "broken.yaml"),
      "E_PARSE_YAML",
      "broken.yaml",
    );
  });

  test("enforces the shared depth limit on deeply nested YAML", () => {
    const depth = 20_000;
    const text = `value: ${"[".repeat(depth)}null${"]".repeat(depth)}`;
    expectSafeError(
      () => parseSafeYaml(text, "deep.yaml"),
      "E_SAFE_DEPTH",
      "deep.yaml",
    );
  });

  test("rejects YAML text above the shared input byte limit before parsing", () => {
    const text = " ".repeat(SAFE_DATA_LIMITS.maxInputBytes + 1);
    expectSafeError(
      () => parseSafeYaml(text, "large.yaml"),
      "E_SAFE_INPUT_SIZE",
      "large.yaml",
    );
  });

  test("enforces the shared node budget on YAML AST data", () => {
    const text = `items:\n${"  - null\n".repeat(SAFE_DATA_LIMITS.maxNodes)}`;
    expectSafeError(
      () => parseSafeYaml(text, "many-nodes.yaml"),
      "E_SAFE_NODE_LIMIT",
      "many-nodes.yaml",
    );
  });
});

describe("parseSafeJson", () => {
  test("parses ordinary nested JSON", () => {
    expect(
      parseSafeJson(
        '{"text":"value","items":[1,true,null,{"nested":"ok"}]}',
        "ordinary.json",
      ),
    ).toEqual({
      text: "value",
      items: [1, true, null, { nested: "ok" }],
    });
  });

  test("reports malformed JSON with its source", () => {
    expectSafeError(
      () => parseSafeJson('{"value":', "broken.json"),
      "E_PARSE_JSON",
      "broken.json",
    );
  });

  test("reports excessive JSON nesting with the shared stable error", () => {
    const depth = 20_000;
    const text = `${"[".repeat(depth)}null${"]".repeat(depth)}`;
    expectSafeError(
      () => parseSafeJson(text, "deep.json"),
      "E_SAFE_DEPTH",
      "deep.json",
    );
  });

  test("rejects JSON text above the shared input byte limit before parsing", () => {
    const text = " ".repeat(SAFE_DATA_LIMITS.maxInputBytes + 1);
    expectSafeError(
      () => parseSafeJson(text, "large.json"),
      "E_SAFE_INPUT_SIZE",
      "large.json",
    );
  });

  test("enforces the shared node budget during JSON preflight", () => {
    const text = `[${"null,".repeat(SAFE_DATA_LIMITS.maxNodes - 1)}null]`;
    expectSafeError(
      () => parseSafeJson(text, "many-nodes.json"),
      "E_SAFE_NODE_LIMIT",
      "many-nodes.json",
    );
  });

  test.each([
    ["root object", '{"a":1,"a":2}'],
    ["nested object", '{"outer":{"a":1,"a":2}}'],
    ["escaped-equivalent key", '{"a":1,"\\u0061":2}'],
    ["object inside an array", '[{"a":1,"a":2}]'],
    ["surrounding whitespace", ' \n { "a" : 1 , "a" : 2 } \t '],
  ])("rejects duplicate member names in a %s", (_label, text) => {
    expectSafeError(
      () => parseSafeJson(text, "duplicate.json"),
      "E_JSON_DUPLICATE_KEY",
      "duplicate.json",
    );
  });

  test.each(["__proto__", "constructor", "prototype"])(
    "rejects the prototype-pollution key %s at any depth",
    (key) => {
      expectSafeError(
        () =>
          parseSafeJson(
            `{"safe":{"${key}":"unsafe"}}`,
            "unsafe.json",
          ),
        "E_SAFE_FORBIDDEN_KEY",
        "unsafe.json",
      );
    },
  );
});

describe("assertJsonDataModel", () => {
  test.each([
    ["Date", new Date("2026-07-24T00:00:00Z")],
    ["BigInt", 1n],
    ["Map", new Map([["one", 1]])],
    ["Set", new Set(["one"])],
    ["class instance", new (class Example {})()],
    ["undefined", undefined],
    ["symbol", Symbol("unsafe")],
    ["function", () => "unsafe"],
  ])("rejects %s values", (_label, value) => {
    expectSafeError(
      () => assertJsonDataModel(value, "runtime-value"),
      "E_SAFE_UNSUPPORTED_TYPE",
      "runtime-value",
    );
  });

  test("rejects cyclic arrays and objects", () => {
    const object = {};
    object.self = object;
    const array = [];
    array.push(array);

    expectSafeError(
      () => assertJsonDataModel(object, "cyclic-object"),
      "E_SAFE_CYCLE",
      "cyclic-object",
    );
    expectSafeError(
      () => assertJsonDataModel(array, "cyclic-array"),
      "E_SAFE_CYCLE",
      "cyclic-array",
    );
  });

  test("rejects accessor and extra array properties without reading accessors", () => {
    let accessorRead = false;
    const accessorArray = [];
    Object.defineProperty(accessorArray, "0", {
      enumerable: true,
      get() {
        accessorRead = true;
        return "unsafe";
      },
    });
    const extendedArray = ["safe"];
    extendedArray.extra = "unsafe";

    expectSafeError(
      () => assertJsonDataModel(accessorArray, "accessor-array"),
      "E_SAFE_UNSUPPORTED_TYPE",
      "accessor-array",
    );
    expect(accessorRead).toBe(false);
    expectSafeError(
      () => assertJsonDataModel(extendedArray, "extended-array"),
      "E_SAFE_UNSUPPORTED_TYPE",
      "extended-array",
    );
  });

  test("rejects non-finite runtime numbers", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expectSafeError(
        () => assertJsonDataModel(value, "non-finite"),
        "E_SAFE_NON_FINITE",
        "non-finite",
      );
    }
  });

  test.each([
    ["array", (value) => [value]],
    ["object", (value) => ({ nested: value })],
  ])("iteratively rejects a 20k-deep plain %s", (_label, wrap) => {
    let value = null;
    for (let depth = 0; depth < 20_000; depth += 1) value = wrap(value);

    expectSafeError(
      () => assertJsonDataModel(value, "deep-runtime"),
      "E_SAFE_DEPTH",
      "deep-runtime",
    );
  });

  test("enforces the shared runtime node budget", () => {
    const value = Array.from(
      { length: SAFE_DATA_LIMITS.maxNodes },
      () => null,
    );
    expectSafeError(
      () => assertJsonDataModel(value, "many-runtime-nodes"),
      "E_SAFE_NODE_LIMIT",
      "many-runtime-nodes",
    );
  });

  test("rejects a very wide container without enqueuing all children", () => {
    const value = Array.from({ length: 1_000_000 }, () => null);
    expectSafeError(
      () => assertJsonDataModel(value, "wide-runtime-value"),
      "E_SAFE_NODE_LIMIT",
      "wide-runtime-value",
    );
  });
});
