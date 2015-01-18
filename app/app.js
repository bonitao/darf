/** Finalize UI components that require javascript */
$(function() {
  $(document).tooltip();  // enable tooltips as title attribute
  $('#tabs').tabs()
  $("#quotes_accordion").accordion({active: false, collapsible: true, activate: function(event, ui) { 
      $("#quotes_accordion").accordion("refresh")
      console.log('accordion refreshed')
  }});

  $.datepicker.setDefaults($.datepicker.regional['pt-BR'])
  $('#vestingdate').datepicker();
  $('#taxable_month').datepicker({
      changeMonth: true,
      changeYear: true,
      showButtonPanel: true,
      dateFormat: 'MM yy',
      onClose: function(dateText, inst) {
        var month = $("#ui-datepicker-div .ui-datepicker-month :selected").val();
        var year = $("#ui-datepicker-div .ui-datepicker-year :selected").val();
        $(this).datepicker('setDate', new Date(year, month, 1));
      }
  });
  $('#currencydate').datepicker();
  $.fn.dataTableExt.sErrMode = 'throw'
  $('#txh_table').dataTable({
      'bJQueryUI': true,
      "bPaginate": false,
      "bLengthChange": false,
      "bFilter": false,
      "bSort": false,
      "bInfo": false,
  })
  $('#darf_button').button()
  $("#darf_button").prop("disabled", false);
  $('#darf_button').click(function() {
    // if ($('#cpf').val().length == 0 || $('#cpf_dv').val().length == 0) {
      // $("<p>Please fill your CPF on the top right of the application.</p>").dialog({modal:true, buttons: [ { text: "Ok", click: function() { $( this ).dialog( "close" ); } } ] });
      // return false
    // }
    $('#sicalc').get(0).clearData({since:0}, { cookies: false })
    $('#sicalc').attr('src', 'http://www31.receita.fazenda.gov.br/sicalcweb/princ.asp?AP=P&TipTributo=1&FormaPagto=1&UF=MG11&municipiodesc=BELO+HORIZONTE&js=s&ValidadeDaPagina=1&municipio=4123')
  })
  $('#sicalc').get(0).addEventListener("loadstop", function(e) {
    sicalc = $('#sicalc')
    url = sicalc.attr('src')
    console.log("Webview navigated to: " + url)
    updateSicalcView($(sicalc), url)
  })
  $('#sicalc').get(0).addEventListener("dialog", function(e) {
    console.log("Guest message of type " + e.messageType + ": " + e.messageText)
  })
  // Called sometime after postMessage is called
  onmessage = function (e) {
    console.log("Html received");
    html = e.data
    html = html.replace(
        new RegExp('http://www31.receita.fazenda.gov.br/Darf/', 'g'),
        'darf_tmpl_files/')
    // Reset state now that we have all data
    $('#sicalc').attr('src', 'http://m.slashdot.org')
    chrome.app.window.create("darf_tmpl.html", {}, function(appwindow) {
      w = appwindow.contentWindow; 
      w.document.documentElement.innerHTML = html;
      w.print();
    })
  }
  // There is some bug in the interaction between jqueryui and webview, which
  // breaks webviews which are not visible at application start. Probably some
  // reminiscent of https://code.google.com/p/chromium/issues/detail?id=387484.
  // We set display:none in all the webview and then call show here, which
  // works around the problem.
  $('webview').show()
})

$(window).ready(function () {})
/** Hook controller logic and initialize app dependent defaults */
$(window).load(function () {
  var last_weekday = previousWeekday(new Date());
  $('#last_weekday').text($.datepicker.formatDate($.datepicker.RFC_2822, last_weekday))
  updateExchangeRate(last_weekday, '#last_weekday_usdbrl')
  updateGoog(last_weekday, '#last_weekday_goog')

  $('#vestingdate').datepicker('setDate', last_weekday)
  $('#sharecount').val('5')
  var vestingdate = $('#vestingdate').datepicker('getDate');
  updateTaxableIncome()
  $('#vestingdate').change(updateTaxableIncome)
  $('#sharecount').change(updateTaxableIncome)

  updateTaxTables()
  month_day = last_weekday
  month_day.setDate(1)
  month_day.setMonth(month_day.getMonth()-1)
  $('#taxable_month').datepicker('setDate', month_day)
  $('#taxable_brl').val(3000)
  updateMonthlyTax()
  $('#taxable_brl').change(updateMonthlyTax)
  $('#taxable_month').change(updateMonthlyTax)

  //;csv = $('#benefit_access_csv').contents().text()
  //loadBenefitAccessXls(xls)
  $('#txh_csv').change(listenDarfTableFileUpload)
  $('#darf_month_ui').on("change", changeDarfTableMonth)
  $('#sicalc').get(0).setUserAgentOverride('Mozilla/5.0 (Linux; Android 4.0.4; Galaxy Nexus Build/IMM76B) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.133 Mobile Safari/535.19')
  $('#sicalc').attr('src', 'http://m.slashdot.org')
})
