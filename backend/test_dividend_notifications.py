#!/usr/bin/env python3
"""
Teste dos endpoints de notificações de dividendos
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta, date

# Add the backend directory to Python path for imports
sys.path.append(str(Path(__file__).parent))

from services import obter_novos_dividendos_usuario_service, obter_proximos_dividendos_usuario_service

def test_novos_dividendos():
    """Testar endpoint de novos dividendos"""
    print("="*50)
    print("TESTE: Novos Dividendos")
    print("="*50)
    
    usuario_id = 2
    
    try:
        # Usar o padrão de 2 dias do service
        resultados = obter_novos_dividendos_usuario_service(usuario_id)
        print(f"Usuario ID: {usuario_id}")
        print(f"Periodo: Ultimos 2 dias (padrao)")
        print(f"Resultados encontrados: {len(resultados)}")
        print()
        
        if resultados:
            print("PRIMEIROS 3 RESULTADOS:")
            for i, dividendo in enumerate(resultados[:3], 1):
                print(f"  {i}. {dividendo['ticker']} - {dividendo['tipo_provento']}")
                print(f"     Valor unitario: R$ {dividendo['valor_unitario']:.4f}")
                print(f"     Valor total: R$ {dividendo['valor_total_recebido']:.2f}")
                print(f"     Data calculo: {dividendo['data_calculo']}")
                print(f"     Data EX: {dividendo['data_ex']}")
                print()
        else:
            print("Nenhum dividendo novo encontrado nos ultimos 2 dias")
            
        return True
        
    except Exception as e:
        print(f"ERRO: {e}")
        return False

def test_proximos_dividendos():
    """Testar endpoint de próximos dividendos"""
    print("="*50)
    print("TESTE: Proximos Dividendos")
    print("="*50)
    
    usuario_id = 2
    data_inicio = date.today()
    data_fim = data_inicio + timedelta(days=15)
    
    try:
        resultados = obter_proximos_dividendos_usuario_service(usuario_id, data_inicio, data_fim)
        print(f"Usuario ID: {usuario_id}")
        print(f"Periodo: {data_inicio} ate {data_fim}")
        print(f"Resultados encontrados: {len(resultados)}")
        print()
        
        if resultados:
            print("PROXIMOS DIVIDENDOS:")
            for i, dividendo in enumerate(resultados, 1):
                print(f"  {i}. {dividendo['ticker']} - {dividendo['tipo_provento']}")
                print(f"     Valor unitario: R$ {dividendo['valor_unitario']:.4f}")
                print(f"     Data pagamento: {dividendo['dt_pagamento']}")
                print(f"     Dias ate pagamento: {dividendo['days_until_payment']}")
                print(f"     Valor estimado: R$ {dividendo['estimated_amount']:.2f}")
                print(f"     Quantidade atual: {dividendo['quantidade_atual']} acoes")
                print()
        else:
            print("Nenhum dividendo proximo encontrado nos proximos 15 dias")
            
        return True
        
    except Exception as e:
        print(f"ERRO: {e}")
        return False

def main():
    """Função principal de teste"""
    print("TESTE DOS ENDPOINTS DE NOTIFICACOES DE DIVIDENDOS")
    print("="*60)
    print()
    
    # Verificar se banco existe
    if not Path('acoes_ir.db').exists():
        print("ERRO: Arquivo acoes_ir.db nao encontrado!")
        print("   Execute este script na pasta backend/")
        return False
    
    # Executar testes
    teste1_ok = test_novos_dividendos()
    teste2_ok = test_proximos_dividendos()
    
    # Resumo
    print("="*50)
    print("RESUMO DOS TESTES")
    print("="*50)
    print(f"1. Novos dividendos: {'OK' if teste1_ok else 'FALHOU'}")
    print(f"2. Proximos dividendos: {'OK' if teste2_ok else 'FALHOU'}")
    print()
    
    if teste1_ok and teste2_ok:
        print("SUCESSO: Todos os testes passaram!")
        print("Os endpoints estao funcionando corretamente.")
    else:
        print("ATENCAO: Alguns testes falharam.")
        print("Verifique os logs de erro acima.")
    
    return teste1_ok and teste2_ok

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)