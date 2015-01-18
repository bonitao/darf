/**
 * Calculates taxable income assuming share_count shares received at vestingdate.
 * @param {int} share_count
 * @param {Date} vestingdate
 * returns {Deferred} Promise of [taxable, goog, exchangerate] holding the
 * rounded %.2f value in BRL of tax to be paid and the values returned by
 * getShareValue and getExchangeRate respectively.
 */
var calculateTaxableIncome = function(share_count, vestingdate) {
  var currency_date = getExchangeRateTaxDate(vestingdate)
  rpc1 = getShareValue(vestingdate, 'GOOG')
  rpc2 = getExchangeRate(currency_date, 'BRL')
  return $.when(rpc1, rpc2).then(function(goog, exchange_rate) {
    taxable = share_count * goog * exchange_rate
    return { taxable: taxable, goog: goog, exchange_rate: exchange_rate }
  })
}
var updateTaxableIncome = function() {
  var share_count = $('#sharecount').val();
  var vestingdate = $('#vestingdate').datepicker('getDate');
  var promise = calculateTaxableIncome(share_count, vestingdate)
  return promise.then(function(taxable_income_calculation) {
    $('#currencydate').datepicker('setDate', getExchangeRateTaxDate(vestingdate))
    $('#taxable').text(taxable_income_calculation.taxable.toFixed(2))
    $('#taxable_a').text(share_count)
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
    // console.log('Completed tax table fetch operation')
  })
  return jqxhr.then(function(data) {
    var dom = parseHTML(data)
    empty_table = [[],[],[],[],[]]  // stupid javascript syntax
    var tax_tables = {}
    // We only look at ano-calendário 2013 and 2014.
    for (var y = 1; y < 4; y++) {
      var year = 2011 + y
      tax_tables[year] = $.extend(true, [], empty_table)
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
        if (!(i < 3)) {  // headers
          var tbl_row = Math.floor(i / 3) - 1
          var tbl_col = Math.floor(i % 3)
          if (tbl_col == 0 && tbl_row == 4) val = val.toString() + "+"
          tax_tables[year][tbl_row][tbl_col] = val
          // console.log("Got val: "  + val + "@" + year + ":[" + tbl_row + "][" + tbl_col +"]")
        }
      })
    }
    // Add 2015 data by hand since we don't have it yet. Copied from
    // http://g1.globo.com/economia/imposto-de-renda/2014/noticia/2014/05/nova-tabela-do-imposto-de-renda-e-publicada-no-diario-oficial.html
    tax_tables[2015] = $.extend(true, [], empty_table)
    tax_tables[2015][0] = ['1868.22', '0', '0' ]
    tax_tables[2015][1] = ['2799.86', '7.5', '140.12' ]
    tax_tables[2015][2] = ['3733.19', '15', '350.11' ]
    tax_tables[2015][3] = ['4664.68', '22.5', '630.10' ]
    tax_tables[2015][4] = ['4664.68+', '27.5', '863.33' ]
    return tax_tables
  })
}

var downloadTaxTableJSON = function() {
  return downloadTaxTable().then(function(tax_tables) {
    return JSON.stringify(tax_tables, undefined, 2)
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
  updateTaxTable(2015);
}

var calculateMonthlyTax = function(taxable_brl, tax_date, tax_tables) {
  tax_date = readDate(tax_date)
  var year = tax_date.getFullYear()
  var range = 0, rate = 0, deduction = 0
  for (row_id in tax_tables[year]) {
    range = parseFloat(tax_tables[year][row_id][0])
    rate = parseFloat(tax_tables[year][row_id][1])
    deduction = parseFloat(tax_tables[year][row_id][2])
    if (range > taxable_brl) break;
  }
  tax_brl = taxable_brl * (rate / 100) - deduction
  // console.log("Computed tax:", tax_brl)
  return { tax_brl: tax_brl, rate: rate, deduction: deduction }
}

var updateMonthlyTax = function() {
  var tax_date = $('#taxable_month').datepicker('getDate')
  var taxable_brl = parseFloat($('#taxable_brl').val())
  return downloadTaxTable().then(function(tax_tables) {
    var tax_computation = calculateMonthlyTax(taxable_brl, tax_date, tax_tables)
    $('#monthly_a').text(taxable_brl)
    $('#monthly_b').text(tax_computation.rate.toFixed(2))
    $('#monthly_c').text(tax_computation.deduction.toFixed(2))
    $('#monthly_d').text(tax_computation.tax_brl.toFixed(2))
  })
}

var calculateMonthlyTaxOnceFromBRL = function(taxable_brl, tax_date) {
  tax_date = readDate(tax_date)
  return downloadTaxTable().then(function(tax_tables) {
    return calculateMonthlyTax(taxable_brl, tax_date, tax_tables)
  })
}

var calculateMonthlyTaxOnceFromUSD = function(taxable_usd, tax_date) {
  // console.log('Taxable usd:', taxable_usd)
  tax_date = readDate(tax_date)
  var currency_date = getExchangeRateTaxDate(tax_date)
  // console.log('Currency Date:', currency_date)
  return getExchangeRate(currency_date, 'BRL').then(function(exchange_rate) {
    taxable_brl = taxable_usd * exchange_rate
    // console.log('Taxable brl computed:', taxable_brl)
    return calculateMonthlyTaxOnceFromBRL(taxable_brl, tax_date)
  })
}

var calculateMonthlyTaxOnceFromShare = function(share_count, symbol, vestingdate) {
  vestingdate = readDate(vestingdate)
  // console.log('Share count:', share_count)
  return getShareValue(vestingdate, symbol).then(function(share_value) {
    var taxable_usd = share_count * share_value
    // console.log('Taxable usd computed:', taxable_usd)
    return calculateMonthlyTaxOnceFromUSD(taxable_usd, vestingdate)
  })
}
