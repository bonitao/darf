/** Helper function for getGoog
 * @param {Date} date The date.
 * returns {string} Date string formatted for input in google finance url.
 */
var getGoogFormatDate = function(mydate) {
  options = { monthNamesShort: $.datepicker.regional[""].monthNamesShort }
  return $.datepicker.formatDate('M+d,+yy', mydate, options)
}
/**
 * Retrieves the USD value of one GOOG share at a date.
 * @param {Date} date The date.
 * returns {Deferred} Promise holding the rounded %.2f value of a GOOG share
 */
var getGoog = function(date) {
  // The CSV end-point is cors unfriendly, but we are packaged app mano.
  end_date = new Date(date.getTime())
  end_date.setDate(end_date.getDate()+1)
  end_date = previousWeekday(end_date)
  // Google finance will return nothing if start date and end date are in a
  // holiday. Increase range by 10 days to guarantee a workday in the range.
  start_date = new Date(end_date.getTime())  // clone
  start_date = new Date(start_date.setDate(start_date.getDate() - 10))  // subtract
  goog_tmpl = "http://www.google.com/finance/historical?cid=694653&startdate={startdate}&enddate={enddate}&num=30&output=csv",
  goog_url = goog_tmpl.replace(
      new RegExp('{enddate}', 'g'), getGoogFormatDate(end_date)).replace(
      new RegExp('{startdate}', 'g'), getGoogFormatDate(start_date))
  console.log('Fetching ' + goog_url)
  jqxhr = $.get(goog_url)
  jqxhr.fail(function () {
    console.log('Failed to fetch GOOG')
  })
  jqxhr.always(function() {
    console.log('Completed GOOG fetch operation')
  })
  return jqxhr.then(function(csv) {
    close = csv.split("\n")[1].split(",")[4]
    val = parseFloat(close)
    if (isNaN(val)) {
      console.log("Failed to parse goog value from " + csv)
    }
    return val
  })
}
var updateGoog = function(date, target) {
  return getGoog(date).done(function(value) {
    $(target).text(value.toFixed(2))
  })
}

/**
 * Retrieves the value of a USD in BRL for the given date.
 * @param {Date} date The date.
 * returns {Deferred} Promise holding the rounded %.2f BLR value of 1 USD.
 */
var getExchangeRate = function(date) {
  openexchangerates_tmpl = 'http://openexchangerates.org/api/historical/{date}.json?app_id=e9566249a33641ebb9c010a5dbd18a2f'
  openexchangerates_url = openexchangerates_tmpl.replace('{date}', $.datepicker.formatDate($.datepicker.ATOM, date))
  console.log('openexchangerates url: ' + openexchangerates_url)
  jqxhr = $.getJSON(openexchangerates_url)
  jqxhr.fail(function(jqxhr, textStatus, errorThrown) {
    console.log('Error status: ' + textStatus)
    console.log('Error thrown: ' + errorThrown)
  })
  jqxhr.always(function() { console.log('openexchangerates fetched completed') })
  return jqxhr.then(function(json) {
    var val = parseFloat(json.rates['BRL'])
    if (isNaN(val)) {
      console.log("Failed to parse exchange rate value from " + json)
    }
    return val
  })
}
var updateExchangeRate = function(date, target) {
  return getExchangeRate(date).done(function(value) {
    $(target).text(value.toFixed(2))
  })
}
