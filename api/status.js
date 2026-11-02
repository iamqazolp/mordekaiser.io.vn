/**
 * Vercel Serverless Function: GET /api/status
 */
const PROMPT = require("./_prompt.json");

module.exports = async function handler(req, res) {
  return res.status(200).json({
    ok: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.MODEL_NAME || PROMPT.default_model,
  });
};
