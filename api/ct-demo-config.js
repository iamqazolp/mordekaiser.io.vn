/**
 * Vercel Serverless Function: GET /api/ct-demo-config
 * Supplies the hosted Python backend origin from Vercel Environment Variables (`CT_DEMO_API_URL`)
 * so the static `/ct-demo` UI can talk to the containerized backend without hardcoding URLs in git.
 */
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    apiBase: String(process.env.CT_DEMO_API_URL || "").trim().replace(/\/+$/, ""),
  });
};
