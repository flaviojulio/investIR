import csv
import sqlite3
from contextlib import contextmanager
# import sys # Removed
# import os # Removed

# Caminho para o banco de dados SQLite
DATABASE_FILE = "acoes_ir.db"

# CSV data as a multiline string
CSV_DATA = """Ticker;Nome;Negocios;Última Negociacao;Variacao
AALR3;ALLIAR;8.707;11,59;+1,67%
ABCB4;ABC BRASIL;10.434;23,19;+2,25%
ABEV3;AMBEV S/A;34.578;12,47;-0,40%
AERI3;AERIS;5.197;0,70;-1,41%
AESB3;AES BRASIL;9.608;9,85;-0,91%
AGRO3;BRASILAGRO;3.080;25,30;+0,20%
ALLD3;ALIANSCE SONAE;3.719;23,30;+0,95%
ALPA4;ALPARGATAS;17.410;8,89;-1,33%
ALUP11;ALUPAR;12.900;30,11;+0,53%
AMAR3;MARISA LOJAS;4.308;0,70;-2,78%
AMBP3;AMBIPAR;2.157;14,00;-0,28%
ANIM3;ANIMA;5.779;3,76;-0,27%
ARML3;ARMAC;2.828;14,00;+1,01%
ARZZ3;AREZZO CO;3.472;64,31;+0,30%
ASAI3;ASSAI;28.104;13,16;-0,08%
AURE3;AUREN;6.250;14,07;-0,42%
AZUL4;AZUL;30.972;13,79;-0,86%
B3SA3;B3;57.099;13,20;+0,08%
BBAS3;BRASIL;58.397;54,00;+0,48%
BBDC3;BRADESCO;26.005;13,28;+0,30%
BBDC4;BRADESCO;101.796;14,83;+0,47%
BBSE3;BBSEGURIDADE;15.298;34,06;+1,25%
BEEF3;MINERVA;10.559;9,70;+0,21%
BHIA3;CASAS BAHIA;27.497;0,51;-1,92%
BLAU3;BLAU;1.176;14,50;+1,33%
BMGB4;BANCO BMG;3.922;2,40;+0,42%
BMIN4;BANCO MERCANTIL;1;10,75;+0,09%
BMOB3;BEMOBI TECH;1.491;3,83;+2,13%
BPAC11;BTGP BANCO;22.970;33,39;+1,40%
BPAN4;BANCO PAN;11.916;7,77;+1,57%
BRAP4;BRADESPAR;4.793;22,07;+0,41%
BRFS3;BRF SA;30.184;14,21;+0,42%
BRKM5;BRASKEM;9.639;18,05;-0,77%
BRSR6;BANRISUL;5.252;12,00;+0,50%
CAMB3;CAMBUCI;390;1,86;-0,53%
CAML3;CAMIL;3.970;7,60;+0,26%
CARD3;MAPFRE REGS;2.561;12,01;-1,72%
CASH3;MELIUZ;11.495;7,10;-0,28%
CBAV3;CBA;1.228;4,00;+1,01%
CCRO3;CCR SA;15.797;13,13;+1,16%
CEAB3;CEA;6.041;3,90;-0,26%
CIEL3;CIELO;27.037;4,92;+0,20%
CMIG3;CEMIG;4.560;18,08;+0,33%
CMIG4;CEMIG;39.623;11,70;+0,60%
CMIN3;CSNMINERACAO;13.070;6,51;+1,24%
COGN3;COGNA ON;30.732;2,43;-0,41%
CPFE3;CPFL ENERGIA;4.952;37,52;+0,94%
CPLE6;COPEL;14.403;9,21;+0,88%
CRFB3;CARREFOUR BR;9.805;10,21;-0,20%
CSAN3;COSAN;22.085;18,75;+0,97%
CSMG3;COPASA;3.866;19,45;+0,88%
CSNA3;SID NACIONAL;13.562;16,36;+1,05%
CURY3;CURY S/A;2.024;18,06;+0,84%
CVCB3;CVC BRASIL;17.363;2,88;-0,69%
CYRE3;CYRELA REALT;10.405;22,20;+1,23%
DASA3;DASA;3.953;3,98;-0,50%
DESK3;DESKTOP SIGA;672;11,90;-0,50%
DIRR3;DIRECIONAL;3.010;22,95;+0,09%
DXCO3;DEXCO;6.623;7,77;+0,78%
ECOR3;ECORODOVIAS;11.086;8,08;+0,87%
EGIE3;ENGIE BRASIL;5.052;44,10;+0,41%
ELET3;ELETROBRAS;25.253;38,99;+0,91%
ELET6;ELETROBRAS;18.172;43,20;+0,93%
EMBR3;EMBRAER;28.527;22,22;+0,91%
ENAT3;ENAUTA PART;5.797;19,03;-0,47%
ENEV3;ENEVA;14.441;12,63;+0,72%
ENGI11;ENERGISABR;6.667;44,57;+0,38%
EQMA3B;EQUATORIALMA;1;7,65;+1,19%
EQPA3B;EQUATORIALPA;1;11,65;+0,87%
EQTL3;EQUATORIAL;27.219;32,52;+0,46%
ESPA3;ESPACOLASER;1.196;1,60;-1,23%
EVEN3;EVEN;2.564;7,72;+0,39%
EZTC3;EZTEC;3.772;16,46;+0,43%
FESA4;FERBASA;1.706;41,53;+0,05%
FLRY3;FLEURY;7.199;14,63;+0,48%
FRAS3;FRAS-LE;2.979;17,35;+0,29%
GFSA3;GAFISA;6.571;4,94;-1,20%
GGBR4;GERDAU;25.318;21,70;+0,56%
GGPS3;GPS;1.655;17,00;+0,18%
GMAT3;GRUPOMATEUS;4.958;7,76;+0,39%
GOAU4;GERDAU MET;14.084;10,13;+0,50%
GOLL4;GOL;25.835;6,13;-1,45%
GRND3;GRENDENE;3.323;6,80;+0,15%
GUAR3;GUARARAPES;5.355;6,25;-1,26%
HAPV3;HAPVIDA;42.293;4,01;-0,74%
HBSA3;HIDROVIAS;2.528;3,30;+1,54%
HYPE3;HYPERA;7.975;33,02;+0,52%
IFCM3;IOCHP-MAXION;2.588;12,01;-0,08%
IGTI11;IGUATEMI S.A;4.490;22,71;+1,02%
INTB3;INTELBRAS;1.800;25,80;+0,19%
IRBR3;IRBBRASIL RE;14.630;40,63;-0,42%
ITSA4;ITAUSA;71.701;10,10;+0,30%
ITUB3;ITAUUNIBANCO;19.406;29,49;+0,24%
ITUB4;ITAUUNIBANCO;76.438;32,63;+0,37%
JALL3;JALLES MACHADO;850;7,50;0,00%
JHSF3;JHSF PART;6.888;4,90;+0,20%
KEPL3;KEPLER WEBER;1.923;9,70;+1,04%
KLBN11;KLABIN S/A;15.946;21,52;+0,94%
LAVV3;LAVVI;960;8,00;+1,27%
LEVE3;METAL LEVE;2.289;35,96;+0,11%
LIGT3;LIGHT S/A;11.160;4,89;-0,20%
LJQQ3;LOJAS QUERO QUERO;1.721;4,07;-0,49%
LOGG3;LOG COM PROP;2.676;20,93;+0,67%
LREN3;LOJAS RENNER;25.024;14,75;+0,20%
LWSA3;LOCAWEB;12.500;5,26;-0,19%
MATD3;MAT D DIASBEN;2.028;34,89;+0,09%
MDNE3;MOURA DUBEUX;968;10,78;+0,75%
MEAL3;IMC S/A;3.697;2,10;-1,41%
MEGA3;OMEGA ENERGIA;1.297;11,01;-0,18%
MGLU3;MAGAZ LUIZA;101.579;2,06;-1,44%
MLAS3;MULTILASER;2.829;2,08;-0,95%
MOAR3;MONT ARANHA;42;10,50;+0,10%
MODL11;MODALMAIS;1;2,50;-1,19%
MOVI3;MOVIDA;10.632;11,75;+0,17%
MRFG3;MARFRIG;9.438;9,62;+0,52%
MRVE3;MRV;13.089;9,23;+0,76%
MTRE3;MITRE REALTY;1.698;5,60;+0,18%
MULT3;MULTIPLAN;6.222;27,01;+1,16%
MYPK3;IOCHPE MAXION;4.155;12,00;-0,17%
NEOE3;NEOENERGIA;8.397;18,86;+0,75%
NTCO3;GRUPO NATURA;12.484;15,03;-0,46%
ONCO3;ONCOCLINICAS;3.284;6,08;+0,33%
OPCT3;OCEANPACT;1.257;6,90;+0,29%
ORVR3;ORIZON;1.486;37,99;+0,50%
PAGS34;PAGSEGURO DIGITAL;2.846;11,18;+0,45%
PARD3;HERMES PARDINI;1.401;20,02;+0,50%
PASS3;PORTO SEGURO;1.209;27,00;+0,37%
PCAR3;P.ACUCAR-CBD;20.855;3,66;-1,88%
PETR3;PETROBRAS;56.075;39,11;+0,54%
PETR4;PETROBRAS;141.169;37,00;+0,46%
PETZ3;PETZ;12.532;3,70;-1,07%
PFRM3;PROFARMA;1.469;4,27;+0,23%
PGMN3;PAGUE MENOS;3.779;3,36;-0,30%
PLPL3;PLANOEPLANO;1.771;44,65;+0,90%
PNVL3;DIMED;2.455;11,65;+0,60%
PORT3;PORTO;1.203;27,05;+0,56%
POSI3;POSITIVO TEC;5.023;7,60;+0,26%
PRIO3;PETRORIO;33.421;45,70;+0,11%
QUAL3;QUALICORP;10.806;3,99;-0,75%
RADL3;RAIADROGASIL;12.951;27,00;+0,30%
RAIL3;RUMO S.A.;26.441;22,39;+0,90%
RAIZ4;RAIZEN;17.014;3,62;+0,28%
RDOR3;REDE DOR;14.108;25,81;+0,86%
RECV3;PETRORECSA;3.914;21,20;-0,05%
RENT3;LOCALIZA;21.720;58,09;+0,43%
RRRP3;3R PETROLEUM;17.152;27,40;-0,11%
SANB11;SANTANDER BR;11.389;28,00;+0,58%
SAPR11;SANEPAR;3.716;23,50;+1,16%
SBFG3;GRUPO SBF;4.499;9,60;-1,54%
SEER3;SER EDUCA;2.095;5,00;0,00%
SGPS3;SPRINGSMCS;1;2,90;+1,40%
SHOW3;TIME FOR FUN;1.609;1,98;-1,00%
SIMH3;SIMPAR;4.388;8,59;+0,35%
SLCE3;SLC AGRICOLA;2.884;40,15;+0,17%
SMFT3;SMARTFIT;4.550;22,88;+0,57%
SMTO3;SAO MARTINHO;3.215;29,45;+0,10%
SOJA3;BOA SAFRA SB;1.008;10,18;-0,20%
SOMA3;GRUPO SOMA;8.880;7,01;-0,71%
SQIA3;SYNQIA;2.323;18,18;+0,11%
STBP3;SANTOS BRP;9.090;11,58;+1,14%
SUBS3;SUBSEA 7;1;82,00;+1,32%
SUZB3;SUZANO S.A.;16.414;50,75;+0,80%
SYNE3;SYN PROP TEC;613;5,00;+1,42%
TAEE11;TAESA;12.545;35,81;+0,36%
TASA4;TAURUS ARMAS;4.137;15,00;-0,20%
TEND3;TENDA;3.765;10,98;+0,64%
TFCO4;TRACK FIELD;1;10,40;+0,19%
TIMS3;TIM;13.408;17,00;+0,71%
TOTS3;TOTVS;10.703;29,41;+0,34%
TRAD3;TRADERS CLUB;1.158;1,08;-0,92%
TRIS3;TRISUL;2.087;5,42;+1,12%
TRPL4;TRAN PAULIST;4.317;25,56;+0,31%
TUPY3;TUPY;3.090;27,00;+0,75%
UGPA3;ULTRAPAR;27.185;24,07;+0,46%
UNIP6;UNIPAR;2.478;69,29;+0,67%
USIM5;USIMINAS;28.879;7,06;+0,14%
VALE3;VALE;83.014;68,68;+0,23%
VAMO3;VAMOS;6.946;10,62;+0,09%
VBBR3;VIBRA;17.858;22,12;+1,10%
VIVA3;VIVARA;4.838;29,40;+0,31%
VLID3;VALID;2.224;8,80;+0,23%
VULC3;VULCABRAS;3.037;18,00;+1,07%
VVEO3;VIVEO;2.087;20,01;+0,96%
WEGE3;WEG;16.940;37,00;+0,30%
WEST3;WESTWING;546;1,01;0,00%
WIZC3;WIZ CO;1.949;6,17;-0,32%
YDUQ3;YDUQS PART;12.700;18,65;+0,05%
ZAMP3;ZAMP S.A.;3.015;4,00;-1,48%
"""

@contextmanager
def get_db():
    """
    Contexto para conexão com o banco de dados.
    """
    conn = sqlite3.connect(DATABASE_FILE)
    try:
        yield conn
    finally:
        conn.close()

def parse_and_clean_data(csv_data_string):
    """
    Parses the CSV data string and cleans the required fields.
    """
    reader = csv.reader(csv_data_string.splitlines(), delimiter=';')
    header = next(reader)  # Skip header row
    processed_data = []
    for row in reader:
        if not row:  # Skip empty rows if any
            continue
        try:
            ticker = row[0].strip()
            nome = row[1].strip()
            negocios_str = row[2].strip().replace(".", "")
            ultima_negociacao_str = row[3].strip().replace(",", ".")
            variacao = row[4].strip()

            # Convert to appropriate types
            negocios = negocios_str # Keep as string as per table def
            ultima_negociacao = float(ultima_negociacao_str)

            processed_data.append((ticker, nome, negocios, ultima_negociacao, variacao))
        except IndexError:
            print(f"Skipping row due to missing columns: {row}")
            continue
        except ValueError as e:
            print(f"Skipping row due to value error ({e}): {row}")
            continue
    return processed_data

def insert_stocks_data(db_conn, stocks_data):
    """
    Inserts processed stock data into the stocks table.
    Uses INSERT OR IGNORE to avoid duplicate entries.
    """
    cursor = db_conn.cursor()
    insert_query = """
    INSERT OR IGNORE INTO stocks (ticker, nome, negocios, ultima_negociacao, variacao)
    VALUES (?, ?, ?, ?, ?)
    """
    try:
        cursor.executemany(insert_query, stocks_data)
        db_conn.commit()
        print(f"Successfully inserted/ignored {len(stocks_data)} rows.")
    except sqlite3.Error as e:
        print(f"Database error during insertion: {e}")
        db_conn.rollback()

if __name__ == "__main__":
    print("Starting stock data population...")

    # Assuming criar_tabelas() is called elsewhere (e.g., main app startup)
    # and tables including 'stocks' already exist.
    # If not, this script will fail at the INSERT stage below.

    parsed_data = parse_and_clean_data(CSV_DATA)

    if parsed_data:
        with get_db() as conn:
            insert_stocks_data(conn, parsed_data)
        print(f"Processed {len(parsed_data)} rows from CSV data.")
    else:
        print("No data parsed from CSV.")

    print("Stock data population finished.")

"""
Small test example (can be run if this script is imported)
def _test_script():
    # This is a sample test, ideally use a separate test DB
    # and mock database.criar_tabelas if it were called directly
    criar_tabelas_if_needed() # Placeholder for actual table creation logic for test

    sample_data = \"\"\"Ticker;Nome;Negocios;Última Negociacao;Variacao
TEST1;Test Stock 1;1.000;10,50;+1,00%
TEST2;Test Stock 2;2.500;20,75;-0,50%
\"\"\"
    parsed = parse_and_clean_data(sample_data)
    assert len(parsed) == 2
    assert parsed[0] == ('TEST1', 'Test Stock 1', '1000', 10.50, '+1,00%')

    with get_db() as conn:
        # Clear table for test
        cursor = conn.cursor()
        cursor.execute("DELETE FROM stocks WHERE ticker LIKE 'TEST%'")
        conn.commit()

        insert_stocks_data(conn, parsed)

        # Verify insertion
        cursor.execute("SELECT * FROM stocks WHERE ticker = 'TEST1'")
        row1 = cursor.fetchone()
        assert row1 is not None
        assert row1[0] == 'TEST1'
        assert row1[2] == '1000' # Check negocios is string
        assert row1[3] == 10.50

        cursor.execute("SELECT COUNT(*) FROM stocks WHERE ticker LIKE 'TEST%'")
        count = cursor.fetchone()[0]
        assert count == 2

        # Test IGNORE
        insert_stocks_data(conn, [('TEST1', 'Test Stock 1 Updated', '1200', 11.00, '+1,50%')])
        cursor.execute("SELECT nome, negocios, ultima_negociacao FROM stocks WHERE ticker = 'TEST1'")
        row1_updated_check = cursor.fetchone()
        assert row1_updated_check[0] == 'Test Stock 1' # Should not have updated due to IGNORE
        assert row1_updated_check[1] == '1000'
        assert row1_updated_check[2] == 10.50

        print("Basic tests passed.")

# To run the test:
# 1. Ensure acoes_ir.db exists and tables are created (run main from app.py or database.py once)
# 2. Uncomment the line below and run: python backend/populate_stocks.py
# _test_script()

def criar_tabelas_if_needed():
    # This is a simplified version for the test.
    # In a real app, you'd import and call the main criar_tabelas
    # from database.py or ensure the DB is initialized before running tests.
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS stocks (
            ticker TEXT PRIMARY KEY,
            nome TEXT,
            negocios TEXT,
            ultima_negociacao REAL,
            variacao TEXT
        )
        ''')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_stocks_ticker ON stocks(ticker)')
        conn.commit()

"""
