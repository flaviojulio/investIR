# Changelog

Este arquivo documenta as principais mudanças e correções implementadas no sistema.

## [Não Liberado]

### Mudanças Significativas
- **Nova Tabela `acoes`**: Introduzida a tabela `acoes` no banco de dados, substituindo a antiga tabela `stocks`. A nova estrutura inclui os campos: `id` (INTEGER PRIMARY KEY AUTOINCREMENT), `ticker` (TEXT NOT NULL UNIQUE), `nome` (TEXT), `razao_social` (TEXT), `cnpj` (TEXT), `ri` (TEXT), `classificacao` (TEXT), e `isin` (TEXT).
- **Validação de Ticker nas Operações**: Ao inserir uma nova operação (manual ou via upload), o ticker informado é agora validado contra a tabela `acoes`. Se o ticker não existir na tabela `acoes`, a operação é rejeitada e um erro (HTTP 400) é retornado ao cliente.
- **Endpoint de Listagem de Ações**: Adicionado um novo endpoint GET `/api/acoes` que permite listar todas as ações (empresas) cadastradas no sistema. Este endpoint é público.
- **Melhoria no Endpoint de Carteira**: O endpoint GET `/api/carteira` foi atualizado para incluir o `nome` da ação (obtido da tabela `acoes`) em cada item da carteira retornada, enriquecendo a informação disponível para o frontend.
- **Remoção do Script de População de Ações**: O script `backend/populate_stocks.py` (que populava a antiga tabela `stocks`) foi removido. A responsabilidade de popular a nova tabela `acoes` com os dados corretos das empresas agora é externa ao versionamento do código principal da aplicação (provavelmente via um script separado ou processo de administração).
- **Renomeações Internas para Consistência**: Diversos modelos Pydantic, funções de serviço e funções de banco de dados foram renomeados para refletir a mudança conceitual de "stocks" (cotações/informações de mercado) para "acoes" (empresas/entidades). Exemplos incluem:
    - Modelo Pydantic: `StockInfo` renomeado para `AcaoInfo`.
    - Endpoint API: `/api/stocks` renomeado para `/api/acoes`.
    - Funções de serviço: `listar_todos_stocks_service` para `listar_todas_acoes_service`.
    - Funções de banco de dados: `obter_todos_stocks` para `obter_todas_acoes`.
- **Melhoria na Adição de Operações (Frontend)**: O formulário de adicionar nova operação (`AddOperation.tsx`) agora utiliza um seletor com busca (Combobox) para o campo "Ticker". Este Combobox é populado com dados da API `/api/acoes`, substituindo a entrada de texto manual e melhorando a experiência do usuário e a validação dos dados.
- **Exibição do Nome da Ação na Carteira (Frontend)**: A tabela da carteira (`StockTable.tsx`) agora exibe uma coluna com o "Nome" da ação, além do ticker. Esta nova coluna também permite ordenação e foi incluída na funcionalidade de busca/filtro da tabela.
- **Tipos Frontend Atualizados**: A interface `CarteiraItem` em `frontend/lib/types.ts` foi atualizada para incluir o campo opcional `nome?: string;`. Adicionalmente, uma nova interface `AcaoInfo` foi criada para tipar os dados das ações buscados da API `/api/acoes`, correspondendo ao modelo Pydantic do backend.

### Gerenciamento de Proventos (Backend)
- **Nova Tabela `proventos`**: Adicionada tabela `proventos` ao banco de dados para armazenar dividendos, JCP (Juros sobre Capital Próprio), rendimentos, etc. Campos: `id` (INTEGER PRIMARY KEY AUTOINCREMENT), `id_acao` (INTEGER, FOREIGN KEY REFERENCES `acoes(id)`), `tipo` (TEXT), `valor` (REAL), `data_registro` (TEXT YYYY-MM-DD), `data_ex` (TEXT YYYY-MM-DD), `dt_pagamento` (TEXT YYYY-MM-DD).
- **Modelos Pydantic para Proventos**: Criados os modelos `ProventoBase`, `ProventoCreate`, e `ProventoInfo` em `backend/models.py`.
    - `ProventoCreate` é usado para a entrada de dados e inclui validadores para converter `valor` (string com vírgula ou ponto) para `float` e datas (strings "DD/MM/YYYY") para objetos `date`.
    - `ProventoInfo` é usado para respostas da API, com campos de data formatados como "YYYY-MM-DD".
- **Lógica de Banco de Dados e Serviços**: Implementadas funções em `backend/database.py` (`inserir_provento`, `obter_proventos_por_acao_id`, `obter_provento_por_id`, `obter_todos_proventos`, `obter_acao_por_id`) e em `backend/services.py` (`registrar_provento_service`, `listar_proventos_por_acao_service`, `listar_todos_proventos_service`) para gerenciar a criação e listagem de proventos, incluindo validações de existência da `id_acao`.
- **Novos Endpoints da API para Proventos**:
    - `POST /api/acoes/{id_acao}/proventos`: Para registrar um novo provento associado a uma ação específica. Requer autenticação.
    - `GET /api/acoes/{id_acao}/proventos`: Para listar todos os proventos de uma ação específica. Requer autenticação.
    - `GET /api/proventos/`: Para listar todos os proventos de todas as ações cadastradas no sistema. Endpoint público.

### Gerenciamento de Eventos Corporativos (Backend)
- **Nova Tabela `eventos_corporativos`**: Adicionada tabela `eventos_corporativos` ao banco de dados para armazenar desdobramentos, bonificações, grupamentos, etc. Campos: `id` (INTEGER PRIMARY KEY AUTOINCREMENT), `id_acao` (INTEGER NOT NULL, FOREIGN KEY REFERENCES `acoes(id)`), `evento` (TEXT NOT NULL), `data_aprovacao` (TEXT YYYY-MM-DD, opcional), `data_registro` (TEXT YYYY-MM-DD, opcional), `data_ex` (TEXT YYYY-MM-DD, opcional), `razao` (TEXT, opcional, e.g., "1:5", "10%").
- **Modelos Pydantic para Eventos Corporativos**: Criados os modelos `EventoCorporativoBase`, `EventoCorporativoCreate`, e `EventoCorporativoInfo` em `backend/models.py`.
    - `EventoCorporativoCreate` é usado para a entrada de dados e inclui validadores para converter datas opcionais (strings "DD/MM/YYYY" ou `None`) para objetos `date` ou `None`.
    - `EventoCorporativoInfo` é usado para respostas da API, com campos de data formatados como "YYYY-MM-DD" ou `null`.
- **Lógica de Banco de Dados e Serviços**: Implementadas funções em `backend/database.py` (`inserir_evento_corporativo`, `obter_eventos_corporativos_por_acao_id`, `obter_evento_corporativo_por_id`, `obter_todos_eventos_corporativos`) e em `backend/services.py` (`registrar_evento_corporativo_service`, `listar_eventos_corporativos_por_acao_service`, `listar_todos_eventos_corporativos_service`) para gerenciar a criação e listagem de eventos corporativos, incluindo validações de existência da `id_acao`.
- **Novos Endpoints da API para Eventos Corporativos**:
    - `POST /api/acoes/{id_acao}/eventos_corporativos`: Para registrar um novo evento corporativo associado a uma ação específica. Requer autenticação.
    - `GET /api/acoes/{id_acao}/eventos_corporativos`: Para listar todos os eventos corporativos de uma ação específica. Requer autenticação.
    - `GET /api/eventos_corporativos/`: Para listar todos os eventos corporativos de todas as ações cadastradas no sistema. Requer autenticação.

### Tipagem de Datas no Banco de Dados
- As colunas de data nas tabelas `proventos` (`data_registro`, `data_ex`, `dt_pagamento`) e `eventos_corporativos` (`data_aprovacao`, `data_registro`, `data_ex`) foram alteradas de `TEXT` para `DATE` nas declarações `CREATE TABLE` em `backend/database.py`.
- Esta mudança visa melhorar a semântica do esquema. A aplicação continua a interagir com o banco de dados usando strings no formato ISO "YYYY-MM-DD" para esses campos, o que é compatível com a afinidade de tipo `DATE` no SQLite (que internamente pode armazená-los como TEXT, REAL ou INTEGER).

### Cálculo e Exibição de Proventos por Usuário (Backend)
- **Lógica de Cálculo**: Implementada funcionalidade para calcular os proventos recebidos por um usuário específico, baseando-se na quantidade de ações que o usuário possuía na data anterior à `data_ex` do provento global. Esta lógica utiliza a função `obter_saldo_acao_em_data` para determinar a quantidade de ações relevantes.
- **Serviços de Agregação**: Desenvolvidos serviços (`gerar_resumo_proventos_anuais_usuario_service`, `gerar_resumo_proventos_mensais_usuario_service`, `gerar_resumo_proventos_por_acao_usuario_service`) para gerar resumos anuais, mensais (filtrados por ano) e por ação dos proventos recebidos pelo usuário.
- **Novos Modelos Pydantic**: Adicionados modelos (`ProventoRecebidoUsuario`, `DetalheTipoProvento`, `ResumoProventoAnual`, `ResumoProventoMensal`, `ResumoProventoPorAcao`) em `backend/models.py` para estruturar os dados de entrada e saída para os novos serviços e endpoints de resumo de proventos.
- **Novos Endpoints da API (Autenticados)**:
    - `GET /api/usuario/proventos/`: Lista detalhada de todos os proventos calculados para o usuário logado, utilizando o modelo `ProventoRecebidoUsuario`.
    - `GET /api/usuario/proventos/resumo_anual/`: Retorna um resumo anual dos proventos do usuário, utilizando o modelo `ResumoProventoAnual`.
    - `GET /api/usuario/proventos/resumo_mensal/{ano}/`: Retorna um resumo mensal dos proventos do usuário para um ano específico (com validação de `ano`), utilizando o modelo `ResumoProventoMensal`.
    - `GET /api/usuario/proventos/resumo_por_acao/`: Retorna um resumo dos proventos do usuário agregado por ação, utilizando o modelo `ResumoProventoPorAcao`.

### Nova Página de Proventos (Frontend)
- **Layout e Navegação**: Criada a página `/proventos` (`frontend/app/proventos/page.tsx`) e adicionado um link "Proventos" na sidebar de navegação principal, facilitando o acesso à nova funcionalidade.
- **Tipos e API**: Definidas interfaces TypeScript (`ProventoRecebidoUsuario`, `ResumoProventoAnualAPI`, etc.) em `frontend/lib/types.ts` para tipar os dados de proventos. Criadas funções em `frontend/lib/api.ts` para buscar os dados dos novos endpoints de proventos do usuário.
- **Filtro por Ano**: Implementado um componente seletor de ano na página, permitindo ao usuário filtrar os dados exibidos nos cards informativos, gráfico de pizza por ação e na tabela detalhada de proventos para um ano específico. Os anos disponíveis no seletor são populados dinamicamente com base nos dados anuais de proventos do usuário.
- **Cards Informativos**: Adicionados cards de resumo no topo da página (`frontend/components/InfoCard.tsx` reutilizado) que exibem informações chave para o ano selecionado, como: Total Recebido no Ano, Total de Dividendos, Total de JCP e a Ação com Maior Pagamento no Ano.
- **Gráficos Interativos**:
    - **Gráfico Anual**: Um gráfico de barras empilhadas exibe o total de proventos recebidos por ano (Dividendos, JCP, Outros) agregando todos os anos com dados.
    - **Gráfico Mensal**: Um gráfico de barras empilhadas detalha os proventos recebidos a cada mês (Dividendos, JCP, Outros) para o ano selecionado no filtro.
    - **Gráfico de Pizza por Ação**: Um gráfico de pizza mostra a distribuição percentual do total de proventos recebidos por cada ação no ano selecionado.
    - Todos os gráficos utilizam a biblioteca `recharts` e wrappers customizados (`ChartContainer`, etc.) para consistência visual e interatividade (tooltips, legendas).
- **Tabela Detalhada de Proventos**: Implementado o componente `frontend/components/TabelaProventos.tsx` que exibe uma lista detalhada de todos os proventos recebidos pelo usuário. As colunas incluem Data Ex, Data de Pagamento, Ticker da Ação, Nome da Ação, Tipo de Provento, Quantidade de Ações na Data Ex, Valor Unitário do Provento e Valor Total Recebido. A tabela possui:
    - Ordenação clicável para as principais colunas.
    - Formatação de datas e valores monetários.
    - Design responsivo com ocultação de colunas menos críticas em telas menores.
    - Filtragem dos dados exibidos de acordo com o ano selecionado no filtro da página (ou todos os proventos se nenhum ano for selecionado).

### Correções e Ajustes
- **Correção**: Corrigido erro `ReferenceError: useMemo is not defined` na página "Meus Proventos" (`frontend/app/proventos/page.tsx`) pela adição da importação faltante do hook `useMemo` do React.
- **Ajuste de UI**: O link de navegação "Proventos" na sidebar (`backend/components/app-sidebar.tsx`) foi reposicionado para aparecer imediatamente após "Visão Geral" (Dashboard) para melhor fluxo de usuário.
- **Correção de Autenticação (Frontend)**: Resolvido problema que causava erros `401 Unauthorized` em chamadas à API para rotas protegidas. Adicionado um interceptor de requisição `axios` em `frontend/lib/api.ts` para incluir automaticamente o token JWT no header `Authorization`.
- **Ajuste na Navegação (Sidebar)**: O código do componente da sidebar (`backend/components/app-sidebar.tsx`) foi verificado e o link "Proventos" está corretamente posicionado após "Visão Geral" (Dashboard). Instruções foram fornecidas ao usuário para limpar cache do navegador e reiniciar o servidor de desenvolvimento, caso o link não esteja visível devido a cache.
- **Correção de Validação de Proventos (Backend)**:
    - Implementada transformação de dados na camada de serviço (`backend/services.py`) ao ler proventos do banco de dados.
    - Valores numéricos (campo `valor`) são convertidos de strings com vírgula para `float`.
    - Strings de data (campos `data_registro`, `data_ex`, `dt_pagamento`) são convertidas do formato "DD/MM/YYYY" (ou "YYYY-MM-DD") para objetos `date` Python antes da validação pelo modelo Pydantic `ProventoInfo`.
    - Isso resolve erros de validação que ocorriam ao buscar e processar dados de proventos para exibição na API (e.g., na página de proventos do frontend).
- **Melhoria na Validação de Datas de Proventos (Backend)**:
    - Os campos de data (`data_registro`, `data_ex`, `dt_pagamento`) no modelo Pydantic `ProventoBase` (e, por herança, em `ProventoInfo` e `ProventoRecebidoUsuario`) foram alterados para `Optional[date] = None`.
    - Esta alteração permite que esses campos de data sejam nulos, tornando a validação mais robusta caso os dados correspondentes estejam ausentes ou não possam ser convertidos a partir do banco de dados. Resolve um `ValidationError` que ocorria quando um campo de data esperado continha `None`.

### Refatoração da Navegação Principal
- A navegação principal da aplicação foi consolidada em um menu de abas horizontais localizado no componente `Dashboard.tsx` (`frontend/components/Dashboard.tsx`).
- Itens de menu que anteriormente estavam em uma sidebar vertical (e.g., `Minha Carteira`, `Operações`, `Resultados`, `DARF`, `Relatórios`, `Configurações`) foram movidos para este novo menu de abas horizontais.
- Para a maioria desses itens, foram criadas novas rotas e páginas placeholder dedicadas no frontend, permitindo que cada seção tenha sua própria URL:
    - `/carteira` (`frontend/app/carteira/page.tsx`)
    - `/operacoes` (`frontend/app/operacoes/page.tsx`)
    - `/proventos` (`frontend/app/proventos/page.tsx`) - já existia, mas agora integrada ao novo sistema de abas.
    - `/resultados` (`frontend/app/resultados/page.tsx`)
    - `/darf` (`frontend/app/darf/page.tsx`)
    - `/relatorios` (`frontend/app/relatorios/page.tsx`)
    - `/configuracoes` (`frontend/app/configuracoes/page.tsx`)
- O item "Prejuízo Acumulado" foi adicionado como uma nova aba de conteúdo local dentro do `Dashboard.tsx`, assim como "Impostos" e "Histórico" que permanecem como conteúdo local.
- O componente de sidebar vertical anterior (`backend/components/app-sidebar.tsx`) foi modificado para remover os links de navegação que agora estão nas abas do Dashboard, simplificando seu propósito ou indicando sua eventual substituição completa pelo novo sistema de navegação por abas.

## Melhorias Recentes (Junho 2024)

### Tabela "Carteira Atual" e Cálculo de Posições

*   **Exibição de Posições na Carteira Atual (`frontend/components/StockTable.tsx`):**
    *   Corrigida a exibição para permitir que posições vendidas (com quantidade negativa) apareçam corretamente.
    *   Implementada a ocultação de posições com saldo zerado (quantidade igual a zero).
    *   Ajustadas as colunas "Valor Inicial" e "Valor Atual\*" para sempre exibirem valores monetários positivos, mesmo para posições vendidas.
    *   Corrigido o cálculo das colunas "Resultado\*" e "Resultado (%)\*" para refletir com precisão o lucro/prejuízo tanto de posições compradas quanto vendidas, considerando a nova convenção de exibição dos valores monetários.

*   **Cálculo e Persistência de Dados da Carteira (`backend/services.py` - `recalcular_carteira` e `backend/database.py`):**
    *   A função `recalcular_carteira` agora garante que o `custo_total` para posições vendidas seja calculado como um valor positivo, representando o valor bruto recebido na(s) venda(s) a descoberto. O `preco_medio` para posições vendidas também reflete o preço médio de venda (positivo).
    *   Corrigida a lógica em `recalcular_carteira` para o tratamento de operações de compra que cobrem posições vendidas, assegurando que o `custo_total` da carteira seja zerado corretamente quando uma posição vendida é totalmente liquidada.
    *   A função `atualizar_carteira` (em `database.py`) foi modificada para aceitar o `custo_total` como um argumento vindo da camada de serviço, em vez de recalculá-lo. Isso garante que o `custo_total` (positivo para vendas) determinado pela lógica de negócios seja o valor efetivamente salvo no banco de dados.
    *   A função `obter_carteira_atual` (em `database.py`) foi ajustada para buscar todas as posições com `quantidade <> 0`, permitindo que as posições vendidas (com quantidade negativa e `custo_total` positivo) sejam corretamente enviadas para o frontend.
    *   **Correção na Edição Manual de Itens da Carteira (`backend/services.py` - `atualizar_item_carteira`):**
        *   Ajustada a função de serviço `atualizar_item_carteira` para calcular e fornecer corretamente o argumento `custo_total` ao chamar a função `database.atualizar_carteira`.
        *   Isso resolve um `TypeError` que ocorria ao tentar editar a quantidade ou preço médio de uma ação via API (`PUT /api/carteira/{ticker}`).
        *   Garantido que, ao editar manualmente uma posição para ser vendida (quantidade negativa), o `custo_total` calculado e salvo seja positivo, representando o valor da posição vendida.

### Apuração de Resultados para Imposto de Renda (`backend/services.py` - `recalcular_resultados`)

*   **Cálculo de Resultados de Swing Trade com Vendas a Descoberto:**
    *   Implementado o rastreamento de posições vendidas a descoberto (`posicoes_vendidas_estado_atual`) que persistem entre os meses.
    *   A lógica de vendas swing trade agora registra os detalhes de vendas a descoberto (quantidade, valor bruto da venda, preço médio de venda). O valor líquido da venda é contabilizado nas "Vendas" do mês.
    *   A lógica de compras swing trade foi ajustada para identificar se uma compra está cobrindo uma posição vendida existente. Em caso afirmativo:
        *   O resultado (lucro ou prejuízo) da operação de venda a descoberto (considerando o valor da venda original e o custo da recompra atual, incluindo taxas proporcionais da compra) é apurado.
        *   O custo da recompra é adicionado aos "Custos" do mês.
        *   O estado da posição vendida aberta é atualizado (reduzido ou zerado).
    *   Isso garante que o `ganho_liquido_swing` mensal reflita corretamente os resultados de operações de venda a descoberto que são liquidadas (cobertas) no respectivo mês.
    *   A separação e o cálculo para operações de Day Trade foram mantidos e não devem ser afetados por estas mudanças no Swing Trade.
*   **Detalhes do Imposto por Operação no Modal DARF:**
    *   Corrigida a atribuição do `status_ir` na função `calcular_operacoes_fechadas` (em `services.py`) para usar os valores específicos "Tributável Day Trade" e "Tributável Swing" (em vez de apenas "Tributável").
    *   Esta correção permite que o modal DARF no frontend (`DarfDetailsModal.tsx`) calcule e exiba corretamente o "Imosto Estimado da Operação" individual, que estava anteriormente aparecendo zerado devido à string de status IR genérica.

### Frontend e Tipos de Dados

*   **Correção de Tipos no Frontend (`frontend/lib/types.ts`):**
    *   Atualizada a interface `ResultadoMensal` para alinhar com a estrutura de dados do backend, incluindo todos os campos DARF específicos para swing trade e day trade (e.g., `darf_codigo_swing`, `darf_competencia_day`, etc.) e outros campos de resultados mensais.
    *   Esta correção resolveu erros de compilação TypeScript no componente `DarfDetailsModal.tsx` que ocorriam devido a campos ausentes na definição do tipo.
*   **Correção na Exibição do Status IR na Tabela de Operações Encerradas (`frontend/components/OperacoesEncerradasTable.tsx`):**
    *   Ajustada a lógica de exibição para reconhecer os status "Tributável Day Trade" e "Tributável Swing" (anteriormente apenas "Tributável").
    *   Isso garante que o badge "Tributável" e o ícone para consultar/detalhar o DARF voltem a ser exibidos corretamente para operações tributáveis.
    *   A cor do ícone DARF (indicando status pago/pendente) também foi ajustada para usar o campo de status correto do resultado mensal (seja de day trade ou swing trade).
