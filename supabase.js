// 1) URL и ANON KEY берутся из /supabase-config.js (он генерится из .env сервером server.js)
// 2) Для Vercel/статики вставь ключи в supabase-config.js (НЕ service_role key!)

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const cfg = window.__SUPABASE__ || { url: "", anonKey: "" };

if (!cfg.url || !cfg.anonKey) {
  // Чтобы новичку было понятно почему ничего не работает.
  console.warn("Supabase config missing. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env");
}

export const supabase = createClient(cfg.url, cfg.anonKey);
