// api/analyze.js

// Handle CORS + preflight so browsers (Framer) can call us
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end(); // preflight OK
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  try {
    // Expect JSON like: { "imageUrl": "...", "imageData": "base64..." }
    const body = req.body && typeof req.body === "object" ? req.body : {};

    const imageUrl  = body.imageUrl  || null;
    const imageData = body.imageData || null; // optional for now

    // Minimal validation (no AI yet)
    if (!imageUrl && !imageData) {
      return res.status(400).json({
        ok: false,
        error: "Send imageUrl or imageData (base64). For now we just echo it back."
      });
    }

    // --- Fake analysis for MVP wiring ---
    // (Later we’ll call OpenAI Vision and real affiliate APIs.)
    const detected = [
      { tag: "sofa", confidence: 0.92 },
      { tag: "rug", confidence: 0.88 },
      { tag: "pendant", confidence: 0.85 }
    ];

    const recommendations = [
      { category: "sofa",     title: "Cream 3-seat Fabric Sofa", price: "$699", vendor: "Amazon" },
      { category: "rug",      title: "Neutral 8×10 Jute Rug",    price: "$199", vendor: "Amazon" },
      { category: "lighting", title: "Boho Pendant Light",       price: "$59",  vendor: "Amazon" }
    ];

    return res.status(200).json({
      ok: true,
      received: { hasImageUrl: !!imageUrl, hasImageData: !!imageData },
      detected,
      recommendations
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
