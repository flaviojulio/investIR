import sys
import os
from pathlib import Path
from datetime import datetime, timedelta
import logging

# Adicionar o diretório backend ao path para importar os módulos
backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

from database import (
    criar_tabelas, 
    obter_todas_acoes, 
    obter_id_acao_por_ticker,
    inserir_cotacoes_lote,
    obter_estatisticas_cotacoes,
    verificar_cotacoes_existentes
)

# Importar a classe de cotações do script original
from investIR.backend.importacao_precos_yfinance import CotacaoAcoes

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class GerenciadorCotacoes:
    """
    Classe para gerenciar a importação de cotações integrando com o backend.
    """
    
    def __init__(self, db_path: str = None):
        """
        Inicializa o gerenciador de cotações.
        
        Args:
            db_path: Caminho para o banco de dados (usa o padrão do backend se None)
        """
        # Se não especificado, usa o banco padrão do backend
        if db_path is None:
            db_path = str(backend_dir / "acoes_ir.db")
        
        self.db_path = db_path
        self.cotacao_manager = CotacaoAcoes(db_path)
        
        # Garantir que as tabelas existam
        criar_tabelas()
        
    def importar_cotacoes_backend(self, anos: int = 6):
        """
        Importa cotações para todas as ações cadastradas no backend.
        
        Args:
            anos: Número de anos de histórico para baixar
        """
        logger.info("🚀 Iniciando importação de cotações para o backend")
        
        # Obter todas as ações cadastradas no backend
        acoes = obter_todas_acoes()
        
        if not acoes:
            logger.warning("❌ Nenhuma ação encontrada no banco de dados do backend")
            return
        
        logger.info(f"📊 Encontradas {len(acoes)} ações para processar")
        
        sucessos = 0
        falhas = 0
        total_cotacoes = 0
        
        for i, acao in enumerate(acoes, 1):
            ticker = acao['ticker']
            acao_id = acao['id']
            nome = acao['nome'] or 'N/A'
            
            logger.info(f"📈 [{i}/{len(acoes)}] Processando {ticker} - {nome}")
            
            try:
                # Verificar se já existem cotações recentes
                data_limite = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
                data_hoje = datetime.now().strftime('%Y-%m-%d')
                
                if verificar_cotacoes_existentes(acao_id, data_limite, data_hoje):
                    logger.info(f"⏭️  {ticker} já possui cotações recentes - pulando")
                    continue
                
                # Baixar cotações usando a classe original
                df_cotacoes = self.cotacao_manager.baixar_cotacoes_acao(acao_id, ticker, anos)
                
                if df_cotacoes is not None and not df_cotacoes.empty:
                    # Converter DataFrame para lista de dicionários
                    cotacoes_lista = []
                    for _, row in df_cotacoes.iterrows():
                        cotacao_dict = {
                            'acao_id': acao_id,
                            'data': row['data'].strftime('%Y-%m-%d') if hasattr(row['data'], 'strftime') else str(row['data']),
                            'abertura': float(row['abertura']) if row['abertura'] is not None else None,
                            'maxima': float(row['maxima']) if row['maxima'] is not None else None,
                            'minima': float(row['minima']) if row['minima'] is not None else None,
                            'fechamento': float(row['fechamento']) if row['fechamento'] is not None else None,
                            'fechamento_ajustado': float(row['fechamento_ajustado']) if row['fechamento_ajustado'] is not None else None,
                            'volume': int(row['volume']) if row['volume'] is not None else None,
                            'dividendos': float(row['dividendos']) if row['dividendos'] is not None else 0.0,
                            'splits': float(row['splits']) if row['splits'] is not None else 0.0
                        }
                        cotacoes_lista.append(cotacao_dict)
                    
                    # Inserir cotações no banco usando as funções do backend
                    num_inseridas = inserir_cotacoes_lote(cotacoes_lista)
                    total_cotacoes += num_inseridas
                    sucessos += 1
                    
                    logger.info(f"✅ {ticker}: {num_inseridas} cotações inseridas")
                    
                else:
                    logger.warning(f"⚠️  {ticker}: Nenhuma cotação encontrada")
                    falhas += 1
                    
            except Exception as e:
                logger.error(f"❌ Erro ao processar {ticker}: {e}")
                falhas += 1
                
            # Pequeno delay para não sobrecarregar a API
            import time
            time.sleep(1)
        
        # Relatório final
        logger.info("="*60)
        logger.info("📋 RELATÓRIO FINAL DA IMPORTAÇÃO")
        logger.info("="*60)
        logger.info(f"✅ Sucessos: {sucessos}")
        logger.info(f"❌ Falhas: {falhas}")
        logger.info(f"📊 Total de cotações inseridas: {total_cotacoes:,}")
        
        # Mostrar estatísticas do banco
        self.mostrar_estatisticas()
        
    def mostrar_estatisticas(self):
        """
        Mostra estatísticas das cotações armazenadas.
        """
        try:
            stats = obter_estatisticas_cotacoes()
            
            logger.info("\n📊 ESTATÍSTICAS DO BANCO DE COTAÇÕES")
            logger.info("-" * 50)
            
            geral = stats['estatisticas_gerais']
            logger.info(f"Total de registros: {geral['total_registros']:,}")
            logger.info(f"Total de ações: {geral['total_acoes']:,}")
            logger.info(f"Período: {geral['data_inicial']} a {geral['data_final']}")
            
            if stats['por_acao']:
                logger.info("\n🔝 Top 10 ações com mais cotações:")
                for acao in stats['por_acao'][:10]:
                    logger.info(f"  {acao['ticker']:<8} | {acao['total_cotacoes']:>6,} cotações | {acao['primeira_data']} a {acao['ultima_data']}")
                    
        except Exception as e:
            logger.error(f"Erro ao obter estatísticas: {e}")

    def atualizar_cotacoes_especificas(self, tickers: list, anos: int = 1):
        """
        Atualiza cotações de tickers específicos.
        
        Args:
            tickers: Lista de tickers para atualizar
            anos: Número de anos de histórico
        """
        logger.info(f"🎯 Atualizando cotações específicas: {', '.join(tickers)}")
        
        for ticker in tickers:
            acao_id = obter_id_acao_por_ticker(ticker)
            
            if not acao_id:
                logger.warning(f"⚠️  Ticker {ticker} não encontrado no banco de dados")
                continue
                
            logger.info(f"📈 Atualizando {ticker}...")
            
            try:
                df_cotacoes = self.cotacao_manager.baixar_cotacoes_acao(acao_id, ticker, anos)
                
                if df_cotacoes is not None and not df_cotacoes.empty:
                    # Converter e inserir
                    cotacoes_lista = []
                    for _, row in df_cotacoes.iterrows():
                        cotacao_dict = {
                            'acao_id': acao_id,
                            'data': row['data'].strftime('%Y-%m-%d') if hasattr(row['data'], 'strftime') else str(row['data']),
                            'abertura': float(row['abertura']) if row['abertura'] is not None else None,
                            'maxima': float(row['maxima']) if row['maxima'] is not None else None,
                            'minima': float(row['minima']) if row['minima'] is not None else None,
                            'fechamento': float(row['fechamento']) if row['fechamento'] is not None else None,
                            'fechamento_ajustado': float(row['fechamento_ajustado']) if row['fechamento_ajustado'] is not None else None,
                            'volume': int(row['volume']) if row['volume'] is not None else None,
                            'dividendos': float(row['dividendos']) if row['dividendos'] is not None else 0.0,
                            'splits': float(row['splits']) if row['splits'] is not None else 0.0
                        }
                        cotacoes_lista.append(cotacao_dict)
                    
                    num_inseridas = inserir_cotacoes_lote(cotacoes_lista)
                    logger.info(f"✅ {ticker}: {num_inseridas} cotações atualizadas")
                    
                else:
                    logger.warning(f"⚠️  {ticker}: Nenhuma cotação encontrada")
                    
            except Exception as e:
                logger.error(f"❌ Erro ao atualizar {ticker}: {e}")

def main():
    """Função principal do script integrado."""
    print("🌟 Gerenciador de Cotações - Backend InvestIR")
    print("=" * 60)
    
    gerenciador = GerenciadorCotacoes()
    
    if len(sys.argv) > 1:
        comando = sys.argv[1].lower()
        
        if comando == "importar":
            # Importar todas as ações
            anos = int(sys.argv[2]) if len(sys.argv) > 2 else 6
            gerenciador.importar_cotacoes_backend(anos)
            
        elif comando == "atualizar":
            # Atualizar tickers específicos
            if len(sys.argv) > 2:
                tickers = sys.argv[2].split(',')
                anos = int(sys.argv[3]) if len(sys.argv) > 3 else 1
                gerenciador.atualizar_cotacoes_especificas(tickers, anos)
            else:
                print("❌ Uso: python script.py atualizar TICKER1,TICKER2,...")
                
        elif comando == "stats":
            # Mostrar estatísticas
            gerenciador.mostrar_estatisticas()
            
        else:
            print("❌ Comando inválido. Use: importar, atualizar ou stats")
    else:
        # Menu interativo
        print("Escolha uma opção:")
        print("1. Importar todas as cotações (6 anos)")
        print("2. Importar cotações (personalizado)")
        print("3. Atualizar cotações específicas")
        print("4. Mostrar estatísticas")
        print("5. Sair")
        
        while True:
            try:
                opcao = input("\nDigite sua opção (1-5): ").strip()
                
                if opcao == "1":
                    gerenciador.importar_cotacoes_backend(6)
                    break
                elif opcao == "2":
                    anos = int(input("Quantos anos de histórico? "))
                    gerenciador.importar_cotacoes_backend(anos)
                    break
                elif opcao == "3":
                    tickers_input = input("Digite os tickers separados por vírgula (ex: PETR4,VALE3): ")
                    tickers = [t.strip().upper() for t in tickers_input.split(",")]
                    anos = int(input("Quantos anos de histórico? (padrão: 1): ") or "1")
                    gerenciador.atualizar_cotacoes_especificas(tickers, anos)
                    break
                elif opcao == "4":
                    gerenciador.mostrar_estatisticas()
                    break
                elif opcao == "5":
                    print("👋 Até logo!")
                    break
                else:
                    print("❌ Opção inválida. Tente novamente.")
                    
            except KeyboardInterrupt:
                print("\n👋 Operação cancelada pelo usuário.")
                break
            except Exception as e:
                print(f"❌ Erro: {e}")

if __name__ == "__main__":
    main()
