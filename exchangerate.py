#!/usr/local/homebrew/bin/python3

import argparse
import logging
import shelve
import bisect
import datetime
import json
import dateutil.relativedelta
import dateutil.parser
from urllib.request import urlopen
from urllib.parse import quote_plus, urlencode
from argparse import ArgumentParser, FileType
import os
import re
import sys

"""
Caching for uol web service on USD/BRL exchange ratio and Google Finance GOOG.

This class could get all its data from a single call with a large range for the
web service, but this demands understanding more of the service data formats
that I care.
"""
class ExchangeRateDB:
  def __init__(self, dbpath):
    self.usdbrl_url = 'http://cotacoes.economia.uol.com.br/cambioJSONChart.html?type=range&cod=BRL&mt=off&begin=%d/%d/%d&end=%d/%d/%d'
    # Needs to use num=2 because Google not always give the exact date with
    # num=2. For example, it gives me Jul 12 values for 11 Jul 2012. With num=2
    # we can scan for the right date inside the page.
    self.goog_url = 'http://www.google.com/finance/historical?cid=694653&enddate=%s&num=2'
    self.usdbrl_db = shelve.open(dbpath + '.usdbrl', writeback = True)
    self.goog_db = shelve.open(dbpath + '.goog', writeback = True)

  def _crawlExchangeRate(self, date):
    date_start = date
    date_end = date_start + dateutil.relativedelta.relativedelta(days=+1)
    days_past = 0
    while days_past < 4:  # there is never so many holidays
      url = self.usdbrl_url % (date_start.day, date_start.month, date_start.year,
                               date_end.day, date_end.month, date_end.year)
      logging.debug('Getting usdbrl from %s' % url)
      raw = urlopen(url).read().decode('utf-8')
      data = json.loads(raw)
      if len(data[1]) == 0:
         days_past += 1
         date_start = date_start + dateutil.relativedelta.relativedelta(days=-1)
         continue
      assert(len(data[1]) == 1 or len(data[1]) == 2)
      day = data[1][0]
      xchg = float(day['ask'])
      ts = day['ts']
      unused_usd_closing_date =datetime.date.fromtimestamp(
           day['ts']/1000).isoformat()
      key = date.isoformat()
      self.usdbrl_db.setdefault(key, xchg)
      return

  def _crawlGoogValue(self, date):
    url = self.goog_url % quote_plus(date.strftime('%d %b, %Y'))
    logging.debug('Getting goog from %s' % url)
    html = urlopen(url).read().decode('utf-8')
    days_past = 0
    m = None
    while days_past < 4:  # there is never so many holidays
      delta = dateutil.relativedelta.relativedelta(days=(-1*days_past))
      scan_date = date + delta
      html_date = scan_date.strftime('%b %d, %Y').replace(' 0', ' ')
      pattern = '<td class="lm">%s.*?(\d+\.\d\d)\n<td class="rgt rm">' % html_date
      logging.debug('Scanning html for pattern %s' % pattern)
      regexp = re.compile(pattern, re.MULTILINE | re.DOTALL)
      m = regexp.search(html)
      if m:
        break
      else:
        days_past = days_past + 1
    goog_value = float(m.group(1))  # last match, closing time
    assert(goog_value > 100 and goog_value < 1000)
    key = date.isoformat()
    self.goog_db.setdefault(key, goog_value)

  def _getKey(self, datestr):
    date = dateutil.parser.parse(datestr)
    date = datetime.date(date.year, date.month, date.day)
    return date, date.isoformat()

  def getUSDBRL(self, datestr):
    (date, key) = self._getKey(datestr)
    if not key in self.usdbrl_db:
      self._crawlExchangeRate(date)
    return self.usdbrl_db[key]

  def getGOOG(self, datestr):
    (date, key) = self._getKey(datestr)
    if not key in self.goog_db:
      self._crawlGoogValue(date)
    return self.goog_db[key]

  def getTaxUSDBRL(self, datestr):
    # http://economia.uol.com.br/impostoderenda/ultimas-noticias/infomoney/2012/03/06/ir-2012-rendimentos-e-pagamentos-em-dolar-devem-ser-convertidos.jhtm
    # http://www.receita.fazenda.gov.br/pessoafisica/irpf/2012/perguntao/perguntas/pergunta-156.htm
    date = dateutil.parser.parse(datestr)
    taxdate = date + dateutil.relativedelta.relativedelta(months=-1)
    taxdate = datetime.date(taxdate.year, taxdate.month, day=15)
    # GetUSDBRL will use the last workday regardless of holiday. We just do the
    # weekend test for debugging convenience.
    while taxdate.weekday() > 4:
      taxdate = taxdate + dateutil.relativedelta.relativedelta(days=-1)
    key = taxdate.isoformat()
    return (key, self.getUSDBRL(key))

if __name__ == '__main__':
  parser = ArgumentParser()
  parser.add_argument("date", help="The date to retrieve exchange rate for.",
                       type=dateutil.parser.parse)
  parser.add_argument("--debug_file", help="File for DEBUG level logging.")
  args = parser.parse_args()
  if args.debug_file:
    logging.basicConfig(level=logging.DEBUG, filename=args.debug_file)
  xchgdb = ExchangeRateDB('xchgrate')
  goog = xchgdb.getGOOG(args.date.isoformat())
  date, usdbrl = xchgdb.getTaxUSDBRL(args.date.isoformat())
  print('usdbrl@%s: %f goog@%s: %f' % (
      dateutil.parser.parse(date).strftime('%d-%b-%Y'), usdbrl,
      args.date.strftime('%d-%b-%Y'), goog))
  sys.exit(0)
