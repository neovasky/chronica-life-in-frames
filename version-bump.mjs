import { readFileSync, writeFileSync } from "fs";

// Read current version from manifest.json
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const currentVersion = manifest.version;

// Read command line arguments for version bump type
const args = process.argv.slice(2);
const bumpType = args[0] || "patch"; // default to patch

// Split current version into parts
const [major, minor, patch] = currentVersion.split(".").map(Number);

// Calculate the new version based on bump type
let newVersion;
switch (bumpType) {
  case "major":
    newVersion = `${major + 1}.0.0`;
    break;
  case "minor":
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case "patch":
  default:
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
}

// Update manifest.json
manifest.version = newVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2));

// Load or create versions.json
let versions = {};
try {
  versions = JSON.parse(readFileSync("versions.json", "utf8"));
} catch (error) {
  console.log("Creating new versions.json file");
}

// Add new version info
versions[newVersion] = manifest.minAppVersion;

// Write versions.json
writeFileSync("versions.json", JSON.stringify(versions, null, 2));

console.log(`Bumped version from ${currentVersion} to ${newVersion}`);
