// assets/js/config.js

// Definimos API_BASE como global y además como constante local
const API_BASE =
  window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
    ? "http://127.0.0.1:8000"
    : "https://ngm-backend.onrender.com";

// También lo colgamos explícitamente en window por si acaso
window.API_BASE = API_BASE;

console.log("CONFIG LOADED → API_BASE =", API_BASE);
