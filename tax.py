#!/usr/bin/env python3

# Crazy pickle wants this here
class TaxTableEntry:
  def __init__(self, date, base, tax, deduction):
    self.date = date
    self.base = base
    self.tax = tax
    self.deduction = deduction

import bisect
import datetime
import dateutil.parser
import re
import shelve
import sys
from lxml.html import parse, submit_form, fromstring, tostring
from argparse import ArgumentParser, FileType

class LionTax:
  def __init__(self, dbpath):
    self.tax_table_url = 'http://www.receita.fazenda.gov.br/aliquotas/ContribFont2012a2015.htm'

    try:
      self.tax_table = shelve.open(dbpath + '.lion', 'r')
    except:
      self.tax_table = shelve.open(dbpath + '.lion', writeback = True)
    for entry in self._crawlTaxTable(self.tax_table_url):
      key = '%s:%s' % (entry.date, format(entry.base, '010.2f'))
      self.tax_table.setdefault(key, entry)

  def _crawlTaxTable(self, url):
    tree = parse(self.tax_table_url)
    headers = tree.xpath("//tr/td[@valign='MIDDLE']")
    values = tree.xpath("//tr/td[@valign='TOP']")
    base = -1
    tax = -1
    deduction = -1
    for i, v in enumerate(values):
      txt = tostring(v).decode('utf-8')
      date = self._findDate(tree, v)
      celltype = i % 3
      if celltype == 0:
        m = re.search(' (\d\.\d\d\d),(\d\d)\s*</span>', txt)
        assert(m)
        base = float(re.sub('\.', '', m.group(1))) + float(m.group(2))/100
        if 'Acima' in txt:
          base = float("inf")
      elif celltype == 1:
        m = re.search('<p[^>]*>\s*((\d?\d),(\d)|-)\s*</p>', txt)
        assert(m)
        tax = 0
        if m.group(1) != '-':
          tax = float(m.group(2)) + float(m.group(3))/10
      elif celltype == 2:
        m = re.search('<p[^>]*>\s*((\d\d\d),(\d\d)|-)\s*</p>', txt)
        assert(m)
        deduction = 0
        if m.group(1) != '-':
          deduction = float(m.group(2)) + float(m.group(3))/100
        yield TaxTableEntry(date, base, tax, deduction)

  def _findDate(self, tree, node):
    month_regexp = re.compile('nos meses de (\w+) a \w+')
    year_regexp = re.compile('Tabelas? Progressivas? para .*? de (\d{4}), .*? de (\d{4})', re.MULTILINE | re.DOTALL)
    nodeyear = None
    nodemonth = None

    years = []
    for y in tree.xpath("//p"):
      if re.search(year_regexp, tostring(y).decode('utf-8')):
        years += [y]

    for n in tree.iter():
      if n in years:
        nodeyear = n
      if n == node:
        break

    inyear = False
    for n in tree.iter():
      if n in years:
        inyear = (n == nodeyear)
        continue
      if not inyear:
        continue
      if re.search(month_regexp, tostring(n).decode('utf-8')):
        nodemonth = n
      if n == node:
        break

    month = 1
    if nodemonth is not None:
      m = re.search(month_regexp, tostring(nodemonth).decode('utf-8'))
      if m.group(1) == 'janeiro':
        month = 1
      elif m.group(1) == 'abril':
        month = 4
      else:
        assert(False)
    year = 0
    if nodeyear is not None:
      m = re.search(year_regexp, tostring(nodeyear).decode('utf-8'))
      year = int(m.group(2))
      return datetime.date(year=year, month=month, day=1)
    return None

  def calculateTax(self, datestr, value):
    date = dateutil.parser.parse(datestr)
    date = datetime.date(year=date.year, month=date.month, day=date.day)
    # Linear sort is simple because otherwise we need to break date and value
    # components
    key = '%s:%s' % (date, format(value, '010.2f'))
    entry_key = None
    entry = None
    for k, v in sorted(self.tax_table.items()):
      if v.date > date:
        break
      if value < v.base:
        if entry is None or entry.date != v.date:
          entry_key = k
          entry = v
    tax = value * (entry.tax/100) - entry.deduction
    return tax


if __name__ == '__main__':
  parser = ArgumentParser()
  parser.add_argument('brl_income', type=float)
  parser.add_argument('month', type=dateutil.parser.parse)
  args = parser.parse_args()
  calculator = LionTax('xchgrate')
  tax = calculator.calculateTax(args.month.isoformat(), args.brl_income)
  print('R$%f @%s gives tax of R$%f' %(args.brl_income, args.month.strftime('%b-%Y'), tax))
