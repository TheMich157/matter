const { build, Platform } = require("electron-builder");

const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const explicitPublish = process.env.PUBLISH || process.env.ELECTRON_PUBLISH || process.env.ELECTRON_PUBLISH_MODE;
const strongToken = process.env.GH_TOKEN || process.env.ELECTRON_GH_TOKEN;

const publishPolicy = explicitPublish || (strongToken ? "onTag" : "never");

const hostPlatform = Platform.current();
const requestedPlatforms = (process.env.BUILD_PLATFORMS || process.env.PLATFORMS || "current")
  .split(",")
  .map((p) => p.trim().toLowerCase())
  .filter(Boolean);

const wantsAll = requestedPlatforms.includes("all");
const resolvedPlatforms = wantsAll ? ["win", "mac", "linux"] : requestedPlatforms;
const targets = new Map();

function addPlatformTargets(platform) {
  if (platform === Platform.WINDOWS) {
    targets.set(Platform.WINDOWS, Platform.WINDOWS.createTarget(["nsis", "portable"]));
    return;
  }
  if (platform === Platform.MAC) {
    targets.set(Platform.MAC, Platform.MAC.createTarget(["dmg", "zip"]));
    return;
  }
  if (platform === Platform.LINUX) {
    targets.set(Platform.LINUX, Platform.LINUX.createTarget(["AppImage", "tar.gz"]));
    return;
  }
}

function isSupportedOnHost(platform) {
  if (platform === Platform.MAC) return process.platform === "darwin";
  if (platform === Platform.WINDOWS) return ["win32", "darwin"].includes(process.platform);
  return true;
}

for (const entry of resolvedPlatforms) {
  let plat = hostPlatform;
  if (entry === "win" || entry === "windows") plat = Platform.WINDOWS;
  else if (entry === "mac" || entry === "darwin" || entry === "osx") plat = Platform.MAC;
  else if (entry === "linux") plat = Platform.LINUX;
  else if (entry === "current") plat = hostPlatform;

  if (!isSupportedOnHost(plat)) {
    console.warn(`[builder] Skipping ${plat.name} targets (unsupported on ${process.platform})`);
    continue;
  }
  addPlatformTargets(plat);
}

// Fallback to host-only if nothing was added (protect against empty env input)
if (targets.size === 0) {
  addPlatformTargets(hostPlatform);
}

if (dryRun) {
  console.log("[builder] DRY_RUN=1 — skipping build");
  console.log("[builder] Publish policy:", publishPolicy);
  console.log("[builder] Targets:", Array.from(targets).map(([platform, target]) => ({ platform: platform.name, target })));
  process.exit(0);
}

build({
  publish: publishPolicy,
  targets,
})
  .then(() => {
    console.log("[builder] Build finished with publish policy:", publishPolicy);
  })
  .catch((err) => {
    console.error("[builder] Build failed:", err);
    process.exit(1);
  });
