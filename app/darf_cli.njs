#!/usr/bin/env node

var cli = require('cli').enable('help', 'status')

cli.parse({
    xls: ['x', 'Path to the file xls file', 'string', 'testdata/googleinc.xlsx'],
});

var FileAPI = require('file-api')
  , File = FileAPI.File
  , FileList = FileAPI.FileList
  , FileReader = FileAPI.FileReader;

cli.main(function(args, options) {
  var phantom_cli = require('./phantom_cli_helper');
  var file = new File(options.xls)
  var reader = new FileReader()
  reader.onload = function(e) {
    xls_content = e.target.result
    console.log('Local xls', xls_content.length)
    phantom_cli.phantomCli('./darf_test.html', this.debug,
      function(xls_content) {
         console.log('Callback xls', xls_content.length)
        return xls_content
      }, [xls_content],  // TODO(davi) likely cannot flown through phantom, move file path instead
      function(xls_content) {
        console.log('Bytes of xls:', len(xls_content))
      }
    )
  }
  reader.readAsBinaryString(file)
})
