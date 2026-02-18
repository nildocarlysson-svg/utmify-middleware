import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: HEADERS });
  }

  try {
    const body = await req.json();
    const rawSaleData = body.rawSaleData || body;

    if (!rawSaleData) {
      return new Response(JSON.stringify({ error: "Payload inválido" }), {
        status: 400,
        headers: HEADERS
      });
    }

    // 🔹 Normalizações obrigatórias
    const orderId = String(rawSaleData.orderId || rawSaleData.id);
    const status =
      rawSaleData.status === "paid"
        ? "paid"
        : rawSaleData.status === "refunded"
        ? "refunded"
        : "pending";

    const createdAt = rawSaleData.created_at
      ? new Date(rawSaleData.created_at).toISOString()
      : new Date().toISOString();

    const approvedDate =
      status === "paid"
        ? new Date(
            rawSaleData.payment_confirmed_at || new Date()
          ).toISOString()
        : undefined;

    const totalUsdCents = Math.max(
      1,
      Math.floor(rawSaleData.priceInUsdCents || rawSaleData.amountUsdCents)
    );

    // 🔹 UTMs limpas (sem null / undefined)
    const trackingParameters = Object.fromEntries(
      Object.entries({
        utm_source: rawSaleData.utm_source,
        utm_medium: rawSaleData.utm_medium,
        utm_campaign: rawSaleData.utm_campaign,
        utm_content: rawSaleData.utm_content,
        utm_term: rawSaleData.utm_term,
        src: rawSaleData.src,
        sck: rawSaleData.sck
      }).filter(([_, v]) => v)
    );

    const payload = {
      orderId,
      platform: "custom_platform",
      paymentMethod: rawSaleData.paymentMethod || "other",
      status,
      createdAt,
      approvedDate,

      customer: {
        name: rawSaleData.buyerName || "Cliente",
        email: rawSaleData.buyerEmail || "",
        phone: rawSaleData.buyerPhone || "",
        country: "AO",
        ip: rawSaleData.clientIp || "0.0.0.0"
      },

      products: [
        {
          id: rawSaleData.productId,
          name: rawSaleData.productName || "Produto",
          planId: rawSaleData.productId,
          planName: rawSaleData.productName || "Produto",
          quantity: rawSaleData.quantity || 1,
          priceInCents: totalUsdCents
        }
      ],

      commission: {
        totalPriceInCents: totalUsdCents,
        gatewayFeeInCents: Math.floor(totalUsdCents * 0.07),
        userCommissionInCents: Math.floor(totalUsdCents * 0.93),
        currency: "USD"
      },

      trackingParameters,
      affiliateCode: rawSaleData.affiliateCode || null
    };

    const response = await fetch(
      "https://api.utmify.com.br/api-credentials/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-token": Deno.env.get("UTMIFY_API_TOKEN")!
        },
        body: JSON.stringify(payload)
      }
    );

    const text = await response.text();

    if (!response.ok) {
      console.error("Erro UTMify:", text);
      return new Response(text, { status: response.status, headers: HEADERS });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: HEADERS
    });
  } catch (err) {
    console.error("Erro geral:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: HEADERS
    });
  }
});
