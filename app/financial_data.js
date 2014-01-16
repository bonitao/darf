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
  goog_tmpl = "http://www.google.com/finance/historical?cid=694653&startdate={date}&enddate={date}&num=30&output=csv",
  date_str = $.datepicker.formatDate('M+d,+yy', end_date, { monthNamesShort: $.datepicker.regional[""].monthNamesShort })
  goog_url = goog_tmpl.replace(new RegExp('{date}', 'g'), date_str)
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
    close = parseFloat(close).toFixed(2)
    return close
  })
}
var updateGoog = function(date, target) {
  return getGoog(date).done(function(value) {
    $(target).text(value)
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
  return jqxhr.then(function(json) { return json.rates['BRL'].toFixed(2) })
}
var updateExchangeRate = function(date, target) {
  return getExchangeRate(date).done(function(value) {
    $(target).text(value)
  })
}
