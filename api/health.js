const { getPool, sendJson } = require("./_utils");

module.exports = async (req, res) => {
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    return sendJson(res, 200, { ok: true });
  } catch (_e) {
    return sendJson(res, 500, { ok: false });
  }
};

