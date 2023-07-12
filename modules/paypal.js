const axios = require('axios')
const uuid = require('uuid');

const _paypalPrepareCreatePlan = (planDocument) => {
  const paypalProductId = process.env.PAYPAL_PRODUCT_ID
  // https://developer.paypal.com/docs/api/subscriptions/v1/#plans_create
  const paypalNormalizePlan = {
    name: planDocument.title,
    product_id: paypalProductId,
    description: planDocument.description,
    status: planDocument.status?.toUpperCase(),
    billing_cycles: [{
      tenure_type: planDocument.tenureType?.toUpperCase(), // type of tenure
      sequence: 1, // Order to run among other billing cycles
      total_cycles: 0, // Infinite
      pricing_scheme: {
        fixed_price: {
          currency_code: planDocument.currency?.toUpperCase(),
          value: String(planDocument.price)
        },
      },
      frequency: {
        interval_unit: planDocument.durationUnit?.toUpperCase(),
        interval_count: Number(planDocument.durationAmount)
      },
    }],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: {
        currency_code: planDocument.currency?.toUpperCase(),
        value: '0'
      },
    },
    taxes: {
      includsive: true,
      percentage: '0'
    }
  }

  return paypalNormalizePlan
}
const _paypalCreatePlan = async (plan) => {
  const paypalRequestId = () => uuid.v4()

  try {
    const { data } = await axios({
      url: 'https://api-m.sandbox.paypal.com/v1/billing/plans',
      method: 'POST',
      maxBodyLength: Infinity,
      headers: {
        'PayPal-Request-Id': paypalRequestId(),
        'Content-Type': 'application/json',
      },
      auth: {
        username: process.env.PAYPAL_CLIENT_ID,
        password: process.env.PAYPAL_CLIENT_SECRET,
      },
      data: plan,
    })

    return data
  } catch (res) {
    console.error('Fail to call paypal api', res.response.data)
    return null
  }
}

exports.createPlan = async (planDocument) => {
  const prePaypalPlan = _paypalPrepareCreatePlan(planDocument)
  const result = await _paypalCreatePlan(prePaypalPlan)
  return result
}

exports.createHookEvent = async (urlListener, eventTypes) => {
  const url = "https://api-m.sandbox.paypal.com/v1/notifications/webhooks";
  const bodyData = {
    url: urlListener,
    event_types: eventTypes,
  };
  console.log("bodyData", bodyData);
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

    return data;
  } catch (error) {
    console.log(error.response.data);
    if (error.response.data?.name === "WEBHOOK_URL_ALREADY_EXISTS") {
      throw new Error(error.response.data?.message);
    }

    throw error;
  }
};

exports.cancelSubscription = async (subscriptionId) => {
  const url = `https://api-m.sandbox.paypal.com/v1/billing/subscriptions/${subscriptionId}/cancel`;
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
      ...configs,
    });

    return data;
  } catch (error) {
    console.log(error.response.data);
    throw error;
  }
};
