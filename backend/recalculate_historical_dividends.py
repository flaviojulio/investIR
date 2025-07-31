#!/usr/bin/env python3
"""
SCRIPT CRÍTICO: Recálculo de Dividendos Históricos com Lógica Corrigida

PROBLEMA RESOLVIDO:
- Sistema calculava dividendos usando saldo na data EX (incorreto)
- Incluía ações compradas na data EX, que não têm direito ao provento
- Solução: Usar data COM (data EX - 1 dia) para verificar posição

AÇÃO CORRETIVA:
1. Backup da tabela usuario_proventos_recebidos
2. Recalcular todos os dividendos com data COM
3. Atualizar valores corrigidos no banco
4. Validar integridade dos novos cálculos
"""

import sqlite3
import sys
import logging
from datetime import datetime, timedelta
from pathlib import Path

# Add the backend directory to Python path for imports
sys.path.append(str(Path(__file__).parent))

from services import obter_saldo_acao_em_data
from services import _obter_proventos_usuario_detalhado

def setup_logging():
    """Configurar logging para o script"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('recalculo_dividendos.log'),
            logging.StreamHandler(sys.stdout)
        ]
    )

def backup_proventos_table():
    """Criar backup da tabela usuario_proventos_recebidos"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_table = f'usuario_proventos_recebidos_backup_{timestamp}'
    
    conn = sqlite3.connect('acoes_ir.db')
    cursor = conn.cursor()
    
    try:
        # Criar tabela de backup com estrutura idêntica
        cursor.execute(f"""
            CREATE TABLE {backup_table} AS 
            SELECT * FROM usuario_proventos_recebidos
        """)
        
        cursor.execute(f"SELECT COUNT(*) FROM {backup_table}")
        backup_count = cursor.fetchone()[0]
        
        conn.commit()
        logging.info(f"✅ Backup criado: {backup_table} ({backup_count} registros)")
        return backup_table
        
    except Exception as e:
        logging.error(f"❌ Erro ao criar backup: {e}")
        conn.rollback()
        return None
    finally:
        conn.close()

def get_all_dividend_calculations():
    """Obter todos os cálculos de dividendos para recálculo"""
    conn = sqlite3.connect('acoes_ir.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT DISTINCT 
                upr.usuario_id,
                upr.provento_global_id,
                upr.id_acao,
                upr.ticker_acao,
                upr.tipo_provento,
                upr.data_ex,
                upr.dt_pagamento,
                upr.valor_unitario_provento,
                upr.quantidade_possuida_na_data_ex as quantidade_incorreta,
                upr.valor_total_recebido as valor_incorreto
            FROM usuario_proventos_recebidos upr
            ORDER BY upr.data_ex, upr.ticker_acao
        """)
        
        calculations = cursor.fetchall()
        logging.info(f"📊 Encontrados {len(calculations)} cálculos para recálculo")
        return calculations
        
    except Exception as e:
        logging.error(f"❌ Erro ao obter cálculos: {e}")
        return []
    finally:
        conn.close()

def recalculate_single_dividend(calc_data):
    """Recalcular um único dividendo usando data COM"""
    (usuario_id, provento_global_id, id_acao, ticker_acao, tipo_provento, 
     data_ex_str, dt_pagamento_str, valor_unitario, quantidade_incorreta, valor_incorreto) = calc_data
    
    try:
        # Converter data_ex de string ISO para objeto date
        data_ex = datetime.strptime(data_ex_str, '%Y-%m-%d').date()
        
        # 🚨 CORREÇÃO CRÍTICA: Usar data COM (D-1 da data EX)
        data_com = data_ex - timedelta(days=1)
        
        # Calcular quantidade correta na data COM
        quantidade_correta = obter_saldo_acao_em_data(
            usuario_id=usuario_id,
            ticker=ticker_acao,
            data_limite=data_com
        )
        
        # Valor total correto
        valor_total_correto = quantidade_correta * valor_unitario
        
        # Log das correções
        if quantidade_correta != quantidade_incorreta:
            logging.info(f"🔧 {ticker_acao} {data_ex}: {quantidade_incorreta} → {quantidade_correta} ações "
                        f"(R$ {valor_incorreto:.2f} → R$ {valor_total_correto:.2f})")
        
        return {
            'provento_global_id': provento_global_id,
            'usuario_id': usuario_id,
            'quantidade_correta': quantidade_correta,
            'valor_total_correto': valor_total_correto,
            'mudou': quantidade_correta != quantidade_incorreta
        }
        
    except Exception as e:
        logging.error(f"❌ Erro ao recalcular {ticker_acao} {data_ex_str}: {e}")
        return None

def update_corrected_calculations(corrections):
    """Atualizar banco com cálculos corrigidos"""
    conn = sqlite3.connect('acoes_ir.db')
    cursor = conn.cursor()
    
    updates_made = 0
    total_corrections = len([c for c in corrections if c and c['mudou']])
    
    try:
        for correction in corrections:
            if not correction or not correction['mudou']:
                continue
                
            cursor.execute("""
                UPDATE usuario_proventos_recebidos 
                SET quantidade_possuida_na_data_ex = ?,
                    valor_total_recebido = ?,
                    data_calculo = datetime('now')
                WHERE usuario_id = ? AND provento_global_id = ?
            """, (
                correction['quantidade_correta'],
                correction['valor_total_correto'],
                correction['usuario_id'],
                correction['provento_global_id']
            ))
            
            updates_made += cursor.rowcount
        
        conn.commit()
        logging.info(f"✅ Atualizados {updates_made} registros de {total_corrections} correções")
        return updates_made
        
    except Exception as e:
        logging.error(f"❌ Erro ao atualizar correções: {e}")
        conn.rollback()
        return 0
    finally:
        conn.close()

def validate_corrections():
    """Validar integridade dos cálculos corrigidos"""
    conn = sqlite3.connect('acoes_ir.db')
    cursor = conn.cursor()
    
    try:
        # Verificar consistência: valor_total = quantidade * valor_unitario
        cursor.execute("""
            SELECT COUNT(*) FROM usuario_proventos_recebidos
            WHERE ABS(valor_total_recebido - (quantidade_possuida_na_data_ex * valor_unitario_provento)) > 0.001
        """)
        
        inconsistent = cursor.fetchone()[0]
        
        if inconsistent == 0:
            logging.info("✅ Validação: Todos os cálculos estão consistentes")
            return True
        else:
            logging.error(f"❌ Validação: {inconsistent} registros inconsistentes encontrados")
            return False
            
    except Exception as e:
        logging.error(f"❌ Erro na validação: {e}")
        return False
    finally:
        conn.close()

def generate_correction_report():
    """Gerar relatório das correções aplicadas"""
    conn = sqlite3.connect('acoes_ir.db')
    cursor = conn.cursor()
    
    try:
        # Estatísticas gerais
        cursor.execute("SELECT COUNT(*) FROM usuario_proventos_recebidos")
        total_records = cursor.fetchone()[0]
        
        cursor.execute("SELECT SUM(valor_total_recebido) FROM usuario_proventos_recebidos")
        total_value = cursor.fetchone()[0] or 0
        
        # Dividendos por ticker (top 10)
        cursor.execute("""
            SELECT 
                ticker_acao,
                COUNT(*) as pagamentos,
                SUM(valor_total_recebido) as total_recebido
            FROM usuario_proventos_recebidos
            GROUP BY ticker_acao
            ORDER BY total_recebido DESC
            LIMIT 10
        """)
        
        top_dividends = cursor.fetchall()
        
        # Gerar relatório
        report = f"""
RELATÓRIO DE CORREÇÃO DE DIVIDENDOS
{'='*50}
Data: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}

ESTATÍSTICAS FINAIS:
- Total de registros: {total_records}
- Valor total corrigido: R$ {total_value:,.2f}

TOP 10 DIVIDENDOS (VALORES CORRIGIDOS):
"""
        
        for ticker, pagamentos, total in top_dividends:
            report += f"  {ticker:6} - {pagamentos:3} pagamentos - R$ {total:8,.2f}\n"
        
        # Salvar relatório
        with open('relatorio_correcao_dividendos.txt', 'w', encoding='utf-8') as f:
            f.write(report)
        
        logging.info("📄 Relatório salvo: relatorio_correcao_dividendos.txt")
        return report
        
    except Exception as e:
        logging.error(f"❌ Erro ao gerar relatório: {e}")
        return ""
    finally:
        conn.close()

def main():
    """Função principal de recálculo"""
    setup_logging()
    
    logging.info("🚀 INICIANDO RECÁLCULO DE DIVIDENDOS HISTÓRICOS")
    logging.info("="*60)
    
    # Verificar se arquivo existe
    if not Path('acoes_ir.db').exists():
        logging.error("❌ Arquivo acoes_ir.db não encontrado!")
        logging.error("   Execute este script na pasta backend/")
        return False
    
    # Criar backup
    backup_table = backup_proventos_table()
    if not backup_table:
        logging.error("❌ Falha ao criar backup - abortando")
        return False
    
    # Obter todos os cálculos para recálculo
    calculations = get_all_dividend_calculations()
    if not calculations:
        logging.error("❌ Nenhum cálculo encontrado para recálculo")
        return False
    
    # Confirmação do usuário
    logging.info(f"⚠️  ATENÇÃO: Será feito recálculo de {len(calculations)} dividendos")
    logging.info(f"   Backup: {backup_table}")
    
    resposta = input("Continuar com o recálculo? (sim/nao): ").lower().strip()
    if resposta not in ['sim', 's', 'yes', 'y']:
        logging.info("❌ CANCELADO: Operação cancelada pelo usuário")
        return False
    
    # Recalcular todos os dividendos
    logging.info("🔄 Recalculando dividendos com lógica corrigida...")
    corrections = []
    
    for i, calc in enumerate(calculations, 1):
        if i % 50 == 0:
            logging.info(f"   Progresso: {i}/{len(calculations)} ({i/len(calculations)*100:.1f}%)")
        
        correction = recalculate_single_dividend(calc)
        if correction:
            corrections.append(correction)
    
    # Aplicar correções no banco
    updates_made = update_corrected_calculations(corrections)
    
    # Validar resultados
    validation_ok = validate_corrections()
    
    # Gerar relatório
    report = generate_correction_report()
    
    if validation_ok and updates_made > 0:
        logging.info("✅ SUCESSO: RECÁLCULO CONCLUÍDO!")
        logging.info(f"   - Registros corrigidos: {updates_made}")
        logging.info(f"   - Backup: {backup_table}")
        logging.info(f"   - Validação: OK")
        return True
    else:
        logging.error("⚠️  PARCIAL: Recálculo teve problemas")
        logging.error(f"   - Restaure backup se necessário: {backup_table}")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)