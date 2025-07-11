"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileText, CheckCircle, AlertCircle, HelpCircle, UploadCloud, Loader2, Clock, Sparkles } from "lucide-react"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import * as XLSX from "xlsx"

interface UploadOperationsProps {
  onSuccess: () => void
}

export function UploadOperations({ onSuccess }: UploadOperationsProps) {
  const [currentStep, setCurrentStep] = useState(1) // 1: Instruções, 2: Upload, 3: Processando, 4: Sucesso
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  const [operationsCount, setOperationsCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Estados de validação
  const [validationSteps, setValidationSteps] = useState([
    { label: "Verificando arquivo", status: "pending", description: "Confirmando se é um arquivo válido da B3" },
    { label: "Analisando estrutura", status: "pending", description: "Verificando colunas e formato dos dados" },
    { label: "Contando operações", status: "pending", description: "Identificando quantas operações serão importadas" },
  ])

  // Estados de processamento
  const [processingSteps, setProcessingSteps] = useState([
    { label: "Importando operações", status: "pending", description: "Salvando suas operações no banco de dados..." },
    { label: "Calculando posições", status: "pending", description: "Atualizando quantidade e preço médio de cada ação..." },
    { label: "Processando proventos", status: "pending", description: "Identificando dividendos e bonificações recebidas..." },
    { label: "Organizando dados", status: "pending", description: "Preparando relatórios e dashboard atualizado..." },
  ])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleFileSelect = (selectedFile: File) => {
    const isExcel = selectedFile.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
                   selectedFile.type === "application/vnd.ms-excel" || 
                   selectedFile.name.endsWith(".xlsx") || 
                   selectedFile.name.endsWith(".xls")
    const isJson = selectedFile.type === "application/json" || selectedFile.name.endsWith(".json")
    
    if (isExcel || isJson) {
      setFile(selectedFile)
      setError('')
      setCurrentStep(2)
      setTimeout(() => runValidation(selectedFile, isExcel), 500)
    } else {
      setError('Por favor, selecione um arquivo Excel (.xlsx) ou JSON válido exportado da B3')
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
    setCurrentStep(3)
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
      
      if (isExcel) {
        console.log("🔄 [UPLOAD] Processando arquivo Excel...")
        const data = await file.arrayBuffer()
        console.log("📊 [UPLOAD] Arquivo lido, tamanho:", data.byteLength, "bytes")
        
        const workbook = XLSX.read(data, { type: "array" })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        let jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" })
        
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
        
        let jsonData = JSON.parse(fileText)
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
      
      // Verifica se há avisos sobre operações ignoradas
      if (response.data.operacoes_ignoradas && response.data.operacoes_ignoradas > 0) {
        console.log("⚠️ [UPLOAD] Operações ignoradas:", response.data.operacoes_ignoradas)
        toast({
          title: "Aviso",
          description: response.data.aviso || `${response.data.operacoes_ignoradas} operações foram ignoradas`,
          variant: "default",
        })
      }

      // Mostrar tela de sucesso - usuário controla quando sair
      setCurrentStep(4)

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
      setCurrentStep(2) // Volta para a etapa de upload
    } finally {
      setLoading(false)
      console.log("🏁 [UPLOAD] Processo finalizado")
    }
  }

  const resetUpload = () => {
    setCurrentStep(1)
    setFile(null)
    setError('')
    setOperationsCount(0)
    setValidationSteps(validationSteps.map(s => ({ ...s, status: 'pending' })))
    setProcessingSteps(processingSteps.map(s => ({ ...s, status: 'pending' })))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
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

  // Passo 1: Instruções e Preparação
  if (currentStep === 1) {
    return (
      <div className="w-full">
        
        {/* Header compacto */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <UploadCloud className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Importar Operações da B3</h1>
          <p className="text-gray-600 text-sm">Importe todas suas operações de uma vez só, de forma simples e segura</p>
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

        {/* Área de Upload */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">Selecione seu arquivo da B3</h2>
          
          <div
            className={`border-3 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
              isDragOver 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Upload className="h-6 w-6 text-blue-500" />
            </div>
            
            <h3 className="text-base font-semibold text-gray-800 mb-2">
              Arraste seu arquivo aqui
            </h3>
            <p className="text-gray-600 mb-4 text-sm">
              ou clique para selecionar do seu computador
            </p>
            
            <Button className="px-4 py-2">
              Escolher Arquivo
            </Button>
            
            <p className="text-xs text-gray-500 mt-3">
              Arquivos Excel (.xlsx) ou JSON • Máximo 5MB
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
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    )
  }

  // Passo 2: Validação do Arquivo
  if (currentStep === 2) {
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
                className="flex-1"
              >
                {validationSteps.every(s => s.status === 'done') ? 'Importar Operações' : 'Aguarde...'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Passo 3: Processamento
  if (currentStep === 3) {
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

            {/* Dica durante processamento */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-blue-500 text-xl">💡</span>
                <div>
                  <h4 className="font-semibold text-blue-800">Enquanto processamos...</h4>
                  <p className="text-sm text-blue-700">
                    Estamos organizando todas suas operações, calculando sua carteira atual 
                    e identificando os dividendos que você recebeu. Em alguns instantes 
                    sua carteira estará completamente atualizada!
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Passo 4: Sucesso
  if (currentStep === 4) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg">
          <CardContent className="p-6 text-center">
            
            {/* Success Animation */}
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
              <span className="text-white text-3xl">🎉</span>
            </div>
            
            <h2 className="text-3xl font-bold text-gray-800 mb-3">
              Sucesso! Tudo importado
            </h2>
            <p className="text-gray-600 mb-8">
              Suas operações foram importadas com sucesso. 
              Sua carteira e histórico estão atualizados!
            </p>

            {/* Resumo */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
              <h3 className="font-bold text-green-800 mb-4">O que foi atualizado:</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>{operationsCount} operações importadas</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Carteira atualizada</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Dividendos calculados</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Impostos organizados</span>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="flex justify-center">
              <Button
                onClick={() => {
                  onSuccess() // Chama onSuccess para fechar modal e atualizar dashboard
                }}
                className="px-8 py-3 text-lg flex items-center gap-2"
                size="lg"
              >
                <Sparkles className="h-5 w-5" />
                Veja a Mágica Acontecer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
