import { api } from "@/lib/api";

export async function getUserOperatedYears(): Promise<number[]> {
  // Endpoint a ser implementado no backend: /usuario/anos-operacao
  const response = await api.get<number[]>("/usuario/anos-operacao");
  return response.data;
}
