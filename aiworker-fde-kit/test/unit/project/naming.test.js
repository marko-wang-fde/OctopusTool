import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  NamingError,
  suggestProjectIdentity,
} from "../../../src/project/naming.js";

const PARENT = path.resolve("/tmp/fde-projects");

describe("suggestProjectIdentity", () => {
  test("suggests the specified Chinese display name and vocabulary-backed ASCII slug", () => {
    expect(
      suggestProjectIdentity({
        customerName: "星河科技",
        scenario: "客户线索收集",
        parent: PARENT,
      }),
    ).toEqual({
      name: "星河科技客户线索收集数字员工",
      slug: "xinghe-lead-collector-fde",
      absolutePath: path.join(PARENT, "xinghe-lead-collector-fde"),
    });
  });

  test("returns exactly the same generic Chinese suggestion for the same input", () => {
    const options = {
      customerName: "远山制造",
      scenario: "巡检记录归档",
      parent: PARENT,
    };

    const first = suggestProjectIdentity(options);
    const second = suggestProjectIdentity(options);

    expect(first).toEqual(second);
    expect(first.name).toBe("远山制造巡检记录归档数字员工");
    expect(first.slug).toMatch(/^project-archive-[a-f0-9]{8}-fde$/u);
    expect(first.absolutePath).toBe(path.join(PARENT, first.slug));
  });

  test("uses explicit valid name and slug overrides", () => {
    expect(
      suggestProjectIdentity({
        customerName: "星河科技",
        scenario: "客户线索收集",
        name: "销售协作数字员工",
        slug: "sales-copilot-fde",
        parent: PARENT,
      }),
    ).toEqual({
      name: "销售协作数字员工",
      slug: "sales-copilot-fde",
      absolutePath: path.join(PARENT, "sales-copilot-fde"),
    });
  });

  test.each([
    ["empty display name", { name: " \t" }],
    ["empty customer", { customerName: "" }],
    ["empty scenario", { scenario: " " }],
    ["uppercase slug", { slug: "Unsafe-Slug" }],
    ["slash in slug", { slug: "unsafe/slug" }],
    ["backslash in slug", { slug: "unsafe\\slug" }],
    ["dot segment slug", { slug: ".." }],
    ["leading hyphen", { slug: "-unsafe" }],
    ["absolute slug", { slug: "/tmp/unsafe" }],
  ])("rejects %s", (_label, override) => {
    expect(() =>
      suggestProjectIdentity({
        customerName: "星河科技",
        scenario: "客户线索收集",
        parent: PARENT,
        ...override,
      }),
    ).toThrow(NamingError);
  });
});
