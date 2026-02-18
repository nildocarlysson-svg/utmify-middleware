import express from "express";
import crypto from "crypto";

const app = express();

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

  const hash = crypto
    .createHmac("sha256", CHECKOUT_SECRET)
    .update(req.rawBody)
    .digest("hex");

  return signature === `sha256=${hash}`;
}

function normalizePaymentMethod(method = "") {
  const map = {
    pix: "pix",
    credit_card: "credit_card",
    card: "credit_card",
    boleto: "boleto",
    paypal: "paypal"
  };
  return map[method] || "unknown";
}

app.post("/", async (req, res) => {
  try {
    if (!verifySignature(req)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const data = req.body.rawSaleData || req.body;
    const now = new Date().toISOString();

    const amount = Math.max(1, Math.round((data.amount || 1) * 100));
    const gatewayFee = Math.floor(amount * 0.07);
    const userCommission = amount - gatewayFee;

    const payload = {
      orderId: String(data.orderId || data.id),
      platform: "checkoutpage",
      paymentMethod: normalizePaymentMethod(data.paymentMethod),
      status: "paid",
      createdAt: now,
      approvedDate: now,
      customer: {
        name: data.buyerName || "Cliente",
        email: data.buyerEmail || "",
        phone: data.buyerPhone || "",
        document: null,
        country: "AO"
      },
      products: [
        {
          id: String(data.productId || "product"),
          name: data.productName || "Produto",
          planId: String(data.productId || "product"),
          planName: data.productName || "Produto",
          quantity: 1,
          priceInCents: amount
        }
      ],
      commission: {
        totalPriceInCents: amount,
        gatewayFeeInCents: gatewayFee,
        userCommissionInCents: userCommission,
        currency: "USD"
      },
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
      console.error("❌ UTMify error:", text);
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
  console.log(`🚀 Middleware rodando na porta ${PORT}`);
});
