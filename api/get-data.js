// Vercel Serverless Function: GET /api/get-data
const crypto = require("crypto");
const eq = (a, b) => {
  if (!a || !b) return false;
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { GOOGLE_SHEET_API_URL, USER_KEY } = process.env;
  if (!GOOGLE_SHEET_API_URL) {
    return res.status(500).json({ error: "Server is not configured" });
  }

  // ตรวจสอบรหัสผ่านเข้าชม (USER_KEY)
  if (USER_KEY) {
    const userKey = req.query.key || req.headers["x-user-key"];
    if (!eq(userKey, USER_KEY)) {
      return res.status(401).json({ error: "Unauthorized access" });
    }
  }

  try {
    const upstream = await fetch(GOOGLE_SHEET_API_URL, { redirect: "follow" });
    if (!upstream.ok) {
      return res.status(502).json({ error: "Upstream error" });
    }
    const body = await upstream.text();
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "text/plain; charset=utf-8"
    );
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).send(body);
  } catch (err) {
    console.error("get-data failed");
    return res.status(502).json({ error: "Failed to fetch data" });
  }
};
