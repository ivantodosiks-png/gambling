const crypto = require("crypto");
const mysql = require("mysql2/promise");

const PBKDF2_ITERS = 210_000;
const PBKDF2_DIGEST = "sha256";
const PBKDF2_KEYLEN = 32;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function getPool() {
  // Cache between invocations in the same lambda instance.
  if (global.__MYSQL_POOL) return global.__MYSQL_POOL;

  const host = requiredEnv("DB_HOST");
  const database = requiredEnv("DB_NAME");
  const user = requiredEnv("DB_USER");
  const password = requiredEnv("DB_PASSWORD");
  const port = Number(process.env.DB_PORT || 3306);

  global.__MYSQL_POOL = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    connectTimeout: 10_000,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });

  return global.__MYSQL_POOL;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return `pbkdf2$${PBKDF2_ITERS}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function verifyPassword(password, stored) {
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

async function readJsonBody(req) {
  const contentType = String(req.headers["content-type"] || "");
  if (!contentType.includes("application/json")) return {};

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sendJson(res, statusCode, obj) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function exposeErrorDetails() {
  return String(process.env.DEBUG_ERRORS || "") === "1";
}

function toErrorDetails(e) {
  if (!e || typeof e !== "object") return { message: String(e || "") };
  return {
    code: e.code,
    message: e.message,
  };
}

module.exports = {
  getPool,
  hashPassword,
  verifyPassword,
  isValidEmail,
  readJsonBody,
  sendJson,
  exposeErrorDetails,
  toErrorDetails,
};
