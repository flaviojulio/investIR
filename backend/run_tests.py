#!/usr/bin/env python3
"""
Script para executar todos os testes do sistema
Suporta diferentes tipos de execução e relatórios
"""
import os
import sys
import subprocess
import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Executar testes do sistema investIR")
    parser.add_argument("--type", choices=["unit", "integration", "all"], default="all",
                       help="Tipo de testes a executar")
    parser.add_argument("--coverage", action="store_true",
                       help="Executar com relatório de cobertura")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Saída verbosa")
    parser.add_argument("--fast", action="store_true",
                       help="Pular testes marcados como slow")
    parser.add_argument("--markers", type=str,
                       help="Executar apenas testes com marcadores específicos (ex: fiscal,operations)")
    parser.add_argument("--pattern", type=str,
                       help="Padrão para filtrar arquivos de teste")
    parser.add_argument("--failfast", action="store_true",
                       help="Parar na primeira falha")
    
    args = parser.parse_args()
    
    # Verificar se está no diretório correto
    if not Path("tests").exists():
        print("❌ Diretório 'tests' não encontrado!")
        print("Execute este script a partir do diretório backend/")
        sys.exit(1)
    
    # Construir comando pytest
    cmd = ["python", "-m", "pytest"]
    
    # Adicionar opções baseadas nos argumentos
    if args.verbose:
        cmd.append("-v")
    else:
        cmd.append("-q")
    
    if args.coverage:
        cmd.extend(["--cov=.", "--cov-report=html", "--cov-report=term-missing"])
    
    if args.failfast:
        cmd.append("-x")
    
    if args.fast:
        cmd.extend(["-m", "not slow"])
    
    # Filtros por tipo de teste
    if args.type == "unit":
        cmd.append("tests/unit/")
    elif args.type == "integration":
        cmd.append("tests/integration/")
    else:  # all
        cmd.append("tests/")
    
    # Marcadores específicos
    if args.markers:
        markers = args.markers.split(",")
        marker_expr = " or ".join(markers)
        cmd.extend(["-m", marker_expr])
    
    # Padrão de arquivos
    if args.pattern:
        cmd.extend(["-k", args.pattern])
    
    # Configurações adicionais
    cmd.extend([
        "--tb=short",
        "--strict-markers",
        "--disable-warnings"
    ])
    
    print("🧪 Executando testes do sistema investIR...")
    print(f"📋 Comando: {' '.join(cmd)}")
    print("=" * 60)
    
    # Executar testes
    try:
        result = subprocess.run(cmd, check=False)
        
        if result.returncode == 0:
            print("\n✅ Todos os testes passaram!")
            
            if args.coverage:
                print("\n📊 Relatório de cobertura gerado em: htmlcov/index.html")
                
        else:
            print(f"\n❌ Alguns testes falharam (código de saída: {result.returncode})")
            
        return result.returncode
        
    except KeyboardInterrupt:
        print("\n⏹️ Execução interrompida pelo usuário")
        return 1
    except Exception as e:
        print(f"\n💥 Erro ao executar testes: {e}")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)