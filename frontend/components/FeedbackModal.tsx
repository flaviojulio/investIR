"use client";

import React, { useState } from 'react';
import { X, MessageSquare, AlertTriangle, HelpCircle, Lightbulb, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  paginaAtual?: string;
  abaAtual?: string;
}

interface FeedbackData {
  categoria: 'bug' | 'duvida_fiscal' | 'sugestao' | 'geral';
  pagina_atual?: string;
  mensagem: string;
  prioridade: 'baixa' | 'media' | 'alta';
}

const categoriaConfig = {
  bug: {
    label: 'Erro/Bug',
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    description: 'Reportar falhas ou comportamentos inesperados'
  },
  duvida_fiscal: {
    label: 'Dúvida Fiscal',
    icon: HelpCircle,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Questões sobre cálculos de IR, DARF ou legislação'
  },
  sugestao: {
    label: 'Sugestão',
    icon: Lightbulb,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    description: 'Ideias para melhorar a plataforma'
  },
  geral: {
    label: 'Geral',
    icon: MessageSquare,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    description: 'Outros assuntos ou feedback geral'
  }
};

const prioridadeConfig = {
  baixa: { label: 'Baixa', color: 'text-green-600' },
  media: { label: 'Média', color: 'text-yellow-600' },
  alta: { label: 'Alta', color: 'text-red-600' }
};

const traduzirAba = (abaId: string): string => {
  const abas: Record<string, string> = {
    'overview': 'Visão Geral',
    'extrato': 'Extrato de Operações',
    'carteira': 'Carteira Atual',
    'proventos': 'Proventos',
    'resultados': 'Resultados Fiscais',
    'graficos': 'Gráficos',
    'upload': 'Upload de Operações',
    'manual': 'Cadastro Manual',
    'operacoes_fechadas': 'Operações Encerradas'
  };
  return abas[abaId] || abaId;
};

export default function FeedbackModal({ isOpen, onClose, paginaAtual, abaAtual }: FeedbackModalProps) {
  const [feedback, setFeedback] = useState<FeedbackData>({
    categoria: 'geral',
    pagina_atual: abaAtual ? `${paginaAtual} - ${traduzirAba(abaAtual)}` : paginaAtual,
    mensagem: '',
    prioridade: 'media'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedback.mensagem.trim()) {
      setErrorMessage('A mensagem é obrigatória');
      return;
    }

    if (feedback.mensagem.length > 1000) {
      setErrorMessage('A mensagem deve ter no máximo 1000 caracteres');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await api.post('/feedback', feedback);
      
      // Se chegou aqui, a requisição foi bem-sucedida
      console.log('✅ [Feedback] Enviado com sucesso:', response.data);

      setSubmitStatus('success');

    } catch (error: any) {
      console.error('❌ [Feedback] Erro ao enviar:', error);
      
      // Tratamento específico para erros do axios
      if (error.response) {
        // Erro de resposta do servidor (4xx, 5xx)
        const errorDetail = error.response.data?.detail || error.response.data?.message || 'Erro no servidor';
        setErrorMessage(errorDetail);
      } else if (error.request) {
        // Erro de rede (sem resposta)
        setErrorMessage('Erro de conexão. Verifique sua internet.');
      } else {
        // Outros erros
        setErrorMessage(error.message || 'Erro desconhecido');
      }
      
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSubmitStatus('idle');
      setErrorMessage('');
      onClose();
    }
  };

  const handleSuccessClose = () => {
    setSubmitStatus('idle');
    setFeedback({
      categoria: 'geral',
      pagina_atual: abaAtual ? `${paginaAtual} - ${traduzirAba(abaAtual)}` : paginaAtual,
      mensagem: '',
      prioridade: 'media'
    });
    setErrorMessage('');
    onClose();
  };

  if (!isOpen) return null;

  if (submitStatus === 'success') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Feedback Enviado!
          </h3>
          <p className="text-gray-600 mb-6">
            Obrigado pelo seu feedback. Nossa equipe analisará sua mensagem e retornará em breve.
          </p>
          <button
            onClick={handleSuccessClose}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Feedback</h2>
              <p className="text-sm text-gray-600">Conte-nos como podemos melhorar</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Categoria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Categoria
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(categoriaConfig).map(([key, config]) => {
                const IconComponent = config.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFeedback(prev => ({ ...prev, categoria: key as any }))}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      feedback.categoria === key
                        ? `${config.borderColor} ${config.bgColor}`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <IconComponent className={`w-4 h-4 ${feedback.categoria === key ? config.color : 'text-gray-400'}`} />
                      <span className={`text-sm font-medium ${feedback.categoria === key ? config.color : 'text-gray-700'}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {config.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prioridade */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Prioridade
            </label>
            <div className="flex space-x-3">
              {Object.entries(prioridadeConfig).map(([key, config]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFeedback(prev => ({ ...prev, prioridade: key as any }))}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    feedback.prioridade === key
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {config.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mensagem */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensagem *
            </label>
            <textarea
              value={feedback.mensagem}
              onChange={(e) => setFeedback(prev => ({ ...prev, mensagem: e.target.value }))}
              placeholder="Descreva sua experiência, problema ou sugestão..."
              rows={5}
              maxLength={1000}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              disabled={isSubmitting}
            />
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-gray-500">
                * Campo obrigatório
              </span>
              <span className={`text-xs ${feedback.mensagem.length > 900 ? 'text-red-600' : 'text-gray-500'}`}>
                {feedback.mensagem.length}/1000
              </span>
            </div>
          </div>

          {/* Localização Atual */}
          {(paginaAtual || abaAtual) && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-xs text-blue-700">
                <span className="font-medium">📍 Localização atual:</span>
                <div className="mt-1">
                  {paginaAtual && <div><strong>Página:</strong> {paginaAtual}</div>}
                  {abaAtual && <div><strong>Aba:</strong> {traduzirAba(abaAtual)}</div>}
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="text-sm text-red-700">{errorMessage}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !feedback.mensagem.trim()}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Enviando...' : 'Enviar Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}