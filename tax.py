#!/usr/local/homebrew/bin/python3

import bisect
import datetime
import re
from lxml.html import parse, submit_form, fromstring, tostring

class LionTax:
  def __init__(self):
    self.tax_table_url = 'http://www.receita.fazenda.gov.br/aliquotas/ContribFont2012a2015.htm'
    self._crawlTaxTable(self.tax_table_url)
    self.tax_table = [
     ]

  def _crawlTaxTable(self, url):
    tree = parse('ContribFont2012a2015.html')
    # open('ContribFont2012a2015.html', 'w').write(tostring(tree, pretty_print=True, method='html').decode('utf-8'))
    headers = tree.xpath("//tr/td[@valign='MIDDLE']")
    values = tree.xpath("//tr/td[@valign='TOP']")
    base = -1
    tax = -1
    deduction = -1
    for i, v in enumerate(values):
      txt = tostring(v).decode('utf-8')
      key = self._findDate(tree, v)
      celltype = i % 3
      if celltype == 0:
        m = re.search(' (\d\.\d\d\d),(\d\d)</span>', txt)
        assert(m)
        base = float(re.sub('\.', '', m.group(1))) + float(m.group(2))/100
      elif celltype == 1:
        m = re.search('>((\d?\d),(\d)|-)</p>', txt)
        assert(m)
        tax = 0
        if m.group(1) != '-':
          tax = float(m.group(2)) + float(m.group(3))/100
      elif celltype == 2:
        m = re.search('>((\d\d\d),(\d\d)|-)</p>', txt)
        assert(m)
        deduction = 0
        if m.group(1) != '-':
          deduction = float(m.group(2)) + float(m.group(3))/100
        print('Date: %s base %f tax %f deduction %f' % (key, base, tax, deduction))

#cell: <td valign="TOP"><span lang="PT-BR">
#                At&#233; 1.499,15</span></td>&#13;
#                
#cell: <td valign="TOP"><span lang="PT-BR">
#                
#                <p align="CENTER">-</p></span></td>&#13;
#                
#cell: <td valign="TOP"><span lang="PT-BR">
#                
#                <p align="CENTER">-</p></span></td>&#13;
#        
#

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
      year = int(m.group(1))
      return datetime.date(year=year, month=month, day=1).isoformat()
    return None



if __name__ == '__main__':
  tax = LionTax()
