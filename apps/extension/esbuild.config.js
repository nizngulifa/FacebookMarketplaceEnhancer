const esbuild = require("esbuild");

async function run() {
  const watch = process.argv.includes("--watch");

  const ctx = await esbuild.context({
    entryPoints: {
      popup: "src/popup/popup.ts",
      content: "src/content/messenger.ts",
      fmePromptBridge: "src/content/fme-prompt-bridge.ts",
    },
    bundle: true,
    outdir: "dist",
    format: "iife",
    platform: "browser",
    target: ["chrome114"],
    sourcemap: true,
  });

  if (watch) {
    await ctx.watch();
    console.log("Watching src/ for changes…");
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
