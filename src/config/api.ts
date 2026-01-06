// API Configuration - Change URL here to switch between dev and demo
// ============================================================================

// Local development URL
const LOCAL_API = "http://192.168.1.9:8000";

// Cloudflare Tunnel URL
const TUNNEL_API = "https://must-directory-established-rental.trycloudflare.com";

// ============================================================================
// Toggle this to switch environments:
// - true  = Use Cloudflare tunnel (demo mode)
// - false = Use local IP (development mode)
// ============================================================================
const USE_TUNNEL = false;

// Export the active API base URL
export const API_BASE = USE_TUNNEL ? TUNNEL_API : LOCAL_API;
