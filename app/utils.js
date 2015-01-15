// Collection of unrelated helper functions. Avoid adding code here.

/**
 * Calculates the last week day
 * @param {Date} day The reference day
 * @returns {Date} The first weekday preceding the reference day
 */
var previousWeekday = function(day) {
  var last_weekday = day
  do {
    last_weekday.setDate(last_weekday.getDate()-1);
  } while (last_weekday.getDay() == 6 || last_weekday.getDay() == 0);
  return last_weekday
}

/**
 * Given a string, returns the dom tree with the parsed html
 * @param {string} html The html to be parsed.
 * @returns {DOMTree} The parsed dom tree.
 */
var parseHTML = function(html) {
  // There is no easy html parser available in chrome. See
  // https://code.google.com/p/chromium/issues/detail?id=265379
  var dom = document.implementation.createHTMLDocument('');
  dom.documentElement.innerHTML = html;
  return dom;
}

var readDate = function(date) {
  if (typeof(date) == typeof(new Date())) return date
  try {
    date = $.datepicker.parseDate($.datepicker.ATOM, date)
  } catch (err) {
    console.log('Failed to parse date:', err)
    return null
  }
  return date
}

