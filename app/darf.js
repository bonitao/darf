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
     reqs.push(updateGoog(row_date, '#txh_table tr:eq(' + (i+1) + ') td:eq(2)'))
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

var updateMonthlyTax = function() {
  $('#monthly_d').text('?')
  var rpc1 = updateTaxTable(2013)
  var rpc2 = updateTaxTable(2014)
  $.when(rpc1, rpc2).then(function() {
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
  updateExchangeRate(last_weekday, '#last_weekday_usdbrl')
  updateGoog(last_weekday, '#last_weekday_goog')

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
