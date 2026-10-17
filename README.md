<p align="center">
  <img
    src="https://cdn.jsdelivr.net/gh/varavelio/vdl@9cb843/assets/png/vdl.png"
    alt="VDL logo"
    width="130"
  />
</p>

<h1 align="center">VDL HTTP RPC OpenAPI Plugin</h1>

<p align="center">
  Generate OpenAPI 3.0 specifications for <strong>VDL HTTP RPC procedures</strong>.
</p>

<p align="center">
  <a href="https://varavel.com">
    <img
      src="https://cdn.jsdelivr.net/gh/varavelio/brand@1.0.0/dist/badges/project.svg"
      alt="A Varavel project"
    />
  </a>
  <a href="https://varavel.com/vdl">
    <img
      src="https://cdn.jsdelivr.net/gh/varavelio/brand@1.0.0/dist/badges/vdl-plugin.svg"
      alt="VDL Plugin"
    />
  </a>
</p>

<p align="center">
  Strictly follows <a href="https://vdl.varavel.com/docs/protocols/http-rpc/">VPP-2: HTTP-RPC</a>.
</p>

This plugin converts your VDL HTTP RPC schema into an OpenAPI document that can be used by API gateways, API clients (e.g. Postman), documentation tooling, contract validation workflows, and code generation pipelines.

It is HTTP RPC-focused.

Use it when you want to:

- publish a standard OpenAPI contract for your VDL HTTP RPC layer
- expose request and response schemas for procedures
- keep API docs synchronized with your source-of-truth VDL definitions
- integrate your HTTP RPC APIs with OpenAPI-compatible tooling
- import all the VDL HTTP RPC requests in an API client like Postman

## Quick Start

1. Add the plugin to your `vdl.config.vdl`:

```vdl
const config = {
  version 1
  plugins [
    {
      src "varavelio/vdl-plugin-http-rpc-openapi@<version>" // Use a version from plugin releases
      schema "./schema.vdl"
      outDir "./gen"
    }
  ]
}
```

2. Run your normal generation command:

```bash
vdl generate
```

3. Check the generated output in `./gen`:

## Plugin Options

All options are optional.

| Option           | Type     | Default              | What it changes                                                                                                                                                                                                     |
| ---------------- | -------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `outFile`        | `string` | `"openapi.yaml"`     | Output filename inside `outDir`. Extension controls format: `.yaml`/`.yml` for YAML, `.json` for JSON. Set to `""` explicitly to skip schema generation entirely (only the playground is produced when configured). |
| `playgroundFile` | `string` | `""`                 | Generates an additional standalone HTML API docs file next to `outFile`. Must end in `.html`. If it is not present, the playground is not generated.                                                                |
| `playgroundUi`   | `string` | `"swagger-ui"`       | Chooses which standalone docs UI to generate for `playgroundFile`: `swagger-ui`, `scalar`, or `stoplight-elements`.                                                                                                 |
| `title`          | `string` | `"VDL HTTP RPC API"` | Sets `info.title` in the generated OpenAPI document and the HTML `<title>` of generated playgrounds.                                                                                                                |
| `version`        | `string` | `"1.0.0"`            | Sets `info.version` in the generated OpenAPI document.                                                                                                                                                              |
| `description`    | `string` | `""`                 | Sets `info.description` when provided.                                                                                                                                                                              |
| `baseUrl`        | `string` | `""`                 | Adds `servers` entries when provided. Use a comma-separated list to emit multiple server URLs.                                                                                                                      |
| `contactName`    | `string` | `""`                 | Sets `info.contact.name` when provided.                                                                                                                                                                             |
| `contactEmail`   | `string` | `""`                 | Sets `info.contact.email` when provided.                                                                                                                                                                            |
| `licenseName`    | `string` | `""`                 | Sets `info.license.name` when provided.                                                                                                                                                                             |
| `auth`           | `string` | `"apiKey"`           | Security preset applied globally: `none` omits auth, `apiKey` sends a raw key, `bearer` sends `Authorization: Bearer <token>`, `basic` sends Basic auth base64 credentials.                                         |
| `authApiKeyName` | `string` | `"Authorization"`    | Key name sent as the API key value. Only used when `auth` is `apiKey`.                                                                                                                                              |
| `authApiKeyIn`   | `string` | `"header"`           | Location of the API key value: `header`, `query`, or `cookie`. Only used when `auth` is `apiKey`.                                                                                                                   |  |

Example with all options:

```vdl
const config = {
  version 1
  plugins [
    {
      src "varavelio/vdl-plugin-http-rpc-openapi@<version>" // Use a version from plugin releases
      schema "./schema.vdl"
      outDir "./gen"
      options {
        outFile "openapi.json"
        playgroundFile "playground.html"
        playgroundUi "swagger-ui"
        title "Messaging API"
        version "2.1.0"
        description "Public RPC contract for messaging services"
        baseUrl "https://api.example.com/rpc,https://backup.example.com/rpc"
        contactName "Platform API Team"
        contactEmail "api@example.com"
        licenseName "MIT"
        auth "apiKey"
        authApiKeyName "Authorization"
        authApiKeyIn "header"
      }
    }
  ]
}
```

Notes:

- `playgroundFile` only affects the extra HTML output. It never replaces the OpenAPI file from `outFile`.
- Set `outFile` to `""` explicitly to skip generating the OpenAPI schema file. When combined with `playgroundFile`, only the HTML playground is produced. When set without a playground, no files are generated.
- `playgroundUi` is only used when `playgroundFile` is present.
- `baseUrl` accepts either one URL or multiple comma-separated URLs. Each URL becomes one OpenAPI `servers` entry.
- `auth` defaults to a generic `apiKey` header named `Authorization`. Use `none` for public APIs, `bearer` for JWT, `basic` for username and password.
- `authApiKeyName` and `authApiKeyIn` only apply when `auth` is `apiKey`.

## HTTP RPC Annotation Model

This plugin reads HTTP RPC procedures from the standard VDL HTTP RPC annotations:

- `@httpRpc` marks a top-level service type
- `@proc` marks a request/response procedure

Example:

```vdl
@httpRpc
type ChatService {
  @proc
  sendMessage {
    input {
      roomId string
      text string
    }

    output {
      accepted bool
    }
  }
}
```

## What You Get

- OpenAPI document version `3.0.0`.
- A global `AuthToken` security scheme using the `Authorization` header.
- One tag group per HTTP RPC service (`<Service>Procedures`).
- One `POST` path per procedure with route pattern `/<lowerFirst(RPCName)>/<ProcedureName>` (for example `/users/getUser`).
- Reusable request bodies and responses under `components.requestBodies` and `components.responses`.
- All non HTTP RPC VDL types and enums emitted under `components.schemas`.

## Response Envelope Behavior

Procedure responses are wrapped in a consistent envelope:

- `ok` (`boolean`) always present
- `output` object with your declared output fields
- `error` object with at least `message` and optional metadata

## Notes

- If there are no valid procedures in your schema, the plugin still generates a valid OpenAPI document skeleton (with `info`, `security`, and `components`).

## License

This plugin is released under the MIT License. See [LICENSE](LICENSE).
