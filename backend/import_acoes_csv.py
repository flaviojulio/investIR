import csv
import sqlite3

DATABASE_FILE = r"C:\Projeto Fortuna\investIR\backend\acoes_ir.db"
CSV_FILE = 'C:\Projeto Fortuna\investIR\backend\Dividendos.csv'

def insert_acoes_from_csv(csv_file):
    conn = sqlite3.connect(DATABASE_FILE)
    cur = conn.cursor()

    # Abrindo o CSV e inserindo os dados
    with open(csv_file, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            cur.execute('''
                INSERT INTO proventos (id_acao, tipo, valor, data_registro,data_ex,dt_pagamento)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                row['ID_Acao'],
                row['Tipo'],
                row['Valor'],
                row['data_registro'],
                row['data_ex'],
                row['dt_pagamento']
            ))

ID_Acao, Tipo, Valor, data_registro,data_ex,dt_pagamento

    # Salvando as alterações e fechando a conexão
    conn.commit()
    conn.close()

    print("Dados inseridos com sucesso!")    
    cur.close()
    conn.close()
    print("Importação concluída.")

if __name__ == "__main__":
    insert_acoes_from_csv(CSV_FILE)