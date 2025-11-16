export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  // Fake data for now — just so we can see it works
  return res.status(200).json({
    ok: true,
    recommendations: [
      { category: "sofa", suggestion: "Cream sectional with wood base", price: "$699" },
      { category: "rug", suggestion: "Neutral 8x10 jute weave", price: "$199" },
      { category: "lighting", suggestion: "Woven pendant lamp", price: "$89" }
    ]
  });
}
