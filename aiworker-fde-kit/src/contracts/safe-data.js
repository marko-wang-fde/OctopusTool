import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseAllDocuments,
} from "yaml";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const JSON_SCALAR_TAGS = new Set([
  "tag:yaml.org,2002:bool",
  "tag:yaml.org,2002:float",
  "tag:yaml.org,2002:int",
  "tag:yaml.org,2002:null",
  "tag:yaml.org,2002:str",
]);
// These limits apply at every untrusted JSON-data entry point. The byte cap
// bounds parser work; depth and node caps bound both parsed and runtime values.
export const SAFE_DATA_LIMITS = Object.freeze({
  maxDepth: 256,
  maxNodes: 100_000,
  maxInputBytes: 10 * 1024 * 1024,
});

export class SafeDataError extends Error {
  constructor(code, sourceName, reason, details = {}) {
    super(`${sourceName}: ${reason} (${code})`);
    this.name = "SafeDataError";
    this.code = code;
    this.sourceName = sourceName;
    this.reason = reason;
    this.details = details;
  }
}

function fail(code, sourceName, reason, details) {
  throw new SafeDataError(code, sourceName, reason, details);
}

function assertInputSize(text, sourceName, format) {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > SAFE_DATA_LIMITS.maxInputBytes) {
    fail(
      "E_SAFE_INPUT_SIZE",
      sourceName,
      `${format} input exceeds the safe byte limit of ${SAFE_DATA_LIMITS.maxInputBytes}.`,
      { bytes, maxInputBytes: SAFE_DATA_LIMITS.maxInputBytes },
    );
  }
}

function assertNodeCapacity(nodes, pendingNodes, additionalNodes, sourceName) {
  if (
    additionalNodes >
    SAFE_DATA_LIMITS.maxNodes - nodes - pendingNodes
  ) {
    fail(
      "E_SAFE_NODE_LIMIT",
      sourceName,
      `Data exceeds the safe node limit of ${SAFE_DATA_LIMITS.maxNodes}.`,
      { maxNodes: SAFE_DATA_LIMITS.maxNodes },
    );
  }
}

function inspectYamlDocument(document, sourceName) {
  const stack = [];
  if (document.contents !== null) {
    stack.push({ node: document.contents, depth: 0 });
  }
  let nodes = 0;

  while (stack.length > 0) {
    const { node, depth } = stack.pop();
    nodes += 1;
    if (nodes > SAFE_DATA_LIMITS.maxNodes) {
      fail(
        "E_SAFE_NODE_LIMIT",
        sourceName,
        `YAML data exceeds the safe node limit of ${SAFE_DATA_LIMITS.maxNodes}.`,
        { maxNodes: SAFE_DATA_LIMITS.maxNodes },
      );
    }
    if (depth > SAFE_DATA_LIMITS.maxDepth) {
      fail(
        "E_SAFE_DEPTH",
        sourceName,
        `YAML nesting exceeds the safe depth limit of ${SAFE_DATA_LIMITS.maxDepth}.`,
        { depth, maxDepth: SAFE_DATA_LIMITS.maxDepth },
      );
    }
    if (node === null) continue;
    if (isAlias(node)) {
      fail("E_YAML_ALIAS", sourceName, "YAML aliases are not allowed.");
    }
    if (node.anchor !== undefined) {
      fail("E_YAML_ANCHOR", sourceName, "YAML anchors are not allowed.");
    }
    if (
      node.tag &&
      (!isScalar(node) || !JSON_SCALAR_TAGS.has(node.tag))
    ) {
      fail("E_YAML_TAG", sourceName, "This YAML tag is not JSON-compatible.", {
        tag: node.tag,
      });
    }
    if (isMap(node)) {
      assertNodeCapacity(
        nodes,
        stack.length,
        node.items.length * 2,
        sourceName,
      );
      for (const pair of node.items) {
        if (!isScalar(pair.key) || typeof pair.key.value !== "string") {
          fail(
            "E_YAML_NON_STRING_KEY",
            sourceName,
            "YAML mapping keys must be strings.",
          );
        }
        if (pair.key.value === "<<") {
          fail(
            "E_YAML_MERGE_KEY",
            sourceName,
            "YAML merge keys are not allowed.",
          );
        }
        if (FORBIDDEN_KEYS.has(pair.key.value)) {
          fail(
            "E_SAFE_FORBIDDEN_KEY",
            sourceName,
            `Forbidden object key: ${pair.key.value}.`,
            { key: pair.key.value },
          );
        }
        stack.push({ node: pair.value, depth: depth + 1 });
        stack.push({ node: pair.key, depth: depth + 1 });
      }
    } else if (isSeq(node)) {
      assertNodeCapacity(nodes, stack.length, node.items.length, sourceName);
      for (let index = node.items.length - 1; index >= 0; index -= 1) {
        stack.push({ node: node.items[index], depth: depth + 1 });
      }
    }
  }
}

function inspectYamlErrors(documents, sourceName) {
  const errors = documents.flatMap((document) => document.errors);
  if (errors.length === 0) return;

  const duplicate = errors.find((error) => error.code === "DUPLICATE_KEY");
  if (duplicate) {
    fail(
      "E_YAML_DUPLICATE_KEY",
      sourceName,
      "Duplicate YAML mapping keys are not allowed.",
    );
  }

  fail("E_PARSE_YAML", sourceName, "YAML could not be parsed.", {
    parserCode: errors[0].code,
  });
}

export function assertJsonDataModel(value, sourceName = "<value>") {
  const ancestors = new WeakSet();
  const stack = [{ kind: "enter", value, location: "$", depth: 0 }];
  let pendingNodes = 1;
  let nodes = 0;

  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame.kind === "exit") {
      ancestors.delete(frame.value);
      continue;
    }

    pendingNodes -= 1;
    nodes += 1;
    if (nodes > SAFE_DATA_LIMITS.maxNodes) {
      fail(
        "E_SAFE_NODE_LIMIT",
        sourceName,
        `Data exceeds the safe node limit of ${SAFE_DATA_LIMITS.maxNodes}.`,
        { maxNodes: SAFE_DATA_LIMITS.maxNodes },
      );
    }
    if (frame.depth > SAFE_DATA_LIMITS.maxDepth) {
      fail(
        "E_SAFE_DEPTH",
        sourceName,
        `Data nesting exceeds the safe depth limit of ${SAFE_DATA_LIMITS.maxDepth}.`,
        {
          depth: frame.depth,
          location: frame.location,
          maxDepth: SAFE_DATA_LIMITS.maxDepth,
        },
      );
    }

    const current = frame.value;
    if (current === null) continue;
    const valueType = typeof current;
    if (valueType === "string" || valueType === "boolean") continue;
    if (valueType === "number") {
      if (!Number.isFinite(current)) {
        fail(
          "E_SAFE_NON_FINITE",
          sourceName,
          `Non-finite number at ${frame.location}.`,
          { location: frame.location },
        );
      }
      continue;
    }
    if (valueType !== "object") {
      fail(
        "E_SAFE_UNSUPPORTED_TYPE",
        sourceName,
        `Unsupported value type at ${frame.location}.`,
        { location: frame.location, type: valueType },
      );
    }
    if (ancestors.has(current)) {
      fail(
        "E_SAFE_CYCLE",
        sourceName,
        `Cyclic value at ${frame.location}.`,
        { location: frame.location },
      );
    }

    ancestors.add(current);
    stack.push({ kind: "exit", value: current });

    if (Array.isArray(current)) {
      assertNodeCapacity(
        nodes,
        pendingNodes,
        current.length,
        sourceName,
      );
      const arrayKeys = Reflect.ownKeys(current);
      if (
        arrayKeys.length !== current.length + 1 ||
        arrayKeys.some(
          (key) =>
            typeof key !== "string" ||
            (key !== "length" && !/^(?:0|[1-9][0-9]*)$/u.test(key)),
        )
      ) {
        fail(
          "E_SAFE_UNSUPPORTED_TYPE",
          sourceName,
          `Array at ${frame.location} contains non-index properties.`,
          { location: frame.location },
        );
      }
      for (let index = current.length - 1; index >= 0; index -= 1) {
        const descriptor = Object.getOwnPropertyDescriptor(
          current,
          String(index),
        );
        if (
          !descriptor ||
          !descriptor.enumerable ||
          !Object.hasOwn(descriptor, "value")
        ) {
          fail(
            "E_SAFE_UNSUPPORTED_TYPE",
            sourceName,
            `Array at ${frame.location} must contain dense data properties.`,
            { location: frame.location },
          );
        }
        stack.push({
          kind: "enter",
          value: descriptor.value,
          location: `${frame.location}[${index}]`,
          depth: frame.depth + 1,
        });
      }
      pendingNodes += current.length;
      continue;
    }

    const prototype = Object.getPrototypeOf(current);
    if (prototype !== Object.prototype && prototype !== null) {
      fail(
        "E_SAFE_UNSUPPORTED_TYPE",
        sourceName,
        `Non-plain object at ${frame.location}.`,
        { location: frame.location },
      );
    }
    const ownKeys = Reflect.ownKeys(current);
    assertNodeCapacity(nodes, pendingNodes, ownKeys.length, sourceName);
    const enumerableKeys = Object.keys(current);
    if (
      ownKeys.length !== enumerableKeys.length ||
      ownKeys.some((key) => typeof key !== "string")
    ) {
      fail(
        "E_SAFE_UNSUPPORTED_TYPE",
        sourceName,
        `Object properties at ${frame.location} must be enumerable string data keys.`,
        { location: frame.location },
      );
    }

    for (let index = enumerableKeys.length - 1; index >= 0; index -= 1) {
      const key = enumerableKeys[index];
      if (FORBIDDEN_KEYS.has(key)) {
        fail(
          "E_SAFE_FORBIDDEN_KEY",
          sourceName,
          `Forbidden object key: ${key}.`,
          { key, location: frame.location },
        );
      }
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!descriptor || !Object.hasOwn(descriptor, "value")) {
        fail(
          "E_SAFE_UNSUPPORTED_TYPE",
          sourceName,
          `Accessor property at ${frame.location}.${key} is not allowed.`,
          { key, location: frame.location },
        );
      }
      stack.push({
        kind: "enter",
        value: descriptor.value,
        location: `${frame.location}.${key}`,
        depth: frame.depth + 1,
      });
    }
    pendingNodes += enumerableKeys.length;
  }
  return value;
}

export function parseSafeYaml(text, sourceName = "<yaml>") {
  if (typeof text !== "string") {
    fail("E_PARSE_YAML", sourceName, "YAML input must be a string.");
  }
  assertInputSize(text, sourceName, "YAML");
  let documents;
  try {
    documents = parseAllDocuments(text, {
      merge: false,
      prettyErrors: false,
      strict: true,
      uniqueKeys: true,
      version: "1.2",
    });
  } catch (error) {
    fail("E_PARSE_YAML", sourceName, "YAML could not be parsed.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (documents.length > 1) {
    fail(
      "E_YAML_MULTI_DOCUMENT",
      sourceName,
      "Only one YAML document is allowed.",
    );
  }
  if (documents.length === 0) return null;

  inspectYamlDocument(documents[0], sourceName);
  inspectYamlErrors(documents, sourceName);

  let value;
  try {
    value = documents[0].toJS({ mapAsMap: false, maxAliasCount: 0 });
  } catch (error) {
    fail("E_PARSE_YAML", sourceName, "YAML could not be converted to data.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return assertJsonDataModel(value, sourceName);
}

class JsonDuplicatePreflight {
  constructor(text, sourceName) {
    this.text = text;
    this.sourceName = sourceName;
    this.index = 0;
    this.nodes = 0;
  }

  parse() {
    this.skipWhitespace();
    this.parseValue(0);
    this.skipWhitespace();
    if (this.index !== this.text.length) {
      this.parseError("Unexpected trailing JSON content.");
    }
  }

  skipWhitespace() {
    while (
      this.index < this.text.length &&
      /[ \t\r\n]/u.test(this.text[this.index])
    ) {
      this.index += 1;
    }
  }

  parseValue(depth) {
    if (depth > SAFE_DATA_LIMITS.maxDepth) {
      fail(
        "E_SAFE_DEPTH",
        this.sourceName,
        `JSON nesting exceeds the safe depth limit of ${SAFE_DATA_LIMITS.maxDepth}.`,
        { depth, maxDepth: SAFE_DATA_LIMITS.maxDepth, offset: this.index },
      );
    }
    this.nodes += 1;
    if (this.nodes > SAFE_DATA_LIMITS.maxNodes) {
      fail(
        "E_SAFE_NODE_LIMIT",
        this.sourceName,
        `JSON data exceeds the safe node limit of ${SAFE_DATA_LIMITS.maxNodes}.`,
        { maxNodes: SAFE_DATA_LIMITS.maxNodes, offset: this.index },
      );
    }
    const token = this.text[this.index];
    if (token === "{") {
      this.parseObject(depth);
    } else if (token === "[") {
      this.parseArray(depth);
    } else if (token === '"') {
      this.parseString();
    } else if (token === "t") {
      this.parseLiteral("true");
    } else if (token === "f") {
      this.parseLiteral("false");
    } else if (token === "n") {
      this.parseLiteral("null");
    } else {
      this.parseNumber();
    }
  }

  parseObject(depth) {
    this.index += 1;
    this.skipWhitespace();
    if (this.text[this.index] === "}") {
      this.index += 1;
      return;
    }

    const keys = new Set();
    while (this.index < this.text.length) {
      if (this.text[this.index] !== '"') {
        this.parseError("JSON object member names must be strings.");
      }
      const key = this.parseString();
      if (keys.has(key)) {
        fail(
          "E_JSON_DUPLICATE_KEY",
          this.sourceName,
          `Duplicate JSON object member name: ${key}.`,
          { key, offset: this.index },
        );
      }
      keys.add(key);

      this.skipWhitespace();
      if (this.text[this.index] !== ":") {
        this.parseError("Expected ':' after JSON object member name.");
      }
      this.index += 1;
      this.skipWhitespace();
      this.parseValue(depth + 1);
      this.skipWhitespace();

      const separator = this.text[this.index];
      if (separator === "}") {
        this.index += 1;
        return;
      }
      if (separator !== ",") {
        this.parseError("Expected ',' or '}' in JSON object.");
      }
      this.index += 1;
      this.skipWhitespace();
    }

    this.parseError("Unterminated JSON object.");
  }

  parseArray(depth) {
    this.index += 1;
    this.skipWhitespace();
    if (this.text[this.index] === "]") {
      this.index += 1;
      return;
    }

    while (this.index < this.text.length) {
      this.parseValue(depth + 1);
      this.skipWhitespace();
      const separator = this.text[this.index];
      if (separator === "]") {
        this.index += 1;
        return;
      }
      if (separator !== ",") {
        this.parseError("Expected ',' or ']' in JSON array.");
      }
      this.index += 1;
      this.skipWhitespace();
    }

    this.parseError("Unterminated JSON array.");
  }

  parseString() {
    const start = this.index;
    this.index += 1;

    while (this.index < this.text.length) {
      const character = this.text[this.index];
      const codeUnit = this.text.charCodeAt(this.index);
      if (character === '"') {
        this.index += 1;
        return JSON.parse(this.text.slice(start, this.index));
      }
      if (codeUnit < 0x20) {
        this.parseError("Unescaped control character in JSON string.");
      }
      if (character === "\\") {
        this.index += 1;
        const escape = this.text[this.index];
        if (escape === "u") {
          const hex = this.text.slice(this.index + 1, this.index + 5);
          if (!/^[a-f0-9]{4}$/iu.test(hex)) {
            this.parseError("Invalid Unicode escape in JSON string.");
          }
          this.index += 5;
          continue;
        }
        if (!'\"\\/bfnrt'.includes(escape ?? "")) {
          this.parseError("Invalid escape in JSON string.");
        }
      }
      this.index += 1;
    }

    this.parseError("Unterminated JSON string.");
  }

  parseLiteral(literal) {
    if (!this.text.startsWith(literal, this.index)) {
      this.parseError("Invalid JSON literal.");
    }
    this.index += literal.length;
  }

  parseNumber() {
    const number = this.text
      .slice(this.index)
      .match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u);
    if (!number) this.parseError("Invalid JSON value.");
    this.index += number[0].length;
  }

  parseError(reason) {
    fail("E_PARSE_JSON", this.sourceName, reason, { offset: this.index });
  }
}

export function parseSafeJson(text, sourceName = "<json>") {
  if (typeof text !== "string") {
    fail("E_PARSE_JSON", sourceName, "JSON input must be a string.");
  }
  assertInputSize(text, sourceName, "JSON");
  new JsonDuplicatePreflight(text, sourceName).parse();

  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    fail("E_PARSE_JSON", sourceName, "JSON could not be parsed.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return assertJsonDataModel(value, sourceName);
}
