import axios from "axios"
import type { PortfolioHistoryResponse } from "./types" // Import the new types

export const api = axios.create({
  baseURL: "http://localhost:8000/api", // Ensure this matches your backend API prefix
})

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
