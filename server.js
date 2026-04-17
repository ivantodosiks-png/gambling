const path = require("path");
const crypto = require("crypto");

require("dotenv").config();

const express = require("express");
const mysql = require("mysql2/promise");

const APP_PORT = Number(process.env.APP_PORT || 3000);

const DB_HOST = process.env.DB_HOST;
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

// Fail fast if anything is missing.
requiredEnv("DB_HOST");
requiredEnv("DB_NAME");
requiredEnv("DB_USER");
requiredEnv("DB_PASSWORD");

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const PBKDF2_ITERS = 210_000;
const PBKDF2_DIGEST = "sha256";
const PBKDF2_KEYLEN = 32;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return `pbkdf2$${PBKDF2_ITERS}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function verifyPassword(password, stored) {
  // Accept legacy/plain stored values (not recommended), but try best to support.
  if (!stored || typeof stored !== "string") return false;
  if (!stored.startsWith("pbkdf2$")) return String(password) === stored;

  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const iters = Number(parts[1]);
  const salt = Buffer.from(parts[2], "base64");
  const expected = Buffer.from(parts[3], "base64");

  if (!Number.isFinite(iters) || iters <= 0) return false;
  if (!salt.length || !expected.length) return false;

  const actual = crypto.pbkdf2Sync(password, salt, iters, expected.length, PBKDF2_DIGEST);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function validateRegister({ username, email, password }) {
  const u = String(username || "").trim();
  const e = String(email || "").trim();
  const p = String(password || "");

  if (!u || u.length < 3) return { ok: false, error: "Username must be at least 3 characters" };
  if (!isValidEmail(e)) return { ok: false, error: "Invalid email address" };
  if (!p || p.length < 6) return { ok: false, error: "Password must be at least 6 characters" };
  return { ok: true, username: u, email: e, password: p };
}

function validateLogin({ username, password }) {
  const u = String(username || "").trim();
  const p = String(password || "");
  if (!u || !p) return { ok: false, error: "Please enter username and password" };
  return { ok: true, username: u, password: p };
}

const app = express();
app.disable("x-powered-by");

app.use(express.json({ limit: "50kb" }));

// Serve the site from this folder.
app.use(express.static(__dirname));

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

app.post("/api/register", async (req, res) => {
  const v = validateRegister(req.body || {});
  if (!v.ok) return res.status(400).json({ ok: false, error: v.error });

  const passwordHash = hashPassword(v.password);
  try {
    const [result] = await pool.execute(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [v.username, v.email, passwordHash],
    );

    const insertId = result && typeof result.insertId === "number" ? result.insertId : null;
    const [rows] = await pool.execute(
      "SELECT id, username, email, created_at FROM users WHERE id = ? LIMIT 1",
      [insertId],
    );
    const user = Array.isArray(rows) && rows.length ? rows[0] : { id: insertId, username: v.username, email: v.email };
    return res.json({ ok: true, user });
  } catch (e) {
    if (e && e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, error: "Username or email already exists" });
    }
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  const v = validateLogin(req.body || {});
  if (!v.ok) return res.status(400).json({ ok: false, error: v.error });

  try {
    const [rows] = await pool.execute(
      "SELECT id, username, email, password, created_at FROM users WHERE username = ? LIMIT 1",
      [v.username],
    );
    const userRow = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!userRow) return res.status(401).json({ ok: false, error: "Invalid username or password" });

    const ok = verifyPassword(v.password, userRow.password);
    if (!ok) return res.status(401).json({ ok: false, error: "Invalid username or password" });

    const user = {
      id: userRow.id,
      username: userRow.username,
      email: userRow.email,
      created_at: userRow.created_at,
    };
    return res.json({ ok: true, user });
  } catch (_e) {
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// SPA fallback (if you add routes later)
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(APP_PORT, () => {
  // Intentionally minimal logging.
  console.log(`Server running on http://localhost:${APP_PORT}`);
});
