#!/usr/bin/env node

var cli = require('cli').enable('help', 'status')

cli.parse({
    date: ['d', 'The reference date for the transaction', 'string', '14-12-31'],
    googl:  ['l', 'The number of GOOGL shares released at the given date', 'number', 0],
    goog:  ['g', 'The number of GOOG shares released at the given date', 'number', 0],
    usd:   ['u', 'The number of dollars received at the given date', 'number', 0],
    brl:  ['g', 'The number of brazilian reais received at the given date', 'number', 0],
    taxtable:  ['x', 'Download the 2014/2015 tax table and print it in json', 'bool', false]
});

cli.main(function(args, options) {
  var phantom_cli = require('./phantom_cli_helper');
  if (options.taxtable) {
    // Just download the tax tables and exit
    phantom_cli.phantomCli('./taxes_test.html', this.debug,
      function() { return downloadTaxTableJSON() }, [],
      function(tax_table_json) {
        console.log(tax_table_json)
      }
    )
    return
  }
  phantom_cli.phantomCli('./taxes_test.html', this.debug,
    function(date, googl, goog, usd, brl) {
      currency_date = getExchangeRateTaxDate(date)
      var rpc = null
      if (brl) { rpc = calculateMonthlyTaxOnceFromBRL(brl, date) }
      if (usd) { rpc = calculateMonthlyTaxOnceFromUSD(usd, date) }
      if (goog) { rpc = calculateMonthlyTaxOnceFromShare(goog, 'GOOG', date) }
      if (googl) { rpc = calculateMonthlyTaxOnceFromShare(googl, 'GOOGL', date) }
      return rpc
    }, [options.date, options.googl, options.goog, options.usd, options.brl],
    function(tax_computation) {
      console.log('Reference date:', options.date)
      console.log('Tax to pay in BRL:', tax_computation.tax_brl.toFixed(2))
    }
  )
})
