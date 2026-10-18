import {
  annotation,
  enumDef,
  enumMember,
  field,
  intLiteral,
  objectType,
  primitiveType,
  schema,
  stringLiteral,
  typeDef,
} from "@varavel/vdl-plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import type { PluginOptions } from "../options";
import type { RpcGroup } from "../rpc-model";
import {
  buildOpenApiSpec,
  generateEnumSchema,
  generatePropertiesFromFields,
  generateTypeRefSchema,
  generateTypeSchema,
} from "./index";
import { buildPaths, toLowerFirst } from "./paths";
import { buildTags } from "./tags";

const baseOptions: PluginOptions = {
  outFile: "openapi.yaml",
  outFormat: "yaml",
  playgroundUi: "swagger-ui",
  title: "Test API",
  version: "1.0.0",
  auth: "apiKey",
  authApiKeyName: "Authorization",
  authApiKeyIn: "header",
};

describe("generateTypeRefSchema", () => {
  it("maps primitive and date-time types", () => {
    expect(generateTypeRefSchema(primitiveType("string"))).toEqual({
      type: "string",
    });
    expect(generateTypeRefSchema(primitiveType("datetime"))).toEqual({
      type: "string",
      format: "date-time",
    });
  });

  it("maps references for custom types and enums", () => {
    expect(
      generateTypeRefSchema({
        kind: "type",
        typeName: "User",
      }),
    ).toEqual({
      $ref: "#/components/schemas/User",
    });

    expect(
      generateTypeRefSchema({
        kind: "enum",
        enumName: "Role",
      }),
    ).toEqual({
      $ref: "#/components/schemas/Role",
    });
  });

  it("supports multi-dimensional arrays", () => {
    const schemaValue = generateTypeRefSchema({
      kind: "array",
      arrayDims: 3,
      arrayType: primitiveType("int"),
    });

    expect(schemaValue).toEqual({
      type: "array",
      items: {
        type: "array",
        items: {
          type: "array",
          items: {
            type: "integer",
          },
        },
      },
    });
  });

  it("maps map types to additionalProperties", () => {
    expect(
      generateTypeRefSchema({
        kind: "map",
        mapType: primitiveType("bool"),
      }),
    ).toEqual({
      type: "object",
      additionalProperties: {
        type: "boolean",
      },
    });
  });
});

describe("generatePropertiesFromFields", () => {
  it("tracks required fields and keeps optional fields out of required", () => {
    const { properties, required } = generatePropertiesFromFields([
      field("id", primitiveType("string")),
      field("nickname", primitiveType("string"), { optional: true }),
    ]);

    expect(Object.keys(properties)).toEqual(["id", "nickname"]);
    expect(required).toEqual(["id"]);
  });

  it("wraps references in allOf when a field has a description", () => {
    const { properties } = generatePropertiesFromFields([
      field(
        "user",
        {
          kind: "type",
          typeName: "User",
        },
        { doc: "The user payload" },
      ),
    ]);

    expect(properties.user).toEqual({
      allOf: [
        {
          $ref: "#/components/schemas/User",
        },
        {
          description: "The user payload",
        },
      ],
    });
  });

  it("marks deprecated fields with the SDK helpers", () => {
    const { properties } = generatePropertiesFromFields([
      field("legacy", primitiveType("string"), {
        annotations: [annotation("deprecated", stringLiteral("Use next."))],
      }),
      field("bare", primitiveType("string"), {
        annotations: [annotation("deprecated")],
      }),
    ]);

    expect(properties.legacy).toMatchObject({
      deprecated: true,
      description: "Deprecated: Use next.",
    });
    expect(properties.bare).toMatchObject({ deprecated: true });
  });
});

describe("generateTypeSchema and generateEnumSchema", () => {
  it("marks deprecated types and appends deprecation message", () => {
    const typeSchema = generateTypeSchema(
      typeDef("Legacy", objectType([field("id", primitiveType("string"))]), {
        annotations: [annotation("deprecated", stringLiteral("Use NewType"))],
      }),
    );

    expect(typeSchema.deprecated).toBe(true);
    expect(typeSchema.description).toBe("Deprecated: Use NewType");
  });

  it("keeps deprecated text on a new paragraph when a description already exists", () => {
    const typeSchema = generateTypeSchema(
      typeDef("Legacy", objectType([field("id", primitiveType("string"))]), {
        doc: "Legacy payload.",
        annotations: [annotation("deprecated", stringLiteral("Use NewType"))],
      }),
    );

    expect(typeSchema.description).toBe(
      "Legacy payload.\n\nDeprecated: Use NewType",
    );
  });

  it("supports both string and integer enums", () => {
    const roleSchema = generateEnumSchema(
      enumDef("Role", "string", [
        enumMember("Admin", stringLiteral("Admin")),
        enumMember("User", stringLiteral("User")),
      ]),
    );

    const prioritySchema = generateEnumSchema(
      enumDef("Priority", "int", [
        enumMember("Low", intLiteral(1)),
        enumMember("High", intLiteral(10)),
      ]),
    );

    expect(roleSchema).toMatchObject({
      type: "string",
      enum: ["Admin", "User"],
    });
    expect(prioritySchema).toMatchObject({
      type: "integer",
      enum: [1, 10],
    });
  });

  it("marks deprecated enums without requiring a message", () => {
    const roleSchema = generateEnumSchema(
      enumDef("Role", "string", [enumMember("Admin", stringLiteral("Admin"))], {
        annotations: [annotation("deprecated")],
      }),
    );

    expect(roleSchema.deprecated).toBe(true);
  });
});

describe("toLowerFirst", () => {
  it("lowercases the first letter and keeps the rest untouched", () => {
    expect(toLowerFirst("Calculator")).toBe("calculator");
    expect(toLowerFirst("MyService")).toBe("myService");
    expect(toLowerFirst("myProc")).toBe("myProc");
  });

  it("handles empty and single character values", () => {
    expect(toLowerFirst("")).toBe("");
    expect(toLowerFirst("A")).toBe("a");
  });

  it("leaves leading non-letters untouched", () => {
    expect(toLowerFirst("123Abc")).toBe("123Abc");
  });
});

describe("buildPaths", () => {
  it("derives VPP-2 routes with lowerFirst at build time", () => {
    const paths = buildPaths([
      {
        name: "Users",
        procs: [
          {
            rpcName: "Users",
            name: "getUser",
            inputFields: [],
            outputFields: [],
          },
        ],
      },
    ]);

    expect(Object.keys(paths)).toEqual(["/users/getUser"]);

    const proc = (paths["/users/getUser"] as Record<string, unknown>)
      .post as Record<string, unknown>;

    expect(proc.operationId).toBe("usersGetUser");
  });

  it("normalizes PascalCase procedures into camelCase operationIds", () => {
    const paths = buildPaths([
      {
        name: "Service",
        procs: [
          {
            rpcName: "Service",
            name: "Ping",
            inputFields: [],
            outputFields: [],
          },
        ],
      },
    ]);

    const proc = (paths["/service/Ping"] as Record<string, unknown>)
      .post as Record<string, unknown>;

    expect(proc.operationId).toBe("servicePing");
  });

  it("marks deprecated procedures and appends the message", () => {
    const paths = buildPaths([
      {
        name: "Users",
        procs: [
          {
            rpcName: "Users",
            name: "getUser",
            deprecated: "Use getUserV2.",
            inputFields: [],
            outputFields: [],
          },
        ],
      },
    ]);

    const proc = (paths["/users/getUser"] as Record<string, unknown>)
      .post as Record<string, unknown>;

    expect(proc.deprecated).toBe(true);
    expect(proc.description).toBe("Deprecated: Use getUserV2.");
  });
});

describe("buildTags", () => {
  it("creates one tag per service and appends service deprecation", () => {
    const tags = buildTags([
      {
        name: "Users",
        doc: "User APIs",
        deprecated: "Use UsersV2.",
        procs: [
          {
            rpcName: "Users",
            name: "get",
            inputFields: [],
            outputFields: [],
          },
        ],
      },
    ]);

    expect(tags).toEqual([
      {
        name: "UsersProcedures",
        description: "User APIs\n\nDeprecated: Use UsersV2.",
      },
    ]);
  });
});

describe("buildOpenApiSpec", () => {
  it("builds sorted tags and includes server metadata", () => {
    const ir = schema();
    const rpcGroups: RpcGroup[] = [
      {
        name: "Users",
        procs: [
          {
            rpcName: "Users",
            rpcDoc: "User APIs",
            name: "get",
            inputFields: [],
            outputFields: [],
          },
        ],
      },
      {
        name: "Chat",
        procs: [
          {
            rpcName: "Chat",
            name: "messages",
            inputFields: [],
            outputFields: [],
          },
        ],
      },
    ];

    const spec = buildOpenApiSpec(ir, rpcGroups, {
      ...baseOptions,
      baseUrls: ["https://api.example.com", "https://backup.example.com"],
    });

    expect(spec.servers).toEqual([
      { url: "https://api.example.com" },
      { url: "https://backup.example.com" },
    ]);
    expect(spec.paths).toMatchObject({
      "/chat/messages": {
        post: {
          requestBody: {
            $ref: "#/components/requestBodies/ChatMessagesInput",
          },
        },
      },
      "/users/get": {
        post: {
          requestBody: {
            $ref: "#/components/requestBodies/UsersGetInput",
          },
        },
      },
    });
    expect(spec.tags).toEqual([
      {
        name: "ChatProcedures",
        description: "Procedures for Chat",
      },
      {
        name: "UsersProcedures",
        description: "Procedures for Users",
      },
    ]);
  });

  it("omits tags and paths when no RPC procedures are present", () => {
    const spec = buildOpenApiSpec(schema(), [], baseOptions);

    expect(spec.tags).toBeUndefined();
    expect(spec.paths).toEqual({});
    expect(spec.components).toBeDefined();
  });

  it("emits procedure responses as JSON envelopes", () => {
    const spec = buildOpenApiSpec(
      schema(),
      [
        {
          name: "Feed",
          procs: [
            {
              rpcName: "Feed",
              name: "updates",
              inputFields: [],
              outputFields: [],
            },
          ],
        },
      ],
      baseOptions,
    );

    const components = spec.components as Record<string, unknown>;
    const responses = components.responses as Record<string, unknown>;
    const updatesResponse = responses.FeedUpdatesOutput as Record<
      string,
      unknown
    >;
    const content = updatesResponse.content as Record<string, unknown>;

    expect(content["application/json"]).toBeDefined();
  });

  it("adds type and enum schemas while skipping @httpRpc types", () => {
    const ir = schema({
      types: [
        typeDef(
          "RpcService",
          objectType([
            field("ping", objectType([]), {
              annotations: [annotation("proc")],
            }),
          ]),
          { annotations: [annotation("httpRpc")] },
        ),
        typeDef("User", objectType([field("id", primitiveType("string"))])),
      ],
      enums: [
        enumDef("Role", "string", [
          enumMember("Admin", stringLiteral("Admin")),
        ]),
      ],
    });

    const spec = buildOpenApiSpec(ir, [], baseOptions);
    const components = spec.components as Record<string, unknown>;
    const schemas = components.schemas as Record<string, unknown>;

    expect(schemas.User).toBeDefined();
    expect(schemas.Role).toBeDefined();
    expect(schemas.RpcService).toBeUndefined();
  });
});

describe("buildOpenApiSpec auth", () => {
  it("omits security when auth is none", () => {
    const spec = buildOpenApiSpec(schema(), [], {
      ...baseOptions,
      auth: "none",
    });

    expect(spec.security).toBeUndefined();

    const components = spec.components as Record<string, unknown>;
    expect(components.securitySchemes).toBeUndefined();
  });

  it("emits a bearer scheme when auth is bearer", () => {
    const spec = buildOpenApiSpec(schema(), [], {
      ...baseOptions,
      auth: "bearer",
    });

    expect(spec.security).toEqual([{ Auth: [] }]);

    const components = spec.components as Record<string, unknown>;
    expect(components.securitySchemes).toEqual({
      Auth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Enter the bearer token. Sent as `Authorization: Bearer <token>` header.",
      },
    });
  });

  it("emits a basic scheme when auth is basic", () => {
    const spec = buildOpenApiSpec(schema(), [], {
      ...baseOptions,
      auth: "basic",
    });

    const components = spec.components as Record<string, unknown>;
    expect(components.securitySchemes).toEqual({
      Auth: {
        type: "http",
        scheme: "basic",
        description:
          "Enter the username and password. Sent as `Authorization: Basic <base64(username:password)>` header.",
      },
    });
  });

  it("emits a custom API key scheme when name and location change", () => {
    const spec = buildOpenApiSpec(schema(), [], {
      ...baseOptions,
      auth: "apiKey",
      authApiKeyName: "X-API-Key",
      authApiKeyIn: "query",
    });

    const components = spec.components as Record<string, unknown>;
    expect(components.securitySchemes).toEqual({
      Auth: {
        type: "apiKey",
        in: "query",
        name: "X-API-Key",
        description:
          "Enter the API key value. Sent as `?X-API-Key={apiKey}` query parameter.",
      },
    });
  });

  it("emits a default API key scheme in the Authorization header", () => {
    const spec = buildOpenApiSpec(schema(), [], baseOptions);

    const components = spec.components as Record<string, unknown>;
    expect(components.securitySchemes).toEqual({
      Auth: {
        type: "apiKey",
        in: "header",
        name: "Authorization",
        description:
          "Enter the API key value. Sent as `Authorization: {apiKey}` header.",
      },
    });
  });

  it("emits an API key scheme in a cookie", () => {
    const spec = buildOpenApiSpec(schema(), [], {
      ...baseOptions,
      auth: "apiKey",
      authApiKeyName: "X-API-Key",
      authApiKeyIn: "cookie",
    });

    const components = spec.components as Record<string, unknown>;
    expect(components.securitySchemes).toEqual({
      Auth: {
        type: "apiKey",
        in: "cookie",
        name: "X-API-Key",
        description:
          "Enter the API key value. Sent as `X-API-Key={apiKey}` cookie.",
      },
    });
  });
});
