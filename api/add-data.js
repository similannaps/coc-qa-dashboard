// Vercel Serverless Function: POST /api/add-data
// ตรวจรหัสผู้ดูแล -> ส่งต่อให้ Google Apps Script เขียนแถวใหม่ลงชีต (URL/โทเคนเก็บใน Environment Variables)
const crypto = require("crypto");
const eq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
// กัน formula injection ใน Google Sheets
const safe = (v) => { v = String(v == null ? "" : v).trim().slice(0, 300); return /^[=+\-@]/.test(v) ? "'" + v : v; };

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const { ADMIN_KEY, SHEET_WRITE_URL, SHEET_WRITE_TOKEN } = process.env;
  if (!ADMIN_KEY || !SHEET_WRITE_URL || !SHEET_WRITE_TOKEN) return res.status(501).json({ error: "Write is not configured" });

  let body = req.body;
  try { if (typeof body === "string") body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: "Invalid JSON" }); }
  body = body || {};
  if (!eq(body.key || "", ADMIN_KEY)) return res.status(401).json({ error: "Unauthorized" });

  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 500) return res.status(400).json({ error: "rows must be 1-500 items" });
  const clean = [];
  for (const r of rows) {
    const y = parseInt(r && r.Year, 10), m = parseInt(r && r.Month, 10) || 0;
    if (!(y >= 1990 && y <= 2100) || m < 0 || m > 12 || !String(r["Staff name"] || "").trim()) return res.status(400).json({ error: "Invalid row" });
    clean.push({ Year: y, Month: m || "", "Staff name": safe(r["Staff name"]), Indexing: safe(r.Indexing), Type: safe(r.Type), Program: safe(r.Program) });
  }
  try {
    const up = await fetch(SHEET_WRITE_URL, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ token: SHEET_WRITE_TOKEN, rows: clean }) });
    const out = await up.json().catch(() => ({}));
    if (!up.ok || !out.ok) return res.status(502).json({ error: "Sheet write failed" });
    return res.status(200).json({ ok: true, added: clean.length });
  } catch (e) {
    console.error("add-data failed");
    return res.status(502).json({ error: "Sheet write failed" });
  }
};
