import { pascalCase } from "@varavel/vdl-plugin-sdk/utils/strings";
import type { RpcGroup, RpcProc } from "../rpc-model";

/**
 * Builds the OpenAPI paths object with VPP-2 routes.
 *
 * Routes are resolved at build time as `/<lowerFirst(RPCName)>/<ProcedureName>`
 * so generated documents already carry the final wire paths.
 */
export function buildPaths(rpcGroups: RpcGroup[]): Record<string, unknown> {
  const entries: Array<[string, Record<string, unknown>]> = [];

  for (const group of rpcGroups) {
    for (const proc of group.procs) {
      entries.push([
        `/${toLowerFirst(group.name)}/${proc.name}`,
        {
          post: buildPathProc(proc),
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

function buildPathProc(proc: RpcProc): Record<string, unknown> {
  const inputName = `${proc.rpcName}${pascalCase(proc.name)}Input`;
  const outputName = `${proc.rpcName}${pascalCase(proc.name)}Output`;
  const pathProc: Record<string, unknown> = {
    operationId: buildOperationId(proc),
    tags: [`${proc.rpcName}Procedures`],
    requestBody: {
      $ref: `#/components/requestBodies/${inputName}`,
    },
    responses: {
      200: {
        $ref: `#/components/responses/${outputName}`,
      },
    },
  };

  const description = procDescription(proc);

  if (description) {
    pathProc.description = description;
  }

  if (proc.deprecated !== undefined) {
    pathProc.deprecated = true;
  }

  return pathProc;
}

/**
 * Builds the stable `operationId` for a procedure.
 * Format is `<lowerFirst(RPCName)><ProcedureName>` so `Users` plus
 * `createUser` becomes `usersCreateUser`, a valid JS method name.
 * Matches the `lowerFirst` route rule already used for paths.
 */
function buildOperationId(proc: RpcProc): string {
  return `${toLowerFirst(proc.rpcName)}${pascalCase(proc.name)}`;
}

function procDescription(proc: RpcProc): string | undefined {
  if (proc.deprecated === undefined || proc.deprecated === "") {
    return proc.doc;
  }

  const note = `Deprecated: ${proc.deprecated}`;

  if (!proc.doc) {
    return note;
  }

  return `${proc.doc}\n\n${note}`;
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
