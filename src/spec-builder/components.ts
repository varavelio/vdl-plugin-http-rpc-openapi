import type { IrSchema } from "@varavel/vdl-plugin-sdk";
import { getAnnotation } from "@varavel/vdl-plugin-sdk/utils/ir";
import { pascalCase } from "@varavel/vdl-plugin-sdk/utils/strings";
import type { PluginOptions } from "../options";
import type { RpcGroup } from "../rpc-model";
import {
  generateEnumSchema,
  generateProcResponse,
  generateRequestBody,
  generateTypeSchema,
} from "./schema-fragments";

const BEARER_DESCRIPTION =
  "Enter the bearer token. Sent as `Authorization: Bearer <token>` header.";

const BASIC_DESCRIPTION =
  "Enter the username and password. Sent as `Authorization: Basic <base64(username:password)>` header.";

/** Shared transport failure response for unknown procedure routes. */
const ROUTE_NOT_FOUND_DESCRIPTION =
  "Unknown route. The procedure path does not exist. Transport failure, never an application error envelope.";

/** Shared transport failure response for unhandled server errors. */
const INTERNAL_ERROR_DESCRIPTION =
  "Unhandled server failure. Transport failure, never an application error envelope.";

/** Shared fallback response for any other transport or infrastructure failure. */
const TRANSPORT_FAILURE_DESCRIPTION =
  "Transport or infrastructure failure. Transport failure, never an application error envelope.";

/**
 * Builds the reusable OpenAPI components section.
 */
export function buildComponents(
  ir: IrSchema,
  rpcGroups: RpcGroup[],
  options: PluginOptions,
): Record<string, unknown> {
  const schemas = buildSchemas(ir);
  const requestBodies = buildRequestBodies(rpcGroups);
  const responses = buildResponses(rpcGroups);

  const components: Record<string, unknown> = {};

  const securitySchemes = buildSecuritySchemes(options);

  if (securitySchemes) {
    components.securitySchemes = securitySchemes;
  }

  if (Object.keys(schemas).length > 0) {
    components.schemas = schemas;
  }

  if (Object.keys(requestBodies).length > 0) {
    components.requestBodies = requestBodies;
  }

  if (Object.keys(responses).length > 0) {
    components.responses = responses;
  }

  return components;
}

/**
 * Builds the didactic `Auth` description for the configured API key location.
 * Resolved at build time so novices see exactly where the value travels.
 */
function apiKeyDescription(options: PluginOptions): string {
  switch (options.authApiKeyIn) {
    case "query":
      return `Enter the API key value. Sent as \`?${options.authApiKeyName}={apiKey}\` query parameter.`;
    case "cookie":
      return `Enter the API key value. Sent as \`${options.authApiKeyName}={apiKey}\` cookie.`;
    default:
      return `Enter the API key value. Sent as \`${options.authApiKeyName}: {apiKey}\` header.`;
  }
}

/**
 * Builds the `Auth` security scheme for the configured `auth` preset.
 * Returns undefined when authentication is disabled.
 */
function buildSecuritySchemes(
  options: PluginOptions,
): Record<string, unknown> | undefined {
  switch (options.auth) {
    case "none":
      return undefined;
    case "bearer":
      return {
        Auth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: BEARER_DESCRIPTION,
        },
      };
    case "basic":
      return {
        Auth: {
          type: "http",
          scheme: "basic",
          description: BASIC_DESCRIPTION,
        },
      };
    default:
      return {
        Auth: {
          type: "apiKey",
          in: options.authApiKeyIn,
          name: options.authApiKeyName,
          description: apiKeyDescription(options),
        },
      };
  }
}

function buildSchemas(ir: IrSchema): Record<string, unknown> {
  const typeEntries: Array<[string, unknown]> = [];
  const enumEntries: Array<[string, unknown]> = [];

  for (const typeDef of ir.types) {
    if (getAnnotation(typeDef.annotations, "httpRpc")) {
      continue;
    }

    typeEntries.push([typeDef.name, generateTypeSchema(typeDef)]);
  }

  for (const enumDef of ir.enums) {
    enumEntries.push([enumDef.name, generateEnumSchema(enumDef)]);
  }

  typeEntries.sort((left, right) => left[0].localeCompare(right[0]));
  enumEntries.sort((left, right) => left[0].localeCompare(right[0]));

  return entriesToRecord([...typeEntries, ...enumEntries]);
}

function buildRequestBodies(rpcGroups: RpcGroup[]): Record<string, unknown> {
  const entries: Array<[string, unknown]> = [];

  for (const group of rpcGroups) {
    for (const proc of group.procs) {
      const inputName = `${group.name}${pascalCase(proc.name)}Input`;

      entries.push([
        inputName,
        generateRequestBody(
          proc.inputFields,
          `Request body for ${group.name}/${proc.name} procedure`,
        ),
      ]);
    }
  }

  entries.sort((left, right) => left[0].localeCompare(right[0]));

  return entriesToRecord(entries);
}

function buildResponses(rpcGroups: RpcGroup[]): Record<string, unknown> {
  const entries: Array<[string, unknown]> = [];

  for (const group of rpcGroups) {
    for (const proc of group.procs) {
      const outputName = `${group.name}${pascalCase(proc.name)}Output`;

      entries.push([
        outputName,
        generateProcResponse(
          proc.outputFields,
          `Response for ${group.name}/${proc.name} procedure`,
        ),
      ]);
    }
  }

  entries.push(
    ["RouteNotFound", { description: ROUTE_NOT_FOUND_DESCRIPTION }],
    ["InternalError", { description: INTERNAL_ERROR_DESCRIPTION }],
    ["TransportFailure", { description: TRANSPORT_FAILURE_DESCRIPTION }],
  );

  entries.sort((left, right) => left[0].localeCompare(right[0]));

  return entriesToRecord(entries);
}

function entriesToRecord(
  entries: Array<[string, unknown]>,
): Record<string, unknown> {
  const record: Record<string, unknown> = {};

  for (const [key, value] of entries) {
    record[key] = value;
  }

  return record;
}
