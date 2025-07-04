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
import * as XLSX from "xlsx";

interface UploadOperationsProps {
  onSuccess: () => void
}

export function UploadOperations({ onSuccess }: UploadOperationsProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [uploadStarted, setUploadStarted] = useState(false)
  // Checklist de pré-análise
  const checklistInitial = [
    { label: "Validando padrão do arquivo...", status: "pending" },
    { label: "Estrutura", status: "pending" },
    { label: "Nomes das colunas", status: "pending" },
    { label: "Formato dos dados", status: "pending" },
    { label: "Tamanho do arquivo", status: "pending" },
  ];
  const [checklist, setChecklist] = useState(checklistInitial);

  // Checklist animado de progresso (para upload)
  const progressStepsInitial = [
    { label: "Enviando arquivo...", status: "pending" },
    { label: "Processando operações...", status: "pending" },
    { label: "Validando dados...", status: "pending" },
    { label: "Tratando eventos corporativos...", status: "pending" },
    { label: "Calculando dividendos...", status: "pending" },
    { label: "Montando a carteira...", status: "pending" },
    { label: "Calculando operações encerradas...", status: "pending" },
    { label: "Finalizando", status: "pending" },
  ];
  const [progressSteps, setProgressSteps] = useState(progressStepsInitial);

  // Remover duplicidade de definição de progressStepsInitial abaixo
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const isJson = selectedFile.type === "application/json" || selectedFile.name.endsWith(".json");
      const isExcel = selectedFile.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || selectedFile.type === "application/vnd.ms-excel" || selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".xls");
      if (isJson || isExcel) {
        setFile(selectedFile);
        setError("");
        setChecklist(checklistInitial);
        runChecklistValidation(selectedFile, isExcel);
      } else {
        setError("Por favor, selecione um arquivo Excel válido exportado da B3.");
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
  const runChecklistValidation = async (selectedFile: File, isExcel: boolean = false) => {
    setChecklist(checklistInitial);
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    let steps = [...checklistInitial];

    // 1. Validando padrão do arquivo...
    steps[0].status = "loading";
    setChecklist([...steps]);
    await delay(600);
    let jsonData: any = null;
    let jsonParseError = false;
    try {
      if (isExcel) {
        // Lê arquivo Excel
        const data = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
      } else {
        const text = await selectedFile.text();
        jsonData = JSON.parse(text);
      }
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

  // ...existing code...

  // Função para simular progresso animado (mais parecido com o checklist de carregamento do arquivo)
  const animateProgress = async () => {
    // Tempos semelhantes ao checklist de pré-análise, mas para mais etapas
    const stepDurations = [600, 500, 700, 600, 600, 600, 700, 500]; // ms para cada etapa
    for (let i = 0; i < progressStepsInitial.length; i++) {
      setProgressSteps(prev => prev.map((step, idx) =>
        idx === i ? { ...step, status: "loading" } : idx < i ? { ...step, status: "done" } : { ...step, status: "pending" }
      ));
      await new Promise(res => setTimeout(res, stepDurations[i]));
      setProgressSteps(prev => prev.map((step, idx) =>
        idx === i ? { ...step, status: "done" } : step
      ));
    }
    // Garante que todos fiquem com visto ao final
    setProgressSteps(prev => prev.map(step => ({ ...step, status: "done" })));
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setUploadStarted(true);
    setError("");
    setProgressSteps(progressSteps.map(step => ({ ...step, status: "pending" })));
    try {
      animateProgress(); // Inicia animação do checklist

      // Detecta se é Excel
      const isExcel = file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.type === "application/vnd.ms-excel" || file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
      let formData = new FormData();
      if (isExcel) {
        // Converte Excel para JSON, cria Blob e envia como arquivo
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
        const jsonBlob = new Blob([JSON.stringify(jsonData)], { type: "application/json" });
        // Nomeia o arquivo como .json para o backend reconhecer
        formData.append("file", jsonBlob, file.name.replace(/\.(xlsx|xls)$/i, ".json"));
      } else {
        // Envia JSON original
        formData.append("file", file);
      }

      const response = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      let toastDescription = response.data.mensagem;
      let warningTickers: string[] = [];
      // Se vier um array de erros de validação, filtra os "não encontrado na base" como warning
      if (Array.isArray(response.data.mensagem)) {
        const warnings: string[] = [];
        const outros: string[] = [];
        response.data.mensagem.forEach((err: any) => {
          const msg = typeof err === 'string' ? err : (err.msg || JSON.stringify(err));
          const match = msg.match(/ticker\s*"([A-Z0-9]+)"\s*n[aã]o encontrado/i);
          if (match) {
            warnings.push(match[1]);
          } else {
            outros.push(msg);
          }
        });
        warningTickers = warnings;
        toastDescription = outros.length > 0 ? (
          <ul className="list-disc list-inside text-xs">
            {outros.map((msg, idx) => <li key={idx}>{msg}</li>)}
          </ul>
        ) : "Operação realizada com sucesso.";
      }
      toast({
        title: "Sucesso!",
        description: toastDescription,
      });

      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onSuccess();

      // Exibe warning amigável se houver tickers não encontrados
      if (warningTickers.length > 0) {
        toast({
          title: "Aviso",
          description: (
            <span>
              O ticker <b>{warningTickers.join(", ")}</b> não foi encontrado na nossa base de dados, mas nossa equipe já está analisando os motivos.
            </span>
          ),
          variant: "warning",
        });
      }
    } catch (error: any) {
      let errorMessage = error.response?.data?.detail || "Erro ao fazer upload do arquivo";
      let warningTickers: string[] = [];
      let outros: string[] = [];
      // Trata tanto string quanto array de detalhes
      if (Array.isArray(error.response?.data?.detail)) {
        error.response.data.detail.forEach((err: any) => {
          const msg = typeof err === 'string' ? err : (err.msg || JSON.stringify(err));
          const match = msg.match(/ticker\s*([A-Z0-9]+)\s*n[aã]o encontrado/i);
          if (match) {
            warningTickers.push(match[1]);
          } else {
            outros.push(msg);
          }
        });
      } else if (typeof errorMessage === 'string') {
        // Trata string simples
        const match = errorMessage.match(/ticker\s*([A-Z0-9]+)\s*n[aã]o encontrado/i);
        if (match) {
          warningTickers.push(match[1]);
        } else {
          outros.push(errorMessage);
        }
      }
      // Se só houver warnings, não bloqueia o upload
      if (warningTickers.length > 0 && outros.length === 0) {
        toast({
          title: "Aviso",
          description: (
            <span>
              O ticker <b>{warningTickers.join(", ")}</b> não foi encontrado na nossa base de dados, mas nossa equipe já está analisando os motivos.
            </span>
          ),
          variant: "warning",
        });
        setError("");
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        onSuccess();
      } else {
        // Se houver outros erros, exibe normalmente
        setError(outros.length > 0 ? outros.join("\n") : (typeof errorMessage === 'string' ? errorMessage : ''));
        toast({
          title: "Erro",
          description: outros.length > 0 ? (
            <ul className="list-disc list-inside text-xs">
              {outros.map((msg, idx) => <li key={idx}>{msg}</li>)}
            </ul>
          ) : errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
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
          {/* Se upload não começou, mostra dropzone e checklist de arquivo */}
          {!uploadStarted && (
            <>
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
                  accept=".json,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {file && (
                <>
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <FileText className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-800">{file.name}</span>
                    <span className="ml-2 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">
                      {file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ? 'Excel' : 'JSON'}
                    </span>
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
                            <span className="ml-2 text-xs">{(file.size / 1024).toLocaleString(undefined, { maximumFractionDigits: 2 })} KB</span>
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
            </>
          )}

          {/* Checklist animado de progresso - só aparece durante upload */}
          {uploadStarted && loading && (
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
