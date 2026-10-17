import type { Field, IrSchema, TypeDef } from "@varavel/vdl-plugin-sdk";
import {
  getDeprecationMessage,
  isDeprecated,
} from "@varavel/vdl-plugin-sdk/utils/deprecations";
import { getAnnotation } from "@varavel/vdl-plugin-sdk/utils/ir";

/** Single VPP-2 procedure discovered inside an `@httpRpc` service. */
export type RpcOperation = {
  rpcName: string;
  rpcDoc?: string;
  name: string;
  doc?: string;
  deprecated?: string;
  inputFields: Field[];
  outputFields: Field[];
};

/** Group of procedures sharing one `@httpRpc` service container. */
export type RpcGroup = {
  name: string;
  doc?: string;
  deprecated?: string;
  procedures: RpcOperation[];
};

/**
 * Builds a normalized HTTP RPC model from the IR so later stages only deal
 * with explicit VPP-2 procedures instead of raw annotated fields.
 */
export function extractRpcGroups(ir: IrSchema): RpcGroup[] {
  const groups: RpcGroup[] = [];

  for (const typeDef of ir.types) {
    if (!getAnnotation(typeDef.annotations, "httpRpc")) {
      continue;
    }

    const group = extractRpcGroup(typeDef);

    if (group.procedures.length > 0) {
      groups.push(group);
    }
  }

  return groups;
}

function extractRpcGroup(typeDef: TypeDef): RpcGroup {
  const procedures: RpcOperation[] = [];

  for (const field of typeDef.typeRef.objectFields ?? []) {
    const operation = extractOperation(typeDef, field);

    if (operation) {
      procedures.push(operation);
    }
  }

  return {
    name: typeDef.name,
    doc: typeDef.doc,
    deprecated: deprecationNote(typeDef.annotations),
    procedures,
  };
}

function extractOperation(
  rpcType: TypeDef,
  field: Field,
): RpcOperation | undefined {
  if (!getAnnotation(field.annotations, "proc")) {
    return undefined;
  }

  const operationFields = field.typeRef.objectFields ?? [];
  const inputField = operationFields.find((item) => item.name === "input");
  const outputField = operationFields.find((item) => item.name === "output");

  return {
    rpcName: rpcType.name,
    rpcDoc: rpcType.doc,
    name: field.name,
    doc: field.doc,
    deprecated: deprecationNote(field.annotations),
    inputFields: inputField?.typeRef.objectFields ?? [],
    outputFields: outputField?.typeRef.objectFields ?? [],
  };
}

function deprecationNote(
  annotations: TypeDef["annotations"],
): string | undefined {
  if (!isDeprecated(annotations)) {
    return undefined;
  }

  return getDeprecationMessage(annotations) ?? "";
}
