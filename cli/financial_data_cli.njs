#!/usr/bin/env node

var cli = require('cli').enable('help', 'status')

cli.parse({
    date: ['d', 'The reference date for the data', 'string', '14-12-31'],
    symbol:   ['s', 'The stock symbol to report about', 'string', 'GOOG'],
    currency:  ['c', 'The currency to report exchange rate about', 'string', 'BRL']
});

cli.main(function(args, options) {
  var phantom_cli = require('./phantom_cli_helper');
  phantom_cli.phantomCli('./app/financial_data_test.html', this.debug,
    function(date, symbol, currency) {
      rpcs = []
      if (symbol) { rpcs.push(getShareValue(date, symbol)) }
      if (currency) { rpcs.push(getExchangeRate(date, currency)) }
      return $.when.apply($, rpcs).then(function() {
        return $.makeArray(arguments)
      })
    }, [options.date, options.symbol, options.currency],
    function(results) {
      console.log('Reference date:', options.date)
      console.log('Price for one ' + options.symbol + ' share in USD: ' + results[0])
      console.log('Price for one USD in ' + options.currency + ': ' + results[1])
      console.log('Price for one ' + options.symbol + ' share in ' +
                  options.currency + ': ' +
                  (parseFloat(results[0]) * parseFloat(results[1])).toFixed(2))
    }
  )
})
