// api/analyze.js
// FREE MODEL: Room transformation with Together.ai + rule-based products
// Keeping your working CORS setup!

export default async function handler(req, res) {
  // ============================================
  // CORS (Your existing setup - keep it!)
  // ============================================
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
    // ============================================
    // PARSE REQUEST
    // ============================================
    const body = req.body && typeof req.body === "object" ? req.body : {};
    
    // Support both your old format AND new format
    const imageUrl  = body.imageUrl  || null;
    const imageData = body.imageData || body.image || null; // Accept both field names
    const style     = body.style     || "modern"; // Default to modern
    const userId    = body.userId    || "anonymous";

    if (!imageUrl && !imageData) {
      return res.status(400).json({
        ok: false,
        error: "Send imageUrl or imageData (base64)"
      });
    }

    // ============================================
    // CHECK USER CREDITS
    // ============================================
    const userCredits = await checkUserCredits(userId);
    
    if (userCredits <= 0) {
      return res.status(429).json({
        ok: false,
        error: "No credits remaining",
        message: "Share on social media or refer a friend to unlock more!",
        creditsRemaining: 0,
        unlockMethods: [
          { method: "social_share", reward: 5, label: "Share on Social" },
          { method: "referral", reward: 3, label: "Refer a Friend" },
          { method: "email", reward: 2, label: "Join Newsletter" }
        ]
      });
    }

    // ============================================
    // DECIDE: DEMO MODE vs REAL TRANSFORMATION
    // ============================================
    const hasTogetherKey = !!process.env.TOGETHER_API_KEY;
    
    let transformedImage = null;
    let demoMode = false;

    if (!hasTogetherKey) {
      // DEMO MODE (no API key yet)
      console.log("⚠️  DEMO MODE: No TOGETHER_API_KEY found");
      transformedImage = `https://via.placeholder.com/800x600/E8DED2/8B7355?text=${style.toUpperCase()}+Style+Demo`;
      demoMode = true;
    } else {
      // REAL TRANSFORMATION
      const imageToTransform = imageData || imageUrl;
      transformedImage = await transformRoomWithTogetherAI(imageToTransform, style);
    }

    // ============================================
    // GET PRODUCTS (Rule-based - no AI cost!)
    // ============================================
    const products = getProductsForStyle(style);

    // ============================================
    // DEDUCT CREDIT & RETURN SUCCESS
    // ============================================
    await decrementUserCredits(userId);

    return res.status(200).json({
      ok: true,
      demo: demoMode,
      received: { 
        hasImageUrl: !!imageUrl, 
        hasImageData: !!imageData,
        style: style
      },
      transformedImage: transformedImage,
      products: products,
      creditsRemaining: userCredits - 1,
      message: demoMode ? "Demo mode - Add TOGETHER_API_KEY to Vercel for real transformations" : "Success!"
    });

  } catch (err) {
    console.error("❌ Error in analyze.js:", err);
    return res.status(500).json({ 
      ok: false, 
      error: String(err),
      details: err.message 
    });
  }
}

// ============================================
// TOGETHER.AI TRANSFORMATION
// Cost: $0.0008 per image (super cheap!)
// ============================================
async function transformRoomWithTogetherAI(imageInput, style) {
  // Style-specific prompts
  const stylePrompts = {
    boho: "boho chic interior, rattan furniture, macrame wall hangings, indoor plants, warm earth tones, textured fabrics, vintage rugs, eclectic decor",
    industrial: "industrial loft interior, exposed brick walls, metal fixtures, concrete floors, leather furniture, Edison bulb lighting, minimal color palette",
    scandinavian: "scandinavian minimalist interior, light wood furniture, white walls, cozy textiles, natural light, potted plants, clean lines, hygge",
    modern: "modern minimalist interior, clean lines, neutral colors, sleek furniture, minimal decor, geometric shapes, contemporary design",
    coastal: "coastal interior, light and airy, white and blue color scheme, natural materials, beach-inspired decor, wicker furniture, nautical accents"
  };

  const prompt = stylePrompts[style] || stylePrompts.modern;

  try {
    const response = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.TOGETHER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "stabilityai/stable-diffusion-xl-base-1.0",
        prompt: `${prompt}, professional interior design photography, high quality, photorealistic, 4k, well-lit`,
        negative_prompt: "blurry, distorted, low quality, unrealistic, amateur, dark, cluttered, ugly, deformed",
        steps: 25,
        guidance_scale: 7.5,
        width: 1024,
        height: 768,
        // If image provided, do img2img transformation
        ...(imageInput && {
          init_image: imageInput,
          strength: 0.75 // How much to change (0.6-0.9 recommended)
        })
      }),
    });

    if (!response.ok) {
      throw new Error(`Together.ai API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Together.ai returns base64 or URL depending on config
    return data.output?.choices?.[0]?.image_base64 || data.output?.[0] || data.data?.[0]?.url;
    
  } catch (error) {
    console.error("Together.ai error:", error);
    throw new Error(`AI transformation failed: ${error.message}`);
  }
}

// ============================================
// PRODUCT DATABASE (Rule-based matching)
// No AI cost! You curate these once
// ============================================
function getProductsForStyle(style) {
  const productDB = {
    boho: [
      {
        id: "boho_chair",
        category: "seating",
        title: "Natural Rattan Accent Chair",
        price: "$189",
        vendor: "Wayfair",
        image: "https://via.placeholder.com/200x200/C19A6B/FFF?text=Rattan",
        affiliateLinks: {
          amazon: "https://amazon.com/dp/EXAMPLE?tag=YOUR_AMAZON_TAG",
          wayfair: "https://wayfair.com/EXAMPLE?refid=YOUR_WAYFAIR_ID",
          target: "https://target.com/EXAMPLE?afid=YOUR_TARGET_ID"
        },
        commission: 7
      },
      {
        id: "boho_macrame",
        category: "decor",
        title: "Handmade Macrame Wall Hanging",
        price: "$45",
        vendor: "Amazon",
        image: "https://via.placeholder.com/200x200/E8DED2/8B7355?text=Macrame",
        affiliateLinks: {
          amazon: "https://amazon.com/dp/EXAMPLE?tag=YOUR_AMAZON_TAG",
          etsy: "https://etsy.com/EXAMPLE?ref=YOUR_ETSY_ID"
        },
        commission: 4
      },
      {
        id: "boho_rug",
        category: "rug",
        title: "Natural Jute Area Rug 8×10",
        price: "$229",
        vendor: "Wayfair",
        image: "https://via.placeholder.com/200x200/D4A574/FFF?text=Jute+Rug",
        affiliateLinks: {
          wayfair: "https://wayfair.com/EXAMPLE?refid=YOUR_WAYFAIR_ID",
          amazon: "https://amazon.com/dp/EXAMPLE?tag=YOUR_AMAZON_TAG"
        },
        commission: 8
      },
      {
        id: "boho_planters",
        category: "decor",
        title: "Modern Ceramic Planter Set (3pc)",
        price: "$67",
        vendor: "Target",
        image: "https://via.placeholder.com/200x200/A0826D/FFF?text=Planters",
        affiliateLinks: {
          target: "https://target.com/EXAMPLE?afid=YOUR_TARGET_ID",
          amazon: "https://amazon.com/dp/EXAMPLE?tag=YOUR_AMAZON_TAG"
        },
        commission: 5
      }
    ],
    industrial: [
      {
        id: "ind_table",
        category: "furniture",
        title: "Industrial Metal Frame Coffee Table",
        price: "$299",
        vendor: "Wayfair",
        affiliateLinks: {
          wayfair: "https://wayfair.com/EXAMPLE?refid=YOUR_WAYFAIR_ID"
        },
        commission: 7
      },
      {
        id: "ind_light",
        category: "lighting",
        title: "Vintage Edison Bulb Pendant Light",
        price: "$129",
        vendor: "Amazon",
        affiliateLinks: {
          amazon: "https://amazon.com/dp/EXAMPLE?tag=YOUR_AMAZON_TAG"
        },
        commission: 4
      },
      {
        id: "ind_chair",
        category: "seating",
        title: "Distressed Leather Accent Chair",
        price: "$449",
        vendor: "Wayfair",
        affiliateLinks: {
          wayfair: "https://wayfair.com/EXAMPLE?refid=YOUR_WAYFAIR_ID"
        },
        commission: 8
      }
    ],
    scandinavian: [
      {
        id: "scand_table",
        category: "furniture",
        title: "Light Oak Minimalist Side Table",
        price: "$179",
        vendor: "IKEA",
        affiliateLinks: {
          ikea: "https://ikea.com/EXAMPLE",
          amazon: "https://amazon.com/dp/EXAMPLE?tag=YOUR_AMAZON_TAG"
        },
        commission: 5
      },
      {
        id: "scand_lamp",
        category: "lighting",
        title: "Nordic Minimalist Floor Lamp",
        price: "$89",
        vendor: "Target",
        affiliateLinks: {
          target: "https://target.com/EXAMPLE?afid=YOUR_TARGET_ID"
        },
        commission: 4
      },
      {
        id: "scand_throw",
        category: "textiles",
        title: "Cozy Knit Throw Blanket",
        price: "$49",
        vendor: "Amazon",
        affiliateLinks: {
          amazon: "https://amazon.com/dp/EXAMPLE?tag=YOUR_AMAZON_TAG"
        },
        commission: 3
      }
    ],
    modern: [
      {
        id: "mod_art",
        category: "decor",
        title: "Abstract Geometric Wall Art",
        price: "$79",
        vendor: "Amazon",
        affiliateLinks: {
          amazon: "https://amazon.com/dp/EXAMPLE?tag=YOUR_AMAZON_TAG"
        },
        commission: 5
      },
      {
        id: "mod_sofa",
        category: "seating",
        title: "Modern Grey Sectional Sofa",
        price: "$899",
        vendor: "Wayfair",
        affiliateLinks: {
          wayfair: "https://wayfair.com/EXAMPLE?refid=YOUR_WAYFAIR_ID"
        },
        commission: 9
      }
    ],
    coastal: [
      {
        id: "coast_sofa",
        category: "seating",
        title: "White Slipcovered Coastal Sofa",
        price: "$749",
        vendor: "Wayfair",
        affiliateLinks: {
          wayfair: "https://wayfair.com/EXAMPLE?refid=YOUR_WAYFAIR_ID"
        },
        commission: 8
      },
      {
        id: "coast_rug",
        category: "rug",
        title: "Blue & White Striped Area Rug",
        price: "$199",
        vendor: "Amazon",
        affiliateLinks: {
          amazon: "https://amazon.com/dp/EXAMPLE?tag=YOUR_AMAZON_TAG"
        },
        commission: 7
      }
    ]
  };

  // Return products for selected style, fallback to modern
  return productDB[style] || productDB.modern;
}

// ============================================
// CREDIT SYSTEM (Simple in-memory for MVP)
// TODO: Replace with Vercel Postgres later
// ============================================
const userCreditsStore = new Map();

async function checkUserCredits(userId) {
  // In production: Query Vercel Postgres or similar
  // For MVP: Give everyone 3 credits per session
  if (!userCreditsStore.has(userId)) {
    userCreditsStore.set(userId, 3); // Start with 3 free credits
  }
  return userCreditsStore.get(userId);
}

async function decrementUserCredits(userId) {
  const current = await checkUserCredits(userId);
  userCreditsStore.set(userId, Math.max(0, current - 1));
}

// ============================================
// ENVIRONMENT VARIABLES YOU NEED IN VERCEL:
// 
// TOGETHER_API_KEY (from together.ai)
//   - Go to: together.ai
//   - Sign up (free)
//   - Get API key from dashboard
//   - Add to Vercel: Settings → Environment Variables
//   - Cost: $0.0008 per image transformation
//
// Without this key, the API runs in DEMO mode
// with placeholder images (perfect for testing!)
// ============================================
