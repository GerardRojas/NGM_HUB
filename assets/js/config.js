// assets/js/config.js

// Definimos API_BASE como global y además como constante local
const API_BASE =
  window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
    ? "http://127.0.0.1:8000"
    : "https://ngm-fastapi.onrender.com";

// También lo colgamos explícitamente en window por si acaso
window.API_BASE = API_BASE;

// Supabase configuration for receipt uploads
window.SUPABASE_URL = 'https://frpshidpuazlqfxodrbs.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZycHNoaWRwdWF6bHFmeG9kcmJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwNTYyODgsImV4cCI6MjA4MDYzMjI4OH0.tFfxodOMYnLdDAmpfTAKzKs0TawE5-BmJiIY_ohI1Is';

console.log("CONFIG LOADED → API_BASE =", API_BASE);
console.log("CONFIG LOADED → SUPABASE_URL =", window.SUPABASE_URL);
