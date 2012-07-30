#!/usr/bin/python

import bisect
import csv
import calendar
import codecs
import datetime
import io
from urllib2 import urlopen
from urllib import quote_plus, urlencode
# from urllib.parse import quote_plus, urlencode
# from urllib.request import urlopen
from optparse import OptionParser
import os
import re
import sys
import time

# http://pypi.python.org/packages/3.2/l/lxml/lxml-2.3.win32-py3.2.exe
from lxml.html import parse, submit_form, fromstring, tostring

def calculate_taxes(benefit_access_csv, cpf, output_dir):

    now_label = datetime.datetime.now().strftime('%Y-%m-%d')
    logfile = open(os.path.join(output_dir, 'carne-leao-%s.txt' % now_label), 'w')
    print(benefit_access_csv)
    usd_exchange_table = get_usd_exchange()
    reader = csv.reader(open(benefit_access_csv))

    income_by_month = {}
    for row in reader:
        if len(row) < 2:
            continue
        if row[1] != 'Release':
            continue
        release_date = datetime.datetime.strptime(row[0], '%d-%b-%Y')
        share_count = float(row[3])
        if release_date.strftime('%Y%m%d') < usd_exchange_table[0][0]:  # no usd exchange data before that
            print("Skipping %d shares released at %s" % (share_count, row[0]))
            continue

        # Get share value from Google Finance
        formatted_release_date = quote_plus(release_date.strftime('%d %b, %Y'))
        share_value_url = 'http://www.google.com/finance/historical?cid=694653&enddate=%s&num=1' % formatted_release_date
        share_value_html = str(urlopen(share_value_url).read())
        # Use Close value as done in the Benefit Access letter
        m = re.search('(\d+\.\d\d)\n<td class="rgt rm">', share_value_html)
        share_value = float(m.group(1))  # last match, closing time
        assert(share_value > 100 and share_value < 1000)


        # From http://www.receita.fazenda.gov.br/PessoaFisica/IRPF/2010/Perguntas/CarneLeao.htm#
        # and from http://www.edsouza.net/declarar-imposto-de-renda-de-moeda-estrangeira-dolar-euro-etc
        usd_exchange_date = release_date
        while usd_exchange_date.day > 15 or usd_exchange_date.month == release_date.month:
            usd_exchange_date -= datetime.timedelta(days=1)
        key = (usd_exchange_date.strftime('%Y%m%d'), 0)
        usd_exchange = bisect.bisect_left(usd_exchange_table, key)
        if usd_exchange == 0:
            print("Skipping %d shares released at %s. No USD information." % (share_count, row[0]))
            continue
        (usd_date, usd_value) = usd_exchange_table[usd_exchange]
        brl_release_value = usd_value * share_value * share_count
        format_tuple = (release_date.strftime('%Y-%m-%d'), share_count, brl_release_value,
                        share_value, release_date.strftime('%Y%m%d'), usd_value, usd_date)
        logfile.write('%s: vested %d shares for total value R$%.2f (1 GSU = %.2f @ %s, 1 USD = %.2f @ %s)\n' % format_tuple)
        key = release_date.strftime('%Y%m')
        income_by_month.setdefault(key, 0)
        income_by_month[key] += brl_release_value

    for month, income in income_by_month.items():
        # http://www.receita.fazenda.gov.br/aliquotas/tabprogressivacalcmens.htm
        main_tax = 0
        table = None
        if month in ['201201', '201202', '201203']:
            table = [(0, 0), (1566.61, 7.5), (2347.85, 15), (3130.51, 22.5), (3911.63, 27.5)]
        # elif month.startswith('2012'):
        #    table = [(0, 0), (1499.15, 7.5), (2246.75, 15), (2995.70, 22.5), (3743.19, 27.5)]
        if month.startswith('2011'):
            table = [(0, 0), (1499.15, 7.5), (2246.75, 15), (2995.70, 22.5), (3743.19, 27.5)]
        if month.startswith('2010'):
            table = [(0, 0), (1434.59, 7.5), (2150.00, 15), (2866.70, 22.5), (3582.00, 27.5)]
        remainder = income
        for i in range(len(table) - 1):
            interval = (table[i + 1][0] - table[i][0])
            main_tax += interval * (table[i][1]/100)
            remainder -= interval
            print (interval, interval * (table[i][1]/100))
        print (remainder, remainder * (table[-1][1]/100))
        main_tax += remainder * (table[-1][1]/100)
        logfile.write('carne leao %s: exterior %.2f imposto devido: %.2f\n' % (month, income, main_tax))

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


def get_usd_exchange():
    # Uses the form from the url below converted from POST to GET using frmget bookmarklet
    # http://www4.bcb.gov.br/pec/taxas/port/ptaxnpesq.asp?id=txcotacao
    # The form never gives me more than 2 years even bypassing the javascript check, so adjust dates for it
    now = datetime.datetime.now()
    begin_date = quote_plus(datetime.datetime(now.year - 1, day=1, month=1).strftime('%d/%m/%Y'))
    end_date = quote_plus(now.strftime('%d/%m/%Y'))
    bc_url = 'http://www4.bcb.gov.br/pec/taxas/port/PtaxRPesq.asp?RadOpcao=1&DATAINI=%s&DATAFIM=%s&ChkMoeda=220&butao=Pesquisar&OPCAO=1&MOEDA=220&DESCMOEDA=DOLAR-DOS-EUA&TxtOpcao5=DOLAR-DOS-EUA&TxtOpcao4=220&BOLETIM=' % (begin_date, end_date)
    print(bc_url)
    bc_html = str(urlopen(bc_url).read())
    print(bc_html)
    m = re.search("http://www4.bcb.gov.br/download/cotacoes/BC\d+.csv", bc_html)
    assert(m)
    bc_csv = urlopen(m.group()).read().decode('utf-8')
    print(bc_csv)
    reader = csv.reader(io.StringIO(bc_csv), delimiter=';', lineterminator='\r\n')
    ret = []
    for row in reader:
        if len(row) < 5:  # trailing blank
            continue
        d = datetime.datetime.strptime(str(row[0]), '%d%m%Y')
        usd_exchange_buy = float(str(row[4]).replace(',', '.'))
        ret.append((d.strftime('%Y%m%d'), usd_exchange_buy))
    ret.sort()
    return ret

    #usd_ratio

if __name__ == '__main__':
    parser = OptionParser()
    parser.add_option("-c", "--cpf", help="Cadastro de Pessoa Fisica")
    parser.add_option("-b", "--benefit_access_csv", help="File from benefitaccess.com")
    parser.add_option("-o", "--output_dir", default="./imposto", help="Output directory")
    (options, args) = parser.parse_args()
    if not os.path.isdir(options.output_dir):
      os.makedirs(options.output_dir)
    cpf = options.cpf.replace('-', '')
    calculate_taxes(options.benefit_access_csv, cpf, options.output_dir)
