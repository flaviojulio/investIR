import yfinance as yf
import pandas as pd
import sqlite3
from datetime import datetime, timedelta
import time
import logging
import sys
import os

# Adicionar o diretório pai ao path para importar o módulo database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db, obter_todas_acoes, obter_id_acao_por_ticker

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CotacaoAcoes:
    def __init__(self):
        """
        Inicializa a classe para baixar e armazenar cotações de ações
        Utiliza o banco de dados existente do sistema
        """
        self.verificar_tabela_cotacoes()
    
    def verificar_tabela_cotacoes(self):
        """Verifica se a tabela cotacao_acoes existe"""
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='cotacao_acoes'")
                if cursor.fetchone():
                    logger.info("Tabela cotacao_acoes encontrada")
                else:
                    logger.error("Tabela cotacao_acoes não encontrada!")
                    raise Exception("Tabela cotacao_acoes não existe")
        except Exception as e:
            logger.error(f"Erro ao verificar tabela: {e}")
            raise

    def obter_acoes_sistema(self):
        """
        Obtém todas as ações da tabela acoes do sistema
        
        Returns:
            list: Lista de dicionários com as informações das ações
        """
        try:
            acoes = obter_todas_acoes()
            logger.info(f"Encontradas {len(acoes)} ações no sistema")
            return acoes
        except Exception as e:
            logger.error(f"Erro ao obter ações do sistema: {e}")
            return []
    
    def baixar_cotacoes_acao(self, acao_id, ticker, meses=12):
        """
        Baixa cotações de uma ação específica dos últimos meses
        
        Args:
            acao_id (int): ID da ação na tabela acoes
            ticker (str): Código da ação (ex: PETR4)
            meses (int): Número de meses para baixar (padrão: 12)
            
        Returns:
            pandas.DataFrame: DataFrame com as cotações
        """
        try:
            # Adicionar .SA se não estiver presente
            if not ticker.endswith('.SA'):
                ticker_yf = f"{ticker}.SA"
            else:
                ticker_yf = ticker
            
            # Calcular data de início (12 meses atrás)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=meses * 30)  # Aproximadamente 12 meses
            
            logger.info(f"Baixando dados de {ticker_yf} (ID: {acao_id}) de {start_date.date()} até {end_date.date()}")
            
            # Baixar dados do yfinance
            stock = yf.Ticker(ticker_yf)
            hist = stock.history(start=start_date, end=end_date)
            
            if hist.empty:
                logger.warning(f"Nenhum dado encontrado para {ticker_yf}")
                return None
            
            # Debug: verificar colunas disponíveis
            logger.debug(f"Colunas disponíveis para {ticker_yf}: {list(hist.columns)}")
            
            # Preparar DataFrame para inserção no banco
            df_cotacoes = pd.DataFrame({
                'acao_id': acao_id,
                'data': hist.index.date,
                'abertura': hist['Open'].round(2) if 'Open' in hist.columns else None,
                'maxima': hist['High'].round(2) if 'High' in hist.columns else None,
                'minima': hist['Low'].round(2) if 'Low' in hist.columns else None,
                'fechamento': hist['Close'].round(2) if 'Close' in hist.columns else None,
                'fechamento_ajustado': hist['Adj Close'].round(2) if 'Adj Close' in hist.columns else hist['Close'].round(2) if 'Close' in hist.columns else None,
                'volume': hist['Volume'].astype('int64') if 'Volume' in hist.columns else 0,
                'dividendos': hist['Dividends'].round(4) if 'Dividends' in hist.columns else 0.0,
                'splits': hist['Stock Splits'].round(4) if 'Stock Splits' in hist.columns else 0.0
            })
            
            logger.info(f"Baixados {len(df_cotacoes)} registros para {ticker} (ID: {acao_id})")
            return df_cotacoes
            
        except Exception as e:
            logger.error(f"Erro ao baixar dados de {ticker} (ID: {acao_id}): {str(e)}")
            if "KeyError" in str(type(e)):
                logger.debug(f"Erro de chave para {ticker_yf}. Verifique se a ação está ativa no mercado.")
            return None
    
    def salvar_cotacoes(self, df_cotacoes):
        """
        Salva as cotações no banco SQLite usando a infraestrutura existente
        
        Args:
            df_cotacoes (pandas.DataFrame): DataFrame com as cotações
        """
        try:
            with get_db() as conn:
                # Inserir registros usando INSERT OR IGNORE para evitar duplicatas
                for _, row in df_cotacoes.iterrows():
                    cursor = conn.cursor()
                    cursor.execute('''
                        INSERT OR IGNORE INTO cotacao_acoes 
                        (acao_id, data, abertura, maxima, minima, fechamento, 
                         fechamento_ajustado, volume, dividendos, splits)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        row['acao_id'], row['data'], row['abertura'], 
                        row['maxima'], row['minima'], row['fechamento'],
                        row['fechamento_ajustado'], row['volume'], 
                        row['dividendos'], row['splits']
                    ))
                
                conn.commit()
                logger.info(f"Salvos {len(df_cotacoes)} registros no banco")
            
        except Exception as e:
            logger.error(f"Erro ao salvar no banco: {e}")
    
    def processar_todas_acoes(self, delay=2):
        """
        Processa todas as ações da tabela acoes do sistema
        
        Args:
            delay (int): Delay em segundos entre requisições (padrão: 2)
        """
        # Obter ações do sistema
        acoes = self.obter_acoes_sistema()
        if not acoes:
            logger.error("Nenhuma ação encontrada no sistema")
            return
        
        total_acoes = len(acoes)
        sucessos = 0
        falhas = 0
        
        logger.info(f"Iniciando processamento de {total_acoes} ações")
        
        for index, acao in enumerate(acoes):
            acao_id = acao['id']
            ticker = acao['ticker']
            nome = acao.get('nome', 'Nome não disponível')
            
            logger.info(f"Processando {index + 1}/{total_acoes}: {ticker} - {nome}")
            
            # Baixar cotações dos últimos 12 meses
            df_cotacoes = self.baixar_cotacoes_acao(acao_id, ticker, meses=12)
            
            if df_cotacoes is not None:
                # Salvar no banco
                self.salvar_cotacoes(df_cotacoes)
                sucessos += 1
            else:
                falhas += 1
            
            # Delay para não sobrecarregar a API
            if index < total_acoes - 1:  # Não fazer delay na última iteração
                time.sleep(delay)
        
        logger.info(f"Processamento concluído: {sucessos} sucessos, {falhas} falhas")
    
    def verificar_dados(self):
        """Verifica os dados salvos no banco"""
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                
                # Estatísticas gerais
                cursor.execute('''
                    SELECT 
                        COUNT(*) as total_registros,
                        COUNT(DISTINCT acao_id) as total_acoes,
                        MIN(data) as data_inicial,
                        MAX(data) as data_final
                    FROM cotacao_acoes
                ''')
                
                stats = cursor.fetchone()
                print("\n=== ESTATÍSTICAS GERAIS ===")
                print(f"Total de registros: {stats[0]}")
                print(f"Total de ações: {stats[1]}")
                print(f"Data inicial: {stats[2]}")
                print(f"Data final: {stats[3]}")
                
                # Registros por ação
                cursor.execute('''
                    SELECT 
                        a.ticker,
                        a.nome,
                        COUNT(c.id) as registros,
                        MIN(c.data) as primeira_data,
                        MAX(c.data) as ultima_data
                    FROM cotacao_acoes c
                    JOIN acoes a ON c.acao_id = a.id
                    GROUP BY c.acao_id, a.ticker, a.nome
                    ORDER BY a.ticker
                ''')
                
                registros_acao = cursor.fetchall()
                print("\n=== REGISTROS POR AÇÃO ===")
                print(f"{'Ticker':<8} {'Nome':<30} {'Registros':<10} {'Primeira':<12} {'Última':<12}")
                print("-" * 80)
                for row in registros_acao:
                    ticker, nome, registros, primeira, ultima = row
                    nome_truncado = (nome[:27] + '...') if nome and len(nome) > 30 else (nome or 'N/A')
                    print(f"{ticker:<8} {nome_truncado:<30} {registros:<10} {primeira:<12} {ultima:<12}")
                
        except Exception as e:
            logger.error(f"Erro ao verificar dados: {e}")

def main():
    """Função principal"""
    logger.info("=== IMPORTAÇÃO DE COTAÇÕES DO YFINANCE ===")
    logger.info("Utilizando a tabela cotacao_acoes do sistema")
    
    try:
        # Inicializar o importador
        cotacao_manager = CotacaoAcoes()
        
        # Processar todas as ações (últimos 12 meses)
        cotacao_manager.processar_todas_acoes(delay=2)
        
        # Verificar dados salvos
        cotacao_manager.verificar_dados()
        
        logger.info("=== IMPORTAÇÃO CONCLUÍDA ===")
        
    except Exception as e:
        logger.error(f"Erro durante a execução: {e}")
        raise

if __name__ == "__main__":
    main()