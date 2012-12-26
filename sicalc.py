#!/usr/bin/env python3

from argparse import ArgumentParser, FileType
from lxml.html import parse, submit_form, fromstring, tostring
from urllib.parse import quote_plus, urlencode
from urllib.request import urlopen
import calendar
import codecs
import dateutil.parser
import datetime
import os
import time

class Sicalc:
  def __init__(self):
    self.sicalc_princ = 'https://pagamento.serpro.gov.br/sicalcweb/princ.asp?AP=P&TipTributo=1&FormaPagto=1&UF=MG11&municipiodesc=BELO+HORIZONTE&js=s&ValidadeDaPagina=1&municipio=4123' 
    self.sicalc_pa = 'https://pagamento.serpro.gov.br/sicalcweb/PeriodoApuracao.asp?AP=P'
    self.sicalc_venc = 'https://pagamento.serpro.gov.br/sicalcweb/SelVenc.asp?AP=P'
    self.sicalc_res = 'https://pagamento.serpro.gov.br/sicalcweb/resumo.asp?AP=P'
    self.sicalc_dados = 'https://pagamento.serpro.gov.br/sicalcweb/DadosContrib.asp?AP=P'
    self.sicalc_darf = 'https://pagamento.serpro.gov.br/Darf/MontaSicalcWEBDarf.asp'

  def GenerateDarf(self, cpf, monthstr, main_tax):
    month = dateutil.parser.parse(monthstr)
    tree_princ = parse(urlopen(self.sicalc_princ))
    # print('hidden params in %s: %s' % (self.sicalc_princ, str(tree_princ.xpath("//input[@type='hidden']"))))
    now = datetime.datetime.now()
    last_day_in_month = datetime.datetime(year=now.year, day=calendar.monthrange(now.year, now.month)[1], month=now.month).strftime('%d/%m/%Y')
    submission_timestamp = str(time.time())
    params = { 'CodReceita': '0190', 'TipoBrowser': 'Darfns.asp', 'TipoAcao': 'I', 'DTUltimoDiaMes': last_day_in_month, 'TipoDarf': '1', 'js':'s', 'DataHoraSubmissao': submission_timestamp}
    for el in tree_princ.xpath("//input[@type='hidden']"):
      params.setdefault(el.name, el.value)
    params = bytes(urlencode(params).encode('utf-8'))
    # print('Params for %s: %s' % (self.sicalc_pa, params))

    tree_pa = parse(urlopen(self.sicalc_pa, data = params))
    # print('hidden params in %s: %s' % (self.sicalc_pa, str(tree_pa.xpath("//input[@type='hidden']"))))
    pa = datetime.datetime(month=month.month, year=month.year, day=1)
    formatted_pa = pa.strftime('%m/%Y')
    raw_pa = pa.strftime('%m%Y')
    txt_val_rec = ('%.2f' % main_tax).replace('.', ',')
    params = { 'PADesFormatada': raw_pa, 'periodo': 'ME', 'PA': formatted_pa, 'TxtValRec': txt_val_rec, 'PeriodoAux': 'ME', 'TipoAcao': 'I', 'js': 's'}
    for el in tree_pa.xpath("//input[@type='hidden']"):
      params.setdefault(el.name, el.value)
    dat_pgt_tex = params['DatPgtTex']
    params = bytes(urlencode(params).encode('utf-8'))
    # print('Params for %s: %s' % (self.sicalc_venc, params))
    tree_venc = parse(urlopen(self.sicalc_venc, data = params))
    # print('hidden params in %s: %s' % (self.sicalc_venc, str(tree_venc.xpath("//input[@type='hidden']"))))

    # DT_Consolidacao = min(UltDtSelic, DatPgtTex) in tree_venc form
    dt_consolidation = dat_pgt_tex
    # DTVCTO and mVcto looks like are last day of the next month
    mvcto = pa
    while (mvcto.month == pa.month):
      mvcto += datetime.timedelta(days=1)
    while (mvcto.day != calendar.monthrange(mvcto.year, mvcto.month)[1]):
      mvcto += datetime.timedelta(days=1)
    mvcto = mvcto.strftime('%d/%m/%Y')
    params = { 'DT_Consolidacao': dt_consolidation, 'DTVCTO': mvcto, 'mVcto': mvcto, 'Referencia': '', 'js': 's' }
    for el in tree_venc.xpath("//input[@type='hidden']"):
      params.setdefault(el.name, el.value)
    params = bytes(urlencode(params).encode('utf-8'))
    # print('Params for %s: %s' % (self.sicalc_res, params))
    tree_res = parse(urlopen(self.sicalc_res, data = params))
    # print('hidden params in %s: %s' % (self.sicalc_res, str(tree_res.xpath("//input[@type='hidden']"))))

    params = { 'Num_Princ': cpf[:-2], 'Num_DV': cpf[-2:], 'TipTributoReceita': '1', 'js': 's' }
    for el in tree_res.xpath("//input[@type='hidden']"):
      params.setdefault(el.name, el.value)
    params = bytes(urlencode(params).encode('utf-8'))
    # print('Params for %s: %s' % (self.sicalc_dados, params))
    tree_dados = parse(urlopen(self.sicalc_dados, data = params))
    # print('hidden params in %s: %s' % (self.sicalc_dados, str(tree_dados.xpath("//input[@type='hidden']"))))

    params = {}
    for el in tree_dados.xpath("//input[@type='hidden']"):
      params.setdefault(el.name, el.value)
    params = bytes(urlencode(params).encode('utf-8'))
    # print('Params for %s: %s' % (self.sicalc_darf, params))
    darf = urlopen(self.sicalc_darf, data = params).read().decode('ISO-8859-1')
    darf = darf.replace('./', 'https://pagamento.serpro.gov.br/Darf/')
    # Remove 404
    darf = darf.replace('<link rel="stylesheet" type="text/css" media="print" href="./estiloDARFprint.css" />', '')
    return darf

if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument("cpf", help="Cadastro de Pessoa Fisica")
    parser.add_argument('month', type=dateutil.parser.parse)
    parser.add_argument("brl_tax", help="Imposto a pagar (principal)", type=float)
    parser.add_argument("--output-file")
    args = parser.parse_args()

    sicalc = Sicalc()
    darf = sicalc.GenerateDarf(args.cpf, args.month.isoformat(), args.brl_tax)
    output_file = args.output_file
    if not args.output_file:
      darf_date = args.month.strftime('%Y-%b')
      payment_date = datetime.datetime.now().strftime('%Y-%b')
      output_file = 'carne-leao-%s-darf-para-%s.html' % (darf_date, payment_date)
    f = codecs.open(output_file, 'w', 'latin1')
    f.write(darf)
    print('Darf written at', output_file)
