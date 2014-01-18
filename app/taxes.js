/** Calculates the date for currency conversion to be used for tax purposes.
 * @param {Date} vestingdate When the shares were granted.
 * @returns {Date} The date for conversion from USD to BRL.
 */
var currencyConversionDate = function(vestingdate) {
  var currencydate = new Date(vestingdate.getTime())
  // The USD value used is the last weekday of the first 15 days of the previous month.
  currencydate.setMonth(currencydate.getMonth() - 1)
  currencydate.setDate(16)
  currencydate = previousWeekday(currencydate)
  return currencydate
}
/**
 * Calculates taxable income assuming sharecount shares received at vestingdate.
 * @param {int} sharecount
 * @param {Date} vestingdate
 * returns {Deferred} Promise of [taxable, goog, exchangerate] holding the
 * rounded %.2f value in BRL of tax to be paid and the values returned by
 * getGoog and getExchangeRate respectively.
 */
var calculateTaxableIncome = function(sharecount, vestingdate) {
  var currencydate = currencyConversionDate(vestingdate)
  rpc1 = getGoog(vestingdate)
  rpc2 = getExchangeRate(currencydate)
  return $.when(rpc1, rpc2).then(function(goog, exchange_rate) {
   console.log("goog: " + goog)
    taxable = sharecount * goog * exchange_rate
    return { taxable: taxable, goog: goog, exchange_rate: exchange_rate }
  })
}
var updateTaxableIncome = function() {
  var sharecount = $('#sharecount').val();
  var vestingdate = $('#vestingdate').datepicker('getDate');
  var promise = calculateTaxableIncome(sharecount, vestingdate)
  return promise.then(function(taxable_income_calculation) {
    $('#currencydate').datepicker('setDate', currencyConversionDate(vestingdate))
    $('#taxable').text(taxable_income_calculation.taxable.toFixed(2))
    $('#taxable_a').text(sharecount)
    $('#taxable_b').text(taxable_income_calculation.goog.toFixed(2))
    $('#taxable_c').text(taxable_income_calculation.exchange_rate.toFixed(2))
  })
};

/** Downloads brazilian taxes table
 * @returns {Promise} A promise for a { 2013: [,] 2014: [,] } object with the
 * 2d tax tables with columns as base, aliquota and deducao, and each cell as a
 * string holding the value.
 */
var downloadTaxTable = function() {
  tax_table_url = 'http://www.receita.fazenda.gov.br/aliquotas/ContribFont2012a2015.htm'
  jqxhr = $.get(tax_table_url)
  jqxhr.fail(function () {
    console.log('Failed to fetch tax table')
  })
  jqxhr.always(function() {
    console.log('Completed tax table fetch operation')
  })
  return jqxhr.then(function(data) {
    var dom = parseHTML(data)
    empty_table = [[],[],[],[],[]]  // stupid javascript syntax
    var tax_tables = {}
    // We only look at ano-calendário 2013 and 2014.
    for (var y = 1; y < 4; y++) {
      var year = 2011 + y
      tax_tables[year] = empty_table.slice(0)
      // console.log("Parsing year " + year)
      // Crazy selector because the first two tables (which are obsolete) are
      // not inside .divMiolo, and not specifying it makes nth-of-type return
      // multiple results.
      table_selector = '.divMiolo>table:nth-of-type('+y+') [lang="PT-BR"]'
      // console.log("selector: "+ table_selector)
      $(table_selector, dom).each(function(i, value) {
        // The table format is a bit crazy, using brazilian format, explicit
        // ranges when only open side woud suffice, and dash to represent zero.
        // Some string hacking transforms everything in numbers suitable to be
        // converted to floats.
        var row = $(value).text()
        // console.log('Year: ' + year + ' row ' + row)
        row = row.replace(/\./g, '')
        row = row.replace(/,/g, '.')
        row = row.replace(/.* /g, '')
        row = row.replace(/[^0-9-.]/g, '')
        row = row.replace(/^-$/g, '0')
        var val = parseFloat(row)
        val = val.toString()
        // console.log("Got val: "  + val)
        if (!(i < 3)) {  // headers
          var tbl_row = Math.floor(i / 3) - 1
          var tbl_col = Math.floor(i % 3)
          if (tbl_col == 0 && tbl_row == 4) val = val.toString() + "+"
          tax_tables[year][tbl_row][tbl_col] = val
        }
      })
    }
    return tax_tables
  })
}

var updateTaxTable = function(year) {
  return downloadTaxTable().then(function(tax_tables) {
    $('#table' + year).dataTable({
      'bJQueryUI': true,
      "bPaginate": false,
      "bLengthChange": false,
      "bFilter": false,
      "bSort": false,
      "bInfo": false,
      "aaData": tax_tables[year],
      "aoColumns": [ "Base", "Alíquota", "Dedução" ]
    })
  })
}
var updateTaxTables = function() {
  updateTaxTable(2013);
  updateTaxTable(2014);
}

var calculateMonthlyTax = function(taxable_blr, tax_date, tax_tables) {
  var year = tax_date.getFullYear()
  var range = 0, rate = 0, deduction = 0
  for (row_id in tax_tables[year]) {
    range = parseFloat(tax_tables[year][row_id][0])
    rate = parseFloat(tax_tables[year][row_id][1])
    deduction = parseFloat(tax_tables[year][row_id][2])
    if (range > taxable_blr) break;
  }
  tax_blr = taxable_blr * (rate / 100) - deduction
  return { tax_blr: tax_blr, rate: rate, deduction: deduction }
}

var updateMonthlyTax = function() {
  var tax_date = $('#taxable_month').datepicker('getDate')
  var taxable_blr = parseFloat($('#taxable_blr').val())
  return downloadTaxTable().then(function(tax_tables) {
    var tax_computation = calculateMonthlyTax(taxable_blr, tax_date, tax_tables)
    $('#monthly_a').text(taxable_blr)
    $('#monthly_b').text(tax_computation.rate.toFixed(2))
    $('#monthly_c').text(tax_computation.deduction.toFixed(2))
    $('#monthly_d').text(tax_computation.tax_blr.toFixed(2))
  })
}
