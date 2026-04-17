const { getPool, verifyPassword, readJsonBody, sendJson, exposeErrorDetails, toErrorDetails } = require("./_utils");

function validateLogin({ username, password }) {
  const u = String(username || "").trim();
  const p = String(password || "");
  if (!u || !p) return { ok: false, error: "Please enter username and password" };
  return { ok: true, username: u, password: p };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method not allowed" });

  const body = await readJsonBody(req);
  if (body === null) return sendJson(res, 400, { ok: false, error: "Invalid JSON" });

  const v = validateLogin(body || {});
  if (!v.ok) return sendJson(res, 400, { ok: false, error: v.error });

  let pool;
  try {
    pool = getPool();
  } catch (e) {
    return sendJson(
      res,
      500,
      exposeErrorDetails() ? { ok: false, error: "Server error", details: toErrorDetails(e) } : { ok: false, error: "Server error" },
    );
  }
  try {
    const [rows] = await pool.execute(
      "SELECT id, username, email, password, created_at FROM users WHERE username = ? LIMIT 1",
      [v.username],
    );
    const userRow = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!userRow) return sendJson(res, 401, { ok: false, error: "Invalid username or password" });

    const ok = verifyPassword(v.password, userRow.password);
    if (!ok) return sendJson(res, 401, { ok: false, error: "Invalid username or password" });

    const user = { id: userRow.id, username: userRow.username, email: userRow.email, created_at: userRow.created_at };
    return sendJson(res, 200, { ok: true, user });
  } catch (e) {
    return sendJson(
      res,
      500,
      exposeErrorDetails() ? { ok: false, error: "Server error", details: toErrorDetails(e) } : { ok: false, error: "Server error" },
    );
  }
};
