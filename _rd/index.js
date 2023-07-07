import express from "express";
import fetch from "node-fetch";
import path from "path";
const __dirname = path.resolve();

const app = express();
const getAccessToken = async () => {
  const clientId =
    "ARBtpS2cDvkGm7jBa13QeUGLm34Rkm1H1beAzdFK7-RuLcg38_89zjK9VWJ1MOfeMfCZVq4kHlm9heGs";
  const appSecret =
    "ED64qKfxxDvXW9UpVhJX2kpKtLsGi76GM3G0jpWTKhhL6LXmiMOsQD46uQ-KmmhYu0tpvOSQhdiGCpB4";
  const url = "https://api-m.sandbox.paypal.com/v1/oauth2/token";
  const response = await fetch(url, {
    body: "grant_type=client_credentials",
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from(clientId + ":" + appSecret).toString("base64"),
    },
  });
  const data = await response.json();
  return data.access_token;
};

const createOrder = async () => {
  const url = "https://api-m.sandbox.paypal.com/v2/checkout/orders";
  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "USD",
          value: "0.02",
        },
      },
    ],
  };
  const headers = {
    Authorization: `Bearer ${await getAccessToken()}`,
    "Content-Type": "application/json",
  };
  const response = await fetch(url, {
    headers,
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (data.error) {
    console.error("data.error", data.error)
    throw new Error(data.error);
  }
  return data;
};

const capturePayment = async (orderID) => {
  console.log("orderID", orderID)
  const url = `https://api-m.sandbox.paypal.com/v1/billing/subscriptions/${orderID}/capture`;
  const headers = {
    Authorization: `Bearer ${await getAccessToken()}`,
    "Content-Type": "application/json",
  };
  const body = JSON.stringify({ "note": "Charging as the balance reached the limit", "capture_type": "OUTSTANDING_BALANCE", "amount": { "currency_code": "USD", "value": "3" } })

  const response = await fetch(url, {
    headers,
    method: "POST",
    body,
  });
  const data = await response.json();
  console.log("data", data)
  if (data.error) {
    throw new Error(data.error);
  }
  return data;
};

app.get("/", (req, res) => {
  res.sendFile(`${__dirname}/index.html`);
});

app.get("/orders/capture/:orderID", async (req, res) => {
  return res.send('ok')
  // const response = await capturePayment(req.params.orderID);
  // console.log('🚀 ~ file: index.js:88 ~ app.post ~ response:', response)
  // res.json(response);
});

app.post("/orders", async (req, res) => {
  const response = await createOrder();
  res.json(response);
});


app.listen(9597, () => {
  console.log("listening on http://localhost:9597/");
});
