const Mongoose = require("mongoose");
const { Schema } = Mongoose;

const Plan = "Plan";
const Bill = "Bill";
const User = "User";

const MembershipSchema = new Schema({
  owner: {
    type: Schema.Types.ObjectId,
    index: true,
    ref: User,
  },
  plan: {
    type: Schema.Types.ObjectId,
    ref: Plan,
  },
  start: {
    type: Date,
    default: Date.now,
  },
  finish: {
    type: Date,
    index: true,
  },
  status: {
    type: String,
    default: "active",
    enum: ["active", "inactive", "expired"],
    index: true,
  },
  canCancel: {
    type: Boolean,
    default: false,
    index: true,
  },
  bill: {
    type: Schema.Types.ObjectId,
    ref: Bill,
    index: true,
  },
});
const Membership = Mongoose.model("Membership", MembershipSchema);
module.exports = Membership;
