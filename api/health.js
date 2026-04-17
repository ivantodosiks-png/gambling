const { getPool, sendJson, exposeErrorDetails, toErrorDetails } = require("./_utils");

module.exports = async (req, res) => {
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    return sendJson(res, 200, { ok: true });
  } catch (e) {
    return sendJson(res, 500, exposeErrorDetails() ? { ok: false, details: toErrorDetails(e) } : { ok: false });
  }
};
