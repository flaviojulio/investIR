"""
Testes unitários para operações de banco de dados
Cobre CRUD de operações, carteira, resultados e importações
"""
import pytest
from datetime import date, datetime, timedelta
from database import (
    inserir_operacao, obter_todas_operacoes, obter_operacao_por_id,
    atualizar_operacao, remover_operacao, obter_tickers_operados_por_usuario,
    atualizar_carteira, obter_carteira_atual, limpar_carteira,
    salvar_resultado_mensal, obter_resultados_mensais, obter_resultado_mensal,
    inserir_importacao, obter_importacao_por_id, verificar_arquivo_ja_importado,
    salvar_operacao_fechada, obter_operacoes_fechadas_salvas,
    inserir_usuario, obter_usuario_por_id, obter_usuario_por_username,
    get_db
)


@pytest.mark.database
class TestOperacoesCRUD:
    """Testes para operações CRUD de operações"""
    
    def test_inserir_operacao_valida(self, sample_user, sample_stocks, sample_corretora):
        """Teste inserção de operação válida"""
        operacao = {
            "date": date(2024, 1, 15),
            "ticker": "PETR4",
            "operation": "buy",
            "quantity": 100,
            "price": 30.50,
            "fees": 5.20,
            "corretora_id": sample_corretora["id"]
        }
        
        op_id = inserir_operacao(operacao, sample_user.id)
        
        assert op_id is not None
        assert isinstance(op_id, int)
        assert op_id > 0
    
    def test_inserir_operacao_com_importacao(self, sample_user, sample_stocks, sample_importacao):
        """Teste inserção de operação com ID de importação"""
        operacao = {
            "date": date(2024, 1, 20),
            "ticker": "VALE3",
            "operation": "sell",
            "quantity": 200,
            "price": 65.80,
            "fees": 10.50
        }
        
        op_id = inserir_operacao(operacao, sample_user.id, sample_importacao["id"])
        
        assert op_id is not None
        
        # Verificar se a operação foi vinculada à importação
        op_recuperada = obter_operacao_por_id(op_id, sample_user.id)
        assert op_recuperada is not None
        assert op_recuperada["importacao_id"] == sample_importacao["id"]
        assert op_recuperada["nome_arquivo_original"] == sample_importacao["nome_arquivo_original"]
    
    def test_inserir_operacao_ticker_inexistente(self, sample_user):
        """Teste inserção de operação com ticker inexistente"""
        operacao = {
            "date": date(2024, 1, 15),
            "ticker": "INEXISTENTE",
            "operation": "buy",
            "quantity": 100,
            "price": 30.50,
            "fees": 5.20
        }
        
        with pytest.raises(ValueError, match="Ticker INEXISTENTE não encontrado"):
            inserir_operacao(operacao, sample_user.id)
    
    def test_obter_todas_operacoes(self, sample_operations):
        """Teste obtenção de todas as operações"""
        user_id = sample_operations[0]["usuario_id"]
        operacoes = obter_todas_operacoes(user_id)
        
        assert len(operacoes) == len(sample_operations)
        
        # Verificar ordenação por data
        datas = [op["date"] for op in operacoes]
        assert datas == sorted(datas)
        
        # Verificar campos obrigatórios
        for op in operacoes:
            assert "id" in op
            assert "ticker" in op
            assert "operation" in op
            assert "quantity" in op
            assert "price" in op
            assert "fees" in op
            assert "corretora_nome" in op
            assert "nome_arquivo_original" in op
    
    def test_obter_operacao_por_id(self, sample_operations):
        """Teste obtenção de operação por ID"""
        op_original = sample_operations[0]
        user_id = op_original["usuario_id"]
        
        op_recuperada = obter_operacao_por_id(op_original["id"], user_id)
        
        assert op_recuperada is not None
        assert op_recuperada["id"] == op_original["id"]
        assert op_recuperada["ticker"] == op_original["ticker"]
        assert op_recuperada["operation"] == op_original["operation"]
        assert op_recuperada["quantity"] == op_original["quantity"]
        assert float(op_recuperada["price"]) == op_original["price"]
    
    def test_obter_operacao_usuario_diferente(self, sample_operations, sample_user):
        """Teste tentativa de obter operação de outro usuário"""
        op_original = sample_operations[0]
        
        # Tentar obter com outro usuário (deve retornar None)
        op_recuperada = obter_operacao_por_id(op_original["id"], 99999)
        
        assert op_recuperada is None
    
    def test_atualizar_operacao(self, sample_operations):
        """Teste atualização de operação"""
        op_original = sample_operations[0]
        user_id = op_original["usuario_id"]
        
        dados_atualizacao = {
            "date": date(2024, 2, 1),
            "ticker": op_original["ticker"],
            "operation": op_original["operation"],
            "quantity": 150,  # Alterado
            "price": 35.00,   # Alterado
            "fees": 8.50      # Alterado
        }
        
        sucesso = atualizar_operacao(op_original["id"], dados_atualizacao, user_id)
        
        assert sucesso is True
        
        # Verificar se foi atualizada
        op_atualizada = obter_operacao_por_id(op_original["id"], user_id)
        assert op_atualizada["quantity"] == 150
        assert float(op_atualizada["price"]) == 35.00
        assert float(op_atualizada["fees"]) == 8.50
    
    def test_atualizar_operacao_usuario_diferente(self, sample_operations):
        """Teste tentativa de atualizar operação de outro usuário"""
        op_original = sample_operations[0]
        
        dados_atualizacao = {
            "date": date(2024, 2, 1),
            "ticker": op_original["ticker"],
            "operation": op_original["operation"],
            "quantity": 150,
            "price": 35.00,
            "fees": 8.50
        }
        
        sucesso = atualizar_operacao(op_original["id"], dados_atualizacao, 99999)
        
        assert sucesso is False
    
    def test_remover_operacao(self, sample_operations):
        """Teste remoção de operação"""
        op_original = sample_operations[0]
        user_id = op_original["usuario_id"]
        
        sucesso = remover_operacao(op_original["id"], user_id)
        
        assert sucesso is True
        
        # Verificar se foi removida
        op_removida = obter_operacao_por_id(op_original["id"], user_id)
        assert op_removida is None
    
    def test_obter_tickers_operados(self, sample_operations):
        """Teste obtenção de tickers operados por usuário"""
        user_id = sample_operations[0]["usuario_id"]
        
        tickers = obter_tickers_operados_por_usuario(user_id)
        
        assert len(tickers) > 0
        assert all(isinstance(ticker, str) for ticker in tickers)
        
        # Verificar se contém tickers das operações
        tickers_operacoes = {op["ticker"] for op in sample_operations}
        assert set(tickers) == tickers_operacoes


@pytest.mark.database
class TestCarteiraOperacoes:
    """Testes para operações de carteira"""
    
    def test_atualizar_carteira_nova_posicao(self, sample_user, sample_stocks):
        """Teste atualização de carteira com nova posição"""
        carteira_data = [
            {
                "ticker": "PETR4",
                "quantidade": 100,
                "preco_medio": 30.50,
                "custo_total": 3050.00
            }
        ]
        
        atualizar_carteira(sample_user.id, carteira_data)
        
        carteira = obter_carteira_atual(sample_user.id)
        
        assert len(carteira) == 1
        assert carteira[0]["ticker"] == "PETR4"
        assert carteira[0]["quantidade"] == 100
        assert float(carteira[0]["preco_medio"]) == 30.50
        assert float(carteira[0]["custo_total"]) == 3050.00
    
    def test_atualizar_carteira_multiplas_posicoes(self, sample_user, sample_stocks):
        """Teste atualização com múltiplas posições"""
        carteira_data = [
            {"ticker": "PETR4", "quantidade": 100, "preco_medio": 30.50, "custo_total": 3050.00},
            {"ticker": "VALE3", "quantidade": 200, "preco_medio": 65.80, "custo_total": 13160.00},
            {"ticker": "ITUB4", "quantidade": 300, "preco_medio": 25.40, "custo_total": 7620.00}
        ]
        
        atualizar_carteira(sample_user.id, carteira_data)
        
        carteira = obter_carteira_atual(sample_user.id)
        
        assert len(carteira) == 3
        tickers = {item["ticker"] for item in carteira}
        assert tickers == {"PETR4", "VALE3", "ITUB4"}
    
    def test_limpar_carteira(self, sample_user, sample_stocks):
        """Teste limpeza de carteira"""
        # Primeiro adicionar algumas posições
        carteira_data = [
            {"ticker": "PETR4", "quantidade": 100, "preco_medio": 30.50, "custo_total": 3050.00}
        ]
        atualizar_carteira(sample_user.id, carteira_data)
        
        # Limpar carteira
        limpar_carteira(sample_user.id)
        
        carteira = obter_carteira_atual(sample_user.id)
        assert len(carteira) == 0
    
    def test_carteira_usuario_isolamento(self, sample_user, sample_stocks):
        """Teste isolamento de carteira entre usuários"""
        # Criar outro usuário
        from database import inserir_usuario
        
        outro_user_data = {
            "username": "outro_user",
            "email": "outro@example.com",
            "nome_completo": "Outro Usuário",
            "senha": "senha456"
        }
        outro_user_id = inserir_usuario(outro_user_data)
        
        # Adicionar carteira para cada usuário
        carteira_user1 = [{"ticker": "PETR4", "quantidade": 100, "preco_medio": 30.50, "custo_total": 3050.00}]
        carteira_user2 = [{"ticker": "VALE3", "quantidade": 200, "preco_medio": 65.80, "custo_total": 13160.00}]
        
        atualizar_carteira(sample_user.id, carteira_user1)
        atualizar_carteira(outro_user_id, carteira_user2)
        
        # Verificar isolamento
        carteira1 = obter_carteira_atual(sample_user.id)
        carteira2 = obter_carteira_atual(outro_user_id)
        
        assert len(carteira1) == 1
        assert len(carteira2) == 1
        assert carteira1[0]["ticker"] == "PETR4"
        assert carteira2[0]["ticker"] == "VALE3"


@pytest.mark.database
class TestResultadosMensais:
    """Testes para resultados mensais"""
    
    def test_salvar_resultado_mensal(self, sample_user):
        """Teste salvamento de resultado mensal"""
        resultado = {
            "mes": "2024-01",
            "vendas_swing": 50000.00,
            "custo_swing": 45000.00,
            "ganho_liquido_swing": 5000.00,
            "isento_swing": False,
            "prejuizo_acumulado_swing": 0.00,
            "ir_devido_swing": 750.00,
            "ir_pagar_swing": 750.00,
            "vendas_day_trade": 20000.00,
            "custo_day_trade": 18000.00,
            "ganho_liquido_day": 2000.00,
            "prejuizo_acumulado_day": 0.00,
            "irrf_day": 20.00,
            "ir_devido_day": 400.00,
            "ir_pagar_day": 380.00,
            "irrf_swing": 25.00
        }
        
        salvar_resultado_mensal(sample_user.id, resultado)
        
        # Verificar se foi salvo
        resultado_recuperado = obter_resultado_mensal(sample_user.id, "2024-01")
        
        assert resultado_recuperado is not None
        assert resultado_recuperado["mes"] == "2024-01"
        assert float(resultado_recuperado["vendas_swing"]) == 50000.00
        assert float(resultado_recuperado["ganho_liquido_swing"]) == 5000.00
        assert float(resultado_recuperado["ir_devido_swing"]) == 750.00
    
    def test_obter_resultados_mensais_multiplos(self, sample_user):
        """Teste obtenção de múltiplos resultados mensais"""
        resultados = [
            {"mes": "2024-01", "vendas_swing": 30000.00, "custo_swing": 28000.00, "ganho_liquido_swing": 2000.00, "isento_swing": False, "prejuizo_acumulado_swing": 0.00, "ir_devido_swing": 300.00, "ir_pagar_swing": 300.00, "vendas_day_trade": 0.00, "custo_day_trade": 0.00, "ganho_liquido_day": 0.00, "prejuizo_acumulado_day": 0.00, "irrf_day": 0.00, "ir_devido_day": 0.00, "ir_pagar_day": 0.00, "irrf_swing": 15.00},
            {"mes": "2024-02", "vendas_swing": 25000.00, "custo_swing": 26000.00, "ganho_liquido_swing": -1000.00, "isento_swing": True, "prejuizo_acumulado_swing": 1000.00, "ir_devido_swing": 0.00, "ir_pagar_swing": 0.00, "vendas_day_trade": 15000.00, "custo_day_trade": 14000.00, "ganho_liquido_day": 1000.00, "prejuizo_acumulado_day": 0.00, "irrf_day": 15.00, "ir_devido_day": 200.00, "ir_pagar_day": 185.00, "irrf_swing": 12.50}
        ]
        
        for resultado in resultados:
            salvar_resultado_mensal(sample_user.id, resultado)
        
        todos_resultados = obter_resultados_mensais(sample_user.id)
        
        assert len(todos_resultados) == 2
        meses = {r["mes"] for r in todos_resultados}
        assert meses == {"2024-01", "2024-02"}
    
    def test_atualizar_resultado_mensal_existente(self, sample_user):
        """Teste atualização de resultado mensal existente"""
        resultado_inicial = {
            "mes": "2024-01",
            "vendas_swing": 30000.00,
            "custo_swing": 28000.00,
            "ganho_liquido_swing": 2000.00,
            "isento_swing": False,
            "prejuizo_acumulado_swing": 0.00,
            "ir_devido_swing": 300.00,
            "ir_pagar_swing": 300.00,
            "vendas_day_trade": 0.00,
            "custo_day_trade": 0.00,
            "ganho_liquido_day": 0.00,
            "prejuizo_acumulado_day": 0.00,
            "irrf_day": 0.00,
            "ir_devido_day": 0.00,
            "ir_pagar_day": 0.00,
            "irrf_swing": 15.00
        }
        
        # Salvar resultado inicial
        salvar_resultado_mensal(sample_user.id, resultado_inicial)
        
        # Atualizar resultado
        resultado_atualizado = resultado_inicial.copy()
        resultado_atualizado["vendas_swing"] = 35000.00
        resultado_atualizado["ganho_liquido_swing"] = 7000.00
        resultado_atualizado["ir_devido_swing"] = 1050.00
        
        salvar_resultado_mensal(sample_user.id, resultado_atualizado)
        
        # Verificar atualização
        resultado_final = obter_resultado_mensal(sample_user.id, "2024-01")
        assert float(resultado_final["vendas_swing"]) == 35000.00
        assert float(resultado_final["ganho_liquido_swing"]) == 7000.00


@pytest.mark.database
class TestImportacoes:
    """Testes para operações de importação"""
    
    def test_inserir_importacao(self, sample_user):
        """Teste inserção de importação"""
        importacao_data = {
            "nome_arquivo": "operacoes_teste.json",
            "nome_arquivo_original": "minhas_operacoes.json",
            "tamanho_arquivo": 2048,
            "total_operacoes_arquivo": 10,
            "total_operacoes_importadas": 8,
            "total_operacoes_duplicadas": 2,
            "total_operacoes_erro": 0,
            "status": "concluida",
            "hash_arquivo": "abc123def456"
        }
        
        import_id = inserir_importacao(sample_user.id, importacao_data)
        
        assert import_id is not None
        assert isinstance(import_id, int)
        
        # Verificar se foi salva
        importacao = obter_importacao_por_id(import_id)
        assert importacao is not None
        assert importacao["nome_arquivo"] == "operacoes_teste.json"
        assert importacao["status"] == "concluida"
    
    def test_verificar_arquivo_ja_importado(self, sample_user):
        """Teste verificação de arquivo já importado"""
        hash_arquivo = "hash_unico_123"
        
        # Primeiro deve retornar False (não importado)
        ja_importado = verificar_arquivo_ja_importado(sample_user.id, hash_arquivo)
        assert ja_importado is False
        
        # Inserir importação
        importacao_data = {
            "nome_arquivo": "teste.json",
            "nome_arquivo_original": "teste.json",
            "tamanho_arquivo": 1024,
            "total_operacoes_arquivo": 5,
            "total_operacoes_importadas": 5,
            "total_operacoes_duplicadas": 0,
            "total_operacoes_erro": 0,
            "status": "concluida",
            "hash_arquivo": hash_arquivo
        }
        inserir_importacao(sample_user.id, importacao_data)
        
        # Agora deve retornar True (já importado)
        ja_importado = verificar_arquivo_ja_importado(sample_user.id, hash_arquivo)
        assert ja_importado is True
    
    def test_isolamento_importacoes_usuarios(self, sample_user):
        """Teste isolamento de importações entre usuários"""
        # Criar outro usuário
        from database import inserir_usuario
        
        outro_user_data = {
            "username": "user2",
            "email": "user2@example.com",
            "nome_completo": "Usuário 2",
            "senha": "senha789"
        }
        outro_user_id = inserir_usuario(outro_user_data)
        
        hash_arquivo = "hash_compartilhado_456"
        
        # Usuário 1 importa arquivo
        importacao_data = {
            "nome_arquivo": "arquivo.json",
            "nome_arquivo_original": "arquivo.json",
            "tamanho_arquivo": 1024,
            "total_operacoes_arquivo": 3,
            "total_operacoes_importadas": 3,
            "total_operacoes_duplicadas": 0,
            "total_operacoes_erro": 0,
            "status": "concluida",
            "hash_arquivo": hash_arquivo
        }
        inserir_importacao(sample_user.id, importacao_data)
        
        # Verificar isolamento
        ja_importado_user1 = verificar_arquivo_ja_importado(sample_user.id, hash_arquivo)
        ja_importado_user2 = verificar_arquivo_ja_importado(outro_user_id, hash_arquivo)
        
        assert ja_importado_user1 is True
        assert ja_importado_user2 is False  # Usuário 2 não importou


@pytest.mark.database
class TestOperacoesFechadas:
    """Testes para operações fechadas"""
    
    def test_salvar_operacao_fechada(self, sample_user):
        """Teste salvamento de operação fechada"""
        operacao_fechada = {
            "ticker": "PETR4",
            "data_abertura": date(2024, 1, 10),
            "data_fechamento": date(2024, 1, 15),
            "quantidade": 100,
            "valor_compra": 3050.00,
            "valor_venda": 3200.00,
            "resultado": 150.00,
            "percentual_lucro": 4.92,
            "day_trade": True,
            "tipo": "compra-venda",
            "taxas_total": 15.00,
            "operacoes_relacionadas": ["1001", "1002"],
            "status_ir": "tributavel"
        }
        
        op_id = salvar_operacao_fechada(sample_user.id, operacao_fechada)
        
        assert op_id is not None
        
        # Verificar se foi salva
        operacoes_salvas = obter_operacoes_fechadas_salvas(sample_user.id)
        assert len(operacoes_salvas) == 1
        
        op_salva = operacoes_salvas[0]
        assert op_salva["ticker"] == "PETR4"
        assert op_salva["day_trade"] == True
        assert float(op_salva["resultado"]) == 150.00
    
    def test_obter_operacoes_fechadas_multiplas(self, sample_user):
        """Teste obtenção de múltiplas operações fechadas"""
        operacoes = [
            {
                "ticker": "PETR4",
                "data_abertura": date(2024, 1, 10),
                "data_fechamento": date(2024, 1, 15),
                "quantidade": 100,
                "valor_compra": 3050.00,
                "valor_venda": 3200.00,
                "resultado": 150.00,
                "percentual_lucro": 4.92,
                "day_trade": True,
                "tipo": "compra-venda",
                "taxas_total": 15.00,
                "operacoes_relacionadas": [],
                "status_ir": "tributavel"
            },
            {
                "ticker": "VALE3",
                "data_abertura": date(2024, 1, 5),
                "data_fechamento": date(2024, 2, 10),
                "quantidade": 200,
                "valor_compra": 13000.00,
                "valor_venda": 13500.00,
                "resultado": 500.00,
                "percentual_lucro": 3.85,
                "day_trade": False,
                "tipo": "compra-venda",
                "taxas_total": 25.00,
                "operacoes_relacionadas": [],
                "status_ir": "isento"
            }
        ]
        
        for op in operacoes:
            salvar_operacao_fechada(sample_user.id, op)
        
        operacoes_salvas = obter_operacoes_fechadas_salvas(sample_user.id)
        
        assert len(operacoes_salvas) == 2
        tickers = {op["ticker"] for op in operacoes_salvas}
        assert tickers == {"PETR4", "VALE3"}
        
        # Verificar tipos
        day_trades = [op for op in operacoes_salvas if op["day_trade"]]
        swing_trades = [op for op in operacoes_salvas if not op["day_trade"]]
        
        assert len(day_trades) == 1
        assert len(swing_trades) == 1


@pytest.mark.database
class TestUsuarios:
    """Testes para operações de usuários"""
    
    def test_inserir_usuario(self):
        """Teste inserção de usuário"""
        usuario_data = {
            "username": "novo_user",
            "email": "novo@example.com",
            "nome_completo": "Novo Usuário",
            "cpf": "12345678901",
            "senha": "senha_segura"
        }
        
        user_id = inserir_usuario(usuario_data)
        
        assert user_id is not None
        assert isinstance(user_id, int)
        
        # Verificar se foi salvo
        usuario = obter_usuario_por_id(user_id)
        assert usuario is not None
        assert usuario["username"] == "novo_user"
        assert usuario["email"] == "novo@example.com"
    
    def test_obter_usuario_por_username(self):
        """Teste obtenção de usuário por username"""
        usuario_data = {
            "username": "test_username",
            "email": "test@example.com",
            "nome_completo": "Test User",
            "senha": "password123"
        }
        
        user_id = inserir_usuario(usuario_data)
        usuario = obter_usuario_por_username("test_username")
        
        assert usuario is not None
        assert usuario["id"] == user_id
        assert usuario["username"] == "test_username"
    
    def test_usuario_username_duplicado(self):
        """Teste tentativa de criar usuário com username duplicado"""
        usuario_data = {
            "username": "duplicado",
            "email": "primeiro@example.com",
            "nome_completo": "Primeiro Usuário",
            "senha": "senha1"
        }
        
        # Primeiro usuário
        inserir_usuario(usuario_data)
        
        # Segundo usuário com mesmo username
        usuario_data2 = {
            "username": "duplicado",  # Mesmo username
            "email": "segundo@example.com",
            "nome_completo": "Segundo Usuário",
            "senha": "senha2"
        }
        
        with pytest.raises(Exception):  # Deve falhar por constraint de unicidade
            inserir_usuario(usuario_data2)


@pytest.mark.database
@pytest.mark.slow
class TestPerformanceBanco:
    """Testes de performance do banco de dados"""
    
    def test_insercao_bulk_operacoes(self, sample_user, sample_stocks):
        """Teste inserção em massa de operações"""
        import time
        
        # Gerar 1000 operações
        operacoes = []
        base_date = date(2024, 1, 1)
        
        for i in range(1000):
            operacao = {
                "date": base_date + timedelta(days=i % 365),
                "ticker": ["PETR4", "VALE3", "ITUB4", "BBAS3"][i % 4],
                "operation": "buy" if i % 2 == 0 else "sell",
                "quantity": 100,
                "price": 30.00 + (i % 20),
                "fees": 5.00 + (i % 10)
            }
            operacoes.append(operacao)
        
        # Medir tempo de inserção
        start_time = time.time()
        
        for operacao in operacoes:
            inserir_operacao(operacao, sample_user.id)
        
        end_time = time.time()
        tempo_total = end_time - start_time
        
        # Verificar performance (deve ser razoável)
        assert tempo_total < 30.0  # Menos de 30 segundos para 1000 operações
        
        # Verificar se todas foram inseridas
        todas_operacoes = obter_todas_operacoes(sample_user.id)
        assert len(todas_operacoes) == 1000
    
    def test_consulta_performance_operacoes(self, sample_user, sample_stocks):
        """Teste performance de consultas de operações"""
        import time
        
        # Inserir muitas operações primeiro
        for i in range(500):
            operacao = {
                "date": date(2024, 1, 1) + timedelta(days=i % 100),
                "ticker": ["PETR4", "VALE3"][i % 2],
                "operation": "buy" if i % 2 == 0 else "sell",
                "quantity": 100,
                "price": 30.00,
                "fees": 5.00
            }
            inserir_operacao(operacao, sample_user.id)
        
        # Medir tempo de consulta
        start_time = time.time()
        
        for _ in range(100):  # 100 consultas
            obter_todas_operacoes(sample_user.id)
        
        end_time = time.time()
        tempo_total = end_time - start_time
        
        # Performance deve ser boa (menos de 5 segundos para 100 consultas)
        assert tempo_total < 5.0
        
        # Medir tempo de consulta por ticker
        start_time = time.time()
        
        for _ in range(50):
            obter_tickers_operados_por_usuario(sample_user.id)
        
        end_time = time.time()
        tempo_consulta_tickers = end_time - start_time
        
        assert tempo_consulta_tickers < 2.0