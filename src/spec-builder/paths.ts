import { pascalCase } from "@varavel/vdl-plugin-sdk/utils/strings";
import type { RpcGroup, RpcOperation } from "../rpc-model";

/**
 * Builds the OpenAPI paths object with VPP-2 routes.
 *
 * Routes are resolved at build time as `/<lowerFirst(RPCName)>/<ProcedureName>`
 * so generated documents already carry the final wire paths.
 */
export function buildPaths(rpcGroups: RpcGroup[]): Record<string, unknown> {
  const entries: Array<[string, Record<string, unknown>]> = [];

  for (const group of rpcGroups) {
    for (const operation of group.procedures) {
      entries.push([
        `/${toLowerFirst(group.name)}/${operation.name}`,
        {
          post: buildPathOperation(operation),
        },
      ]);
    }
  }

  entries.sort((left, right) => left[0].localeCompare(right[0]));

  return entriesToRecord(entries);
}

/**
 * Applies the VPP-2 route rule to an RPC service name.
 */
export function toLowerFirst(value: string): string {
  if (value.length === 0) {
    return value;
  }

  return value.charAt(0).toLowerCase() + value.slice(1);
}

function buildPathOperation(operation: RpcOperation): Record<string, unknown> {
  const inputName = `${operation.rpcName}${pascalCase(operation.name)}Input`;
  const outputName = `${operation.rpcName}${pascalCase(operation.name)}Output`;
  const openApiOperation: Record<string, unknown> = {
    tags: [`${operation.rpcName}Procedures`],
    requestBody: {
      $ref: `#/components/requestBodies/${inputName}`,
    },
    responses: {
      200: {
        $ref: `#/components/responses/${outputName}`,
      },
    },
  };

  const description = operationDescription(operation);

  if (description) {
    openApiOperation.description = description;
  }

  if (operation.deprecated !== undefined) {
    openApiOperation.deprecated = true;
  }

  return openApiOperation;
}

function operationDescription(operation: RpcOperation): string | undefined {
  if (operation.deprecated === undefined || operation.deprecated === "") {
    return operation.doc;
  }

  const note = `Deprecated: ${operation.deprecated}`;

  if (!operation.doc) {
    return note;
  }

  return `${operation.doc}\n\n${note}`;
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
