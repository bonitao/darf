#!/usr/bin/env node

var XLS = require('xlsjs')
var cli = require('cli').enable('help', 'status')

cli.parse({
    xls: ['x', 'Path to the file xls file', 'string', 'testdata/googleinc.xlsx'],
});

cli.main(function(args, options) {
  console.log("Reading file", options.xls)
  var workbook = XLS.readFile(options.xls)
  var sheet = workbook.Sheets[workbook.SheetNames[0]]
  console.log("Converting to csv", options.xls)
  var csv_content = XLS.utils.sheet_to_csv(sheet)
  console.log(csv_content)
  var phantom_cli = require('./phantom_cli_helper');
  phantom_cli.phantomCli('./darf_test.html', this.debug,
    function(csv_content) {
      return parseBenefitAccessCsv(csv_content)
    }, [csv_content],
    function(csv_content) {
      console.log('Bytes of xls:', len(xls_content))
    }
  )
})
