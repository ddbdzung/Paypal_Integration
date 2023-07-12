/**
 * @param {string} val Ex: 1 day, 1 week, 1 month, 1 year
 */
const getMilliSecondsFromShortStr = (val) => {
  if (!val) return null;
  if (val.endsWith("day")) {
    return parseInt(val.slice(0, -1), 10) * 1000 * 60 * 60 * 24;
  }
  if (val.endsWith("week")) {
    return parseInt(val.slice(0, -1), 10) * 1000 * 60 * 60 * 24 * 7;
  }
  if (val.endsWith("month")) {
    return parseInt(val.slice(0, -1), 10) * 1000 * 60 * 60 * 24 * 30;
  }
  if (val.endsWith("year")) {
    return parseInt(val.slice(0, -1), 10) * 1000 * 60 * 60 * 24 * 365;
  }

  return null;
};
exports.getMilliSecondsFromShortStr = getMilliSecondsFromShortStr;
/**
 *
 * @param {Date} start
 * @param {number} interval millisecond
 */
exports.getFinish = (start, interval) => {
  if (!start) return null;
  if (!interval) return null;

  return new Date(start.getTime() + interval);
};
