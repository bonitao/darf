#!/usr/bin/env python3

from argparse import ArgumentParser, FileType
from lxml.html import parse, submit_form, fromstring, tostring
import urllib
from urllib.parse import quote_plus, urlencode
from urllib.request import urlopen
import calendar
import codecs
import dateutil.parser
import datetime
import logging
import os
import time
import http.client

http.client.HTTPConnection.debuglevel = 1 

class Sicalc:
  def __init__(self):
    # No https option anymore.
    sicalc_host = 'http://www31.receita.fazenda.gov.br'
    # Also, this triggers a captcha, hence we need a session cookie.
    self.sicalc_aspid = 'NMAGCDJCIDGDLFLOCIPOEIAJ'
    self.sicalc_captcha = 'yrAthTMIMdoDJZESJMH98'


    self.sicalc_princ = '%s/sicalcweb/princ.asp?AP=P&TipTributo=1&FormaPagto=1&UF=MG11&municipiodesc=BELO+HORIZONTE&js=s&ValidadeDaPagina=1&municipio=4123' % sicalc_host
    self.sicalc_pa = '%s/sicalcweb/PeriodoApuracao.asp?AP=P' % sicalc_host
    self.sicalc_venc = '%s/sicalcweb/SelVenc.asp?AP=P' % sicalc_host
    self.sicalc_res = '%s/sicalcweb/resumo.asp?AP=P' % sicalc_host
    self.sicalc_dados = '%s/sicalcweb/DadosContrib.asp?AP=P' % sicalc_host
    self.sicalc_darf = '%s/Darf/MontaSicalcWEBDarf.asp' % sicalc_host

  def MakeRequest(self, url, data):
    opener = urllib.request.build_opener()
    opener.addheaders.append(('Cookie', 'ASPSESSIONIDAADBATAS=%s' % self.sicalc_aspid))
    opener.addheaders.append(('Cookie', 'cookieCaptcha=%s' % self.sicalc_captcha))
    data['idLetra']='ipxp'
    data['idSom']=''
    params = bytes(urlencode(data).encode('utf-8'))
    open('url.txt', 'wb+').write(bytes(url.encode('utf-8')))
    open('data.txt', 'wb+').write(params)
    f = opener.open(url, data=params)
    return f

  def GenerateDarf(self, cpf, monthstr, main_tax):
    month = dateutil.parser.parse(monthstr)
    logging.debug('Starting darf generation from url %s' % self.sicalc_princ)
    tree_princ = parse(self.MakeRequest(self.sicalc_princ, {}))
    # print('hidden params in %s: %s' % (self.sicalc_princ, str(tree_princ.xpath("//input[@type='hidden']"))))
    now = datetime.datetime.now()
    last_day_in_month = datetime.datetime(year=now.year, day=calendar.monthrange(now.year, now.month)[1], month=now.month).strftime('%d/%m/%Y')
    submission_timestamp = str(time.time())
    params = { 'CodReceita': '0190', 'TipoBrowser': 'Darfns.asp', 'TipoAcao': 'I', 'DTUltimoDiaMes': last_day_in_month, 'TipoDarf': '1', 'js':'s', 'DataHoraSubmissao': submission_timestamp}
    for el in tree_princ.xpath("//input[@type='hidden']"):
      params.setdefault(el.name, el.value)
    logging.debug('Second step for darf generation from url %s' % self.sicalc_pa)
    tree_pa = parse(self.MakeRequest(self.sicalc_pa, params))
    print('hidden params in %s: %s' % (self.sicalc_pa, str(tree_pa.xpath("//input[@type='hidden']"))))
    pa = datetime.datetime(month=month.month, year=month.year, day=1)
    formatted_pa = pa.strftime('%m/%Y')
    raw_pa = pa.strftime('%m%Y')
    txt_val_rec = ('%.2f' % main_tax).replace('.', ',')
    params = { 'PADesFormatada': raw_pa, 'periodo': 'ME', 'PA': formatted_pa, 'TxtValRec': txt_val_rec, 'PeriodoAux': 'ME', 'TipoAcao': 'I', 'js': 's'}
    for el in tree_pa.xpath("//input[@type='hidden']"):
      params.setdefault(el.name, el.value)
      logging.debug('Extracted hidden param %s:%s', el.name, el.value)
    dat_pgt_tex = params['DatPgtTex']
    # print('Params for %s: %s' % (self.sicalc_venc, params))
    logging.debug('Third step for darf generation from url %s' % self.sicalc_venc)
    tree_venc = parse(self.MakeRequest(self.sicalc_venc, params))
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
      logging.debug('Extracted hidden param %s:%s', el.name, el.value)
    # print('Params for %s: %s' % (self.sicalc_res, params))
    logging.debug('Forth step for darf generation from url %s' % self.sicalc_venc)
    tree_venc = parse(self.MakeRequest(self.sicalc_venc, params))
    logging.debug('Fifth step for darf generation from url %s' % self.sicalc_res)
    tree_res = parse(self.MakeRequest(self.sicalc_res, params))
    # print('hidden params in %s: %s' % (self.sicalc_res, str(tree_res.xpath("//input[@type='hidden']"))))

    params = { 'Num_Princ': cpf[:-2], 'Num_DV': cpf[-2:], 'TipTributoReceita': '1', 'js': 's' }
    for el in tree_res.xpath("//input[@type='hidden']"):
      logging.debug('Extracted hidden param %s:%s', el.name, el.value)
      params.setdefault(el.name, el.value)
    # print('Params for %s: %s' % (self.sicalc_dados, params))
    logging.debug('Sixth step for darf generation from url %s' % self.sicalc_dados)
    tree_dados = parse(self.MakeRequest(self.sicalc_dados, params))
    # print('hidden params in %s: %s' % (self.sicalc_dados, str(tree_dados.xpath("//input[@type='hidden']"))))

    params = {}
    for el in tree_dados.xpath("//input[@type='hidden']"):
      params.setdefault(el.name, el.value)
    # print('Params for %s: %s' % (self.sicalc_darf, params))
    logging.debug('Seventh step for darf generation from url %s' % self.sicalc_darf)
    darf = self.MakeRequest(self.sicalc_darf, params).read().decode('ISO-8859-1')
    darf = darf.replace('./', 'https://pagamento.serpro.gov.br/Darf/')
    # Remove 404
    darf = darf.replace('<link rel="stylesheet" type="text/css" media="print" href="./estiloDARFprint.css" />', '')
    # pagamento.serpro.gov.br has an expired SSL certificate.
    darf = darf.replace('https://', 'http://')
    return darf

if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument("cpf", help="Cadastro de Pessoa Fisica")
    parser.add_argument('month', type=dateutil.parser.parse)
    parser.add_argument("brl_tax", help="Imposto a pagar (principal)", type=float)
    parser.add_argument("--output_file")
    parser.add_argument("--debug_file", help="File for DEBUG level logging.")
    args = parser.parse_args()
    if args.debug_file:
      logging.basicConfig(level=logging.DEBUG, filename=args.debug_file)

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
