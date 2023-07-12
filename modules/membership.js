const Membership = require("../models/Membership");
const { getFinish, getMilliSecondsFromShortStr } = require("../utils/time");

exports.createMembership = async (plan, user, bill) => {
  if (!plan._id || !user._id || !bill._id) {
    throw new Error("Missing plan, user or bill");
  }
  const now = new Date(Date.now());

  const finish = getMilliSecondsFromShortStr(
    `${plan.durationAmount} ${plan.durationUnit}`
  );
  if (!finish) throw new Error("Invalid plan duration");

  return Membership.create({
    owner: user._id,
    plan: plan._id,
    bill: bill._id,
    start: now,
    finish: getFinish(now, finish),
  });
};
