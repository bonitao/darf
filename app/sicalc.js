var padLeft = function(number, length) {
  return (Array(length).join("0") + number).slice(length * -1)
}
var updateSicalcView = function(sicalc, url) {
  var month_date = new Date($('#darf_month_ui').select2('data').id)
  var expire_date = new Date(month_date.getTime())
  expire_date = new Date(expire_date.setMonth(expire_date.getMonth() + 2))
  expire_date = new Date(expire_date.setDate(expire_date.getDate() - 1))
  var month = $.datepicker.formatDate('mmyy', month_date)
  var formatted_month = $.datepicker.formatDate('mm/yy', month_date)
  var tax_brl = parseFloat($('#darf_tax_value').text())
  tax_brl = accounting.formatNumber(tax_brl, 2, ".", ","); 
  // cpf = padLeft($('#cpf').val(), 9)
  // cpf_dv = padLeft($('#cpf_dv').val(), 2)

  jstmpl = "\ne = document.querySelector('{el}'); if (e != null) { e.value = '{value}' }"
  formdata = [ ['select[name=UF]', 'MG11'],
               ['select[name=municipio]', '4123'],
               ['input[name=CodReceita]', '0190'],
               ['input[name=PA]', formatted_month],
               ['input[name=PADesFormatada]', month],
               ['input[name=TxtValRec]', tax_brl],
               ['input[name=DiaDatVencTex]', padLeft(expire_date.getDate(), 2)],
               ['input[name=MesDatVencTex]', padLeft(expire_date.getMonth() + 1), 2],
               ['input[name=AnoDatVencTex]', expire_date.getFullYear()] ]
               // ['input[name=Num_Princ]', cpf],
               // ['input[name=Num_DV]', cpf_dv] ]
  script = $.map(formdata, function(item) {
    return jstmpl.replace('{el}', item[0]).replace('{value}', item[1])
  }).join(";")
  script += ";\nif (document.querySelector('div[data-ui-captcha-serpro]') != null) {\n" +
            "  // captcha page, do nothing\n" +
            "} else if (document.querySelector('form[name=DadosContrib]') != null) {\n" +
            "  document.querySelector('a[value=RETORNA]').innerHTML='Retorna';\n" +
            "  document.querySelector('input[name=js]').value = 's';\n" +
            "  document.querySelector('form').action = '../Darf/senda.asp';\n" +
            "  document.querySelector('form[name=DadosContrib]').submit()\n" +
            "} else {\n" +
            "  e = document.querySelector('img[src=\"images/Continua.gif\"]').parentElement; e.click()\n" +
              // "setTimeout(function() { e.click() }, 500 );\n" + 
            "}\n"
  console.log('updateSicalcView analyzing', url)
  if (url == "http://www31.receita.fazenda.gov.br/Darf/senda.asp") {
    sicalc.get(0).executeScript({ code: 'onmessage = function(e) { e.source.postMessage(document.getElementsByTagName("html")[0].innerHTML, "*"); console.log("html sent") }'});
    console.log('Requesting html')
    sicalc.get(0).contentWindow.postMessage({ command: 'sendhtml' }, '*');
  } else {
    // console.log("Sending: " + script)
    sicalc.get(0).executeScript({ code: script });
  }
}
