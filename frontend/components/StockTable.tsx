"use client"
import { useState, useEffect, useMemo } from "react" // For modal and form state, added useEffect, useMemo
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog" // Dialog components
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog" // AlertDialog components
import { Input } from "@/components/ui/input" // Input for form
import { Label } from "@/components/ui/label" // Label for form
import { TrendingUp, TrendingDown, Edit, Trash2, ArrowUp, ArrowDown, ChevronsUpDown, PiggyBank, Calculator, Target, Activity, Coins, Wallet, TrendingUpDown, DollarSign } from "lucide-react" // Edit, Trash2, and Sort icons
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip" // Tooltip components
import Link from 'next/link'; // Import Link for navigation
import type { CarteiraItem } from "@/lib/types"
import { api } from "@/lib/api" // For API calls
import { useToast } from "@/hooks/use-toast" // For notifications
import { formatCurrency, formatNumber } from "@/lib/utils"; // Import centralized formatters

// Extensão do tipo CarteiraItem para incluir campos calculados
interface CarteiraItemWithCalc extends CarteiraItem {
  _valorAtualCalculated: number;
  _resultadoAtualCalculated: number;
  _resultadoPercentualCalculated: number;
}

interface StockTableProps {
  carteira: CarteiraItem[]
  onUpdate: () => void
  showValues?: boolean
}

export function StockTable({ carteira, onUpdate, showValues = true }: StockTableProps) {
  // ...rest of the component code
}

// Simulate a "current price" for demonstration purposes.
// Here, we add a random fluctuation of -10% to +10% to the average price.
function getSimulatedCurrentPrice(preco_medio: number) {
  const fluctuation = (Math.random() * 0.2) - 0.1; // -0.1 to +0.1
  const simulatedPrice = preco_medio * (1 + fluctuation);
  return Math.max(0, Number(simulatedPrice.toFixed(2)));
}


