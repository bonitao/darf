/** Returns a { month: [{}]} object. The layout of the inner object is given by
 * csv and only lines representing a share release are kept. The month key is a
 * string formatted with datepicker.ATOM and day component fixed to 1.
 *
 * The csv content must be derived with xlsjs from the xls file exported from
 * Morgan Stanley Smith Barney. See tests for an example input.
 */
var parseBenefitAccessCsv = function(csv_content) {
  // Remove leading and trailing lines with different schema, but keep headers.
  csv = csv_content.split('\n').slice(8, -8).join('\n')
  type_key = 'Type'
  date_key = 'Date'
  date_pattern = 'mm/dd/yy'
  var data = $.csv.toObjects(csv)
  per_month_data = {}
  data = data.filter(function(e) { return e[type_key] == 'Release' })
  $.each(data, function(i, e) {
    var month_date = null
    try {
      month_date = $.datepicker.parseDate(
          date_pattern, e[date_key], $.datepicker.regional[''])
    } catch (err) {
      console.log('Failed to parse date', datestr)
    }
    month_date.setDate(1)
    month = $.datepicker.formatDate($.datepicker.ATOM, month_date)
    if (!(month in per_month_data)) per_month_data[month] = []
    per_month_data[month].push(e)
  })
  return per_month_data
}

var generateMonthlyReportOnce = function(per_month_data) {
  report_lines = []
  $.each(per_month_data, function(i, month) {
    goog_share_count = 0
    googl_share_count = 0
    income_value_usd = 0
    $.each(month, function(j, e) {
      quantity = parseInt(e['Quantity']) 
      price = parseFloat(e['Price'])
      if (e['Type'] == 'GSU Class A') {
        googl_share_count = goog_share_count + quantity
      } else if (e['Type'] == 'GSU Class C' || e['Type'] == 'Historical GSU') {
        goog_share_count = goog_share_count + quantity 
      }
      income_value_usd = price * quantity
    })
    line = 'Income for ' + month + ': ' + income_value_usd
    report_lines.append(line)
  })
  return '\n'.join(report_lines)
}

var parseBenefitAccessXlsFromFile = function(xls_file) {
  var reader = new FileReader()
  var ret = $.Deferred()
  reader.onload = function(e) {
    xls_content = e.target.result
    var workbook = XLS.read(binary_xls_content, { type: 'binary' })
    var sheet = workbook.Sheets[workbook.SheetNames[0]]
    var csv_content = XLS.utils.sheet_to_csv(sheet)
    return ret.resolve(parseBenefitAccessCsv(csv_content)).promise()
  }
  reader.readAsBinaryString(xls_file)
  return ret
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
     price = parseFloat(row['Price'])
     share_count = parseFloat(row['Quantity'])
     net_cash_proceeds = price * share_count
     $('#txh_table').dataTable().fnAddData([
       row['Date'],
       row['Type'],
       price,
       share_count,
       net_cash_proceeds
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
    share_count = parseInt(data[i]['Quantity'])
    release_value = (share_value * share_count)
    income_value_usd += release_value
  }
  var month_date = $.datepicker.parseDate($.datepicker.ATOM, month)
  darf_exchange_rate_promise = getExchangeRate(
      getExchangeRateTaxDate(month_date))
  darf_taxable_brl_promise = $.when(darf_exchange_rate_promise).then(
          function(exchange_rate) {
    $('#darf_usd_income').text(income_value_usd.toFixed(2))
    $('#darf_exchange_rate').text(exchange_rate.toFixed(2))
    taxable_brl = income_value_usd * exchange_rate
    $('#darf_brl_taxable').text(taxable_brl.toFixed(2))
    $('#income_value').text(taxable_brl.toFixed(2))
    $('#income_value').tooltip({'content': $('#darf_income_calculation').text()})
    return taxable_brl
  })
  tax_tables_promise = downloadTaxTable()
  all_done = $.when(darf_taxable_brl_promise, tax_tables_promise).then(
       function(taxable_brl, tax_tables) {
     tax_calculation = calculateMonthlyTax(taxable_brl, month_date, tax_tables)
     $('#darf_taxable_brl').text(taxable_brl.toFixed(2))
     $('#darf_tax_rate').text(tax_calculation.rate.toFixed(2))
     $('#darf_tax_deduction').text(tax_calculation.deduction.toFixed(2))
     $('#darf_tax_value').text(tax_calculation.tax_brl.toFixed(2))
     $('#darf_value').text(tax_calculation.tax_brl.toFixed(2))
     $('#darf_value').tooltip({'content': $('#darf_tax_calculation').text()})
     return [taxable_brl, tax_calculation.tax_brl]
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

var loadBenefitAccessXls = function(xls_file) {
  per_month_data = parseBenefitAccessXlsFromFile(csv)
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
}

var listenDarfTableFileUpload = function(e) {
  if (e.target.files == undefined) return
  loadBenefitAccessXls(e.target.result)
}
