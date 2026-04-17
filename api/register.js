const { getPool, hashPassword, isValidEmail, readJsonBody, sendJson } = require("./_utils");

function validateRegister({ username, email, password }) {
  const u = String(username || "").trim();
  const e = String(email || "").trim();
  const p = String(password || "");

  if (!u || u.length < 3) return { ok: false, error: "Username must be at least 3 characters" };
  if (!isValidEmail(e)) return { ok: false, error: "Invalid email address" };
  if (!p || p.length < 6) return { ok: false, error: "Password must be at least 6 characters" };
  return { ok: true, username: u, email: e, password: p };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method not allowed" });

  const body = await readJsonBody(req);
  if (body === null) return sendJson(res, 400, { ok: false, error: "Invalid JSON" });

  const v = validateRegister(body || {});
  if (!v.ok) return sendJson(res, 400, { ok: false, error: v.error });

  const pool = getPool();
  try {
    const passwordHash = hashPassword(v.password);
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
    return sendJson(res, 200, { ok: true, user });
  } catch (e) {
    if (e && e.code === "ER_DUP_ENTRY") return sendJson(res, 409, { ok: false, error: "Username or email already exists" });
    return sendJson(res, 500, { ok: false, error: "Server error" });
  }
};

