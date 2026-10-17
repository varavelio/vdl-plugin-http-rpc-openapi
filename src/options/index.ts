import { fail } from "@varavel/vdl-plugin-sdk";
import {
  getOptionArray,
  getOptionString,
} from "@varavel/vdl-plugin-sdk/utils/options";
import { extname } from "@varavel/vdl-plugin-sdk/utils/paths";
import { trim } from "@varavel/vdl-plugin-sdk/utils/strings";

const DEFAULT_OUT_FILE = "openapi.yaml";
const DEFAULT_PLAYGROUND_UI = "swagger-ui";
const DEFAULT_TITLE = "VDL HTTP RPC API";
const DEFAULT_VERSION = "1.0.0";
const DEFAULT_AUTH: AuthMode = "apiKey";
const DEFAULT_AUTH_API_KEY_NAME = "Authorization";
const DEFAULT_AUTH_API_KEY_IN: AuthApiKeyIn = "header";

type OutFormat = "yaml" | "json";
type PlaygroundUi = "swagger-ui" | "scalar" | "stoplight-elements";

/** OpenAPI security preset emitted for every procedure. */
export type AuthMode = "none" | "apiKey" | "bearer" | "basic";

/** Location of the API key value when `auth` is `apiKey`. */
export type AuthApiKeyIn = "header" | "query" | "cookie";

export type PluginOptions = {
  /** Path for the generated OpenAPI schema file. When undefined, no schema file is produced. */
  outFile: string | undefined;
  outFormat: OutFormat;
  playgroundFile?: string;
  playgroundUi: PlaygroundUi;
  title: string;
  version: string;
  description?: string;
  baseUrls?: string[];
  contactName?: string;
  contactEmail?: string;
  licenseName?: string;
  auth: AuthMode;
  authApiKeyName: string;
  authApiKeyIn: AuthApiKeyIn;
};

/**
 * Resolves plugin options with defaults and validates output format constraints.
 */
export function resolvePluginOptions(
  options: Record<string, string>,
): PluginOptions {
  const rawOutFile = getOptionString(options, "outFile", DEFAULT_OUT_FILE);
  const outFile = rawOutFile === "" ? undefined : rawOutFile;
  const outFormat = outFile ? resolveOutFormat(outFile) : "yaml";
  const playgroundFile = resolvePlaygroundFile(options);
  const playgroundUi = resolvePlaygroundUi(options);
  const title = requiredStrOption(options, "title", DEFAULT_TITLE);
  const version = requiredStrOption(options, "version", DEFAULT_VERSION);

  return {
    outFile,
    outFormat,
    playgroundFile,
    playgroundUi,
    title,
    version,
    description: optionalStrOption(options, "description"),
    baseUrls: resolveBaseUrls(options),
    contactName: optionalStrOption(options, "contactName"),
    contactEmail: optionalStrOption(options, "contactEmail"),
    licenseName: optionalStrOption(options, "licenseName"),
    auth: resolveAuth(options),
    authApiKeyName: requiredStrOption(
      options,
      "authApiKeyName",
      DEFAULT_AUTH_API_KEY_NAME,
    ),
    authApiKeyIn: resolveAuthApiKeyIn(options),
  };
}

function resolveOutFormat(outFile: string): OutFormat {
  const extension = extname(outFile).toLowerCase();

  if (extension === ".json") return "json";
  if (extension === ".yaml") return "yaml";
  if (extension === ".yml") return "yaml";

  fail(
    `Option "outFile" must end with .yaml, .yml, or .json. Received: ${JSON.stringify(outFile)}.`,
  );
}

function resolvePlaygroundFile(
  options: Record<string, string>,
): string | undefined {
  const playgroundFile = trim(
    optionalStrOption(options, "playgroundFile") ?? "",
  );

  if (!playgroundFile) {
    return undefined;
  }

  if (extname(playgroundFile).toLowerCase() === ".html") {
    return playgroundFile;
  }

  fail(
    `Option "playgroundFile" must end with .html. Received: ${JSON.stringify(playgroundFile)}.`,
  );
}

function resolvePlaygroundUi(options: Record<string, string>): PlaygroundUi {
  const playgroundUi = trim(
    getOptionString(options, "playgroundUi", DEFAULT_PLAYGROUND_UI),
  ).toLowerCase();

  if (
    playgroundUi === "swagger-ui" ||
    playgroundUi === "scalar" ||
    playgroundUi === "stoplight-elements"
  ) {
    return playgroundUi;
  }

  fail(
    `Option "playgroundUi" must be one of "swagger-ui", "scalar", or "stoplight-elements". Received: ${JSON.stringify(playgroundUi)}.`,
  );
}

function resolveAuth(options: Record<string, string>): AuthMode {
  const auth = trim(getOptionString(options, "auth", DEFAULT_AUTH));

  if (auth === "") {
    return DEFAULT_AUTH;
  }

  if (
    auth === "none" ||
    auth === "apiKey" ||
    auth === "bearer" ||
    auth === "basic"
  ) {
    return auth;
  }

  fail(
    `Option "auth" must be one of "none", "apiKey", "bearer", or "basic". Received: ${JSON.stringify(auth)}.`,
  );
}

function resolveAuthApiKeyIn(options: Record<string, string>): AuthApiKeyIn {
  const authApiKeyIn = trim(
    getOptionString(options, "authApiKeyIn", DEFAULT_AUTH_API_KEY_IN),
  ).toLowerCase();

  if (authApiKeyIn === "") {
    return DEFAULT_AUTH_API_KEY_IN;
  }

  if (
    authApiKeyIn === "header" ||
    authApiKeyIn === "query" ||
    authApiKeyIn === "cookie"
  ) {
    return authApiKeyIn;
  }

  fail(
    `Option "authApiKeyIn" must be one of "header", "query", or "cookie". Received: ${JSON.stringify(authApiKeyIn)}.`,
  );
}

function resolveBaseUrls(
  options: Record<string, string>,
): string[] | undefined {
  const baseUrls = getOptionArray(options, "baseUrl", [], ",");

  return baseUrls.length > 0 ? baseUrls : undefined;
}

function requiredStrOption(
  options: Record<string, string>,
  key: string,
  defaultValue: string,
): string {
  const value = getOptionString(options, key, defaultValue);
  return value === "" ? defaultValue : value;
}

function optionalStrOption(
  options: Record<string, string>,
  key: string,
): string | undefined {
  const value = getOptionString(options, key, "");
  return value === "" ? undefined : value;
}
