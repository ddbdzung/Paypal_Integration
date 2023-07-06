// Example about a mongoose model schema
const mongoose = require('mongoose')
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
  currency: String,
  status: {
    type: String,
    enum: ['active', 'inactive'],
  },
})

const Plan = mongoose.model('Plan', PlanSchema)
module.exports = Plan
