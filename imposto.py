#!/usr/local/homebrew/bin/python3

import bisect
import csv
import calendar
import codecs
import datetime
import dateutil.parser
import io
from urllib.parse import quote_plus, urlencode
from urllib.request import urlopen
from argparse import ArgumentParser, FileType
import os
import re
import sys
import time

import tax
import exchangerate

# http://pypi.python.org/packages/3.2/l/lxml/lxml-2.3.win32-py3.2.exe
from lxml.html import parse, submit_form, fromstring, tostring

class Transaction:
  def __init__(self, transaction_row):
    self.date = datetime.datetime.strptime(transaction_row[0], '%d-%b-%Y').isoformat()
    self.ttype = transaction_row[1]
    self.price = transaction_row[2]  # always zero
    self.usdbrl_date = ''
    self.usdbrl = .0
    self.shares = float(transaction_row[3])
    self.proceeds = transaction_row[4]
    self.balance = transaction_row[5]

def calculate_taxes(benefit_access_csv, cpf, output_dir):

    now_label = datetime.datetime.now().isoformat()
    logfile = open(os.path.join(output_dir, 'carne-leao-%s.txt' % now_label), 'w')
    xchgdb = exchangerate.ExchangeRateDB('xchgrate')
    calculator = tax.LionTax('xchgrate')
    reader = csv.reader(benefit_access_csv)

    income_by_month = {}
    for row in reader:
        if len(row) < 5 or row[0] == 'Transaction Date' or not row[0]:
            continue
        txn = Transaction(row)
        txn.price = xchgdb.getGOOG(txn.date)
        (txn.usdbrl_date, txn.usdbrl) = xchgdb.getTaxUSDBRL(txn.date)
        brl_release_value = txn.price * txn.usdbrl * txn.shares
        format_tuple = (txn.date, txn.shares, brl_release_value,
                        txn.price, txn.date, txn.usdbrl, txn.usdbrl_date)
        logfile.write('%s: vested %d shares for total value R$%.2f (1 GSU = %.2f @ %s, 1 USD = %.2f @ %s)\n' % format_tuple)
        key = dateutil.parser.parse(txn.date).strftime('%Y-%m-01')
        income_by_month.setdefault(key, 0)
        income_by_month[key] += brl_release_value

    for month, income in income_by_month.items():
        main_tax = calculator.calculateTax(month, income)
        line = 'carne leao %s: exterior %.2f imposto devido: %.2f\n' % (month, income, main_tax)
        print(line)
        logfile.write(line)
        continue

        sicalc_princ = 'https://pagamento.serpro.gov.br/sicalcweb/princ.asp?AP=P&TipTributo=1&FormaPagto=1&UF=MG11&municipiodesc=BELO+HORIZONTE&js=s&ValidadeDaPagina=1&municipio=4123' 
        tree_princ = parse(urlopen(sicalc_princ))
        # open('c:\\Users\\Davi\\Desktop\\princ.html', 'wb').write(tostring(tree_princ))
        print('hidden params in %s: %s' % (sicalc_princ, str(tree_princ.xpath("//input[@type='hidden']"))))

        sicalc_pa = 'https://pagamento.serpro.gov.br/sicalcweb/PeriodoApuracao.asp?AP=P'
        now = datetime.datetime.now()
        last_day_in_month = datetime.datetime(year=now.year, day=calendar.monthrange(now.year, now.month)[1], month=now.month).strftime('%d/%m/%Y')
        submission_timestamp = str(time.time())
        params = { 'CodReceita': '0190', 'TipoBrowser': 'Darfns.asp', 'TipoAcao': 'I', 'DTUltimoDiaMes': last_day_in_month, 'TipoDarf': '1', 'js':'s', 'DataHoraSubmissao': submission_timestamp}
        for el in tree_princ.xpath("//input[@type='hidden']"):
            params.setdefault(el.name, el.value)
        params = bytes(urlencode(params).encode('utf-8'))
        print('Params for %s: %s' % (sicalc_pa, params))
        tree_pa = parse(urlopen(sicalc_pa, data = params))
        # open('c:\\Users\\Davi\\Desktop\\pa.html', 'wb').write(tostring(tree_pa))
        print('hidden params in %s: %s' % (sicalc_pa, str(tree_pa.xpath("//input[@type='hidden']"))))

        sicalc_venc = 'https://pagamento.serpro.gov.br/sicalcweb/SelVenc.asp?AP=P'
        pa = datetime.datetime(month=int(month[4:]), year=int(month[:4]), day=1)
        formatted_pa = pa.strftime('%m/%Y')
        raw_pa = pa.strftime('%m%Y')
        txt_val_rec = ('%.2f' % main_tax).replace('.', ',')
        params = { 'PADesFormatada': raw_pa, 'periodo': 'ME', 'PA': formatted_pa, 'TxtValRec': txt_val_rec, 'PeriodoAux': 'ME', 'TipoAcao': 'I', 'js': 's'}
        for el in tree_pa.xpath("//input[@type='hidden']"):
            params.setdefault(el.name, el.value)
        dat_pgt_tex = params['DatPgtTex']
        params = bytes(urlencode(params).encode('utf-8'))
        print('Params for %s: %s' % (sicalc_venc, params))
        tree_venc = parse(urlopen(sicalc_venc, data = params))
        # open('c:\\Users\\Davi\\Desktop\\venc.html', 'wb').write(tostring(tree_venc))
        print('hidden params in %s: %s' % (sicalc_venc, str(tree_venc.xpath("//input[@type='hidden']"))))

        sicalc_res = 'https://pagamento.serpro.gov.br/sicalcweb/resumo.asp?AP=P'
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
        print('Params for %s: %s' % (sicalc_res, params))
        tree_res = parse(urlopen(sicalc_res, data = params))
        # open('c:\\Users\\Davi\\Desktop\\res.html', 'wb').write(tostring(tree_res))
        print('hidden params in %s: %s' % (sicalc_res, str(tree_res.xpath("//input[@type='hidden']"))))

        sicalc_dados = 'https://pagamento.serpro.gov.br/sicalcweb/DadosContrib.asp?AP=P'
        params = { 'Num_Princ': cpf[:-2], 'Num_DV': cpf[-2:], 'TipTributoReceita': '1', 'js': 's' }
        for el in tree_res.xpath("//input[@type='hidden']"):
            params.setdefault(el.name, el.value)
        params = bytes(urlencode(params).encode('utf-8'))
        print('Params for %s: %s' % (sicalc_dados, params))
        tree_dados = parse(urlopen(sicalc_dados, data = params))
        # open('c:\\Users\\Davi\\Desktop\\dados.html', 'wb').write(tostring(tree_dados))
        print('hidden params in %s: %s' % (sicalc_dados, str(tree_dados.xpath("//input[@type='hidden']"))))

        sicalc_darf = 'https://pagamento.serpro.gov.br/Darf/MontaSicalcWEBDarf.asp'
        params = {}
        for el in tree_dados.xpath("//input[@type='hidden']"):
            params.setdefault(el.name, el.value)
        params = bytes(urlencode(params).encode('utf-8'))
        print('Params for %s: %s' % (sicalc_darf, params))
        darf = urlopen(sicalc_darf, data = params).read().decode('ISO-8859-1')
        darf = darf.replace('./', 'https://pagamento.serpro.gov.br/Darf/')
        # Remove 404
        darf = darf.replace('<link rel="stylesheet" type="text/css" media="print" href="./estiloDARFprint.css" />', '')
        f = codecs.open(os.path.join(output_dir, 'carne-leao-%s-darf-%s.html' % (now_label, month)), 'w', 'latin1')
        f.write(darf)


if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument("cpf", help="Cadastro de Pessoa Fisica")
    parser.add_argument("benefit_access_csv", help="File from benefitaccess.com", type=FileType('r'))
    parser.add_argument("-o", "--output_dir", default="./darfs", help="Output directory")
    args = parser.parse_args()
    if not os.path.isdir(args.output_dir):
      os.makedirs(args.output_dir)
    calculate_taxes(args.benefit_access_csv, args.cpf, args.output_dir)
