import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.post("/webhook/checkoutpage", async (req, res) => {
  try {
    const event = req.body;

    const response = await fetch(
      "https://api.utmify.com.br/api/checkout/webhook",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer 7L2MyFVIW3rzfDxBA8j1qsVKja8d8QxAtGQ"
        },
        body: JSON.stringify(event)
      }
    );

    const result = await response.text();
    console.log("UTMify response:", result);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Middleware error:", error);
    return res.status(500).json({ error: "Middleware error" });
  }
});

app.listen(3000, () => {
  console.log("Middleware rodando na porta 3000");
});
