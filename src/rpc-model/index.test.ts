import {
  annotation,
  field,
  objectType,
  primitiveType,
  schema,
  stringLiteral,
  typeDef,
} from "@varavel/vdl-plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import { extractRpcGroups } from "./index";

describe("extractRpcGroups", () => {
  it("extracts procedures from @httpRpc types", () => {
    const ir = schema({
      types: [
        typeDef(
          "ChatService",
          objectType([
            field(
              "sendMessage",
              objectType([
                field(
                  "input",
                  objectType([field("text", primitiveType("string"))]),
                ),
                field(
                  "output",
                  objectType([field("id", primitiveType("string"))]),
                ),
              ]),
              { annotations: [annotation("proc")] },
            ),
          ]),
          {
            doc: "Chat APIs",
            annotations: [annotation("httpRpc")],
          },
        ),
      ],
    });

    const groups = extractRpcGroups(ir);
    const firstGroup = groups[0];

    expect(groups).toHaveLength(1);
    expect(firstGroup).toBeDefined();
    expect(firstGroup?.name).toBe("ChatService");
    expect(firstGroup?.doc).toBe("Chat APIs");
    expect(firstGroup?.procedures.map((item) => item.name)).toEqual([
      "sendMessage",
    ]);
  });

  it("ignores types without @httpRpc", () => {
    const ir = schema({
      types: [
        typeDef("User", objectType([field("id", primitiveType("string"))])),
        typeDef(
          "Legacy",
          objectType([
            field("ping", objectType([]), {
              annotations: [annotation("proc")],
            }),
          ]),
          { annotations: [annotation("rpc")] },
        ),
      ],
    });

    expect(extractRpcGroups(ir)).toEqual([]);
  });

  it("ignores fields without @proc", () => {
    const ir = schema({
      types: [
        typeDef(
          "Service",
          objectType([
            field("helper", primitiveType("string")),
            field(
              "ping",
              objectType([
                field("input", objectType([])),
                field("output", objectType([])),
              ]),
              { annotations: [annotation("proc")] },
            ),
          ]),
          { annotations: [annotation("httpRpc")] },
        ),
      ],
    });

    const groups = extractRpcGroups(ir);
    const firstGroup = groups[0];

    expect(groups).toHaveLength(1);
    expect(firstGroup?.procedures).toHaveLength(1);
    expect(firstGroup?.procedures[0]?.name).toBe("ping");
  });

  it("treats missing input and output blocks as empty payloads", () => {
    const ir = schema({
      types: [
        typeDef(
          "Service",
          objectType([
            field("ping", objectType([]), {
              annotations: [annotation("proc")],
            }),
          ]),
          { annotations: [annotation("httpRpc")] },
        ),
      ],
    });

    const group = extractRpcGroups(ir)[0];
    expect(group).toBeDefined();
    expect(group?.procedures[0]?.inputFields).toEqual([]);
    expect(group?.procedures[0]?.outputFields).toEqual([]);
  });

  it("skips services without procedures", () => {
    const ir = schema({
      types: [
        typeDef(
          "Empty",
          objectType([field("helper", primitiveType("string"))]),
          {
            annotations: [annotation("httpRpc")],
          },
        ),
      ],
    });

    expect(extractRpcGroups(ir)).toEqual([]);
  });

  it("reports deprecation messages for services and procedures", () => {
    const ir = schema({
      types: [
        typeDef(
          "Service",
          objectType([
            field("oldPing", objectType([]), {
              annotations: [
                annotation("proc"),
                annotation("deprecated", stringLiteral("Use ping instead.")),
              ],
            }),
            field("barePing", objectType([]), {
              annotations: [annotation("proc"), annotation("deprecated")],
            }),
          ]),
          {
            annotations: [
              annotation("httpRpc"),
              annotation("deprecated", stringLiteral("Use ServiceV2.")),
            ],
          },
        ),
      ],
    });

    const group = extractRpcGroups(ir)[0];
    expect(group?.deprecated).toBe("Use ServiceV2.");
    expect(group?.procedures[0]?.deprecated).toBe("Use ping instead.");
    expect(group?.procedures[1]?.deprecated).toBe("");
  });

  it("leaves deprecation undefined when no annotation is present", () => {
    const ir = schema({
      types: [
        typeDef(
          "Service",
          objectType([
            field("ping", objectType([]), {
              annotations: [annotation("proc")],
            }),
          ]),
          { annotations: [annotation("httpRpc")] },
        ),
      ],
    });

    const group = extractRpcGroups(ir)[0];
    expect(group?.deprecated).toBeUndefined();
    expect(group?.procedures[0]?.deprecated).toBeUndefined();
  });
});
