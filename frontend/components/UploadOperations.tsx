"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileText, CheckCircle, AlertCircle, HelpCircle, UploadCloud, Loader2, Clock } from "lucide-react"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

interface UploadOperationsProps {
  onSuccess: () => void
}

export function UploadOperations({ onSuccess }: UploadOperationsProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  // Checklist de pré-análise
  const checklistInitial = [
    { label: "Validando padrão do arquivo...", status: "pending" },
    { label: "Estrutura", status: "pending" },
    { label: "Nomes das colunas", status: "pending" },
    { label: "Formato dos dados", status: "pending" },
    { label: "Tamanho do arquivo", status: "pending" },
  ];
  const [checklist, setChecklist] = useState(checklistInitial);
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === "application/json" || selectedFile.name.endsWith(".json")) {
        setFile(selectedFile);
        setError("");
        setChecklist(checklistInitial);
        runChecklistValidation(selectedFile);
      } else {
        setError("Por favor, selecione um arquivo JSON válido.");
        setFile(null);
        setChecklist(checklistInitial);
      }
    }
  };

  // Dropzone handlers
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/json" || droppedFile.name.endsWith(".json")) {
        setFile(droppedFile);
        setError("");
        setChecklist(checklistInitial);
        runChecklistValidation(droppedFile);
      } else {
        setError("Por favor, selecione um arquivo JSON válido.");
        setFile(null);
        setChecklist(checklistInitial);
      }
    }
  };
  // Validação do checklist de pré-análise
  const runChecklistValidation = async (selectedFile: File) => {
    // Reset checklist
    setChecklist(checklistInitial);
    // Helper para delay visual
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    let steps = [...checklistInitial];

    // 1. Validando padrão do arquivo...
    steps[0].status = "loading";
    setChecklist([...steps]);
    await delay(600);
    let jsonData: any = null;
    let jsonParseError = false;
    try {
      const text = await selectedFile.text();
      jsonData = JSON.parse(text);
      steps[0].status = "done";
    } catch (e) {
      steps[0].status = "error";
      setChecklist([...steps]);
      return;
    }
    setChecklist([...steps]);

    // 2. Estrutura (meramente visual)
    steps[1].status = "loading";
    setChecklist([...steps]);
    await delay(500);
    steps[1].status = "done";
    setChecklist([...steps]);

    // 3. Nomes das colunas
    steps[2].status = "loading";
    setChecklist([...steps]);
    await delay(700);
    // Esperado: array de objetos, cada objeto com as chaves exatas
    const expectedColumns = [
      "Data do Negócio",
      "Tipo de Movimentação",
      "Mercado",
      "Prazo/Vencimento",
      "Instituição",
      "Código de Negociação",
      "Quantidade",
      "Preço",
      "Valor"
    ];
    let columnsOk = false;
    if (Array.isArray(jsonData) && jsonData.length > 0 && typeof jsonData[0] === "object") {
      const keys = Object.keys(jsonData[0]);
      columnsOk = expectedColumns.every(col => keys.includes(col));
    }
    steps[2].status = columnsOk ? "done" : "error";
    setChecklist([...steps]);
    if (!columnsOk) return;

    // 4. Formato dos dados (meramente visual)
    steps[3].status = "loading";
    setChecklist([...steps]);
    await delay(500);
    steps[3].status = "done";
    setChecklist([...steps]);

    // 5. Tamanho do arquivo
    steps[4].status = "loading";
    setChecklist([...steps]);
    await delay(500);
    if (selectedFile.size > 2 * 1024 * 1024) {
      steps[4].status = "error";
    } else {
      steps[4].status = "done";
    }
    setChecklist([...steps]);
  };

  // Função para simular progresso animado (pode ser adaptada para progresso real via backend futuramente)
  const animateProgress = async () => {
    for (let i = 0; i < progressSteps.length; i++) {
      setProgressSteps(prev => prev.map((step, idx) =>
        idx === i ? { ...step, status: "loading" } : idx < i ? { ...step, status: "done" } : step
      ));
      await new Promise(res => setTimeout(res, 900)); // Simula tempo de processamento
      setProgressSteps(prev => prev.map((step, idx) =>
        idx === i ? { ...step, status: "done" } : step
      ));
    }
  };

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setError("")
    setProgressSteps(progressSteps.map(step => ({ ...step, status: "pending" })))
    try {
      animateProgress(); // Inicia animação do checklist
      const formData = new FormData()
      formData.append("file", file)

      const response = await api.post("/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })

      toast({
        title: "Sucesso!",
        description: response.data.mensagem,
      })

      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      onSuccess()
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || "Erro ao fazer upload do arquivo"
      setError(errorMessage)
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const exampleData = [
    {
      date: "2025-01-10",
      ticker: "ITUB4",
      operation: "buy",
      quantity: 1000,
      price: 19.0,
      fees: 2.0,
    },
    {
      date: "2025-01-15",
      ticker: "ITUB4",
      operation: "sell",
      quantity: 500,
      price: 20.5,
      fees: 1.5,
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <UploadCloud className="h-6 w-6 text-blue-500" />
            Importar Operações
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 ml-2 text-gray-400 cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent>
                <span>
                  Arraste um arquivo JSON ou clique para selecionar.
                  <br />
                  <a href="/template.json" className="underline text-blue-700">
                    Baixar template
                  </a>
                </span>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription>Importe suas operações de forma rápida e segura.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed border-blue-400 bg-blue-50 rounded-lg p-6 flex flex-col items-center cursor-pointer hover:bg-blue-100 transition"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="h-10 w-10 text-blue-400 mb-2" />
            <span className="text-blue-700 font-medium">
              Arraste o arquivo aqui ou clique para selecionar
            </span>
            <Input
              ref={fileInputRef}
              id="file"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {file && (
            <>
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <FileText className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800">{file.name}</span>
                <span className="ml-2 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">JSON</span>
                <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />
              </div>
              {/* Checklist de pré-análise do arquivo */}
              <div className="mt-3 space-y-2">
                {checklist.map((step, idx) => (
                  <div
                    key={idx}
                    className={
                      `flex items-center gap-2 p-3 rounded-lg border ` +
                      (step.status === "done"
                        ? "bg-green-50 border-green-200"
                        : step.status === "loading"
                        ? "bg-blue-50 border-blue-200"
                        : step.status === "error"
                        ? "bg-red-50 border-red-200"
                        : "bg-gray-50 border-gray-200")
                    }
                  >
                    {/* Ícone */}
                    {step.status === "done" && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {step.status === "loading" && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                    {step.status === "pending" && <Clock className="h-4 w-4 text-gray-400" />}
                    {step.status === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
                    {/* Título da etapa */}
                    <span
                      className={
                        `text-sm ` +
                        (step.status === "done"
                          ? "text-green-800"
                          : step.status === "loading"
                          ? "text-blue-800"
                          : step.status === "error"
                          ? "text-red-800"
                          : "text-gray-700")
                      }
                    >
                      {step.label}
                      {step.label === "Tamanho do arquivo" && file && (
                        <span className="ml-2 text-xs">{file.size.toLocaleString()} bytes</span>
                      )}
                    </span>
                    {/* Badge de status à direita */}
                    <span className="ml-auto">
                      {step.status === "done" && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {step.status === "loading" && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                      {step.status === "pending" && <Clock className="h-4 w-4 text-gray-400" />}
                      {step.status === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
                    </span>
                  </div>
                ))}
                {/* Mensagens de erro específicas */}
                {checklist[0].status === "error" && (
                  <div className="text-red-600 text-xs ml-7">Arquivo JSON inválido.</div>
                )}
                {checklist[2].status === "error" && (
                  <div className="text-red-600 text-xs ml-7">Nomes das colunas incompatíveis. Use o template disponível.</div>
                )}
                {checklist[4].status === "error" && (
                  <div className="text-red-600 text-xs ml-7">O arquivo excede o limite de 2MB.</div>
                )}
              </div>
            </>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleUpload}
            disabled={
              !file || loading ||
              checklist.some((step, idx) => idx <= 4 && step.status !== "done")
            }
            className="w-full flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</> : <><UploadCloud className="h-4 w-4" /> Fazer Upload</>}
          </Button>

          {/* Checklist animado de progresso */}
          {loading && (
            <div className="mt-6 space-y-2">
              {progressSteps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  {step.status === "done" && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {step.status === "loading" && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                  {step.status === "pending" && <Clock className="h-4 w-4 text-gray-400" />}
                  <span className={step.status === "done" ? "text-green-700" : step.status === "loading" ? "text-blue-700" : "text-gray-500"}>{step.label}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
