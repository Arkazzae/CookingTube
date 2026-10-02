declare namespace Cloudflare {
  interface Env {
    CONNECTORS?: import("./lib/connector-contract.mjs").ConnectorBinding;
  }
}
