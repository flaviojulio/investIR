// Helper to fetch carteira (current portfolio)
import { api } from "@/lib/api";
import type { CarteiraItem } from "@/lib/types";

export async function getCarteira(): Promise<CarteiraItem[]> {
  const res = await api.get<CarteiraItem[]>("/carteira");
  return res.data || [];
}
