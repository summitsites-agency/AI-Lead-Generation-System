import { describe, it, expect } from "vitest";
import { runSourceChain, type DiscoverySource } from "./sources";
import type { DiscoveredBusiness } from "@/lib/types";

function biz(name: string): DiscoveredBusiness {
  return { name, website: "", phone: "", email: "", address: "", source: "test" };
}
function source(name: string, available: boolean, result: DiscoveredBusiness[] | Error): DiscoverySource {
  return {
    name,
    available: () => available,
    discover: async () => {
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

describe("runSourceChain", () => {
  it("returns the first available source that yields results", async () => {
    const chain = [
      source("a", false, [biz("skip")]),
      source("b", true, []),
      source("c", true, [biz("hit")]),
    ];
    const list = await runSourceChain(chain, "roofing", "Montreal", {});
    expect(list.map((b) => b.name)).toEqual(["hit"]);
  });

  it("falls through when a source throws", async () => {
    const chain = [
      source("a", true, new Error("boom")),
      source("b", true, [biz("recovered")]),
    ];
    const list = await runSourceChain(chain, "x", "y", {});
    expect(list.map((b) => b.name)).toEqual(["recovered"]);
  });

  it("returns empty when nothing yields", async () => {
    const chain = [source("a", false, []), source("b", true, [])];
    expect(await runSourceChain(chain, "x", "y", {})).toEqual([]);
  });
});
