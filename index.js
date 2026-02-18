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
    const raw = body.rawSaleData || body;

    if (!raw) {
      return new Response(JSON.stringify({ error: "Payload inválido" }), {
        status: 400,
        headers: HEADERS
      });
    }

    // 🔹 Normalizações obrigatórias
    const orderId = String(raw.orderId || raw.id);
    const status =
      raw.status === "paid"
        ? "paid"
        : raw.status === "refunded"
        ? "refunded"
        : "pending";

    const createdAt = new Date(
      raw.created_at || Date.now()
    ).toISOString();

    const approvedDate =
      status === "paid"
        ? new Date(
            raw.payment_confirmed_at || Date.now()
          ).toISOString()
        : undefined;

    const totalUsdCents = Math.max(
      1,
      Math.floor(raw.priceInUsdCents || raw.amountUsdCents || 0)
    );

    // 🔹 UTMs limpas
    const trackingParameters = Object.fromEntries(
      Object.entries({
        utm_source: raw.utm_source,
        utm_medium: raw.utm_medium,
        utm_campaign: raw.utm_campaign,
        utm_content: raw.utm_content,
        utm_term: raw.utm_term,
        src: raw.src,
        sck: raw.sck
      }).filter(([_, v]) => v)
    );

    const payload = {
      orderId,
      platform: "checkoutpage",
      paymentMethod: raw.paymentMethod || "other",
      status,
      createdAt,
      approvedDate,

      customer: {
        name: raw.buyerName || "Cliente",
        email: raw.buyerEmail || "",
        phone: raw.buyerPhone || "",
        country: "AO",
        ip: raw.clientIp || "0.0.0.0"
      },

      products: [
        {
          id: raw.productId || "produto",
          name: raw.productName || "Produto",
          planId: raw.productId || "plano",
          planName: raw.productName || "Plano",
          quantity: raw.quantity || 1,
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
      affiliateCode: raw.affiliateCode || undefined
    };

    const response = await fetch(
      "https://api.utmify.com.br/api-credentials/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-token": Deno.env.get("UTMIFY_API_TOKEN")
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
