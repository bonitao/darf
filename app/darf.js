$(function() {
  $(document).tooltip();  // enable tooltips as title attribute
  $('#tabs').tabs()
  $("#quotes_accordion" ).accordion({active: false});

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
  $('#darf_month').select2()
})

var getGoog = function(date, target) {
  // The CSV end-point is cors unfriendly, but we are packaged app mano.
  end_date = new Date(date.getTime())
  end_date.setDate(end_date.getDate()+1)
  end_date = previousWeekday(end_date)
  goog_tmpl = "http://www.google.com/finance/historical?cid=694653&startdate={date}&enddate={date}&num=30&output=csv",
  date_str = $.datepicker.formatDate('M+d,+yy', end_date, { monthNamesShort: $.datepicker.regional[""].monthNamesShort })
  goog_url = goog_tmpl.replace(new RegExp('{date}', 'g'), date_str)
  console.log(goog_url)
  jqxhr = $.get(goog_url, function(csv) {
      close = csv.split("\n")[1].split(",")[4]
      close = parseFloat(close).toFixed(2)
      $(target).text(close)
    }).fail(function () {$(target).text("*erro*")})
  return jqxhr
}

var previousWeekday = function(day) {
  var last_weekday = day
  do {
    last_weekday.setDate(last_weekday.getDate()-1);
  } while (last_weekday.getDay() == 6 || last_weekday.getDay() == 0);
  return last_weekday
}

var getExchangeRate = function(date, target) {
  openexchangerates_tmpl = 'http://openexchangerates.org/api/historical/{date}.json?app_id=e9566249a33641ebb9c010a5dbd18a2f'
  openexchangerates_url = openexchangerates_tmpl.replace('{date}', $.datepicker.formatDate($.datepicker.ATOM, date))
  console.log('openexchangerates url: ' + openexchangerates_url)
  return $.getJSON(openexchangerates_url, function(json) {
    $(target).text(json.rates['BRL'].toFixed(2))
  }).fail(function() { $(target).text("*erro*"); })
}

var updateTaxableIncome = function() {
  $('#taxable').text('?')
  var sharecount = $('#sharecount').val()
  var vestingdate = $('#vestingdate').datepicker('getDate')

  var currencydate = new Date(vestingdate.getTime())
  currencydate.setMonth(currencydate.getMonth() - 1)
  currencydate.setDate(16)
  currencydate = previousWeekday(currencydate)
  $('#currencydate').datepicker('setDate', currencydate)
  console.log('Calling getGoog for ' + $.datepicker.formatDate($.datepicker.ATOM, vestingdate))
  rpc1 = getGoog(vestingdate, '#taxable_b').error(function() { console.log('getGoog failed') })
  rpc2 = getExchangeRate(currencydate, '#taxable_c').error(function() { console.log('getExchangeRate failed') })
  return $.when(rpc1, rpc2).then(function() {
    console.log($('#taxable_a').text() + "*" + $('#taxable_b').text() + "*" + $('#taxable_c').text())
    $('#taxable_a').text(sharecount)
    taxable = parseFloat($('#taxable_a').text()) *
              parseFloat($('#taxable_b').text()) *
              parseFloat($('#taxable_c').text())
    $('#taxable').text(taxable.toFixed(2))
  })
}

var parseHTML = function(html) {
  // There is no easy html parser available in chrome. See
  // https://code.google.com/p/chromium/issues/detail?id=265379
  var dom = document.implementation.createHTMLDocument('');
  dom.documentElement.innerHTML = html;
  return dom;
}

var updateDarfTable = function(e) {
  if (e.target.files == undefined) return
  var reader = new FileReader();
  reader.readAsText(e.target.files[0])
  reader.onload = function(e) {
    var csv = e.target.result;
    // Remove leading lines with different schema, but keep headers.
    csv = csv.split('\n').slice(4).join('\n')
    var data = $.csv.toObjects(csv)
    data = data.filter(function(e) { return e['Transaction Type'] == 'Release' })
    data = data.filter(function(e) {
      target_date = new Date()
      target_date.setMonth(target_date.getMonth() - 1)
      row_date = $.datepicker.parseDate('dd-M-yy', e['Transaction Date'], $.datepicker.regional[''])
      keep = row_date.getMonth() == target_date.getMonth() && row_date.getYear() == target_date.getYear()
      return keep
    })
    $('#txh_table').dataTable().fnClearTable()
    for (var i = 0; i < data.length; i++) {
      $('#txh_table').dataTable().fnAddData([
        data[i]['Transaction Date'],
        data[i]['Transaction Type'],
        data[i]['Price'],
        data[i]['Shares'],
        data[i]['Net Proceeds']
      ])
    }
    reqs = []
    for (var i = 0; i < data.length; ++i) {
     row_date = $.datepicker.parseDate('dd-M-yy', data[i]['Transaction Date'], $.datepicker.regional[''])
     reqs.push(getGoog(row_date, '#txh_table tr:eq(' + (i+1) + ') td:eq(2)'))
    }
    $.when.apply($, reqs).then(function() {
      month_total = 0
      for (var i = 0; i < data.length; ++i) {
        share_value = parseFloat($('#txh_table tr:eq(' + (i+1) + ') td:eq(2)').text())
        share_count = parseInt($('#txh_table tr:eq(' + (i+1) + ') td:eq(3)').text())
        value = (share_value * share_count)
        if ($.isNumeric(value)) { value = value.toFixed(2) }
        $('#txh_table').dataTable().fnUpdate(value, i, 4)
        month_total = month_total + parseFloat(value)
        console.log('darf table updated with ' + share_value + ' * ' + share_count + ' = ' + value)
      }
      $('#taxable_blr').val(month_total)
      month_day = new Date()
      month_day.setDate(1)
      month_day.setMonth(month_day.getMonth()-1)
      $('#taxable_month').datepicker('setDate', month_day)
      updateTaxableIncome().done(function() {
        $('#darf_value').text('R$ ' + $('#monthly_d').text())
        $('#darf_value').tooltip({'content': $('#monthly_calculation').text()})
      })
    })
  }
}

var downloadTaxTable = function() {
  taxtable_url = 'http://www.receita.fazenda.gov.br/aliquotas/ContribFont2012a2015.htm'
  return $.get(taxtable_url, function(data) {
    var dom = parseHTML(data)
    console.log("Parsed tax tables.")
    // We only look at ano-calendário 2013 and 2014.
    for (var y = 1; y < 4; y++) {
      var year = (2011 + y).toString()
      // Crazy selector because the first two tables (which are obsolete) are
      // not inside .divMiolo, and not specifying it makes nth-of-type return
      // multiple results.
      table_selector = '.divMiolo>table:nth-of-type('+y+') [lang="PT-BR"]'
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
        var selector = '#table' + year
        selector = selector + ' tr:nth-of-type(' + Math.floor(i / 3 + 1) + ')'
        selector = selector + ' td:nth-of-type(' + ((i % 3)+1) + ')'
        if (!(i < 3)) {  // headers
          // console.log(selector)
          $(selector).text(val)
        }
      })
      last = $('#table' + year + ' tr:last-child td:first-child')
      last.text(last.text() + '+')
    }
  })
}

var updateMonthlyTax = function() {
  $('#monthly_d').text('?')
  var rpc = downloadTaxTable()
  $.when(rpc).then(function() {
    var taxable_blr = parseFloat($('#taxable_blr').val())
    var year = $('#taxable_month').datepicker('getDate').getFullYear()
    var break_loop = false
    $('#table' + year + ' tr td:first-child').each(function(i, cell) {
      if (break_loop) return
      range = parseFloat($(cell).first().text())
      console.log('Range: ' + range + ' Taxable: ' + taxable_blr)
      rate = parseFloat($(cell).next().text())
      deduction = parseFloat($(cell).next().next().text())
      console.log('Rate: ' + rate + ' Deduction: ' + deduction)
      if (range > taxable_blr) break_loop = true
    })
    console.log('Taxable brl: ' + taxable_blr)
    $('#monthly_a').text(taxable_blr)
    $('#monthly_b').text(rate)
    $('#monthly_c').text(deduction)
    tax_blr = taxable_blr * (rate/100) - deduction
    $('#monthly_d').text(tax_blr.toFixed(2))
  })
}

$(window).ready(function () {})
$(window).load(function () {
  var last_weekday = previousWeekday(new Date());
  $('#last_weekday').text($.datepicker.formatDate($.datepicker.RFC_2822, last_weekday))
  getExchangeRate(last_weekday, '#last_weekday_usdbrl')
  getGoog(last_weekday, '#last_weekday_goog')

  $('#vestingdate').datepicker('setDate', last_weekday)
  $('#sharecount').val('5')
  updateTaxableIncome()
  $('#vestingdate').change(updateTaxableIncome)
  $('#sharecount').change(updateTaxableIncome)

  month_day = last_weekday
  month_day.setDate(1)
  month_day.setMonth(month_day.getMonth()-1)
  $('#taxable_month').datepicker('setDate', month_day)
  $('#taxable_blr').val(3000)
  updateMonthlyTax()
  $('#taxable_blr').change(updateMonthlyTax)
  $('#taxable_month').change(updateMonthlyTax)

  $('#txh_csv').change(updateDarfTable)

})
