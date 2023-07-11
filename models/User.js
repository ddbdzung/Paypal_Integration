const Mongoose = require("mongoose");
const { Schema } = Mongoose;

const Membership = "Membership";

const UserSchema = new Schema({
  email: {
    type: String,
    // unique: true,
    default: "test@example.com",
    index: true,
  },

  referral_id: {
    type: String,
    index: true,
    // unique: true,
    default: null,
  },

  roles: {
    type: [
      {
        type: String,
        enum: ["user", "admin", "mod", "beta", "super-admin"],
      },
    ],
    default: ["user"],
  },

  membership: {
    type: Schema.Types.ObjectId,
    ref: Membership,
    index: true,
    default: null,
  },

  isSignedUpTrial: {
    type: Boolean,
    default: false,
  },

  password: String,
  passwordResetToken: String,
  passwordResetExpires: Date,

  affiliateCode: {
    type: String,
    index: true,
    unique: true,
    trim: true,
  },

  affiliateRefCode: {
    type: String,
    index: true,
    trim: true,
  },

  profile: {
    type: Schema.Types.Mixed,
    default: {},
  },

  settings: {
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

  IP: {
    type: String,
    index: true,
  },

  IPs: [
    {
      type: String,
      default: [],
    },
  ],

  location: {
    type: Schema.Types.Mixed,
    default: {},
  },

  status: {
    type: String,
    default: "active",
  },

  heartbeat: {
    type: Date,
    index: true,
  },

  note: {
    type: String,
    default: "",
  },

  meta: {
    type: Schema.Types.Mixed,
    default: {},
  },

  licenseCode: {
    type: String,
    default: "",
  },

  licenseName: {
    type: String,
    default: "",
  },
});

const User = Mongoose.model("User", UserSchema);
module.exports = User;
