const Joi = require('joi')
const { PAYPAL_CURRENCY, PAYPAL_STATUS, PAYPAL_INTERVAL_UNIT, PAYPAL_TENURE_TYPE } = require('../constants/paypal')

const createPlan = {
  body: Joi.object().keys({
    title: Joi.string().required(),
    description: Joi.string().required().min(1).max(127),
    price: Joi.number().required(),
    currency: Joi.string().required().valid(...Object.values(PAYPAL_CURRENCY)),
    status: Joi.string().required().valid(...Object.values(PAYPAL_STATUS)),
    tenureType: Joi.string().required().valid(...Object.values(PAYPAL_TENURE_TYPE)),
    durationAmount: Joi.number().required().min(1).max(365),
    durationUnit: Joi.string().required().valid(...Object.values(PAYPAL_INTERVAL_UNIT)),
  }),
}

module.exports = {
  createPlan,
}
