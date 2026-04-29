require("dotenv").config();

const express = require("express");

const APP_PORT = Number(process.env.APP_PORT || 3000);

const app = express();
app.disable("x-powered-by");

// Friendly route aliases (static files are still served via express.static).
// Coin is integrated into site.html as a tab; keep /coin as a convenience redirect.
app.get("/coin", (_req, res) => {
  res.redirect(302, "/site.html#coin");
});

app.get("/supabase-config.js", (_req, res) => {
  const url = process.env.SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || "";

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(
    [
      "/* Generated from .env by server.js */",
      "window.__SUPABASE__ = {",
      `  url: ${JSON.stringify(url)},`,
      `  anonKey: ${JSON.stringify(anonKey)},`,
      "};",
    ].join("\n"),
  );
});

app.use(express.static(__dirname));

app.listen(APP_PORT, () => {
  console.log(`Dev server: http://localhost:${APP_PORT}`);
});
