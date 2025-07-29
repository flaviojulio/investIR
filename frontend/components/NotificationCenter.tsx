"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { 
  Bell, 
  Check, 
  CheckCheck, 
  X, 
  Info, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  ExternalLink,
  Filter,
  Trash2,
  RefreshCw
} from 'lucide-react'
import { api } from '@/lib/api'
import { Mensagem, EstatisticasMensagens } from '@/lib/types'
import Link from 'next/link'

interface NotificationCenterProps {
  onUnreadCountChange?: (count: number) => void
}

export default function NotificationCenter({ onUnreadCountChange }: NotificationCenterProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [estatisticas, setEstatisticas] = useState<EstatisticasMensagens | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('todas')
  const { toast } = useToast()

  useEffect(() => {
    carregarMensagens()
    carregarEstatisticas()
  }, [])

  useEffect(() => {
    // Notificar componente pai sobre mudanças no contador
    if (onUnreadCountChange && estatisticas) {
      onUnreadCountChange(estatisticas.nao_lidas)
    }
  }, [estatisticas, onUnreadCountChange])

  const carregarMensagens = async () => {
    try {
      setLoading(true)
      const response = await api.get('/mensagens?limite=100')
      setMensagens(response.data)
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error)
      toast({
        title: "Erro",
        description: "Erro ao carregar mensagens",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const carregarEstatisticas = async () => {
    try {
      const response = await api.get('/mensagens/estatisticas')
      setEstatisticas(response.data)
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
    }
  }

  const marcarComoLida = async (mensagemId: number) => {
    try {
      await api.put(`/mensagens/${mensagemId}/lida`)
      
      // Atualizar estado local
      setMensagens(prev => prev.map(msg => 
        msg.id === mensagemId 
          ? { ...msg, lida: true, data_leitura: new Date().toISOString() }
          : msg
      ))
      
      // Recarregar estatísticas
      carregarEstatisticas()
      
      toast({
        title: "Sucesso",
        description: "Mensagem marcada como lida",
        variant: "default"
      })
    } catch (error) {
      console.error('Erro ao marcar como lida:', error)
      toast({
        title: "Erro",
        description: "Erro ao marcar mensagem como lida",
        variant: "destructive"
      })
    }
  }

  const marcarTodasComoLidas = async () => {
    try {
      await api.put('/mensagens/marcar-todas-lidas')
      
      // Atualizar estado local
      setMensagens(prev => prev.map(msg => ({
        ...msg,
        lida: true,
        data_leitura: new Date().toISOString()
      })))
      
      // Recarregar estatísticas
      carregarEstatisticas()
      
      toast({
        title: "Sucesso",
        description: "Todas as mensagens foram marcadas como lidas",
        variant: "default"
      })
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error)
      toast({
        title: "Erro",
        description: "Erro ao marcar mensagens como lidas",
        variant: "destructive"
      })
    }
  }

  const deletarMensagem = async (mensagemId: number) => {
    try {
      await api.delete(`/mensagens/${mensagemId}`)
      
      // Remover do estado local
      setMensagens(prev => prev.filter(msg => msg.id !== mensagemId))
      
      // Recarregar estatísticas
      carregarEstatisticas()
      
      toast({
        title: "Sucesso",
        description: "Mensagem deletada com sucesso",
        variant: "default"
      })
    } catch (error) {
      console.error('Erro ao deletar mensagem:', error)
      toast({
        title: "Erro",
        description: "Erro ao deletar mensagem",
        variant: "destructive"
      })
    }
  }

  const obterIconePorTipo = (tipo: string) => {
    switch (tipo) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <Info className="h-5 w-5 text-blue-600" />
    }
  }

  const obterCorPorPrioridade = (prioridade: string) => {
    switch (prioridade) {
      case 'critica':
        return 'border-l-red-500 bg-red-50'
      case 'alta':
        return 'border-l-orange-500 bg-orange-50'
      case 'normal':
        return 'border-l-blue-500 bg-blue-50'
      case 'baixa':
        return 'border-l-gray-500 bg-gray-50'
      default:
        return 'border-l-gray-500 bg-gray-50'
    }
  }

  const filtrarMensagens = (mensagens: Mensagem[]) => {
    switch (activeTab) {
      case 'nao-lidas':
        return mensagens.filter(msg => !msg.lida)
      case 'importantes':
        return mensagens.filter(msg => msg.prioridade === 'alta' || msg.prioridade === 'critica')
      case 'sistema':
        return mensagens.filter(msg => msg.categoria === 'sistema')
      default:
        return mensagens
    }
  }

  const formatarData = (dataStr: string) => {
    const data = new Date(dataStr)
    const agora = new Date()
    const diferenca = agora.getTime() - data.getTime()
    const minutos = Math.floor(diferenca / (1000 * 60))
    const horas = Math.floor(diferenca / (1000 * 60 * 60))
    const dias = Math.floor(diferenca / (1000 * 60 * 60 * 24))

    if (minutos < 60) {
      return `há ${minutos} min`
    } else if (horas < 24) {
      return `há ${horas}h`
    } else if (dias < 7) {
      return `há ${dias} dias`
    } else {
      return data.toLocaleDateString('pt-BR')
    }
  }

  const mensagensFiltradas = filtrarMensagens(mensagens)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="relative flex items-center gap-2 hover:bg-indigo-50 hover:border-indigo-300"
        >
          <Bell className="h-4 w-4" />
          {estatisticas && estatisticas.nao_lidas > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {estatisticas.nao_lidas > 99 ? '99+' : estatisticas.nao_lidas}
            </Badge>
          )}
          <span className="hidden sm:inline">Notificações</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Central de Notificações
            {estatisticas && (
              <Badge variant="secondary" className="ml-2">
                {estatisticas.nao_lidas} não lidas
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Controles */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={carregarMensagens}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              
              {estatisticas && estatisticas.nao_lidas > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={marcarTodasComoLidas}
                  className="flex items-center gap-2"
                >
                  <CheckCheck className="h-4 w-4" />
                  Marcar Todas como Lidas
                </Button>
              )}
            </div>

            {/* Estatísticas rápidas */}
            {estatisticas && (
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Total: {estatisticas.total}</span>
                <span>Não lidas: {estatisticas.nao_lidas}</span>
              </div>
            )}
          </div>

          {/* Tabs de filtro */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="todas">Todas</TabsTrigger>
              <TabsTrigger value="nao-lidas">
                Não Lidas
                {estatisticas && estatisticas.nao_lidas > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 text-xs">
                    {estatisticas.nao_lidas}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="importantes">Importantes</TabsTrigger>
              <TabsTrigger value="sistema">Sistema</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <ScrollArea className="h-[400px] w-full">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Carregando mensagens...</span>
                    </div>
                  </div>
                ) : mensagensFiltradas.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhuma mensagem encontrada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mensagensFiltradas.map((mensagem) => (
                      <Card
                        key={mensagem.id}
                        className={`border-l-4 transition-all duration-200 ${
                          mensagem.lida ? 'opacity-75' : 'shadow-md'
                        } ${obterCorPorPrioridade(mensagem.prioridade)}`}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              {obterIconePorTipo(mensagem.tipo)}
                              <CardTitle className="text-sm font-medium">
                                {mensagem.titulo}
                              </CardTitle>
                              {!mensagem.lida && (
                                <Badge variant="secondary" className="text-xs">
                                  Nova
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1">
                              {!mensagem.lida && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => marcarComoLida(mensagem.id)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              )}
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deletarMensagem(mensagem.id)}
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="pt-0">
                          <CardDescription className="text-sm mb-2">
                            {mensagem.conteudo}
                          </CardDescription>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>{formatarData(mensagem.data_criacao)}</span>
                              <Separator orientation="vertical" className="h-3" />
                              <span className="capitalize">{mensagem.categoria}</span>
                              <Separator orientation="vertical" className="h-3" />
                              <span className="capitalize">{mensagem.prioridade}</span>
                            </div>
                            
                            {mensagem.acao_url && mensagem.acao_texto && (
                              <Link href={mensagem.acao_url}>
                                <Button variant="outline" size="sm" className="flex items-center gap-1">
                                  {mensagem.acao_texto}
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}