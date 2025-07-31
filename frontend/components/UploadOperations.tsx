"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileText, CheckCircle, AlertCircle, HelpCircle, UploadCloud, Loader2, Clock, Sparkles, AlertTriangle, FileStack, Shield, ShieldCheck, Lock, Zap, Timer, Trophy } from "lucide-react"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Tooltip, TooltipContent } from "@/components/ui/tooltip"
import * as XLSX from "xlsx"

interface UploadOperationsProps {
  onSuccess: () => void
}

export function UploadOperations({ onSuccess }: UploadOperationsProps) {
  const [currentStep, setCurrentStep] = useState(1) // 1: Instruções, 2: Aviso B3, 3: Validação, 4: Processamento, 5: Sucesso
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  const [operationsCount, setOperationsCount] = useState(0)
  const [avisoB3Aceito, setAvisoB3Aceito] = useState(false)
  
  // Estados para resumo final
  const [resumoImportacao, setResumoImportacao] = useState<{
    operacoesImportadas: number
    operacoesIgnoradas: number
    avisoB3?: string
    acoesAfetadas: string[]
    temProblemas: boolean
  } | null>(null)
  
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estados de validação
  const [validationSteps, setValidationSteps] = useState([
    { label: "Verificando arquivo", status: "pending", description: "Confirmando se é um arquivo válido da B3" },
    { label: "Analisando estrutura", status: "pending", description: "Verificando colunas e formato dos dados" },
    { label: "Contando operações", status: "pending", description: "Identificando quantas operações serão importadas" },
  ])

  // Estados de processamento
  const [processingSteps, setProcessingSteps] = useState([
    { label: "Lendo operações", status: "pending", description: "Extraindo dados do arquivo" },
    { label: "Validando dados", status: "pending", description: "Verificando consistência das informações" },
    { label: "Salvando no banco", status: "pending", description: "Armazenando suas operações" },
    { label: "Calculando carteira", status: "pending", description: "Atualizando posição atual" },
    { label: "Processando dividendos", status: "pending", description: "Identificando proventos recebidos" },
  ])

  // Função para formatar tamanho do arquivo
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Reset do upload
  const resetUpload = () => {
    setCurrentStep(1)
    setFile(null)
    setError("")
    setOperationsCount(0)
    setAvisoB3Aceito(false)
    setResumoImportacao(null)
    setValidationSteps([
      { label: "Verificando arquivo", status: "pending", description: "Confirmando se é um arquivo válido da B3" },
      { label: "Analisando estrutura", status: "pending", description: "Verificando colunas e formato dos dados" },
      { label: "Contando operações", status: "pending", description: "Identificando quantas operações serão importadas" },
    ])
    setProcessingSteps([
      { label: "Lendo operações", status: "pending", description: "Extraindo dados do arquivo" },
      { label: "Validando dados", status: "pending", description: "Verificando consistência das informações" },
      { label: "Salvando no banco", status: "pending", description: "Armazenando suas operações" },
      { label: "Calculando carteira", status: "pending", description: "Atualizando posição atual" },
      { label: "Processando dividendos", status: "pending", description: "Identificando proventos recebidos" },
    ])
  }

  // Função para prosseguir após aceitar aviso B3
  const prosseguirAposAvisoB3 = () => {
    setAvisoB3Aceito(true)
    setCurrentStep(3) // Vai para validação
    
    // Inicia a validação automaticamente
    if (file) {
      const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls")
      setTimeout(() => runValidation(file, isExcel), 500)
    }
  }

  // Handle file selection
  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile)
    setError("")
    setCurrentStep(2) // Vai para o aviso da B3
  }

  // Funções auxiliares
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  const runValidation = async (selectedFile: File, isExcel: boolean = false) => {
    const steps = [...validationSteps]
    
    // Etapa 1: Verificando arquivo (timing mais longo)
    steps[0].status = 'loading'
    setValidationSteps([...steps])
    
    await new Promise(resolve => setTimeout(resolve, 1500)) // Aumentado de 800ms
    
    let jsonData: any = null
    try {
      if (isExcel) {
        const data = await selectedFile.arrayBuffer()
        const workbook = XLSX.read(data, { type: "array" })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" })
      } else {
        const text = await selectedFile.text()
        jsonData = JSON.parse(text)
      }
      steps[0].status = 'done'
    } catch (e) {
      steps[0].status = 'error'
      setValidationSteps([...steps])
      setError('Arquivo inválido. Por favor, verifique se é um arquivo Excel ou JSON válido.')
      return
    }
    setValidationSteps([...steps])

    // Etapa 2: Analisando estrutura (timing mais longo)
    steps[1].status = 'loading'
    setValidationSteps([...steps])
    await new Promise(resolve => setTimeout(resolve, 1200)) // Aumentado de 700ms
    
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
    ]
    
    let columnsOk = false
    if (Array.isArray(jsonData) && jsonData.length > 0 && typeof jsonData[0] === "object") {
      const keys = Object.keys(jsonData[0])
      columnsOk = expectedColumns.every(col => keys.includes(col))
    }
    
    if (!columnsOk) {
      steps[1].status = 'error'
      setValidationSteps([...steps])
      setError('Estrutura do arquivo incompatível. Verifique se está usando o arquivo correto da B3.')
      return
    }
    
    steps[1].status = 'done'
    setValidationSteps([...steps])

    // Etapa 3: Contando operações (timing mais longo)
    steps[2].status = 'loading'
    setValidationSteps([...steps])
    await new Promise(resolve => setTimeout(resolve, 1000)) // Aumentado de 600ms
    
    setOperationsCount(jsonData.length)
    steps[2].status = 'done'
    setValidationSteps([...steps])
  }

  const handleUpload = async () => {
    if (!file) return
    
    console.log("🚀 [UPLOAD] Iniciando upload do arquivo:", file.name)
    
    setLoading(true)
    setCurrentStep(4) // Vai para processamento (step 4)
    setError("")
    
    // Animação do progresso
    const animateProgress = async () => {
      const stepDurations = [2500, 2000, 1800, 1500] // Tempos mais longos para melhor UX
      for (let i = 0; i < processingSteps.length; i++) {
        setProcessingSteps(prev => prev.map((step, idx) =>
          idx === i ? { ...step, status: "loading" } : idx < i ? { ...step, status: "done" } : step
        ))
        await new Promise(resolve => setTimeout(resolve, stepDurations[i]))
        setProcessingSteps(prev => prev.map((step, idx) =>
          idx === i ? { ...step, status: "done" } : step
        ))
      }
    }
    
    try {
      // Esperar a animação terminar antes de fazer o upload real
      await animateProgress()
      
      console.log("🎬 [UPLOAD] Animação concluída, iniciando processamento real")

      const isExcel = file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
                     file.type === "application/vnd.ms-excel" || 
                     file.name.endsWith(".xlsx") || 
                     file.name.endsWith(".xls")
      
      console.log("📝 [UPLOAD] Tipo de arquivo detectado:", isExcel ? "Excel" : "JSON")
      console.log("📝 [UPLOAD] Tipo MIME:", file.type)
      
      const formData = new FormData()
      let jsonData: any[] = [] // Declarar no escopo correto
      
      if (isExcel) {
        console.log("🔄 [UPLOAD] Processando arquivo Excel...")
        const data = await file.arrayBuffer()
        console.log("📊 [UPLOAD] Arquivo lido, tamanho:", data.byteLength, "bytes")
        
        const workbook = XLSX.read(data, { type: "array" })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" })
        
        console.log("📋 [UPLOAD] Dados convertidos para JSON, total de linhas:", jsonData.length)
        console.log("📋 [UPLOAD] Primeira linha de exemplo (antes da limpeza):", jsonData[0])
        
        // Limpar valores monetários e validar
        const jsonDataOriginal = [...jsonData]
        jsonData = jsonData.map((operation: any) => {
          const cleanOperation = { ...operation }
          
          // Limpar campo Preço
          if (cleanOperation["Preço"] && typeof cleanOperation["Preço"] === "string") {
            const originalPrice = cleanOperation["Preço"]
            cleanOperation["Preço"] = cleanOperation["Preço"]
              .replace(/R\$\s?/, "") // Remove R$
              .replace(/\./g, "") // Remove pontos dos milhares
              .replace(",", ".") // Converte vírgula decimal para ponto
              .trim()
            console.log("💰 [UPLOAD] Preço limpo:", originalPrice, "->", cleanOperation["Preço"])
          }
          
          // Limpar campo Valor
          if (cleanOperation["Valor"] && typeof cleanOperation["Valor"] === "string") {
            const originalValue = cleanOperation["Valor"]
            cleanOperation["Valor"] = cleanOperation["Valor"]
              .replace(/R\$\s?/, "") // Remove R$
              .replace(/\./g, "") // Remove pontos dos milhares
              .replace(",", ".") // Converte vírgula decimal para ponto
              .trim()
            console.log("💰 [UPLOAD] Valor limpo:", originalValue, "->", cleanOperation["Valor"])
          }
          
          return cleanOperation
        })
        
        // Filtrar operações com quantidade zero ou inválida
        const operacoesValidas = jsonData.filter((operation: any) => {
          const quantidade = operation["Quantidade"]
          if (!quantidade || quantidade === "0" || quantidade === 0) {
            console.log("⚠️ [UPLOAD] Operação ignorada por quantidade zero:", operation)
            return false
          }
          return true
        })
        
        console.log("📋 [UPLOAD] Operações válidas após filtro:", operacoesValidas.length, "de", jsonDataOriginal.length)
        console.log("📋 [UPLOAD] Primeira linha após limpeza:", operacoesValidas[0])
        
        // Se não há operações válidas, mostra erro
        if (operacoesValidas.length === 0) {
          console.error("❌ [UPLOAD] Nenhuma operação válida encontrada após filtros")
          setError('Nenhuma operação válida encontrada no arquivo. Verifique se as quantidades estão preenchidas corretamente.')
          return
        }
        
        const jsonBlob = new Blob([JSON.stringify(operacoesValidas)], { type: "application/json" })
        console.log("📦 [UPLOAD] Blob JSON criado, tamanho:", jsonBlob.size, "bytes")
        formData.append("file", jsonBlob, file.name.replace(/\.(xlsx|xls)$/i, ".json"))
        console.log("📤 [UPLOAD] Arquivo anexado ao FormData como:", file.name.replace(/\.(xlsx|xls)$/i, ".json"))
      } else {
        console.log("🔄 [UPLOAD] Processando arquivo JSON...")
        // Para arquivos JSON, também limpar os valores monetários
        const fileText = await file.text()
        console.log("📄 [UPLOAD] Arquivo JSON lido, tamanho:", fileText.length, "caracteres")
        
        jsonData = JSON.parse(fileText)
        console.log("📋 [UPLOAD] JSON parseado, total de linhas:", Array.isArray(jsonData) ? jsonData.length : "não é array")
        
        if (Array.isArray(jsonData)) {
          console.log("📋 [UPLOAD] Primeira linha de exemplo (antes da limpeza):", jsonData[0])
          
          const jsonDataOriginal = [...jsonData]
          jsonData = jsonData.map((operation: any) => {
            const cleanOperation = { ...operation }
            
            // Limpar campo Preço
            if (cleanOperation["Preço"] && typeof cleanOperation["Preço"] === "string") {
              const originalPrice = cleanOperation["Preço"]
              cleanOperation["Preço"] = cleanOperation["Preço"]
                .replace(/R\$\s?/, "") // Remove R$
                .replace(/\./g, "") // Remove pontos dos milhares
                .replace(",", ".") // Converte vírgula decimal para ponto
                .trim()
              console.log("💰 [UPLOAD] Preço limpo:", originalPrice, "->", cleanOperation["Preço"])
            }
            
            // Limpar campo Valor
            if (cleanOperation["Valor"] && typeof cleanOperation["Valor"] === "string") {
              const originalValue = cleanOperation["Valor"]
              cleanOperation["Valor"] = cleanOperation["Valor"]
                .replace(/R\$\s?/, "") // Remove R$
                .replace(/\./g, "") // Remove pontos dos milhares
                .replace(",", ".") // Converte vírgula decimal para ponto
                .trim()
              console.log("💰 [UPLOAD] Valor limpo:", originalValue, "->", cleanOperation["Valor"])
            }
            
            return cleanOperation
          })
          
          // Filtrar operações com quantidade zero ou inválida
          const operacoesValidas = jsonData.filter((operation: any) => {
            const quantidade = operation["Quantidade"]
            if (!quantidade || quantidade === "0" || quantidade === 0) {
              console.log("⚠️ [UPLOAD] Operação ignorada por quantidade zero:", operation)
              return false
            }
            return true
          })
          
          console.log("📋 [UPLOAD] Operações válidas após filtro:", operacoesValidas.length, "de", jsonDataOriginal.length)
          console.log("📋 [UPLOAD] Primeira linha após limpeza:", operacoesValidas[0])
          
          // Se não há operações válidas, mostra erro
          if (operacoesValidas.length === 0) {
            console.error("❌ [UPLOAD] Nenhuma operação válida encontrada após filtros")
            setError('Nenhuma operação válida encontrada no arquivo. Verifique se as quantidades estão preenchidas corretamente.')
            return
          }
          
          jsonData = operacoesValidas
        }
        
        const cleanedJsonBlob = new Blob([JSON.stringify(jsonData)], { type: "application/json" })
        console.log("📦 [UPLOAD] Blob JSON limpo criado, tamanho:", cleanedJsonBlob.size, "bytes")
        formData.append("file", cleanedJsonBlob, file.name)
        console.log("📤 [UPLOAD] Arquivo anexado ao FormData como:", file.name)
      }

      console.log("🌐 [UPLOAD] Enviando requisição para /upload...")
      const response = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      
      console.log("✅ [UPLOAD] Resposta recebida:", response.status, response.data)
      
      // Extrair lista de ações únicas do arquivo importado
      const acoesAfetadas = Array.from(new Set(
        (Array.isArray(jsonData) ? jsonData : [])
          .map((op: any) => op["Código de Negociação"] || op.ticker)
          .filter((ticker: string) => ticker && ticker.trim())
      )) as string[]
      
      // Preparar resumo da importação
      const resumo = {
        operacoesImportadas: jsonData.length - (response.data.operacoes_ignoradas || 0),
        operacoesIgnoradas: response.data.operacoes_ignoradas || 0,
        avisoB3: response.data.aviso_b3,
        acoesAfetadas: acoesAfetadas,
        temProblemas: (response.data.operacoes_ignoradas > 0) || !!response.data.aviso_b3
      }
      
      setResumoImportacao(resumo)
      
      console.log("📊 [UPLOAD] Resumo da importação:", resumo)
      
      // Verificar se há aviso específico da B3
      if (response.data.aviso_b3) {
        toast({
          title: "Operações da B3 Processadas",
          description: response.data.aviso_b3.split('\n')[0], // Primeira linha do aviso
          variant: "default",
        })
      }
      
      // Verificar se há avisos gerais sobre operações ignoradas
      if (response.data.operacoes_ignoradas && response.data.operacoes_ignoradas > 0) {
        console.log("⚠️ [UPLOAD] Operações ignoradas:", response.data.operacoes_ignoradas)
        toast({
          title: "Aviso",
          description: response.data.aviso || `${response.data.operacoes_ignoradas} operações foram ignoradas`,
          variant: "default",
        })
      }

      // Mostrar tela de sucesso - usuário controla quando sair
      setCurrentStep(5)

    } catch (error: any) {
      console.error("❌ [UPLOAD] Erro capturado:", error)
      console.error("❌ [UPLOAD] Erro completo:", {
        message: error.message,
        response: error.response,
        responseData: error.response?.data,
        responseStatus: error.response?.status,
        responseStatusText: error.response?.statusText
      })
      
      const errorMessage = error.response?.data?.detail || "Erro ao fazer upload do arquivo"
      console.error("❌ [UPLOAD] Mensagem de erro final:", errorMessage)
      
      setError(errorMessage)
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      })
      setCurrentStep(3) // Volta para a etapa de upload
    } finally {
      setLoading(false)
      console.log("🏁 [UPLOAD] Processo finalizado")
    }
  }

  // Passo 1: Instruções e Preparação
  if (currentStep === 1) {
    return (
      <div className="w-full">
        
        {/* Header melhorado com gradiente brasileiro */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg hover:scale-110 transition-transform duration-300">
            <UploadCloud className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">Importar da B3</h1>
          <p className="text-gray-600 text-lg mb-4">Rápido, simples e 100% seguro 🚀</p>
          
          {/* Indicadores de confiança LGPD */}
          <div className="flex items-center justify-center gap-4 mb-6 text-sm text-gray-600">
            <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-full border border-green-200">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-green-700 font-medium">Protegido pela LGPD</span>
            </div>
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-full border border-blue-200">
              <Lock className="h-4 w-4 text-blue-600" />
              <span className="text-blue-700 font-medium">Criptografia bancária</span>
            </div>
            <div className="flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-full border border-purple-200">
              <CheckCircle className="h-4 w-4 text-purple-600" />
              <span className="text-purple-700 font-medium">Dados não compartilhados</span>
            </div>
          </div>
        </div>

        {/* Cards de Instrução Lado a Lado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          
          {/* Como Funciona */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
            <h2 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
              <span>🚀</span> Como funciona?
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">1</span>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 text-sm mb-1">Baixe da B3</h3>
                  <p className="text-xs text-blue-700">Acesse o site da B3 e baixe o extrato das suas operações em Excel</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">2</span>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 text-sm mb-1">Envie Aqui</h3>
                  <p className="text-xs text-blue-700">Arraste o arquivo ou clique para selecionar. É rápido e seguro!</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">3</span>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 text-sm mb-1">Pronto!</h3>
                  <p className="text-xs text-blue-700">Sua carteira será atualizada automaticamente com todas as operações</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tutorial B3 */}
          <div className="bg-white rounded-xl border p-4">
            <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span>📚</span> Como baixar da B3?
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">1</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Acesse o site da B3</h3>
                  <p className="text-gray-600 text-xs">Entre em <span className="font-mono bg-gray-200 px-1 rounded">b3.com.br</span> e faça login</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">2</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Vá em "Extratos e Informes"</h3>
                  <p className="text-gray-600 text-xs">Procure pela seção de extratos no menu</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">3</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Baixe o "Extrato de Negociação"</h3>
                  <p className="text-gray-600 text-xs">Escolha o período e baixe em Excel (.xlsx)</p>
                </div>
              </div>
            </div>
            
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 text-sm">💡</span>
                <div>
                  <h4 className="font-semibold text-yellow-800 text-xs">Importante</h4>
                  <p className="text-xs text-yellow-700">
                    Use sempre o formato Excel (.xlsx). PDFs não funcionam.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Área de Upload melhorada com design brasileiro */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Arraste seu extrato da B3 aqui 🎯</h2>
          
          <div
            className={`relative border-3 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer group ${
              isDragOver 
                ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 scale-[1.02] shadow-lg' 
                : 'border-gray-300 hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 hover:scale-[1.01]'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {/* Fundo animado */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-purple-50 to-indigo-50 opacity-0 group-hover:opacity-50 transition-opacity duration-300 rounded-2xl" />
            
            {/* Ícone principal melhorado */}
            <div className={`relative w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 ${
              isDragOver 
                ? 'bg-gradient-to-br from-green-400 to-emerald-500' 
                : 'bg-gradient-to-br from-blue-500 to-purple-600'
            }`}>
              <Upload className="h-10 w-10 text-white" />
            </div>
            
            {/* Texto principal */}
            <h3 className="text-2xl font-bold text-gray-800 mb-3">
              {isDragOver ? "Solte aqui! 🎯" : "Arraste seu arquivo aqui"}
            </h3>
            <p className="text-gray-600 mb-6 text-lg">
              ou toque para escolher do seu celular/computador
            </p>
            
            {/* Botão melhorado */}
            <Button className="px-8 py-4 text-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl font-semibold shadow-lg hover:scale-105 transition-all duration-300">
              📎 Escolher Arquivo da B3
            </Button>
            
            {/* Informações de arquivo */}
            <p className="text-sm text-gray-500 mt-4">
              Arquivos Excel (.xlsx) • Até 25MB • Dados seguros
            </p>
            
            <Input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.json"
              onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
              className="hidden"
            />
          </div>

          {error && (
            <Alert variant="destructive" className="mt-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* Footer de conformidade LGPD */}
          <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <Lock className="h-4 w-4 text-green-600" />
              <span>🇧🇷 Dados processados no Brasil • Protegido pela LGPD • Não compartilhamos suas informações</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Passo 2: Aviso da B3
  if (currentStep === 2) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg">
          <CardContent className="p-6">
            
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Importante: Limitações dos dados da B3</h2>
              <p className="text-gray-600">Informação sobre o histórico de operações</p>
            </div>

            {/* Aviso da B3 */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-amber-600 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-amber-800 mb-2">Atenção: Histórico limitado da B3</h3>
                  <p className="text-amber-700 mb-3">
                    A B3 (Bolsa de Valores brasileira) fornece apenas o histórico de operações 
                    a partir de <strong>Novembro de 2019</strong>.
                  </p>
                  <p className="text-amber-700 mb-3">
                    Se você comprou ações antes dessa data e as vendeu depois, o saldo pode 
                    aparecer como negativo no arquivo da B3, pois a compra original não está 
                    incluída no histórico.
                  </p>
                  <p className="text-amber-700">
                    <strong>O que faremos:</strong> Automaticamente excluiremos operações que 
                    resultem em saldos negativos e informaremos quais foram ignoradas.
                  </p>
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="flex-1"
              >
                Voltar
              </Button>
              
              <Button
                onClick={prosseguirAposAvisoB3}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3"
              >
                ✅ Entendi, vamos continuar!
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Passo 3: Validação do Arquivo
  if (currentStep === 3) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg">
          <CardContent className="p-6">
            
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Arquivo Recebido!</h2>
              <p className="text-gray-600">Estamos verificando se está tudo certo</p>
            </div>

            {/* Info do Arquivo */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 flex items-center gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">{file?.name}</h3>
                <p className="text-sm text-gray-600">{file ? formatFileSize(file.size) : ''}</p>
              </div>
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>

            {/* Checklist de Validação */}
            <div className="space-y-3 mb-6">
              {validationSteps.map((step, index) => (
                <div key={index} className="flex items-center gap-4 p-4 rounded-lg bg-gray-50">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center">
                    {step.status === 'pending' && (
                      <Clock className="h-5 w-5 text-gray-400" />
                    )}
                    {step.status === 'loading' && (
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                    )}
                    {step.status === 'done' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {step.status === 'error' && (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-medium ${
                      step.status === 'done' ? 'text-green-800' :
                      step.status === 'loading' ? 'text-blue-800' : 
                      step.status === 'error' ? 'text-red-800' : 'text-gray-600'
                    }`}>
                      {step.label}
                      {step.label === "Contando operações" && operationsCount > 0 && (
                        <span className="ml-2 text-sm">({operationsCount} operações)</span>
                      )}
                    </h4>
                    <p className="text-sm text-gray-500">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Botões */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={resetUpload}
                className="flex-1"
              >
                Escolher Outro Arquivo
              </Button>
              
              <Button
                onClick={handleUpload}
                disabled={validationSteps.some(s => s.status !== 'done')}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 disabled:opacity-50"
              >
                {validationSteps.every(s => s.status === 'done') ? 
                  <>🚀 Importar Operações ({operationsCount} encontradas)</> : 
                  'Aguarde a validação...'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Passo 4: Processamento
  if (currentStep === 4) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg">
          <CardContent className="p-6">
            
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Processando suas operações</h2>
              <p className="text-gray-600">Isso pode levar alguns minutos, mas vale a pena!</p>
            </div>

            {/* Progress Steps */}
            <div className="space-y-4 mb-8">
              {processingSteps.map((step, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center">
                    {step.status === 'pending' && (
                      <Clock className="h-6 w-6 text-gray-400" />
                    )}
                    {step.status === 'loading' && (
                      <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                    )}
                    {step.status === 'done' && (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-semibold ${
                      step.status === 'done' ? 'text-green-800' :
                      step.status === 'loading' ? 'text-blue-800' : 'text-gray-600'
                    }`}>
                      {step.label}
                    </h4>
                    <p className="text-sm text-gray-500">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Dica durante processamento com mensagem sobre futuro automático */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <span className="text-blue-500 text-xl">💡</span>
                <div>
                  <h4 className="font-semibold text-blue-800">Enquanto processamos...</h4>
                  <p className="text-sm text-blue-700 mb-2">
                    Estamos organizando todas suas operações, calculando sua carteira atual 
                    e identificando os dividendos que você recebeu. Em alguns instantes 
                    sua carteira estará completamente atualizada!
                  </p>
                  <p className="text-xs text-blue-600 italic">
                    Tenha paciência, em breve será automático. Estamos trabalhando para que seus dados sejam importados diretamente da B3.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Passo 5: Sucesso
  if (currentStep === 5) {
    const temProblemas = resumoImportacao?.temProblemas || false
    const operacoesImportadas = resumoImportacao?.operacoesImportadas || operationsCount
    const operacoesIgnoradas = resumoImportacao?.operacoesIgnoradas || 0
    const acoesAfetadas = resumoImportacao?.acoesAfetadas || []
    
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="shadow-lg">
          <CardContent className="p-8">
            
            {/* Header Success */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                <span className="text-white text-3xl">🎉</span>
              </div>
              
              <h2 className="text-3xl font-bold text-gray-800 mb-3">
                Importação Concluída!
              </h2>
              <p className="text-gray-600 text-lg">
                Aqui está um resumo completo do que aconteceu
              </p>
            </div>

            {/* Resumo Principal */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <h3 className="text-xl font-bold text-gray-800"> O que deu certo</h3>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <span className="text-green-600 text-sm font-bold">{operacoesImportadas}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">Operações Importadas</p>
                      <p className="text-sm text-gray-600">Compras e vendas adicionadas à sua carteira</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600 text-sm font-bold">{acoesAfetadas.length}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">Ações Diferentes</p>
                      <p className="text-sm text-gray-600">Tipos de ações que você negociou</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-semibold text-gray-800">Carteira Atualizada</p>
                      <p className="text-sm text-gray-600">Suas posições atuais foram recalculadas</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-semibold text-gray-800">Impostos Organizados</p>
                      <p className="text-sm text-gray-600">IR e DARF calculados automaticamente</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Lista de ações */}
              {acoesAfetadas.length > 0 && (
                <div className="mt-4 p-4 bg-white/60 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <FileStack className="h-4 w-4 text-blue-600" />
                    Ações processadas:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {acoesAfetadas.slice(0, 10).map((ticker, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        {ticker}
                      </span>
                    ))}
                    {acoesAfetadas.length > 10 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        +{acoesAfetadas.length - 10} outras
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Avisos e Problemas */}
            {temProblemas && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                  <h3 className="text-xl font-bold text-gray-800">Pontos de atenção</h3>
                </div>
                
                {operacoesIgnoradas > 0 && (
                  <div className="mb-4 p-4 bg-white/60 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-600 text-sm font-bold">{operacoesIgnoradas}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">Operações Ignoradas</p>
                        <p className="text-sm text-gray-600 mb-2">
                          Algumas operações não puderam ser importadas
                        </p>
                        <div className="text-xs text-amber-700 bg-amber-100 rounded p-2">
                          <strong>💡 Por que isso acontece?</strong><br/>
                          • Operações com quantidade zero<br/>
                          • Dados inconsistentes ou corrompidos<br/>
                          • Operações anteriores a Nov/2019 (limitação da B3)
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {resumoImportacao?.avisoB3 && (
                  <div className="p-4 bg-white/60 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-gray-800 mb-2">Limitação da B3</p>
                        <div className="text-sm text-gray-700 bg-amber-50 rounded p-3">
                          {resumoImportacao.avisoB3.split('\n').map((linha, index) => (
                            <p key={index} className="mb-1">{linha}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => {
                  onSuccess() // Chama onSuccess para fechar modal e atualizar dashboard
                }}
                className="px-8 py-3 text-lg flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                size="lg"
              >
                <Sparkles className="h-5 w-5" />
                Ver Minha Carteira
              </Button>              
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
