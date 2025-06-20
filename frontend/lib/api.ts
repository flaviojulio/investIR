import axios from "axios"
import type {
  PortfolioHistoryResponse,
  ProventoRecebidoUsuario,
  ResumoProventoAnualAPI,
  ResumoProventoMensalAPI,
  ResumoProventoPorAcaoAPI,
  // Novos tipos para Corretora e Operacao
  Corretora,
  CorretoraCreate,
  Operacao,
} from "./types"

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
      }
    }
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
    const response = await api.get<ProventoRecebidoUsuario[]>("/usuario/proventos/");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
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

// --- Corretoras API ---
export const fetchCorretoras = async (): Promise<Corretora[]> => {
  try {
    const response = await api.get<Corretora[]>("/corretoras/");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.detail || "Falha ao buscar corretoras.");
    }
    throw new Error("Erro inesperado ao buscar corretoras.");
  }
};

export const createCorretora = async (data: CorretoraCreate): Promise<Corretora> => {
  try {
    const response = await api.post<Corretora>("/corretoras/", data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.detail || "Falha ao criar corretora.");
    }
    throw new Error("Erro inesperado ao criar corretora.");
  }
};

export const updateCorretora = async (id: number, data: Partial<CorretoraCreate>): Promise<Corretora> => {
  try {
    const response = await api.put<Corretora>(`/corretoras/${id}`, data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.detail || "Falha ao atualizar corretora.");
    }
    throw new Error("Erro inesperado ao atualizar corretora.");
  }
};

export const deleteCorretora = async (id: number): Promise<void> => {
  try {
    await api.delete(`/corretoras/${id}`);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.detail || "Falha ao remover corretora.");
    }
    throw new Error("Erro inesperado ao remover corretora.");
  }
};

// --- Operacoes API ---
// Assuming OperacaoCreate is similar to Omit<Operacao, 'id' | 'nome_corretora'>
// For simplicity, we'll use Partial<Operacao> for creation payload if it includes corretora_id
// A more specific OperacaoCreate type on the frontend might be needed later.

export const fetchOperations = async (): Promise<Operacao[]> => {
  try {
    // The backend /api/operacoes now returns OperacaoResponse which includes nome_corretora
    // The frontend Operacao type has been updated to include these optional fields.
    const response = await api.get<Operacao[]>("/operacoes");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.detail || "Falha ao buscar operações.");
    }
    throw new Error("Erro inesperado ao buscar operações.");
  }
};

// Define OperacaoCreateFrontend if not already defined, or use relevant fields from Operacao
// This is what the form for creating an operation would submit.
// It should include corretora_id as optional.
export interface OperacaoCreatePayload {
  date: string; // YYYY-MM-DD
  ticker: string;
  operation: 'buy' | 'sell';
  quantity: number;
  price: number;
  fees: number;
  corretora_id?: number | null;
}

export const addOperation = async (operationData: OperacaoCreatePayload): Promise<Operacao> => {
  try {
    // The backend /api/operacoes (POST) now returns OperacaoResponse
    // which includes nome_corretora.
    const response = await api.post<Operacao>("/operacoes", operationData);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.detail || "Falha ao adicionar operação.");
    }
    throw new Error("Erro inesperado ao adicionar operação.");
  }
};

// For uploading multiple operations (e.g., from a file)
// The backend /api/upload endpoint might not return the full operations with corretora names.
// This function might need adjustment based on the actual response of /api/upload.
// For now, assuming it returns a simple message.
export const uploadOperations = async (file: File): Promise<{ mensagem: string }> => {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const response = await api.post<{ mensagem: string }>("/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.detail || "Falha ao fazer upload das operações.");
    }
    throw new Error("Erro inesperado ao fazer upload das operações.");
  }
};

// Placeholder for updateOperation if needed.
// The backend does not currently have a PUT /api/operacoes/{id}
// export const updateOperation = async (id: number, operationData: Partial<OperacaoCreatePayload>): Promise<Operacao> => {
//   try {
//     const response = await api.put<Operacao>(`/operacoes/${id}`, operationData);
//     return response.data;
//   } catch (error) {
//     if (axios.isAxiosError(error) && error.response) {
//       throw new Error(error.response.data.detail || "Falha ao atualizar operação.");
//     }
//     throw new Error("Erro inesperado ao atualizar operação.");
//   }
// };

export const deleteOperation = async (id: number): Promise<{ mensagem: string }> => {
  try {
    const response = await api.delete<{ mensagem: string }>(`/operacoes/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.detail || "Falha ao remover operação.");
    }
    throw new Error("Erro inesperado ao remover operação.");
  }
};
