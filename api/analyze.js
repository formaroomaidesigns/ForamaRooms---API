// api/analyze.js
// SMART PRODUCT SYSTEM: Intensity-based, anchor pricing, conversion-optimized

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    
    // Parse all user inputs
    const imageUrl  = body.imageUrl  || null;
    const imageData = body.imageData || body.image || null;
    const style     = body.style     || "modern";
    const userId    = body.userId    || "anonymous";
    const roomType  = body.roomType  || "living_room";
    const mood      = body.mood      || "cozy";
    const colorPalette = body.colorPalette || "neutral";
    const intensity = body.intensity || "redesign"; // refresh, redesign, transform
    const keepItems = body.keepItems || {};
    const additionalNotes = body.additionalNotes || "";

    if (!imageUrl && !imageData) {
      return res.status(400).json({
        ok: false,
        error: "Send imageUrl or imageData (base64)"
      });
    }

    // Check credits
    const userCredits = await checkUserCredits(userId);
    if (userCredits <= 0) {
      return res.status(429).json({
        ok: false,
        error: "No credits remaining",
        message: "Share or refer to unlock more!",
        creditsRemaining: 0
      });
    }

    // Determine AI transformation strength based on intensity
    const transformationStrength = getTransformationStrength(intensity);

    // Generate or demo transformation
    const hasTogetherKey = !!process.env.TOGETHER_API_KEY;
    let transformedImage = null;
    let demoMode = false;

    if (!hasTogetherKey) {
      console.log("⚠️  DEMO MODE");
      transformedImage = `https://via.placeholder.com/800x600/E8DED2/8B7355?text=${style.toUpperCase()}+${roomType}`;
      demoMode = true;
    } else {
      const imageToTransform = imageData || imageUrl;
      const aiPrompt = buildSmartPrompt(style, roomType, mood, colorPalette, additionalNotes);
      transformedImage = await transformRoomWithTogetherAI(
        imageToTransform, 
        aiPrompt, 
        transformationStrength
      );
    }

    // Get smart product recommendations
    const products = getSmartProducts({
      style,
      roomType,
      intensity,
      keepItems,
      mood,
      colorPalette
    });

    await decrementUserCredits(userId);

    return res.status(200).json({
      ok: true,
      demo: demoMode,
      received: { 
        hasImageUrl: !!imageUrl, 
        hasImageData: !!imageData,
        style,
        roomType,
        intensity,
        mood,
        colorPalette
      },
      transformedImage,
      products,
      productCount: products.length,
      creditsRemaining: userCredits - 1,
      intensityInfo: getIntensityInfo(intensity),
      message: demoMode ? "Demo mode - Add TOGETHER_API_KEY" : "Success!"
    });

  } catch (err) {
    console.error("❌ Error:", err);
    return res.status(500).json({ 
      ok: false, 
      error: String(err),
      details: err.message 
    });
  }
}

// ============================================
// SMART PROMPT BUILDER
// ============================================
function buildSmartPrompt(style, roomType, mood, colorPalette, additionalNotes) {
  const stylePrompts = {
    boho: "boho chic interior, rattan furniture, macrame, indoor plants, warm earth tones, textured fabrics, vintage rugs, eclectic",
    industrial: "industrial loft, exposed brick, metal fixtures, concrete floors, leather furniture, Edison lighting, minimal palette",
    scandinavian: "scandinavian minimalist, light wood, white walls, cozy textiles, natural light, plants, clean lines, hygge",
    modern: "modern minimalist, clean lines, neutral colors, sleek furniture, minimal decor, geometric shapes, contemporary",
    coastal: "coastal interior, light and airy, white and blue, natural materials, beach-inspired, wicker furniture, nautical"
  };

  const moodDescriptors = {
    cozy: "warm, inviting, comfortable, soft lighting, layered textiles",
    bright: "well-lit, airy, open, fresh, energizing, lots of natural light",
    dramatic: "bold, statement pieces, contrasting colors, moody, sophisticated",
    minimal: "uncluttered, simple, essential items only, clean, zen-like",
    eclectic: "mix of styles, collected over time, personality-filled, curated chaos"
  };

  const colorDescriptors = {
    warm: "warm tones, terracotta, rust, golden, amber, cream",
    cool: "cool tones, blues, grays, whites, seafoam, sage",
    neutral: "neutral palette, beige, taupe, gray, white, natural wood",
    bold: "bold accent colors, vibrant, saturated, jewel tones",
    earthy: "earthy tones, browns, greens, terracotta, natural materials"
  };

  const base = stylePrompts[style] || stylePrompts.modern;
  const moodAdd = moodDescriptors[mood] || "";
  const colorAdd = colorDescriptors[colorPalette] || "";
  
  return `${base}, ${moodAdd}, ${colorAdd}, ${roomType} design, professional interior photography, high quality, photorealistic, 4k, well-lit ${additionalNotes ? ', ' + additionalNotes : ''}`;
}

// ============================================
// AI TRANSFORMATION STRENGTH BY INTENSITY
// ============================================
function getTransformationStrength(intensity) {
  const strengths = {
    refresh: 0.65,
    redesign: 0.72,
    transform: 0.78
  };
  return strengths[intensity] || 0.72;
}

// ============================================
// INTENSITY INFO FOR UI
// ============================================
function getIntensityInfo(intensity) {
  const info = {
    refresh: {
      label: "Refresh",
      description: "Light touch with accents & decor",
      itemCount: 8,
      focus: ["lighting", "pillows", "decor", "plants", "small furniture"]
    },
    redesign: {
      label: "Redesign",
      description: "Noticeable transformation",
      itemCount: 10,
      focus: ["accent furniture", "lighting", "rug", "decor", "textiles"]
    },
    transform: {
      label: "Transform",
      description: "Complete vision - go bold",
      itemCount: 12,
      focus: ["major furniture", "everything", "full redesign"]
    }
  };
  return info[intensity] || info.redesign;
}

// ============================================
// SMART PRODUCT RECOMMENDATIONS
// ============================================
function getSmartProducts({ style, roomType, intensity, keepItems }) {
  const allProducts = getProductDatabase(style, roomType);
  
  let availableProducts = allProducts.filter(p => {
    if (keepItems.couch && p.category === 'seating_major') return false;
    if (keepItems.rug && p.category === 'rug') return false;
    if (keepItems.lighting && p.category === 'lighting_major') return false;
    return true;
  });

  if (keepItems.couch) {
    availableProducts.push(...getComplementaryProducts('couch', style));
  }

  const intensityInfo = getIntensityInfo(intensity);
  const targetCount = intensityInfo.itemCount;

  availableProducts = scoreAndSortProducts(availableProducts, intensity);
  let selectedProducts = availableProducts.slice(0, targetCount);
  selectedProducts = addAnchorPricing(selectedProducts, intensity);

  return selectedProducts;
}

// ============================================
// PRODUCT DATABASE
// ============================================
function getProductDatabase(style, roomType) {
  const products = {
    boho_living_room: [
      {
        id: "boho_sofa",
        category: "seating_major",
        title: "Boho Velvet Sectional Sofa",
        price: "$1,299",
        priceNum: 1299,
        vendor: "Burrow",
        affiliateLinks: { burrow: "https://burrow.com/EXAMPLE?ref=YOUR_ID" },
        commission: 10,
        conversionScore: 60,
        shipsIn: "2 weeks"
      },
      {
        id: "boho_chair",
        category: "seating_accent",
        title: "Natural Rattan Accent Chair",
        price: "$189",
        priceNum: 189,
        vendor: "Wayfair",
        affiliateLinks: { wayfair: "https://wayfair.com/EXAMPLE?refid=YOUR_ID" },
        commission: 7,
        conversionScore: 85,
        shipsIn: "3-5 days",
        badge: "FAST SHIP"
      },
      {
        id: "boho_rug_premium",
        category: "rug",
        title: "Ruggable Washable Area Rug 8×10",
        price: "$399",
        priceNum: 399,
        vendor: "Ruggable",
        affiliateLinks: { ruggable: "https://ruggable.com/EXAMPLE?ref=YOUR_ID" },
        commission: 15,
        conversionScore: 50,
        badge: "PREMIUM PICK",
        isPremiumAnchor: true
      },
      {
        id: "boho_rug_value",
        category: "rug",
        title: "Natural Jute Area Rug 8×10",
        price: "$179",
        priceNum: 179,
        vendor: "Amazon",
        affiliateLinks: { amazon: "https://amazon.com/dp/EXAMPLE?tag=YOUR_TAG" },
        commission: 3,
        conversionScore: 95,
        shipsIn: "2 days Prime",
        badge: "BEST VALUE ⭐",
        savingsVsPremium: "$220",
        compareToId: "boho_rug_premium"
      },
      {
        id: "boho_side_table",
        category: "table_small",
        title: "Round Wood Side Table",
        price: "$79",
        priceNum: 79,
        vendor: "Target",
        affiliateLinks: { target: "https://target.com/EXAMPLE?afid=YOUR_ID" },
        commission: 5,
        conversionScore: 93,
        shipsIn: "2 days",
        badge: "HIGH IMPACT"
      },
      {
        id: "boho_coffee_table",
        category: "table",
        title: "Round Wood Coffee Table",
        price: "$249",
        priceNum: 249,
        vendor: "IKEA",
        affiliateLinks: { ikea: "https://ikea.com/EXAMPLE" },
        commission: 4,
        conversionScore: 80
      },
      {
        id: "boho_pendant",
        category: "lighting_major",
        title: "Woven Rattan Pendant Light",
        price: "$129",
        priceNum: 129,
        vendor: "Lamps Plus",
        affiliateLinks: { lampsplus: "https://lampsplus.com/EXAMPLE?ref=YOUR_ID" },
        commission: 6,
        conversionScore: 88
      },
      {
        id: "boho_floor_lamp",
        category: "lighting_accent",
        title: "Tripod Floor Lamp",
        price: "$89",
        priceNum: 89,
        vendor: "Target",
        affiliateLinks: { target: "https://target.com/EXAMPLE?afid=YOUR_ID" },
        commission: 5,
        conversionScore: 92,
        badge: "FAST SHIP"
      },
      {
        id: "boho_macrame",
        category: "decor",
        title: "Handmade Macrame Wall Hanging",
        price: "$45",
        priceNum: 45,
        vendor: "Etsy",
        affiliateLinks: { etsy: "https://etsy.com/EXAMPLE?ref=YOUR_ID" },
        commission: 6,
        conversionScore: 98
      },
      {
        id: "boho_pillows",
        category: "textiles",
        title: "Boho Throw Pillow Set (4pc)",
        price: "$52",
        priceNum: 52,
        vendor: "Amazon",
        affiliateLinks: { amazon: "https://amazon.com/dp/EXAMPLE?tag=YOUR_TAG" },
        commission: 4,
        conversionScore: 99,
        badge: "BESTSELLER"
      },
      {
        id: "boho_plants",
        category: "decor",
        title: "Ceramic Planter Set (3pc)",
        price: "$67",
        priceNum: 67,
        vendor: "The Sill",
        affiliateLinks: { thesill: "https://thesill.com/EXAMPLE?ref=YOUR_ID" },
        commission: 8,
        conversionScore: 94
      },
      {
        id: "boho_mirror",
        category: "decor",
        title: "Octagonal Wood Frame Mirror",
        price: "$119",
        priceNum: 119,
        vendor: "Wayfair",
        affiliateLinks: { wayfair: "https://wayfair.com/EXAMPLE?refid=YOUR_ID" },
        commission: 7,
        conversionScore: 87
      }
    ]
  };

  const key = `${style}_${roomType}`;
  return products[key] || products.boho_living_room;
}

function getComplementaryProducts(keptItem, style) {
  if (keptItem === 'couch') {
    return [
      {
        id: `${style}_complement_pillows`,
        category: "textiles",
        title: "Coordinating Throw Pillows (2pc)",
        price: "$38",
        priceNum: 38,
        vendor: "Amazon",
        conversionScore: 99,
        badge: "COMPLEMENTS YOUR COUCH"
      }
    ];
  }
  return [];
}

function scoreAndSortProducts(products, intensity) {
  return products.sort((a, b) => {
    let scoreA = a.conversionScore + a.commission;
    let scoreB = b.conversionScore + b.commission;

    if (intensity === 'refresh') {
      if (a.priceNum < 100) scoreA += 20;
      if (b.priceNum < 100) scoreB += 20;
    }

    return scoreB - scoreA;
  });
}

function addAnchorPricing(products, intensity) {
  if (intensity === 'refresh') return products;

  const result = [];
  const categories = {};

  products.forEach(p => {
    if (!categories[p.category]) categories[p.category] = [];
    categories[p.category].push(p);
  });

  Object.values(categories).forEach(categoryProducts => {
    const premium = categoryProducts.find(p => p.isPremiumAnchor);
    const value = categoryProducts.find(p => p.compareToId);

    if (premium && value) {
      result.push(premium);
      result.push(value);
      const remaining = categoryProducts.filter(p => p.id !== premium.id && p.id !== value.id);
      result.push(...remaining);
    } else {
      result.push(...categoryProducts);
    }
  });

  return result.length > 0 ? result : products;
}

async function transformRoomWithTogetherAI(imageInput, prompt, strength) {
  const response = await fetch("https://api.together.xyz/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.TOGETHER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "stabilityai/stable-diffusion-xl-base-1.0",
      prompt: `${prompt}, professional interior design photography, high quality, photorealistic, 4k`,
      negative_prompt: "blurry, distorted, low quality, unrealistic",
      steps: 25,
      guidance_scale: 7.5,
      width: 1024,
      height: 768,
      ...(imageInput && { init_image: imageInput, strength: strength })
    }),
  });

  if (!response.ok) throw new Error(`Together.ai API error: ${response.status}`);
  const data = await response.json();
  return data.output?.choices?.[0]?.image_base64 || data.output?.[0];
}

const userCreditsStore = new Map();

async function checkUserCredits(userId) {
  if (!userCreditsStore.has(userId)) {
    userCreditsStore.set(userId, 3);
  }
  return userCreditsStore.get(userId);
}

async function decrementUserCredits(userId) {
  const current = await checkUserCredits(userId);
  userCreditsStore.set(userId, Math.max(0, current - 1));
}