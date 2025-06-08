import csv
import sqlite3

DATABASE_FILE = r"C:\Projeto Fortuna\investIR\backend\acoes_ir.db"
CSV_FILE = 'Acoes.csv'

def insert_acoes_from_csv(csv_file):
    conn = sqlite3.connect(DATABASE_FILE)
    cur = conn.cursor()

    with open(csv_file, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cur.execute("""
                INSERT OR IGNORE INTO acoes (
                    id, ticker, nome, razao_social, cnpj, ri,
                    classificacao, isin
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                row['ID'],
                row['Ticker'],
                row['Nome'],
                row['Razao Social'],
                row['CNPJ'],
                row['Site do RI'],
                row['Classificacao Setorial B3'],
                row['Codigo ISIN']
            ))
    conn.commit()
    cur.close()
    conn.close()
    print("Importação concluída.")

if __name__ == "__main__":
    insert_acoes_from_csv(CSV_FILE)