// Supabase client for plain HTML (no modules).
// Требования:
// - подключи UMD SDK ДО этого файла:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
// - загрузи ключи в window.__SUPABASE__ (через /supabase-config.js или ./supabase-config.js)

(function () {
  const cfg = window.__SUPABASE__ || { url: "", anonKey: "" };

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("Supabase SDK not loaded. Check supabase UMD script tag.");
    window.sb = null;
    return;
  }

  if (!cfg.url || !cfg.anonKey) {
    console.warn("Supabase config missing. Fill url/anonKey in supabase-config.js (or .env via server.js).");
    window.sb = null;
    return;
  }

  window.sb = window.supabase.createClient(cfg.url, cfg.anonKey);
})();
