const { build, Platform } = require("electron-builder");

const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const explicitPublish = process.env.PUBLISH || process.env.ELECTRON_PUBLISH || process.env.ELECTRON_PUBLISH_MODE;
const strongToken = process.env.GH_TOKEN || process.env.ELECTRON_GH_TOKEN;

const publishPolicy = explicitPublish || (strongToken ? "onTag" : "never");

const targets = new Map([
  [Platform.WINDOWS, Platform.WINDOWS.createTarget(["nsis", "portable"])],
  [Platform.MAC, Platform.MAC.createTarget(["dmg", "zip"])],
  [Platform.LINUX, Platform.LINUX.createTarget(["AppImage", "tar.gz"])],
]);

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
