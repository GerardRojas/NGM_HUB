// assets/js/config.js

// Detectar ambiente: localhost, staging, o produccion
function detectEnvironment() {
  const hostname = window.location.hostname;

  // Localhost / desarrollo local
  if (hostname === "127.0.0.1" || hostname === "localhost") {
    return "development";
  }

  // Staging (URL contiene "staging")
  if (hostname.includes("staging")) {
    return "staging";
  }

  // Produccion (default)
  return "production";
}

const ENVIRONMENT = detectEnvironment();

// API_BASE segun ambiente
const API_BASE = {
  development: "http://127.0.0.1:8000",
  staging: "https://ngm-api-staging.onrender.com",
  production: "https://ngm-fastapi.onrender.com"
}[ENVIRONMENT];

// También lo colgamos explícitamente en window por si acaso
window.API_BASE = API_BASE;
window.ENVIRONMENT = ENVIRONMENT;

// Supabase configuration for receipt uploads and realtime
window.SUPABASE_URL = 'https://frpshidpuazlqfxodrbs.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZycHNoaWRwdWF6bHFmeG9kcmJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwNTYyODgsImV4cCI6MjA4MDYzMjI4OH0.tFfxodOMYnLdDAmpfTAKzKs0TawE5-BmJiIY_ohI1Is';

// Unified config object for all modules
window.NGM_CONFIG = {
  API_BASE: API_BASE,
  SUPABASE_URL: window.SUPABASE_URL,
  SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY
};

console.log("CONFIG LOADED → ENVIRONMENT =", ENVIRONMENT);
console.log("CONFIG LOADED → API_BASE =", API_BASE);
console.log("CONFIG LOADED → SUPABASE_URL =", window.SUPABASE_URL);
