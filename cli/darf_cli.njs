#!/usr/bin/env node

var XLS = require('xlsjs')
var cli = require('cli').enable('help', 'status')

cli.parse({
    xls: ['x', 'Path to the file xls file', 'string', './app/testdata/googleinc.xlsx'],
    year: ['y', 'Year to compute', 'number', (new Date()).getFullYear()],
});

cli.main(function(args, options) {
  var workbook = XLS.readFile(options.xls)
  var sheet = workbook.Sheets[workbook.SheetNames[0]]
  var csv_content = XLS.utils.sheet_to_csv(sheet)
  var phantom_cli = require('./phantom_cli_helper');
  phantom_cli.phantomCli('../app/darf_test.html', this.debug,
    function(csv_content, year) {
      per_month_data = parseBenefitAccessCsv(csv_content)
      return generateMonthlyReportOnce(per_month_data, year)
    }, [csv_content, options.year],
    function(monthly_report) {
      console.log('Monthly report:\n\n' + monthly_report)
    }
  )
})
