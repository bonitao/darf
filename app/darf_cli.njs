#!/usr/bin/env node

var cli = require('cli').enable('help', 'status')

cli.parse({
    xls: ['x', 'Path to the file xls file', 'string', 'testdata/googleinc.xlsx'],
});

cli.main(function(args, options) {
  var phantom_cli = require('./phantom_cli_helper');
  phantom_cli.phantomCli('./darf_test.html', this.debug,
    function(xls_file) {
      console.log('Callback xls', xls_file)
      return parseBenefitAccessXlsFromFile(xls_content)
    }, [options.xls],
    function(xls_content) {
      console.log('Bytes of xls:', len(xls_content))
    }
  )
})
