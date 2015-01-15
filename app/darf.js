/** Returns a { month: [{}]} object. The layout of the inner object is given by
 * csv and only lines representing a share release are kept. The month key is a
 * string formatted with datepicker.ATOM and day component fixed to 1.
 */
var parseBenefitAccessCsv = function(csv) {
  // Remove leading lines with different schema, but keep headers.
  csv = csv.split('\n').slice(4).join('\n')
  var data = $.csv.toObjects(csv)
  per_month_data = {}
  data = data.filter(function(e) { return e['Transaction Type'] == 'Release' })
  $.each(data, function(i, e) {
    var month_date = $.datepicker.parseDate(
         'dd-M-yy', e['Transaction Date'], $.datepicker.regional[''])
    month_date.setDate(1)
    month = $.datepicker.formatDate($.datepicker.ATOM, month_date)
    if (!(month in per_month_data)) per_month_data[month] = []
    per_month_data[month].push(e)
  })
  return per_month_data
}

var parseBenefitAccessXls = function(xls_content) {
}

/** Augments fields of per_month_data to have Price and Net Proceeds fields
 * which are originally zeroed.
 */
var fillFinancialData = function(per_month_data) {
  goog_rpcs = []
  for (month in per_month_data) {
    for (var i = 0; i < per_month_data[month].length; ++i) {
      row = per_month_data[month][i]
      row_date = $.datepicker.parseDate(
           'dd-M-yy', row['Transaction Date'], $.datepicker.regional[''])
      goog_rpcs.push(getGoog(row_date))
    }
  }
  return $.when.apply($, goog_rpcs).then(function() {
    var goog_array = $.makeArray(arguments);
    for (month in per_month_data) {
      for (var i = 0; i < per_month_data[month].length; ++i) {
        row = per_month_data[month][i]
        shares = parseFloat(row['Shares'])
        price = parseFloat(goog_array.shift())
        net_proceeds = price * shares
        row['Price'] = price
        row['Net Proceeds'] = net_proceeds
      }
    }
    return per_month_data
  })
}

/** Updates the view for the transaction table
 * @param {string} Atom serialization of the first day of the month of interest.
 * @param {} The data to store in the table.
 * @return {Promise}
 */
var updateDarfTable = function(month, per_month_data) {
  $('#txh_table').dataTable().fnClearTable()
  for (var i = 0; i < per_month_data[month].length; i++) {
    row = per_month_data[month][i]
     $('#txh_table').dataTable().fnAddData([
       row['Transaction Date'],
       row['Transaction Type'],
       row['Price'].toFixed(2),
       row['Shares'],
       row['Net Proceeds'].toFixed(2)
     ])
  }
  return $.Deferred().resolve().promise()
}
var populateMonthSelect = function(months) {
  items = $.map(months, function(month, i) {
    parsed_month = $.datepicker.parseDate($.datepicker.ATOM, month)
    formatted_month = $.datepicker.formatDate('MM yy', parsed_month)
    return { id: parsed_month.getTime(), text: formatted_month}
  })
  $('#darf_month_ui').removeClass('select2-offscreen');
  $('#darf_month_ui').select2({
      initSelection: function (e, cb) { cb(items[items.length-1]) },
      data: items
  });
  $('#darf_month_ui').select2("enable", true)
}


var updateIncomeAndTax = function(month, per_month_data) {
  var data = per_month_data[month]
  var income_value_usd = 0
  for (var i = 0; i < data.length; ++i) {
    share_value = parseFloat(data[i]['Price'])
    share_count = parseInt(data[i]['Shares'])
    release_value = (share_value * share_count)
    income_value_usd += release_value
  }
  var month_date = $.datepicker.parseDate($.datepicker.ATOM, month)
  darf_exchange_rate_promise = getExchangeRate(
      currencyConversionDate(month_date))
  darf_taxable_blr_promise = $.when(darf_exchange_rate_promise).then(
          function(exchange_rate) {
    $('#darf_usd_income').text(income_value_usd.toFixed(2))
    $('#darf_exchange_rate').text(exchange_rate.toFixed(2))
    taxable_blr = income_value_usd * exchange_rate
    $('#darf_blr_taxable').text(taxable_blr.toFixed(2))
    $('#income_value').text(taxable_blr.toFixed(2))
    $('#income_value').tooltip({'content': $('#darf_income_calculation').text()})
    return taxable_blr
  })
  tax_tables_promise = downloadTaxTable()
  all_done = $.when(darf_taxable_blr_promise, tax_tables_promise).then(
       function(taxable_blr, tax_tables) {
     tax_calculation = calculateMonthlyTax(taxable_blr, month_date, tax_tables)
     $('#darf_taxable_blr').text(taxable_blr.toFixed(2))
     $('#darf_tax_rate').text(tax_calculation.rate.toFixed(2))
     $('#darf_tax_deduction').text(tax_calculation.deduction.toFixed(2))
     $('#darf_tax_value').text(tax_calculation.tax_blr.toFixed(2))
     $('#darf_value').text(tax_calculation.tax_blr.toFixed(2))
     $('#darf_value').tooltip({'content': $('#darf_tax_calculation').text()})
     return [taxable_blr, tax_calculation.tax_blr]
  })
  return all_done
}

var changeDarfTableMonth = function(e) {
  var month_date = new Date(parseInt(e.val))
  var per_month_data = $('#txh_table').data('per_month_data')
  var month = $.datepicker.formatDate($.datepicker.ATOM, month_date)
   updateDarfTable(month, per_month_data).then(function() {
    return updateIncomeAndTax(month, per_month_data)
  })
  return false
}

var loadBenefitAccessCsv = function(csv) {
  per_month_data = parseBenefitAccessCsv(csv)
  fillFinancialData(per_month_data).then(function(per_month_data) {
    $('#txh_table').data('per_month_data', per_month_data)
    var months = Object.keys(per_month_data).sort()
    populateMonthSelect(months)
    var month_date = new Date($('#darf_month_ui').select2('data').id)
    var month = $.datepicker.formatDate($.datepicker.ATOM, month_date)
    updateDarfTable(month, per_month_data).then(function() {
      updateIncomeAndTax(month, per_month_data).then(function() {
        $('darf_button').prop("disabled", false);
      })
    })
  })
}

var listenDarfTableFileUpload = function(e) {
  if (e.target.files == undefined) return
  var reader = new FileReader();
  reader.readAsText(e.target.files[0])
  reader.onload = function(e) { loadBenefitAccessCsv(e.target.result) }
}
