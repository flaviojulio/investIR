#!/usr/bin/env python3
"""
Script para testar e atualizar links dos logos das ações
Testa cada link do formato https://storage.googleapis.com/investir-storage/logos/{ticker}.jpg
e atualiza a tabela acoes com os links válidos
"""
import requests
import sqlite3
import time
from datetime import datetime
from typing import List, Dict, Tuple
import sys
import os

# Adicionar o diretório do projeto ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import get_db, migrar_acoes_logo


def testar_link_logo(ticker: str, timeout: int = 10) -> Tuple[bool, str]:
    """
    Testa se o link do logo existe e é acessível
    
    Args:
        ticker: Ticker da ação
        timeout: Timeout para requisição
        
    Returns:
        Tuple[bool, str]: (sucesso, url_testada)
    """
    # Converter ticker para minúsculo para o link
    ticker_lower = ticker.lower()
    url = f"https://storage.googleapis.com/investir-storage/logos/{ticker_lower}.jpg"
    
    try:
        response = requests.head(url, timeout=timeout, allow_redirects=True)
        
        # Considerar sucesso para códigos 200-299
        if 200 <= response.status_code < 300:
            return True, url
        else:
            print(f"FAIL {ticker}: HTTP {response.status_code} - {url}")
            return False, url
            
    except requests.exceptions.Timeout:
        print(f"TIMEOUT {ticker}: Timeout - {url}")
        return False, url
    except requests.exceptions.RequestException as e:
        print(f"ERROR {ticker}: Erro de conexão - {e}")
        return False, url
    except Exception as e:
        print(f"CRASH {ticker}: Erro inesperado - {e}")
        return False, url


def obter_todos_tickers() -> List[Dict[str, str]]:
    """
    Obtém todos os tickers da tabela acoes
    
    Returns:
        Lista de dicionários com id, ticker, nome
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, ticker, nome FROM acoes ORDER BY ticker")
        rows = cursor.fetchall()
        
        return [
            {"id": row["id"], "ticker": row["ticker"], "nome": row["nome"] or ""}
            for row in rows
        ]


def atualizar_logo_acao(acao_id: int, logo_url: str) -> bool:
    """
    Atualiza o campo logo de uma ação
    
    Args:
        acao_id: ID da ação
        logo_url: URL do logo
        
    Returns:
        bool: Sucesso da atualização
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE acoes SET logo = ? WHERE id = ?", (logo_url, acao_id))
            conn.commit()
            return cursor.rowcount > 0
    except Exception as e:
        print(f"DB ERROR - Erro ao atualizar logo para ID {acao_id}: {e}")
        return False


def processar_logos_batch(acoes: List[Dict], batch_size: int = 10, delay: float = 0.5):
    """
    Processa logos em lotes para evitar sobrecarga
    
    Args:
        acoes: Lista de ações para processar
        batch_size: Tamanho do lote
        delay: Delay entre requisições (segundos)
    """
    total_acoes = len(acoes)
    sucessos = 0
    falhas = 0
    
    print(f"INICIO - Testando {total_acoes} logos...")
    print(f"CONFIG - Lotes de {batch_size} com delay de {delay}s")
    print("=" * 70)
    
    for i in range(0, total_acoes, batch_size):
        batch = acoes[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (total_acoes + batch_size - 1) // batch_size
        
        print(f"\nLOTE {batch_num}/{total_batches} ({len(batch)} acoes):")
        
        for acao in batch:
            ticker = acao["ticker"]
            nome = acao["nome"]
            acao_id = acao["id"]
            
            # Testar link
            sucesso, url = testar_link_logo(ticker)
            
            if sucesso:
                # Atualizar no banco
                if atualizar_logo_acao(acao_id, url):
                    print(f"OK {ticker:<8} - {nome[:30]:<30} - Logo atualizado")
                    sucessos += 1
                else:
                    print(f"SAVE_ERR {ticker:<8} - Erro ao salvar no banco")
                    falhas += 1
            else:
                falhas += 1
            
            # Delay entre requisições
            if delay > 0:
                time.sleep(delay)
        
        # Pausa entre lotes
        if i + batch_size < total_acoes:
            print(f"PAUSA - Entre lotes...")
            time.sleep(1.0)
    
    print("\n" + "=" * 70)
    print(f"RESUMO FINAL:")
    print(f"   OK: {sucessos}")
    print(f"   FAIL: {falhas}")
    print(f"   Taxa sucesso: {sucessos/total_acoes*100:.1f}%")
    
    return sucessos, falhas


def verificar_logos_existentes() -> Dict[str, str]:
    """
    Verifica quais ações já têm logos cadastrados
    
    Returns:
        Dict com ticker -> logo_url dos logos existentes
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT ticker, logo FROM acoes WHERE logo IS NOT NULL AND logo != ''")
        rows = cursor.fetchall()
        
        return {row["ticker"]: row["logo"] for row in rows}


def main():
    """Função principal do script"""
    print("ATUALIZADOR DE LOGOS DE ACOES")
    print("=" * 50)
    print(f"INICIO: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Executar migração para garantir que a coluna existe
    print("\nCONFIG - Verificando estrutura do banco...")
    migrar_acoes_logo()
    
    # Obter todas as ações
    print("\nLOAD - Carregando acoes do banco...")
    acoes = obter_todos_tickers()
    
    if not acoes:
        print("ERRO - Nenhuma acao encontrada na tabela!")
        return
    
    print(f"TOTAL - {len(acoes)} acoes encontradas")
    
    # Verificar logos existentes
    logos_existentes = verificar_logos_existentes()
    if logos_existentes:
        print(f"EXISTING - {len(logos_existentes)} acoes com logos cadastrados")
        
        # Perguntar se quer reprocessar todas ou apenas as sem logo
        resposta = input("\nOPCAO - Reprocessar TODAS (T) ou apenas SEM logo (S)? [T/s]: ").strip().lower()
        
        if resposta in ['s', 'sem', 'sem logo']:
            # Filtrar apenas ações sem logo
            acoes = [acao for acao in acoes if acao["ticker"] not in logos_existentes]
            print(f"FILTRO - Processando apenas {len(acoes)} acoes sem logo")
        else:
            print(f"ALL - Reprocessando todas as {len(acoes)} acoes")
    
    if not acoes:
        print("COMPLETO - Todas as acoes ja tem logos cadastrados!")
        return
    
    # Configurações de processamento
    print("\nCONFIGURACOES:")
    print("   Tamanho do lote: 10 acoes")
    print("   Delay entre requests: 0.5s")
    print("   URL base: https://storage.googleapis.com/investir-storage/logos/")
    print("   Formato: {ticker_lowercase}.jpg")
    
    # Confirmar execução
    input("\nSTART - Pressione ENTER para iniciar...")
    
    # Processar logos
    sucessos, falhas = processar_logos_batch(acoes, batch_size=10, delay=0.5)
    
    # Estatísticas finais
    print(f"\nPROCESSAMENTO CONCLUIDO!")
    print(f"FIM: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    if sucessos > 0:
        print(f"\nSUCESSO - {sucessos} logos atualizados!")
        
        # Mostrar algumas ações atualizadas
        logos_atualizados = verificar_logos_existentes()
        print(f"TOTAL LOGOS - {len(logos_atualizados)} acoes com logos no banco")
    
    if falhas > 0:
        print(f"\nFALHAS - {falhas} acoes nao puderam ter logos atualizados")
        print("   Possiveis motivos:")
        print("   - Logo nao existe no servidor")
        print("   - Problemas de conexao")
        print("   - Ticker com formato diferente")


def testar_alguns_logos():
    """Função para testar alguns logos específicos"""
    tickers_teste = ["PETR4", "VALE3", "ITUB4", "BBAS3", "WEGE3", "MGLU3", "ABEV3"]
    
    print("TESTE DE ALGUNS LOGOS")
    print("=" * 40)
    
    for ticker in tickers_teste:
        sucesso, url = testar_link_logo(ticker)
        status = "OK" if sucesso else "FAIL"
        print(f"{status} {ticker}: {url}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Atualizar logos das ações")
    parser.add_argument("--teste", action="store_true", 
                       help="Executar apenas teste com alguns logos")
    parser.add_argument("--batch-size", type=int, default=10,
                       help="Tamanho do lote para processamento")
    parser.add_argument("--delay", type=float, default=0.5,
                       help="Delay entre requisições em segundos")
    
    args = parser.parse_args()
    
    if args.teste:
        testar_alguns_logos()
    else:
        main()