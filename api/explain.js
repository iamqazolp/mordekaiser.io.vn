/**
 * Vercel Serverless Function: POST /api/explain
 * Mirrors `phase1_mcq_prep/llm_server.py` for hosted Vercel deployments.
 *
 * Required Vercel Environment Variables (Project Settings -> Environment Variables):
 *   - OPENAI_API_KEY   (secret API key; never exposed to browser)
 *   - OPENAI_BASE_URL  (optional, default: https://api.openai.com)
 *   - MODEL_NAME       (optional, default: gpt-4o-mini)
 */

const LETTERS = "ABCDEF";

const DEFAULT_SUBJECT =
  "You are a tutor helping a candidate prepare for a Qualcomm AI Research Engineer (QARE) " +
  "technical screening covering math foundations, classical ML/DL, computer vision, NLP/sequence " +
  "models, and LLMs/efficient AI.";

const PEDAGOGY_PROMPT =
  "Explain concepts clearly and rigorously: give intuition first, " +
  "then derivation, then the exam trap or shortcut. Be concise. Use Markdown, and write math with " +
  "$...$ (inline) or $$...$$ (display) LaTeX.";

function buildSystemPrompt(subject) {
  const subj = String(subject || "").trim().slice(0, 600) || DEFAULT_SUBJECT;
  return `${subj} ${PEDAGOGY_PROMPT}`;
}

function getChatUrl() {
  let base = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
  if (base.endsWith("/chat/completions")) return base;
  if (!base.endsWith("/v1")) base += "/v1";
  return base + "/chat/completions";
}

function buildQuestionContext(q, revealed = true) {
  const opts = (q.options || [])
    .map((o, i) => `${LETTERS[i] || i + 1}. ${o}`)
    .join("\n");
  let ctx =
    "Here is the exam question the user is asking about (HTML/LaTeX may appear in the text).\n\n" +
    `Topic: ${q.topic || ""} | Difficulty: ${q.difficulty || ""}\n` +
    `Question: ${q.q || ""}\n\nOptions:\n${opts}\n`;

  if (revealed && Array.isArray(q.ans)) {
    const correct = q.ans.map((i) => LETTERS[i] || i + 1).join(", ");
    ctx += `\nCorrect answer: ${correct}\nReference explanation: ${q.exp || ""}`;
  } else {
    ctx +=
      "\nThe user has NOT submitted an answer yet. Do not reveal or confirm which option is " +
      "correct and do not give the final answer. Give hints, relevant concepts, and guiding " +
      "steps so they can work it out themselves; you may check their reasoning without " +
      "naming the final option.";
  }
  return ctx;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(502).json({
      error:
        "OPENAI_API_KEY is not configured in Vercel Environment Variables. Add OPENAI_API_KEY in Vercel Project Settings -> Environment Variables and redeploy.",
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const q = body.question;
    if (!q || typeof q !== "object") {
      return res.status(400).json({ error: "bad request: missing question object" });
    }

    const rawHistory = Array.isArray(body.messages) ? body.messages : [];
    const history = rawHistory
      .filter((m) => m && (m.role === "user" || m.role === "assistant"))
      .slice(-12)
      .map((m) => ({
        role: m.role,
        content: String(m.content || "").slice(0, 4000),
      }));

    if (history.length === 0 || history[history.length - 1].role !== "user") {
      return res.status(400).json({ error: "bad request: messages must end with a user message" });
    }

    const messages = [
      {
        role: "system",
        content: buildSystemPrompt(body.subject) + "\n\n" + buildQuestionContext(q, Boolean(body.revealed)),
      },
      ...history,
    ];

    const upstream = await fetch(getChatUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.MODEL_NAME || "gpt-4o-mini",
        messages,
      }),
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const detail = JSON.stringify(data).slice(0, 500);
      return res.status(502).json({ error: `LLM API error ${upstream.status}: ${detail}` });
    }

    const answer =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;

    return res.status(200).json({ answer: answer || "" });
  } catch (err) {
    return res.status(502).json({ error: String(err && err.message ? err.message : err) });
  }
};
