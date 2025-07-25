import axios from "axios"
import type {
  PortfolioHistoryResponse,
  ProventoRecebidoUsuario,
  ResumoProventoAnualAPI,
  ResumoProventoMensalAPI,
  ResumoProventoPorAcaoAPI,
  MonthlyEarnings, // Added MonthlyEarnings
  EventoCorporativoInfo, // Added EventoCorporativoInfo
} from "./types" // Import the new types

export const api = axios.create({
  baseURL: "http://localhost:8000/api", // Ensure this matches your backend API prefix
})

// Interceptor para adicionar o token JWT ao header Authorization de todas as requisições
api.interceptors.request.use(
  (config) => {
    // Verifica se o código está sendo executado no lado do cliente
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem("token"); // Chave do token no localStorage
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('🔍 [API] Token JWT encontrado e adicionado ao header');
      } else {
        console.warn('⚠️ [API] Token JWT não encontrado no localStorage');
      }
    }
    console.log('🔍 [API] Fazendo requisição para:', (config.baseURL || '') + (config.url || ''));
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Check if already on login page to prevent reload loop
      if (window.location.pathname !== '/login') {
        localStorage.removeItem("token") // Assuming token is stored in localStorage
        delete api.defaults.headers.common["Authorization"]
        // Redirect to login page or show a global message
        // window.location.href = '/login'; // Or use router if in a SPA framework
        window.location.reload(); // Simple reload for now
      }
    }
    return Promise.reject(error)
  },
)

// Function to get portfolio equity history
export const getPortfolioEquityHistory = async (
  startDate: string,
  endDate: string,
  frequency: 'daily' | 'monthly'
): Promise<PortfolioHistoryResponse> => {
  try {
    const response = await api.get<PortfolioHistoryResponse>("/analysis/portfolio/equity-history", {
      params: {
        start_date: startDate,
        end_date: endDate,
        frequency: frequency,
      },
    });
    return response.data;
  } catch (error) {
    // Handle or throw error appropriately for the calling component to catch
    if (axios.isAxiosError(error) && error.response) {
      // You can log or transform error.response.data here if needed
      throw new Error(error.response.data.detail || "Failed to fetch portfolio history");
    }
    throw new Error("An unexpected error occurred while fetching portfolio history");
  }
};

// Funções para buscar dados de proventos do usuário

export const getProventosUsuarioDetalhado = async (): Promise<ProventoRecebidoUsuario[]> => {
  try {
    console.log('🔍 [getProventosUsuarioDetalhado] Iniciando busca de proventos...');
    const response = await api.get<ProventoRecebidoUsuario[]>("/usuario/proventos/");
    console.log('🔍 [getProventosUsuarioDetalhado] Resposta recebida:', response.data);
    return response.data;
  } catch (error) {
    console.error('🚨 [getProventosUsuarioDetalhado] Erro:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('🚨 [getProventosUsuarioDetalhado] Resposta do erro:', error.response.data);
      console.error('🚨 [getProventosUsuarioDetalhado] Status do erro:', error.response.status);
      throw new Error(error.response.data.detail || "Falha ao buscar proventos detalhados do usuário.");
    }
    throw new Error("Erro inesperado ao buscar proventos detalhados do usuário.");
  }
};

export const getResumoProventosAnuaisUsuario = async (): Promise<ResumoProventoAnualAPI[]> => {
  try {
    const response = await api.get<ResumoProventoAnualAPI[]>("/usuario/proventos/resumo_anual/");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.detail || "Falha ao buscar resumo anual de proventos.");
    }
    throw new Error("Erro inesperado ao buscar resumo anual de proventos.");
  }
};

export const getResumoProventosMensaisUsuario = async (ano: number): Promise<ResumoProventoMensalAPI[]> => {
  try {
    const response = await api.get<ResumoProventoMensalAPI[]>(`/usuario/proventos/resumo_mensal/${ano}/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.detail || "Falha ao buscar resumo mensal de proventos.");
    }
    throw new Error("Erro inesperado ao buscar resumo mensal de proventos.");
  }
};

export const getResumoProventosPorAcaoUsuario = async (): Promise<ResumoProventoPorAcaoAPI[]> => {
  try {
    const response = await api.get<ResumoProventoPorAcaoAPI[]>("/usuario/proventos/resumo_por_acao/");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.detail || "Falha ao buscar resumo de proventos por ação.");
    }
    throw new Error("Erro inesperado ao buscar resumo de proventos por ação.");
  }
};

export const getSumEarningsLast12Months = async (): Promise<MonthlyEarnings[]> => {
  try {
    // The endpoint is /api/proventos/resumo/ultimos-12-meses
    // The existing `api` instance has baseURL: "http://localhost:8000/api"
    // So, the path for the get request should be "/proventos/resumo/ultimos-12-meses"
    const response = await api.get<MonthlyEarnings[]>("/proventos/resumo/ultimos-12-meses");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.detail || "Falha ao buscar o resumo de proventos dos últimos 12 meses.");
    }
    throw new Error("Erro inesperado ao buscar o resumo de proventos dos últimos 12 meses.");
  }
};

// Função para buscar eventos corporativos
export const getEventosCorporativos = async (): Promise<EventoCorporativoInfo[]> => {
  try {
    const response = await api.get<EventoCorporativoInfo[]>("/eventos_corporativos/");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.detail || "Falha ao buscar eventos corporativos.");
    }
    throw new Error("Erro inesperado ao buscar eventos corporativos.");
  }
};

// Função para buscar eventos corporativos filtrados do usuário (NOVA - MAIS EFICIENTE)
export const getEventosCorporativosUsuario = async (): Promise<EventoCorporativoInfo[]> => {
  try {
    console.log('🔍 [getEventosCorporativosUsuario] Iniciando busca de eventos corporativos do usuário...');
    const response = await api.get<EventoCorporativoInfo[]>("/usuario/eventos_corporativos/");
    console.log('🔍 [getEventosCorporativosUsuario] Resposta recebida:', response.data);
    return response.data;
  } catch (error) {
    console.error('🚨 [getEventosCorporativosUsuario] Erro:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('🚨 [getEventosCorporativosUsuario] Resposta do erro:', error.response.data);
      console.error('🚨 [getEventosCorporativosUsuario] Status do erro:', error.response.status);
      throw new Error(error.response.data.detail || "Falha ao buscar eventos corporativos do usuário.");
    }
    throw new Error("Erro inesperado ao buscar eventos corporativos do usuário.");
  }
};
