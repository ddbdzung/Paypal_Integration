require('dotenv').config()
const express = require('express')
const { PAYPAL_CURRENCY, PAYPAL_TENURE_TYPE, PAYPAL_STATUS, PAYPAL_INTERVAL_UNIT, PAYPAL_EVENT_SUBSCRIPTION, PAYPAL_EVENT_PLAN } = require('./constants/paypal')
const { validate } = require('./middlewares/validate')
const Plan = require('./models/Plan')
const { planValidation } = require('./validations')
const { connectDb } = require('./mongoose')
const { pick } = require('./utils/pick')
const { createPlan } = require('./modules/paypal')
const uuid = require('uuid');
const axios = require("axios");
const cookieParser = require("cookie-parser");

const fs = require("fs");
const https = require("https");
const User = require("./models/User");
const Bill = require("./models/Bill");
const Membership = require("./models/Membership");

const certCrt = fs.readFileSync("./config/cert.crt");
const certKey = fs.readFileSync("./config/cert.key");

const app = express();
const port = 3000;
const httpsPort = 3001;

app.set("view engine", "ejs");
app.use(express.json());
app.use(
  cookieParser({
    secret: "secret",
    signed: true,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  })
);

connectDb();

app.get("/login", async (req, res) => {
  const defaultEmail = "test@example.com";
  let user = await User.findOne({ email: defaultEmail });
  if (!user) {
    console.log("created default user");
    user = await User.create({});
  }
  // Sign a cookie
  res.cookie("user", { _id: user._id, roles: user.roles, email: user.email });

  res.redirect("/");
});

const authUser = () => (req, res, next) => {
  const { user } = req.cookies;
  if (!user) {
    return res.redirect("/");
  }

  req.user = user;
  next();
};

app.get("/", (req, res) => {
  res.render("pages/index", {
    isAuth: !!req.cookies.user,
    title: "Paypal Demo",
  });
});

app.get("/subscription/plans", authUser(), async (req, res) => {
  const plans = await Plan.find({});
  res.render("pages/plans", {
    plans,
    isAuth: !!req.user,
  });
});

app.get("/api/v1/paypal/webhook/list-events", async (req, res) => {
  const url = "https://api-m.sandbox.paypal.com/v1/notifications/webhooks";
  const configs = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    auth: {
      username: process.env.PAYPAL_CLIENT_ID,
      password: process.env.PAYPAL_CLIENT_SECRET,
    },
  };
  try {
    const { data } = await axios({
      url,
      ...configs,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error });
  }
});

app.get("/api/v1/paypal/webhook/show-event/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const url = `https://api-m.sandbox.paypal.com/v1/notifications/webhooks/${eventId}`;
  const configs = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    auth: {
      username: process.env.PAYPAL_CLIENT_ID,
      password: process.env.PAYPAL_CLIENT_SECRET,
    },
  };
  try {
    const { data } = await axios({
      url,
      ...configs,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error });
  }
});

app.post("/api/v1/paypal/webhook/update-event/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const { urlListener, eventTypes } = req.body;
  const url = `https://api-m.sandbox.paypal.com/v1/notifications/webhooks/${eventId}`;
  const bodyData = [
    {
      op: "replace",
      path: "/url",
      value: urlListener,
    },
    {
      op: "replace",
      path: "/event_types",
      value: eventTypes,
    },
  ];
  console.log("🚀 ~ file: app.js:127 ~ app.post ~ bodyData:", bodyData);
  const configs = {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    auth: {
      username: process.env.PAYPAL_CLIENT_ID,
      password: process.env.PAYPAL_CLIENT_SECRET,
    },
  };
  try {
    const { data } = await axios({
      url,
      data: bodyData,
      ...configs,
    });

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.response?.data });
  }
});

app.post("/api/v1/paypal/webhook/create-event", async (req, res) => {
  const { urlListener, eventTypes } = req.body;
  const url = "https://api-m.sandbox.paypal.com/v1/notifications/webhooks";
  const bodyData = {
    url: urlListener,
    event_types: eventTypes,
  };
  const configs = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    auth: {
      username: process.env.PAYPAL_CLIENT_ID,
      password: process.env.PAYPAL_CLIENT_SECRET,
    },
  };
  try {
    const { data } = await axios({
      url,
      data: bodyData,
      ...configs,
    });
    res.json(data);
  } catch (error) {
    if (error.response.data?.name === "WEBHOOK_URL_ALREADY_EXISTS") {
      return res.status(500).json({ error: error.response.data?.message });
    }

    res.status(500).json({ error });
  }
});

app.post(
  "/api/v1/paypal/webhook/subscription",
  async (req, res) => {
    const { event_type, resource, summary } = req.body;
    console.log(event_type, summary);

    switch (event_type) {
      case PAYPAL_EVENT_SUBSCRIPTION.BILLING_SUBSCRIPTION_CREATED:
        console.log(
          PAYPAL_EVENT_SUBSCRIPTION.BILLING_SUBSCRIPTION_CREATED,
          resource.plan_id
        );
        break;

      case PAYPAL_EVENT_SUBSCRIPTION.BILLING_SUBSCRIPTION_ACTIVATED:
        console.log(
          PAYPAL_EVENT_SUBSCRIPTION.BILLING_SUBSCRIPTION_ACTIVATED,
          resource.plan_id
        );
        break;
      case PAYPAL_EVENT_PLAN.BILLING_PLAN_CREATED:
        console.log(PAYPAL_EVENT_PLAN.BILLING_PLAN_CREATED, resource.id);
        break;

      default:
        console.log("Event type not handled");
        console.log(PAYPAL_EVENT_PLAN.BILLING_PLAN_CREATED, null);
        break;
    }

    return res.status(201).json({
      success: true,
      // message: 'User subscribed successfully',
      // data: req.body,
    });
  }
);

app.get("/subscription/plans/new", authUser(), async (req, res) => {
  res.render("pages/create-plan", {
    isAuth: !!req.user,
    currencies: PAYPAL_CURRENCY,
    status: PAYPAL_STATUS,
    tenureTypes: PAYPAL_TENURE_TYPE,
    durationUnits: PAYPAL_INTERVAL_UNIT,
  });
});

app.post(
  "/api/v1/subscription/plans/new",
  validate(planValidation.createPlan),
  async (req, res) => {
    const rawPlan = pick(req.body, [
      "title",
      "description",
      "price",
      "currency",
      "status",
      "tenureType",
      "durationAmount",
      "durationUnit",
    ]);
    try {
      const isPlanExists = await Plan.findOne({ title: rawPlan.title });
      if (isPlanExists) {
        return res.status(400).json({
          success: false,
          message: "Plan already exists",
        });
      }

      const planDocument = new Plan(rawPlan);
      const paypalPlan = await createPlan(planDocument);
      if (!paypalPlan) {
        console.error("Something went wrong with syncing plan to paypal");

        return res.status(500).json({
          success: false,
          message: "Something went wrong",
        });
      }

      planDocument.paypalPlanId = paypalPlan.id;
      await planDocument.save();

      res.status(201).json({
        success: true,
        data: paypalPlan,
      });
    } catch (error) {
      console.error("Something went wrong with creating plan", error);

      res.status(500).json({
        success: false,
        message: "Something went wrong",
      });
    }
  }
);

app.get("/subscription/checkout", authUser(), async (req, res) => {
  const planIds = (await Plan.find({}, "paypalPlanId")).map(
    (plan) => plan.paypalPlanId
  );
  const { planId } = req.query;
  if (!planIds.includes(planId)) {
    return res.status(404).send("Plan not found");
  }

  res.render("pages/checkout", {
    isAuth: !!req.user,
    planId,
    clientId: process.env.PAYPAL_CLIENT_ID,
  });
});

app.get("/bills", authUser(), async (req, res) => {
  const bills = await Bill.find({ user: req.user._id }).populate("plan");
  res.render("pages/bills", {
    isAuth: !!req.user,
    bills,
  });
});

app.get("/memberships", authUser(), async (req, res) => {
  const memberships = await Membership.find({ user: req.user._id }).populate(
    "plan"
  );
  res.render("pages/memberships", {
    isAuth: !!req.user,
    memberships,
  });
});

app.get("/logout", (req, res) => {
  res.clearCookie("user");
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`App listening at port ${port}`)
})

https.createServer({
    key: certKey,
    cert: certCrt,
}, app).listen(httpsPort, () => {
    console.log(`App https listening at port ${httpsPort}`)
})
