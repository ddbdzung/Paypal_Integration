// Example about a mongoose model schema
const mongoose = require('mongoose')
const { PAYPAL_TENURE_TYPE, PAYPAL_CURRENCY, PAYPAL_INTERVAL_UNIT, PAYPAL_STATUS } = require('../constants/paypal')
const PlanSchema = mongoose.Schema({
  paypalPlanId: {
    type: String,
  },
  title: {
    type: String,
    required: true
  },
  price: Number,
  description: String,
  currency: {
    type: String,
    enum: Object.values(PAYPAL_CURRENCY),
    default: PAYPAL_CURRENCY.USD,
  },
  status: {
    type: String,
    enum: Object.values(PAYPAL_STATUS),
    required: true,
  },

  durationUnit: {
    type: String,
    required: true,
    enum: Object.values(PAYPAL_INTERVAL_UNIT),
  },
  durationAmount: {
    type: Number,
    default: 1,
    min: 1,
    max: 365,
    validate: {
      validator: function (value) { return Number.isInteger(value) },
      message: '{VALUE} is not an integer value'
    }
  },
  tenureType: {
    type: String,
    enum: Object.values(PAYPAL_TENURE_TYPE),
    default: PAYPAL_TENURE_TYPE.REGULAR,
  }
})

const Plan = mongoose.model('Plan', PlanSchema)
module.exports = Plan
