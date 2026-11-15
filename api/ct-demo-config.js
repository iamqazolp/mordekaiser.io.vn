/**
 * Vercel Serverless Function: GET /api/ct-demo-config
 * Supplies the hosted Python backend origin from Vercel Environment Variables (`CT_DEMO_API_URL`)
 * or falls back to the deployed Railway backend URL.
 */
const DEFAULT_API_URL = "https://ct-demo-api-production.up.railway.app";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    apiBase: String(process.env.CT_DEMO_API_URL || DEFAULT_API_URL).trim().replace(/\/+$/, ""),
  });
};
