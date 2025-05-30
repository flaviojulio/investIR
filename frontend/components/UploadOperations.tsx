"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface UploadOperationsProps {
  onSuccess: () => void
}

export function UploadOperations({ onSuccess }: UploadOperationsProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type === "application/json" || selectedFile.name.endsWith(".json")) {
        setFile(selectedFile)
        setError("")
      } else {
        setError("Por favor, selecione um arquivo JSON válido.")
        setFile(null)
      }
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setLoading(true)
    setError("")

    try {
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
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload de Operações
          </CardTitle>
          <CardDescription>Faça upload de um arquivo JSON com suas operações históricas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Arquivo JSON</Label>
            <Input id="file" type="file" accept=".json" onChange={handleFileSelect} ref={fileInputRef} />
          </div>

          {file && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <FileText className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-800">{file.name}</span>
              <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleUpload} disabled={!file || loading} className="w-full">
            {loading ? "Fazendo upload..." : "Fazer Upload"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Formato do Arquivo</CardTitle>
          <CardDescription>O arquivo JSON deve seguir o formato abaixo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-sm overflow-x-auto">{JSON.stringify(exampleData, null, 2)}</pre>
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>Campos obrigatórios:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                <strong>date:</strong> Data da operação (formato: YYYY-MM-DD)
              </li>
              <li>
                <strong>ticker:</strong> Código da ação (ex: ITUB4, PETR4)
              </li>
              <li>
                <strong>operation:</strong> Tipo de operação ("buy" ou "sell")
              </li>
              <li>
                <strong>quantity:</strong> Quantidade de ações (número inteiro)
              </li>
              <li>
                <strong>price:</strong> Preço por ação (número decimal)
              </li>
              <li>
                <strong>fees:</strong> Taxas da operação (número decimal)
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
