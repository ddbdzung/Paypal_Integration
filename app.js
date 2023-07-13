require('dotenv').config()
const express = require('express')
const { PAYPAL_CURRENCY, PAYPAL_TENURE_TYPE, PAYPAL_STATUS, PAYPAL_INTERVAL_UNIT, PAYPAL_EVENT_SUBSCRIPTION, PAYPAL_EVENT_PLAN } = require('./constants/paypal')
const { validate } = require('./middlewares/validate')
const Plan = require('./models/Plan')
const { planValidation } = require('./validations')
const { connectDb } = require('./mongoose')
const { pick } = require('./utils/pick')
const {
  createPlan,
  createHookEvent,
  cancelSubscription,
} = require("./modules/paypal");
const uuid = require("uuid");
const axios = require("axios");
const cookieParser = require("cookie-parser");

const fs = require("fs");
const https = require("https");
const User = require("./models/User");
const Bill = require("./models/Bill");
const Membership = require("./models/Membership");
const PaypalWebhook = require("./models/PaypalWebhook");
const { createMembership } = require("./modules/membership");
const { BILL_STATUS } = require("./constants/bill");

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
  res.render("pages/login", {
    title: 'Paypal Demo',
    isAuth: false,
  });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }

    res.cookie("user", { _id: user._id, roles: user.roles, email: user.email });
    return res.status(200).json({
      success: true,
      message: 'Login successfully'
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

app.get('/register', (req, res) => {
  res.render('pages/register', {
    title: 'Paypal Demo',
    isAuth: false,
  })
})

app.post('/register', async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const isUserExist = await User.findOne({ email });
    if (isUserExist) {
      return res.status(400).json({
        success: false,
        message: 'Email already exist'
      })
    }
    const user = await User.create({ email, password, roles: [role] });

    res.cookie("user", { _id: user._id, roles: user.roles, email: user.email });
    return res.status(201).json({
      success: true,
      message: 'Register successfully'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 
 * @param {string | string[]} roleRequired 'user' | 'admin
 * @returns 
 */
const authUser = (requiredRoles) => (req, res, next) => {
  const { user } = req.cookies;
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    })
  }

  if (!requiredRoles || (Array.isArray(requiredRoles) && requiredRoles.length === 0)) {
    throw new Error('Must have at least one role required for this middleware')
  }

  const authorizedRequestRoles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  const roles = Array.isArray(user.roles) ? user.roles : [user.roles];
  if (!authorizedRequestRoles.some(role => roles.includes(role))) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden'
    })
  }

  req.user = user;
  next();
};

app.get("/", (req, res) => {
  res.render("pages/index", {
    isAuth: !!req.cookies.user,
    title: "Paypal Demo",
    user: req.cookies.user,
  });
});

app.get("/subscription/plans", async (req, res) => {
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
  try {
    const data = await createHookEvent(urlListener, eventTypes);

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/webhooks", authUser('admin'), async (req, res) => {
  const paypalWebhooks = await PaypalWebhook.find({});
  res.render("pages/webhooks", {
    isAuth: !!req.user,
    paypalWebhooks,
  });
});

app.get("/api/v1/paypal/webhooks/initialize", authUser('admin'), async (req, res) => {
  const paypalWebhooks = await PaypalWebhook.find({});
  let protocol = req.protocol;
  if (protocol !== "https") {
    // return res.status(500).json({
    //   success: false,
    //   message: "Please use https protocol to sign up paypal webhooks",
    // });
    protocol = "https";
  }
  const listener = `${protocol}://${req.get(
    "host"
  )}/api/v1/paypal/webhook/subscription`;
  console.log("listener: ", listener);
  if (paypalWebhooks.length === 0) {
    const eventTypes = [
      ...Object.values(PAYPAL_EVENT_PLAN),
      ...Object.values(PAYPAL_EVENT_SUBSCRIPTION),
    ].map((e) => ({ name: e }));
    try {
      const data = await createHookEvent(listener, eventTypes);
      const { id, url, event_types } = data;
      const documents = event_types.map((e) => ({
        hookId: id,
        type: e.name,
        listener: url,
      }));

      await PaypalWebhook.create(documents);
      return res.status(200).json({
        success: true,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(204).send();
});

app.post("/api/v1/paypal/webhook/subscription", async (req, res) => {
  const { event_type, resource, summary } = req.body;
  if (Object.values(PAYPAL_EVENT_SUBSCRIPTION).includes(event_type)) {
    console.log(
      `[${event_type}] ${summary} - Plan ID: ${resource.plan_id} - Subscription ID: ${resource.id}`
    );

    if (
      event_type === PAYPAL_EVENT_SUBSCRIPTION.BILLING_SUBSCRIPTION_ACTIVATED
    ) {
      const { plan_id, id, subscriber, billing_info } = resource;
      try {
        const pPlan = Plan.findOne({ paypalPlanId: plan_id });
        const pBill = Bill.findOne({ paypalSubscriptionId: id });
        const [plan, bill] = await Promise.all([pPlan, pBill]);
        if (!bill) {
          console.log("Can not find bill with this subscription");
          // What to do if subscription is activated but the bill is not exist in database
          // Can not create new bill because can not verify user create the bill if not provide
          return res.status(200).json({
            success: false,
            error: "Can not find bill with this subscription",
            metadata: {
              plan_id,
              subscriptionID: id,
            },
          });
        }

        bill.status = BILL_STATUS.PAID;
        bill.paypalExtend = {
          subscriber,
          billing_info,
        };
        bill.paypalPlanId = plan_id;
        const user = await User.findById(bill.owner._id);
        const pSavedBill = bill.save();
        const pMembership = createMembership(plan, user, bill);
        const [savedBill, membership] = await Promise.all([
          pSavedBill,
          pMembership,
        ]);
        console.log({ savedBill, membership });
      } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, error: error.message });
      }
    } else if (
      event_type === PAYPAL_EVENT_SUBSCRIPTION.BILLING_SUBSCRIPTION_CANCELLED
    ) {
      console.log("User cancelled subscription from paypal");
      const { plan_id, id } = resource;
      try {
        const bill = await Bill.findOne({ paypalSubscriptionId: id }).lean();
        if (!bill) {
          console.log("Can not find bill with this subscription");
          // What to do if subscription is activated but the bill is not exist in database
          // Can not create new bill because can not verify user create the bill if not provide
          return res.status(200).json({
            success: false,
            error: "Can not find bill with this subscription",
            metadata: {
              plan_id,
              subscriptionID: id,
            },
          });
        }

        const membership = await Membership.findOne({ bill: bill._id });
        if (!membership) {
          return res.status(500).json({
            success: false,
            error: "Can not find membership with this bill",
          });
        }

        membership.status = "cancelled";
        await membership.save();
        return res.status(200).json({
          success: true,
          data: membership,
        });
      } catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, error: err.message });
      }
    }
    return res.status(200).json({
      success: true,
    });
  }

  if (Object.values(PAYPAL_EVENT_PLAN).includes(event_type)) {
    console.log(`[${event_type}] ${summary} - Plan ID: ${resource.id}`);

    return res.status(200).json({
      success: true,
    });
  }

  console.log("Event type not handled");

  return res.status(500).json({
    success: true,
  });
});

app.get("/subscription/plans/new", authUser(['admin']), async (req, res) => {
  const webhookEvents = await PaypalWebhook.find({}).lean();
  if (webhookEvents.length === 0 || !webhookEvents.map(i => i.type).includes(PAYPAL_EVENT_PLAN.BILLING_PLAN_CREATED)) {
    return res.status(400).json({
      success: false,
      message: "Please create webhook for billing plan created event",
    });
  }

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
  authUser('admin'),
  async (req, res) => {
    const webhookEvents = await PaypalWebhook.find({}).lean();
    if (webhookEvents.length === 0 || !webhookEvents.includes(PAYPAL_EVENT_PLAN.BILLING_PLAN_CREATED)) {
      return res.status(400).json({
        success: false,
        message: "Please create webhook for billing plan created event",
      });
    }

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

app.get("/subscription/checkout", authUser(['user', 'admin']), async (req, res) => {
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

app.get(
  "/subscription/unsubscribe/:membershipId",
  authUser(['user', 'admin']),
  async (req, res) => {
    const { membershipId } = req.params;
    const { _id } = req.user;
    try {
      const membership = await Membership.findById(membershipId).populate([
        "bill",
      ]);
      if (!membership) {
        return res.status(404).json({
          success: false,
          message: "Membership not found",
        });
      }

      if (membership.owner._id.toString() !== _id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to perform this action",
        });
      }

      if (
        membership.status === "inactive" ||
        membership.status === "cancelled"
      ) {
        return res.status(400).json({
          success: false,
          message: "Membership is already inactive or cancelled",
        });
      }

      membership.status = "cancelled";

      const pSavedMembership = membership.save();
      const pCancelSubscription = cancelSubscription(
        membership.bill.paypalSubscriptionId
      );

      const [savedMembership, _] = await Promise.all([
        pSavedMembership,
        pCancelSubscription,
      ]);
      return res.status(200).json({
        success: true,
        data: savedMembership,
      });
    } catch (err) {
      console.log("Error when cancelling subscription", err);
      return res.status(500).json({
        success: false,
        message: "Something went wrong",
      });
    }
  }
);

app.post("/subscription/checkout/:planId", authUser(['admin', 'user']), async (req, res) => {
  const { planId } = req.params;
  const { _id } = req.user;
  const { subscriptionID } = req.body;

  if (!planId) {
    return res.status(400).json({
      success: false,
      message: "Plan ID is required",
    });
  }
  const pPlan = Plan.findOne({ paypalPlanId: planId });
  const pUser = User.findById(_id);
  const [plan, user] = await Promise.all([pPlan, pUser]);
  if (!plan || !user) {
    return res.status(404).json({
      success: false,
      message: "Plan or user not found",
    });
  }

  if (user.membership) {
    const membership = await Membership.findById(user.membership);
    if (membership.status === "active") {
      return res.status(400).json({
        success: false,
        message: "You already have an active membership",
      });
    }
  }

  const createdBill = await Bill.create({
    owner: user._id,
    plan: plan._id,
    price: plan.price,
    currency: plan.currency,
    status: BILL_STATUS.PENDING,
    paypalSubscriptionId: subscriptionID,
  });

  return res.status(201).json({
    success: true,
    data: createdBill,
  });
});

app.get("/bills", authUser(['admin', 'user']), async (req, res) => {
  const bills = await Bill.find({ owner: req.user._id })
    .populate("plan")
    .lean();
  res.render("pages/bills", {
    isAuth: !!req.user,
    bills,
  });
});

app.get("/memberships", authUser(['admin', 'user']), async (req, res) => {
  const memberships = await Membership.find({ owner: req.user._id })
    .populate(["plan", "owner"])
    .lean();

  const formatMemberships = (memberships) => {
    return memberships.map(({ start, finish, ...membership }) => ({
      start: `${start.toLocaleDateString()} ${start.toLocaleTimeString()}`,
      finish: `${finish.toLocaleDateString()} ${finish.toLocaleTimeString()}`,
      ...membership,
    }));
  };

  res.render("pages/memberships", {
    isAuth: !!req.user,
    memberships: formatMemberships(memberships),
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
