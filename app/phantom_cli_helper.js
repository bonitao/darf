// Boilerplate to write a command line tool that talks remotely to a phantomjs instance.

// Executes code.apply(window, args), which must return a deferred object, in the javascript
// context of uri and calls callback when done. All messages in the phantom
// console are piped to debug_sink. Note that code and args are converted to a
// string and eval'ed in the uri context. Debugging any failures on that code is super tricky.
var phantomCli = function(uri, debug_sink, code, args, callback) {
  var phantom = require('node-phantom-simple')
  // var phantom = require('phantom')
  return phantom.create(function(err, ph) {
    return ph.createPage(function(err, page) {
      return page.open(uri, function(err, status) {
        if (debug_sink) {
          debug_sink('About to evaluate code with args ' + args + ' in context uri ' + uri)
        }
        page.onConsoleMessage = function(msg, lineNum, sourceId) {
          if (debug_sink) {
	    debug_sink('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")')
          }
        }
        page.onCallback = function(result) {
            callback(result)
            ph.exit();
        }
        return page.evaluate(function(codestr, args) {
          code = eval('(' + codestr + ')')
          return code.apply(window, args).done(function(val) { window.callPhantom(val)})}
        , function(err,result) {
          if (err && debug_sink) {
            debug_sink('Evaluate immediate callback params:', err, result) 
          }
        }, code.toString(), args)
      })
    })
  }, {parameters: {'web-security': 'false'}})
}

module.exports = {
  phantomCli : phantomCli
}
