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
import logging
import os
import re
import sys
import time

import exchangerate
import sicalc
import tax

# http://pypi.python.org/packages/3.2/l/lxml/lxml-2.3.win32-py3.2.exe
from lxml.html import parse, submit_form, fromstring, tostring

class Transaction:
  def __init__(self, transaction_row):
    pdate = datetime.datetime.strptime(transaction_row[0], '%d-%b-%Y')
    self.date = datetime.date(pdate.year, pdate.month, pdate.day).isoformat()
    self.ttype = transaction_row[1]
    self.price = transaction_row[2]  # always zero
    self.usdbrl_date = ''
    self.usdbrl = .0
    self.shares = float(transaction_row[3])
    self.proceeds = transaction_row[4]
    self.balance = transaction_row[5]

class GsuIrpf:
  def __init__(self, output_dir):
    current_month_label = datetime.datetime.now().strftime('%Y-%b')
    self.logfile_name = os.path.join(
      output_dir, 'gsu-irpf-log-%s.txt' % current_month_label)
    self.logfile = open(self.logfile_name, 'w')
    self.output_dir = output_dir
    self.xchgdb = exchangerate.ExchangeRateDB('xchgrate')
    self.calculator = tax.LionTax('xchgrate')
    self.sicalc = sicalc.Sicalc()
    self.darf_css='https://pagamento.serpro.gov.br/Darf/estiloDARF.css'

  def _ParseTransactions(self, benefit_access_csv):
    reader = csv.reader(benefit_access_csv)
    for row in reader:
      if len(row) < 5 or row[0] == 'Transaction Date' or not row[0]:
        continue
      txn = Transaction(row)
      if txn.ttype != 'Release':
        logging.debug('Skipped transaction %s @%s' % (txn.ttype, txn.date))
        continue
      if dateutil.parser.parse(txn.date).year < 2012:
        logging.debug('Skipped transaction %s @%s previous to 2012.' %(txn.ttype, txn.date))
        continue
      txn.price = round(self.xchgdb.getGOOG(txn.date)*100)/100
      (txn.usdbrl_date, txn.usdbrl) = self.xchgdb.getTaxUSDBRL(txn.date)
      txn.usdbrl = round(txn.usdbrl*100)/100
      yield txn

  def _print(self, line):
    logging.debug(line)
    self.logfile.write(line + '\n')
    print(line)
    sys.stdout.flush()


  def Generate(self, benefit_access_csv, cpf, startdate):
    income_by_month = {}
    transactions = self._ParseTransactions(benefit_access_csv)
    for txn in transactions:
      brl_release_value = round(txn.price * txn.usdbrl * txn.shares * 100)/100
      format_tuple = (txn.date, txn.shares, brl_release_value,
                      txn.price, txn.date, txn.usdbrl, txn.usdbrl_date)
      line = '%s: vested %d shares for total value R$%.2f (1 GSU = %.2f @%s, 1 USD = %.2f @%s)' % format_tuple
      self._print(line)
      key = dateutil.parser.parse(txn.date).strftime('%Y-%m')
      income_by_month.setdefault(key, 0)
      income_by_month[key] += brl_release_value

    if income_by_month:
      self._print('---')

    index_file = os.path.join(self.output_dir, 'index.html')
    index = open(index_file, 'w')
    index.write('<html><head/><body><a href="%s">Click me</a> to fix ssl permissions if having rendering issues.<br/><br/>' % self.darf_css)
    index.write('Tax computation <a href="file://%s">log</a><br/><br/>' % os.path.abspath(self.logfile_name))

    summary = {}
    for month, income in sorted(income_by_month.items()):
      main_tax = self.calculator.calculateTax(month, income)
      line = 'carne leao %s: exterior %.2f imposto devido: %.2f' % (month, income, main_tax)
      summary.setdefault(month, line)
      self._print(line)

    for month, income in sorted(income_by_month.items()):
      main_tax = self.calculator.calculateTax(month, income)
      darf = self.sicalc.GenerateDarf(cpf, month, main_tax)
      darf_date = dateutil.parser.parse(month).strftime('%Y-%b')
      payment_date = datetime.datetime.now().strftime('%Y-%b')
      output_file = 'carne-leao-%s-darf-para-%s.html' % (darf_date, payment_date)
      self._print('Generated darf %s' % output_file)
      output_file = os.path.join(self.output_dir, output_file)
      index.write('%s <-> <a href="file://%s">print</a><br/>\n' % (summary[month], os.path.abspath(output_file)))
      f = codecs.open(output_file, 'w', 'latin1')
      f.write(darf)
    index.write('</body></html>')

if __name__ == '__main__':
  parser = ArgumentParser()
  parser.add_argument("cpf", help="Cadastro de Pessoa Fisica")
  parser.add_argument("benefit_access_csv", help="File from benefitaccess.com", type=FileType('r'))
  parser.add_argument("-o", "--output-dir", default="./darfs", help="Output directory")
  parser.add_argument("-s", "--start-date", default="1970-1-1", type=dateutil.parser.parse,
                      help="Ignore any transactions previous to this date.")
  args = parser.parse_args()

  if not os.path.isdir(args.output_dir):
    os.makedirs(args.output_dir)
  logging.basicConfig(level=logging.DEBUG,
                      filename=os.path.join(args.output_dir, 'debug.log'))

  gsu_irpf = GsuIrpf(args.output_dir)
  gsu_irpf.Generate(args.benefit_access_csv, args.cpf, args.start_date)
  index_file = os.path.abspath(os.path.join(args.output_dir, 'index.html'))
  print('Point your browser to file://%s' % index_file)
