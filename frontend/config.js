// The API base URL is injected at build time via the VITE_API_BASE_URL environment
// variable. When no variable is provided we fall back to the previous production
// URL so local development continues to work without additional configuration.
window.BILLFINITY_API = import.meta.env.VITE_API_BASE_URL || "https://billfinity-backend.onrender.com";
