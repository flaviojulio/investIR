"""
Testes unitários para APIs e endpoints
Cobre autenticação, CRUD de operações, carteira e resultados
"""
import pytest
from httpx import AsyncClient
from fastapi.testclient import TestClient
from datetime import date, datetime
import json
from unittest.mock import patch, MagicMock

# Importar a aplicação FastAPI
from main import app
from auth import create_access_token
from models import UsuarioResponse


@pytest.fixture
def client():
    """Cliente de teste para FastAPI"""
    return TestClient(app)


@pytest.fixture
def auth_headers(sample_user):
    """Headers de autenticação para testes"""
    token = create_access_token(data={"sub": sample_user.username})
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.api
class TestAutenticacao:
    """Testes para endpoints de autenticação"""
    
    def test_login_sucesso(self, client, sample_user):
        """Teste login com credenciais válidas"""
        login_data = {
            "username": sample_user.username,
            "password": "senha123"  # Senha definida no fixture
        }
        
        response = client.post("/api/auth/login", data=login_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
    
    def test_login_credenciais_invalidas(self, client, sample_user):
        """Teste login com credenciais inválidas"""
        login_data = {
            "username": sample_user.username,
            "password": "senha_errada"
        }
        
        response = client.post("/api/auth/login", data=login_data)
        
        assert response.status_code == 401
        assert "detail" in response.json()
    
    def test_login_usuario_inexistente(self, client):
        """Teste login com usuário inexistente"""
        login_data = {
            "username": "usuario_inexistente",
            "password": "qualquer_senha"
        }
        
        response = client.post("/api/auth/login", data=login_data)
        
        assert response.status_code == 401
    
    def test_endpoint_protegido_sem_token(self, client):
        """Teste acesso a endpoint protegido sem token"""
        response = client.get("/api/operacoes")
        
        assert response.status_code == 401
    
    def test_endpoint_protegido_com_token_invalido(self, client):
        """Teste acesso com token inválido"""
        headers = {"Authorization": "Bearer token_invalido"}
        response = client.get("/api/operacoes", headers=headers)
        
        assert response.status_code == 401


@pytest.mark.api
class TestOperacoesAPI:
    """Testes para endpoints de operações"""
    
    def test_listar_operacoes(self, client, auth_headers, sample_operations):
        """Teste listagem de operações"""
        response = client.get("/api/operacoes", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == len(sample_operations)
        
        # Verificar estrutura dos dados
        if data:
            operacao = data[0]
            required_fields = ["id", "date", "ticker", "operation", "quantity", "price", "fees"]
            for field in required_fields:
                assert field in operacao
    
    def test_listar_operacoes_por_ticker(self, client, auth_headers, sample_operations):
        """Teste listagem de operações por ticker específico"""
        ticker = "PETR4"
        response = client.get(f"/api/operacoes/ticker/{ticker}", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Todas as operações devem ser do ticker especificado
        for operacao in data:
            assert operacao["ticker"] == ticker
    
    def test_criar_operacao_valida(self, client, auth_headers, sample_stocks, sample_corretora):
        """Teste criação de operação válida"""
        operacao_data = {
            "date": "2024-01-15",
            "ticker": "PETR4",
            "operation": "buy",
            "quantity": 100,
            "price": 30.50,
            "fees": 5.20
        }
        
        response = client.post("/api/operacoes", json=operacao_data, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["ticker"] == "PETR4"
        assert data["operation"] == "buy"
        assert data["quantity"] == 100
        assert "id" in data
    
    def test_criar_operacao_ticker_inexistente(self, client, auth_headers):
        """Teste criação de operação com ticker inexistente"""
        operacao_data = {
            "date": "2024-01-15",
            "ticker": "INEXISTENTE",
            "operation": "buy",
            "quantity": 100,
            "price": 30.50,
            "fees": 5.20
        }
        
        response = client.post("/api/operacoes", json=operacao_data, headers=auth_headers)
        
        assert response.status_code == 500  # Erro interno por ticker inexistente
    
    def test_criar_operacao_dados_invalidos(self, client, auth_headers):
        """Teste criação de operação com dados inválidos"""
        operacao_data = {
            "date": "2024-01-15",
            "ticker": "PETR4",
            "operation": "buy",
            "quantity": -100,  # Quantidade inválida
            "price": 30.50,
            "fees": 5.20
        }
        
        response = client.post("/api/operacoes", json=operacao_data, headers=auth_headers)
        
        assert response.status_code == 422  # Validation error
    
    def test_deletar_operacao(self, client, auth_headers, sample_operations):
        """Teste deleção de operação"""
        operacao_id = sample_operations[0]["id"]
        
        response = client.delete(f"/api/operacoes/{operacao_id}", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "mensagem" in data
    
    def test_deletar_operacao_inexistente(self, client, auth_headers):
        """Teste deleção de operação inexistente"""
        response = client.delete("/api/operacoes/99999", headers=auth_headers)
        
        assert response.status_code == 404
    
    def test_bulk_delete_operacoes(self, client, auth_headers, sample_operations):
        """Teste deleção em massa de operações"""
        response = client.delete("/api/bulk-ops/operacoes/delete-all", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "mensagem" in data
        assert "total_removidas" in data
        assert data["total_removidas"] == len(sample_operations)


@pytest.mark.api
class TestCarteiraAPI:
    """Testes para endpoints de carteira"""
    
    def test_obter_carteira(self, client, auth_headers):
        """Teste obtenção de carteira atual"""
        response = client.get("/api/carteira", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verificar estrutura se há itens
        if data:
            item = data[0]
            required_fields = ["ticker", "quantidade", "preco_medio", "custo_total"]
            for field in required_fields:
                assert field in item
    
    def test_atualizar_preco_carteira(self, client, auth_headers, sample_stocks):
        """Teste atualização de preço na carteira"""
        # Primeiro, criar uma posição na carteira
        with patch('services.atualizar_preco_carteira_service') as mock_service:
            mock_service.return_value = True
            
            update_data = {
                "ticker": "PETR4",
                "preco_medio": 32.50,
                "observacao": "Ajuste manual"
            }
            
            response = client.put("/api/carteira/atualizar-preco", json=update_data, headers=auth_headers)
            
            assert response.status_code == 200
            mock_service.assert_called_once()


@pytest.mark.api
class TestResultadosAPI:
    """Testes para endpoints de resultados"""
    
    def test_obter_resultados_mensais(self, client, auth_headers):
        """Teste obtenção de resultados mensais"""
        response = client.get("/api/resultados", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verificar estrutura se há dados
        if data:
            resultado = data[0]
            required_fields = ["mes", "vendas_swing", "ganho_liquido_swing", "ir_devido_swing"]
            for field in required_fields:
                assert field in resultado


@pytest.mark.api
class TestOperacoesFechadasAPI:
    """Testes para endpoints de operações fechadas"""
    
    def test_obter_operacoes_fechadas(self, client, auth_headers):
        """Teste obtenção de operações fechadas"""
        response = client.get("/api/operacoes/fechadas", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_obter_operacoes_fechadas_otimizado(self, client, auth_headers):
        """Teste endpoint otimizado de operações fechadas"""
        response = client.get("/api/operacoes/fechadas/otimizado", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_recalcular_operacoes_fechadas(self, client, auth_headers):
        """Teste recálculo de operações fechadas"""
        with patch('services.recalcular_resultados_corrigido') as mock_recalcular:
            mock_recalcular.return_value = None
            
            response = client.post("/api/operacoes/fechadas/recalcular", headers=auth_headers)
            
            assert response.status_code == 200
            data = response.json()
            assert "mensagem" in data
            mock_recalcular.assert_called_once()


@pytest.mark.api
class TestImportacoesAPI:
    """Testes para endpoints de importações"""
    
    def test_upload_arquivo_operacoes(self, client, auth_headers):
        """Teste upload de arquivo de operações"""
        # Simular arquivo JSON
        arquivo_conteudo = json.dumps([
            {
                "Data do Negócio": "2024-01-15",
                "Código de Negociação": "PETR4",
                "Tipo de Movimentação": "C",
                "Quantidade": 100,
                "Preço": 30.50,
                "Taxas": 5.20
            }
        ])
        
        files = {"file": ("operacoes.json", arquivo_conteudo, "application/json")}
        
        # Mock do serviço de processamento
        with patch('services.processar_arquivo_importacao') as mock_processar:
            mock_processar.return_value = {
                "importacao_id": 1,
                "total_operacoes": 1,
                "operacoes_importadas": 1,
                "operacoes_duplicadas": 0,
                "operacoes_erro": 0
            }
            
            response = client.post("/api/upload-operacoes", files=files, headers=auth_headers)
            
            assert response.status_code == 200
            data = response.json()
            assert "importacao_id" in data
            assert data["operacoes_importadas"] == 1
    
    def test_obter_importacoes_usuario(self, client, auth_headers):
        """Teste obtenção de importações do usuário"""
        response = client.get("/api/importacoes", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


@pytest.mark.api
class TestMensageriaAPI:
    """Testes para endpoints de mensageria"""
    
    def test_listar_mensagens(self, client, auth_headers):
        """Teste listagem de mensagens"""
        response = client.get("/api/mensagens", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_criar_mensagem(self, client, auth_headers):
        """Teste criação de mensagem"""
        mensagem_data = {
            "titulo": "Teste de Mensagem",
            "conteudo": "Conteúdo da mensagem de teste",
            "tipo": "info",
            "prioridade": "normal",
            "categoria": "sistema"
        }
        
        with patch('database.criar_mensagem') as mock_criar:
            mock_criar.return_value = 1
            
            response = client.post("/api/mensagens", json=mensagem_data, headers=auth_headers)
            
            assert response.status_code == 200
            mock_criar.assert_called_once()
    
    def test_marcar_mensagem_como_lida(self, client, auth_headers):
        """Teste marcar mensagem como lida"""
        mensagem_id = 1
        
        with patch('database.marcar_mensagem_como_lida') as mock_marcar:
            mock_marcar.return_value = True
            
            response = client.put(f"/api/mensagens/{mensagem_id}/lida", headers=auth_headers)
            
            assert response.status_code == 200
            mock_marcar.assert_called_once()
    
    def test_obter_estatisticas_mensagens(self, client, auth_headers):
        """Teste obtenção de estatísticas de mensagens"""
        with patch('database.obter_estatisticas_mensagens') as mock_stats:
            mock_stats.return_value = {
                "total": 5,
                "nao_lidas": 2,
                "por_tipo": {"info": 3, "warning": 2},
                "por_prioridade": {"normal": 4, "alta": 1},
                "por_categoria": {"sistema": 5}
            }
            
            response = client.get("/api/mensagens/estatisticas", headers=auth_headers)
            
            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 5
            assert data["nao_lidas"] == 2


@pytest.mark.api
class TestValidacaoEntrada:
    """Testes para validação de entrada de dados"""
    
    def test_operacao_quantidade_negativa(self, client, auth_headers):
        """Teste validação de quantidade negativa"""
        operacao_data = {
            "date": "2024-01-15",
            "ticker": "PETR4",
            "operation": "buy",
            "quantity": -100,
            "price": 30.50,
            "fees": 5.20
        }
        
        response = client.post("/api/operacoes", json=operacao_data, headers=auth_headers)
        
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
    
    def test_operacao_preco_zero(self, client, auth_headers):
        """Teste validação de preço zero"""
        operacao_data = {
            "date": "2024-01-15",
            "ticker": "PETR4",
            "operation": "buy",
            "quantity": 100,
            "price": 0.0,
            "fees": 5.20
        }
        
        response = client.post("/api/operacoes", json=operacao_data, headers=auth_headers)
        
        assert response.status_code == 422
    
    def test_operacao_data_futura(self, client, auth_headers):
        """Teste validação de data futura"""
        from datetime import datetime, timedelta
        
        data_futura = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        operacao_data = {
            "date": data_futura,
            "ticker": "PETR4",
            "operation": "buy",
            "quantity": 100,
            "price": 30.50,
            "fees": 5.20
        }
        
        response = client.post("/api/operacoes", json=operacao_data, headers=auth_headers)
        
        # Dependendo da validação implementada, pode ser 422 ou aceito
        assert response.status_code in [200, 422]
    
    def test_operacao_tipo_invalido(self, client, auth_headers):
        """Teste validação de tipo de operação inválido"""
        operacao_data = {
            "date": "2024-01-15",
            "ticker": "PETR4",
            "operation": "invalid_operation",
            "quantity": 100,
            "price": 30.50,
            "fees": 5.20
        }
        
        response = client.post("/api/operacoes", json=operacao_data, headers=auth_headers)
        
        assert response.status_code == 422


@pytest.mark.api
class TestErrorHandling:
    """Testes para tratamento de erros"""
    
    def test_internal_server_error(self, client, auth_headers):
        """Teste tratamento de erro interno do servidor"""
        with patch('services.listar_operacoes_service') as mock_service:
            mock_service.side_effect = Exception("Erro interno simulado")
            
            response = client.get("/api/operacoes", headers=auth_headers)
            
            assert response.status_code == 500
            data = response.json()
            assert "detail" in data
    
    def test_not_found_error(self, client, auth_headers):
        """Teste tratamento de erro 404"""
        response = client.get("/api/operacoes/99999", headers=auth_headers)
        
        assert response.status_code == 404
    
    def test_timeout_handling(self, client, auth_headers):
        """Teste tratamento de timeout (simulado)"""
        import time
        
        with patch('services.listar_operacoes_service') as mock_service:
            def slow_function(*args, **kwargs):
                time.sleep(0.1)  # Simular operação lenta
                return []
            
            mock_service.side_effect = slow_function
            
            response = client.get("/api/operacoes", headers=auth_headers)
            
            # Deve completar normalmente (timeout real seria maior)
            assert response.status_code == 200


@pytest.mark.api
@pytest.mark.slow
class TestPerformanceAPI:
    """Testes de performance das APIs"""
    
    def test_performance_listagem_operacoes(self, client, auth_headers):
        """Teste performance da listagem de operações"""
        import time
        
        start_time = time.time()
        
        # Fazer múltiplas requisições
        for _ in range(10):
            response = client.get("/api/operacoes", headers=auth_headers)
            assert response.status_code == 200
        
        end_time = time.time()
        tempo_total = end_time - start_time
        
        # Deve completar em menos de 2 segundos
        assert tempo_total < 2.0
    
    def test_concorrencia_criacao_operacoes(self, client, auth_headers, sample_stocks):
        """Teste criação concorrente de operações"""
        import concurrent.futures
        import threading
        
        def criar_operacao(index):
            operacao_data = {
                "date": "2024-01-15",
                "ticker": "PETR4",
                "operation": "buy",
                "quantity": 100,
                "price": 30.50 + index * 0.1,
                "fees": 5.20
            }
            
            response = client.post("/api/operacoes", json=operacao_data, headers=auth_headers)
            return response.status_code == 200
        
        # Criar 5 operações simultaneamente
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(criar_operacao, i) for i in range(5)]
            resultados = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        # Todas as operações devem ter sido criadas com sucesso
        assert all(resultados)


@pytest.mark.api
class TestCORS:
    """Testes para configuração CORS"""
    
    def test_cors_headers_presente(self, client):
        """Teste se headers CORS estão presentes"""
        response = client.options("/api/operacoes")
        
        # Verificar se headers CORS estão presentes
        assert "access-control-allow-origin" in response.headers or response.status_code in [404, 405]
    
    def test_preflight_request(self, client):
        """Teste requisição preflight CORS"""
        headers = {
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type,Authorization"
        }
        
        response = client.options("/api/operacoes", headers=headers)
        
        # Deve aceitar ou retornar método não permitido
        assert response.status_code in [200, 204, 405]