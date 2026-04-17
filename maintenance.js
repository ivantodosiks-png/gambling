// Minimal maintenance mode guard (Supabase-backed).
// DB: public.app_settings row with key='maintenance' and value: { enabled: boolean, message: string }

(function () {
  function injectStylesOnce() {
    if (document.getElementById("maintStyles")) return;
    const s = document.createElement("style");
    s.id = "maintStyles";
    s.textContent = `
      .maint-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(1200px 700px at 18% 0%, rgba(255, 209, 102, 0.12), transparent 60%),
          radial-gradient(900px 540px at 90% 20%, rgba(125, 211, 252, 0.10), transparent 55%),
          rgba(11, 16, 32, 0.96);
        color: #e9edf7;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      .maint-card {
        width: min(720px, 100%);
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.06);
        border-radius: 18px;
        padding: 20px;
        box-shadow: 0 22px 60px rgba(0,0,0,0.55);
      }
      .maint-title { font-weight: 1000; font-size: 20px; margin: 0 0 6px; }
      .maint-muted { color: rgba(233,237,247,0.72); font-size: 13px; }
      .maint-msg { margin-top: 12px; white-space: pre-wrap; line-height: 1.35; }
      .maint-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
      .maint-btn {
        cursor: pointer;
        border: 0;
        padding: 10px 12px;
        border-radius: 12px;
        font-weight: 900;
        background: #33d18f;
        color: #07110c;
      }
      .maint-btn.secondary {
        background: rgba(255,255,255,0.06);
        color: #e9edf7;
        border: 1px solid rgba(255,255,255,0.14);
      }
      .maint-badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.06);
        font-size: 12px;
        font-weight: 800;
      }
    `;
    document.head.appendChild(s);
  }

  function showOverlay(message) {
    injectStylesOnce();
    const existing = document.getElementById("maintOverlay");
    if (existing) existing.remove();

    const wrap = document.createElement("div");
    wrap.id = "maintOverlay";
    wrap.className = "maint-overlay";
    wrap.innerHTML = `
      <div class="maint-card">
        <div class="maint-badge">Maintenance</div>
        <h1 class="maint-title" style="margin-top:10px;">Technical difficulties</h1>
        <div class="maint-muted">The site is temporarily unavailable. Please try again later.</div>
        <div class="maint-msg">${String(message || "").replace(/</g, "&lt;")}</div>
        <div class="maint-row">
          <button class="maint-btn" id="maintRefresh" type="button">Refresh</button>
          <button class="maint-btn secondary" id="maintBack" type="button">Back</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    document.body.style.overflow = "hidden";

    const r = document.getElementById("maintRefresh");
    const b = document.getElementById("maintBack");
    if (r) r.addEventListener("click", () => window.location.reload());
    if (b) b.addEventListener("click", () => window.history.back());
  }

  async function isAdmin(sb) {
    try {
      const { data } = await sb.rpc("is_admin");
      return Boolean(data);
    } catch {
      return false;
    }
  }

  async function readMaintenance(sb) {
    try {
      const { data, error } = await sb.from("app_settings").select("value").eq("key", "maintenance").maybeSingle();
      if (error) throw error;
      const v = data?.value || {};
      return { enabled: Boolean(v.enabled), message: String(v.message || "") };
    } catch {
      return { enabled: false, message: "" };
    }
  }

  // Returns true if blocked.
  async function guard(sb) {
    if (!sb) return false;

    const { enabled, message } = await readMaintenance(sb);
    if (!enabled) return false;

    // Allow admins to bypass.
    const { data } = await sb.auth.getSession();
    if (data?.session) {
      const ok = await isAdmin(sb);
      if (ok) return false;
    }

    showOverlay(message || "We will be back soon.");
    return true;
  }

  window.maintenanceGuard = guard;
  window.readMaintenance = readMaintenance;
})();

