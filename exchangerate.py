#!/usr/local/homebrew/bin/python3

import argparse
import shelve
import bisect
import datetime
import json
import dateutil.relativedelta
import dateutil.parser
from urllib.request import urlopen
from urllib.parse import quote_plus, urlencode
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
    self.goog_url = 'http://www.google.com/finance/historical?cid=694653&enddate=%s&num=1'
    self.usdbrl_db = shelve.open(dbpath + '.usdbrl', writeback = True)
    self.goog_db = shelve.open(dbpath + '.goog', writeback = True)

  def _crawlExchangeRate(self, date):
    date_start = date
    date_end = date_start + dateutil.relativedelta.relativedelta(days=+1)
    days_past = 0
    while days_past < 4:  # there is never so many holidays
      url = self.usdbrl_url % (date_start.day, date_start.month, date_start.year,
                               date_end.day, date_end.month, date_end.year)
      print(date_start)
      print(date_end)
      raw = urlopen(url).read().decode('utf-8')
      data = json.loads(raw)
      print(data)
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
    html = urlopen(url).read().decode('utf-8')
    m = re.search('(\d+\.\d\d)\n<td class="rgt rm">', html)
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

if __name__ == '__main__':
  xchgdb = ExchangeRateDB('xchgratio')
  usdbrl = xchgdb.getUSDBRL(sys.argv[1])
  goog = xchgdb.getGOOG(sys.argv[1])
  print('usdbrl: %f goog: %f' % (usdbrl, goog))
  sys.exit(0)
