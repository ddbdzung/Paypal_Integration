const mongoose = require("mongoose");

function connectDb() {
  mongoose
    .connect("mongodb://127.0.0.1:27017/paypal-subscriptions-demo")
    .then(() => console.log("Connected to MongoDB..."))
    .catch((err) => console.error("Could not connect to MongoDB...", err));
}

module.exports = {
  connectDb,
}
