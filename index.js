import express from "express";
import crypto from "crypto";

const app = express();

// ⚠️ PRECISAMOS DO BODY RAW PARA VALIDAR ASSINATURA
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

const PORT = process.env.PORT || 8080;
const CHECKOUT_SECRET = process.env.CHECKOUTPAGE_WEBHOOK_SECRET;
const UTMIFY_TOKEN = process.env.UTMIFY_API_TOKEN;

function verifySignature(req) {
  const signature = req.headers["x-webhook-signature"];
  if (!signature || !CHECKOUT_SECRET) return false;

  const hmac = crypto
    .createHmac("sha256", CHECKOUT_SECRET)
    .update(req.rawBody)
    .digest("hex");

  return signature === `sha256=${hmac}`;
}

app.post("/", async (req, res) => {
  try {
    // 🔐 Verificar assinatura
    if (!verifySignature(req)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const data = req.body.rawSaleData || req.body;

    const payload = {
      orderId: data.orderId || data.id,
      platform: "checkoutpage",
      status: "paid",
      paymentMethod: data.paymentMethod || "other",
      createdAt: new Date().toISOString(),
      customer: {
        name: data.buyerName || "Cliente",
        email: data.buyerEmail || "",
        phone: data.buyerPhone || "",
        country: "AO"
      },
      products: [
        {
          id: data.productId,
          name: data.productName || "Produto",
          quantity: 1,
          priceInCents: Math.round((data.amount || 0) * 100)
        }
      ],
      trackingParameters: {
        utm_source: data.utm_source || null,
        utm_medium: data.utm_medium || null,
        utm_campaign: data.utm_campaign || null,
        utm_content: data.utm_content || null,
        utm_term: data.utm_term || null,
        src: data.src || null,
        sck: data.sck || null
      }
    };

    const response = await fetch(
      "https://api.utmify.com.br/api-credentials/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-token": UTMIFY_TOKEN
        },
        body: JSON.stringify(payload)
      }
    );

    const text = await response.text();

    if (!response.ok) {
      console.error("UTMify error:", text);
      return res.status(500).json({ error: text });
    }

    console.log("✅ Venda enviada ao UTMify");
    return res.json({ success: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
