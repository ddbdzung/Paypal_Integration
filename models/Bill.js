const Mongoose = require("mongoose");
const { BILL_STATUS } = require("../constants/bill");
const { Schema } = Mongoose;
const User = "User";
const Plan = "Plan";

const BillSchema = new Schema({
  owner: {
    type: Schema.Types.ObjectId,
    ref: User,
    required: true,
    index: true,
  },
  plan: {
    type: Schema.Types.ObjectId,
    ref: Plan,
    required: true,
  },
  paypalSubscriptionId: {
    type: String,
    index: true,
  },
  paypalPlanId: {
    type: String,
    index: true,
  },
  paypalExtend: {
    type: Schema.Types.Mixed,
    default: {},
  },
  coupon: {
    type: String,
  },
  title: {
    type: String,
    trim: true,
  },
  price: {
    required: true,
    type: Number,
  },
  affiliate: {
    type: String,
    index: true,
  },
  total: {
    type: Number,
  },
  currency: {
    type: String,
    required: true,
    default: "USD",
  },
  status: {
    required: true,
    index: true,
    type: String,
    trim: true,
    enum: Object.values(BILL_STATUS),
    default: BILL_STATUS.PENDING,
  },
  method: {
    type: String,
    default: "direct",
    index: true,
  },
  extend: {
    type: Schema.Types.Mixed,
    default: {},
  },
  updated: {
    type: Date,
  },
  created: {
    type: Date,
    default: Date.now,
  },
});

BillSchema.index({ "extend.txn_id": 1 });

const Bill = Mongoose.model("Bill", BillSchema);

module.exports = Bill;
