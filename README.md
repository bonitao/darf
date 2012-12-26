darf
====

São 4 programinhas para calcular o valor do DARF a ser pago ao se receber
ações GOOG através de GSU.

Dependências:

* [Python 3.2][py] ou mais recente
* [dateutil][dateutil]
* [lxml][lxml]

[py]: http://python.org/
[dateutil]: http://labix.org/python-dateutil
[lxml]: http://lxml.de/

exchangerate.py
---------------

Usa UOL e Google Finance para pegar o valor da ação GOOG em uma certa data e o
valor do dólar no último dia útil da primeira quinzena do mês anterior.

    ./exchangerate.py 20-Jan-2012
	usdbrl@15-Dec-2011: 1.860800 goog@20-Jan-2012: 585.990000

A data pode ser digitada em qualquer formato suportado pelo
[`dateutil.parser.parse`][parse].

[parse]: http://labix.org/python-dateutil#head-a23e8ae0a661d77b89dfb3476f85b26f0b30349c

tax.py
------

Realiza uma busca na tabela progressiva do imposto para fazer a mesma conta
que o [carnê-leão][carneleao] faz.

    ./tax.py 5000 2012-Jan
    R$5000.000000 @Jan-2012 gives tax of R$618.470000

O valor de entrada (no exemplo acima, 5000) corresponde à seguinte fórmula:

    num. de ações × valor da ação × cotação do dólar

[carneleao]: http://www.receita.fazenda.gov.br/PessoaFisica/CarneLeao/default.htm

sicalc.py
---------

Recebe o valor de imposto e usa o sicalc para gerar o DARF.

	# cpf com 12 dígitos, mês, valor
    ./sicalc.py 12345678909 2012-Jan 618.47
    Darf written at carne-leao-2012-Jan-darf-para-2012-Aug.html

gsu_irpf.py
-----------

É a cola de todos os programas anteriores. Recebe o CPF e o arquivo CSV
*transaction history* (exportado do [benefitaccess.com][mssb]) e gera todos os
DARFs, incluindo multa e juros se aplicável. Basta apenas escolher os que não
foram pagos e pagá-los.

    ./gsu_irpf.py 12345678909 sample_benefit_access_csv.csv
	2012-08-01: vested 3 shares for total value R$3872.00 (1 GSU = 632.68 @2012-08-01, 1 USD = 2.04 @2012-07-13)
    2012-03-26: vested 5 shares for total value R$5584.24 (1 GSU = 649.33 @2012-03-26, 1 USD = 1.72 @2012-02-15)
    2012-03-25: vested 5 shares for total value R$5526.27 (1 GSU = 642.59 @2012-03-25, 1 USD = 1.72 @2012-02-15)
    ---
    carne leao 2012-03: exterior 11110.51 imposto devido: 2298.86
    carne leao 2012-08: exterior 3872.00 imposto devido: 308.27
    Generated darf carne-leao-2012-Mar-darf-para-2012-Aug.html
    Generated darf carne-leao-2012-Aug-darf-para-2012-Aug.html
    Point your browser to file://.../index.html

[mssb]: http://benefitaccess.com/
