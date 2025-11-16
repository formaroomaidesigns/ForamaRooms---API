export default function handler(req, res) {
  // This allows your Framer site to call the API
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Send a simple test message back
  res.status(200).json({ ok: true, message: "🏓 Pong from FormaRooms API!" });
}
