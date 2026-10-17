import type { RpcGroup } from "../rpc-model";

/**
 * Creates one tag per HTTP RPC service with procedures.
 */
export function buildTags(rpcGroups: RpcGroup[]): Record<string, unknown>[] {
  const tags: Record<string, unknown>[] = [];

  for (const group of rpcGroups) {
    if (group.procs.length === 0) {
      continue;
    }

    tags.push({
      name: `${group.name}Procedures`,
      description: tagDescription(group),
    });
  }

  tags.sort((left, right) => {
    return String(left.name).localeCompare(String(right.name));
  });

  return tags;
}

function tagDescription(group: RpcGroup): string {
  const base = group.doc ?? `Procedures for ${group.name}`;

  if (group.deprecated === undefined || group.deprecated === "") {
    return base;
  }

  return `${base}\n\nDeprecated: ${group.deprecated}`;
}
