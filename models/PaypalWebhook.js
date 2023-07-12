const Mongoose = require("mongoose");
const { Schema } = Mongoose;

const PaypalWebhookSchema = new Schema({
  hookId: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  listener: {
    type: String,
    required: true,
  },
});
const PaypalWebhook = Mongoose.model("PaypalWebhook", PaypalWebhookSchema);
module.exports = PaypalWebhook;
