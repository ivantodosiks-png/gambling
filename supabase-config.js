// Вставь сюда свои данные Supabase (Project Settings -> API)
// ВАЖНО: используй только ANON KEY (не service_role key)
//
// На Vercel это самый простой способ, потому что `.env` не попадает в браузер.
// Если ты запускаешь локально через `node server.js`, то ключи могут прийти из `/supabase-config.js`,
// и тогда этот файл НЕ перезапишет их.

window.__SUPABASE__ = window.__SUPABASE__ || {
  url: "https://ujiksdybdvzkctposela.supabase.co", // <-- SUPABASE_URL
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaWtzZHliZHZ6a2N0cG9zZWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTI2MjYsImV4cCI6MjA5MTk2ODYyNn0.V6gRi6K4V2pg5pX7r568In-3OxuJOF1QLeOlInaD55M", // <-- SUPABASE_ANON_KEY
};
