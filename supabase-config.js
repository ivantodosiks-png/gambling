// Вставь сюда свои данные Supabase (Project Settings -> API)
// ВАЖНО: используй только ANON KEY (не service_role key)
//
// На Vercel это самый простой способ, потому что `.env` не попадает в браузер.
// Если ты запускаешь локально через `node server.js`, то ключи могут прийти из `/supabase-config.js`,
// и тогда этот файл НЕ перезапишет их.

window.__SUPABASE__ = window.__SUPABASE__ || {
  url: "", // <-- SUPABASE_URL
  anonKey: "", // <-- SUPABASE_ANON_KEY
};

