import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Local deployment metadata is ignored by Git; fresh clones use the template.
export function hostingConfigPath(root = process.cwd()) {
  const localPath = resolve(root, ".openai", "hosting.json");
  return existsSync(localPath)
    ? localPath
    : resolve(root, ".openai", "hosting.example.json");
}
