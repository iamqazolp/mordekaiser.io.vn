/**
 * Vercel Serverless Function: POST /api/explain
 * Mirrors `simulator/llm_server.py` for hosted Vercel deployments.
 *
 * Required Vercel Environment Variables (Project Settings -> Environment Variables):
 *   - OPENAI_API_KEY   (secret API key; never exposed to browser)
 *   - OPENAI_BASE_URL  (optional, default: https://api.openai.com)
 *   - MODEL_NAME       (optional, default: gpt-4o-mini)
 */

const LETTERS = "ABCDEF";
// Prompt text and limits are shared with simulator/llm_server.py so both backends behave the same.
const PROMPT = require("./_prompt.json");
const LIMITS = PROMPT.limits;

function buildSystemPrompt(subject) {
  const subj = String(subject || "").trim().slice(0, LIMITS.subject_chars) || PROMPT.default_subject;
  return `${subj} ${PROMPT.pedagogy}`;
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
    `${PROMPT.question_intro}\n\n` +
    `Topic: ${q.topic || ""} | Difficulty: ${q.difficulty || ""}\n` +
    `Question: ${q.q || ""}\n\nOptions:\n${opts}\n`;

  if (revealed && Array.isArray(q.ans)) {
    const correct = q.ans.map((i) => LETTERS[i] || i + 1).join(", ");
    ctx += `\nCorrect answer: ${correct}\nReference explanation: ${q.exp || ""}`;
  } else {
    ctx += "\n" + PROMPT.hint_mode;
  }
  return ctx;
}

// Newest messages first, until the message-count or character budget is reached.
function trimHistory(history) {
  const out = [];
  let used = 0;
  for (const m of history.slice(-LIMITS.history_max_messages).reverse()) {
    const content = String(m.content || "").slice(0, LIMITS.history_message_chars);
    if (out.length && used + content.length > LIMITS.history_char_budget) break;
    out.push({ role: m.role, content });
    used += content.length;
  }
  return out.reverse();
}

// Textbook chapter (the PDF's source text) the browser may attach as grounding.
function buildReferenceContext(ref) {
  if (!ref || typeof ref !== "object") return "";
  let text = String(ref.text || "").trim();
  if (!text) return "";
  if (text.length > LIMITS.reference_chars) text = text.slice(0, LIMITS.reference_chars) + "\n[... chapter truncated ...]";
  const title = String(ref.title || "").trim().slice(0, 200);
  const source = String(ref.source || "").trim().slice(0, 200);
  let label = title ? `"${title}"` : "the relevant chapter";
  if (source) label += ` from ${source}`;
  return "\n\n" + PROMPT.textbook_intro.replace("{label}", label) + "\n<<<TEXTBOOK\n" + text + "\nTEXTBOOK>>>";
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
    const history = trimHistory(rawHistory.filter((m) => m && (m.role === "user" || m.role === "assistant")));

    if (history.length === 0 || history[history.length - 1].role !== "user") {
      return res.status(400).json({ error: "bad request: messages must end with a user message" });
    }

    const messages = [
      {
        role: "system",
        content:
          buildSystemPrompt(body.subject) +
          "\n\n" +
          buildQuestionContext(q, Boolean(body.revealed)) +
          buildReferenceContext(body.reference),
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
        model: process.env.MODEL_NAME || PROMPT.default_model,
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
