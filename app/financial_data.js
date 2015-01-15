/** Helper function for getShareValue
 * @param {Date} date The date.
 * returns {string} Date string formatted for input in google finance url.
 */
var getShareFormatDate = function(mydate) {
  options = { monthNamesShort: $.datepicker.regional[""].monthNamesShort }
  return $.datepicker.formatDate('M+d,+yy', mydate, options)
}

/**
 * Retrieves the USD value of one share of the given symbol at a date.
 * @param {Date} date The date.
 * returns {Deferred} Promise holding the rounded %.2f value of a share
 */

var getShareValue = function(date, symbol) {
  date = readDate(date)
  symbol = symbol.toUpperCase()
  console.log('Running get share for symbol', symbol, 'at date', date)
  // The CSV end-point is cors unfriendly, but we are packaged app mano.
  end_date = new Date(date.getTime())
  end_date.setDate(end_date.getDate()+1)
  end_date = previousWeekday(end_date)
  // Google finance will return nothing if start date and end date are in a
  // holiday. Increase range by 10 days to guarantee a workday in the range.
  start_date = new Date(end_date.getTime())  // clone
  start_date = new Date(start_date.setDate(start_date.getDate() - 10))  // subtract
  tmpl = "http://www.google.com/finance/historical?q=NASDAQ%3A" +
         symbol + "&startdate={startdate}&enddate={enddate}&num=30&output=csv"
  url = tmpl.replace(
      new RegExp('{enddate}', 'g'), getShareFormatDate(end_date)).replace(
      new RegExp('{startdate}', 'g'), getShareFormatDate(start_date))
  console.log('Fetching ' + url)
  jqxhr = $.get(url)
  jqxhr.fail(function () {
    console.log('Failed to fetch ' + symbol)
  })
  jqxhr.always(function() {
    console.log('Completed ' + symbol + ' fetch operation')
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
  return getShareValue(date, 'GOOG').done(function(value) {
    $(target).text(value.toFixed(2))
  })
}

/**
 * Retrieves the value of a USD in BRL for the given date.
 * @param {Date} date The date.
 * returns {Deferred} Promise holding the rounded %.2f BRL value of 1 USD.
 */
var getExchangeRate = function(date, currency) {
  console.log('Getting rate for', currency, 'at', date)
  date = readDate(date)
  currency = currency.toUpperCase()
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
    var val = parseFloat(json.rates[currency])
    if (isNaN(val)) {
      console.log("Failed to parse exchange rate for", currency, "value from ", json.rates[currency])
    }
    return val
  })
}
var updateExchangeRate = function(date, target) {
  return getExchangeRate(date, 'BRL').done(function(value) {
    $(target).text(value.toFixed(2))
  })
}
