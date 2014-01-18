chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('app.html', {
    'bounds': {
      'width': 660,
      'height': 400
    }
  });
});
