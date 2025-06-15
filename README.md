# InvestIR - Apuração de Imposto de Renda para Ações

## Sobre o Projeto

InvestIR é uma aplicação FullStack projetada para auxiliar investidores no acompanhamento de suas carteiras de ações e na apuração do Imposto de Renda (IR) devido em operações de compra e venda, incluindo day trade e swing trade. O sistema permite o upload de operações, cálculo de resultados mensais, visualização da carteira atualizada e geração de informações relevantes para a declaração de IR.

## Principais Funcionalidades

*   **Upload de Operações**: Importação de operações de compra e venda a partir de um arquivo JSON.
*   **Registro Manual de Operações**: Permite adicionar operações individualmente.
*   **Cálculo de Carteira Atual**: Exibe a posição atualizada em cada ativo, incluindo quantidade, preço médio, custo total e nome da empresa.
*   **Apuração de Resultados Mensais**: Calcula os resultados de swing trade e day trade para cada mês, considerando prejuízos acumulados e isenções.
*   **Geração de DARF (simulado)**: Informa valores de IR a pagar e datas de vencimento.
*   **Listagem de Ações**: Permite visualizar todas as ações/ativos cadastrados no sistema.
*   **Autenticação de Usuários**: Sistema de registro, login e gerenciamento de sessão.

## Estrutura do Banco de Dados

O sistema utiliza um banco de dados SQLite para armazenar as informações. As principais tabelas incluem:

*   **`acoes`**: Armazena informações cadastrais sobre as ações e outros ativos negociáveis.
    *   `id`: INTEGER PRIMARY KEY AUTOINCREMENT - Identificador único da ação.
    *   `ticker`: TEXT NOT NULL UNIQUE - Código de negociação do ativo (ex: PETR4, MGLU3).
    *   `nome`: TEXT - Nome popular ou de referência da empresa/ativo.
    *   `razao_social`: TEXT - Razão social da empresa.
    *   `cnpj`: TEXT - CNPJ da empresa.
    *   `ri`: TEXT - Link para o site de Relações com Investidores (RI) da empresa.
    *   `classificacao`: TEXT - Classificação setorial do ativo.
    *   `isin`: TEXT - Código ISIN do ativo.

*   **`operacoes`**: Registra todas as operações de compra e venda realizadas pelo usuário.
*   **`carteira_atual`**: Mantém a posição consolidada do usuário em cada ativo.
*   **`resultados_mensais`**: Armazena os resultados apurados mensalmente para fins de IR.
*   **`operacoes_fechadas`**: Guarda o detalhamento de operações de compra e venda que foram concluídas (lucro/prejuízo realizado).
*   Tabelas de autenticação (`usuarios`, `funcoes`, etc.).

## Principais Endpoints da API

A API é construída com FastAPI e segue um padrão RESTful.

*   **`GET /api/acoes`**
    *   **Propósito**: Lista todas as ações/ativos disponíveis cadastrados no sistema.
    *   **Autenticação**: Não requerida.
    *   **Resposta**: Uma lista de objetos `AcaoInfo`, cada um contendo: `ticker`, `nome`, `razao_social`, `cnpj`, `ri`, `classificacao`, `isin`.

*   **`POST /api/upload`**
    *   **Propósito**: Permite o upload de um arquivo JSON contendo uma lista de operações.
    *   **Autenticação**: Requerida.
    *   **Validação**: O `ticker` de cada operação no arquivo é validado contra a tabela `acoes`. Se um ticker inválido ou não existente for encontrado, a API retornará um erro HTTP 400 e o processamento do lote será interrompido.

*   **`POST /api/operacoes`**
    *   **Propósito**: Permite adicionar uma nova operação manualmente.
    *   **Autenticação**: Requerida.
    *   **Validação**: O `ticker` fornecido na operação é validado contra a tabela `acoes`. Se o ticker for inválido ou não existente, a API retornará um erro HTTP 400.

*   **`GET /api/carteira`**
    *   **Propósito**: Retorna a carteira de ações atualizada do usuário autenticado.
    *   **Autenticação**: Requerida.
    *   **Resposta**: Lista de objetos representando cada posição na carteira. Cada objeto agora inclui o campo `nome` (nome da ação, obtido da tabela `acoes`), além de `ticker`, `quantidade`, `preco_medio`, e `custo_total`.

*   **`GET /api/resultados`**
    *   **Propósito**: Retorna os resultados mensais apurados para o IR do usuário autenticado.
    *   **Autenticação**: Requerida.

*   **Endpoints de Autenticação**:
    *   `POST /api/auth/registrar`: Para registro de novos usuários.
    *   `POST /api/auth/login`: Para login e obtenção de token de acesso.
    *   `GET /api/auth/me`: Retorna informações do usuário autenticado.

## Como Executar

**Pré-requisitos**: Python 3.8+, Node.js e npm/yarn.

**Backend**:
1.  Navegue até a pasta `backend`.
2.  Crie um ambiente virtual: `python -m venv venv`
3.  Ative o ambiente virtual: `source venv/bin/activate` (Linux/macOS) ou `venv\\Scripts\\activate` (Windows).
4.  Instale as dependências: `pip install -r requirements.txt`.
5.  Execute o servidor FastAPI: `uvicorn main:app --reload --port 8000`.

**Frontend**:
1.  Navegue até a pasta `frontend`.
2.  Instale as dependências: `npm install` (ou `yarn install`).
3.  Execute o servidor de desenvolvimento Next.js: `npm run dev` (ou `yarn dev`).
4.  Acesse a aplicação em `http://localhost:3000`.

**Nota**: A primeira execução do backend criará o banco de dados `acoes_ir.db` com as tabelas necessárias. A tabela `acoes` precisará ser populada manualmente ou através de um script/processo de administração separado com as informações das empresas/ativos desejados.

## Tecnologias Utilizadas

*   **Backend**: Python, FastAPI, Pydantic, SQLite.
*   **Frontend**: TypeScript, React, Next.js, Shadcn/UI, Tailwind CSS.
*   **Autenticação**: JWT (JSON Web Tokens).

Este projeto é uma ferramenta para aprendizado e demonstração de desenvolvimento FullStack com foco em aplicações financeiras.
