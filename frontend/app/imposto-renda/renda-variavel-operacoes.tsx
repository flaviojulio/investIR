import React, { useState, useEffect } from 'react';

interface RendaVariavelOperacoesProps {
  ano: number;
}

export default function RendaVariavelOperacoes({ ano }: RendaVariavelOperacoesProps) {
  const [mesAtivo, setMesAtivo] = useState('Janeiro');
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const [dados, setDados] = useState({
    mercadoVista: {
      acoes: { operacoesComuns: '0,00', dayTrade: '0,00' },
      // ouro e ouroFinForaBolsa desabilitados
    },
    resultados: {
      resultadoLiquido: { operacoesComuns: '0,00', dayTrade: '0,00' },
      resultadoNegativo: { operacoesComuns: '0,00', dayTrade: '0,00' },
      baseCalculo: { operacoesComuns: '0,00', dayTrade: '0,00' },
      prejuizoCompensar: { operacoesComuns: '0,00', dayTrade: '0,00' },
      aliquotaImposto: { operacoesComuns: '15%', dayTrade: '20%' },
      impostoDevido: { operacoesComuns: '0,00', dayTrade: '0,00' }
    },
    consolidacao: {
      totalImpostoDevido: '0,00',
      impostoAPagar: '0,00',
      impostoPago: '0,00'
    }
  });

  useEffect(() => {
    async function fetchResultadosMensais(mes: string) {
      const mesesNum = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      const mesIndex = mesesNum.indexOf(mes) + 1;
      const mesFormatado = `${ano}-${mesIndex.toString().padStart(2, '0')}`;
      try {
        const response = await fetch(`/api/resultados?mes=${mesFormatado}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const text = await response.text();
        console.log('[FRONT] Resposta bruta da API /api/resultados:', text);
        let resultados: any[];
        try {
          resultados = JSON.parse(text);
        } catch (parseError) {
          console.error('[FRONT] Erro ao fazer parse do JSON da resposta da API /api/resultados:', parseError, text);
          throw parseError;
        }
        // Filtra apenas meses tributáveis (isento_swing === false)
        const resultadosTributaveis = resultados.filter((r: any) => r.isento_swing === false);
        const resultado = resultadosTributaveis.find((r: any) => r.mes === mesFormatado);
        if (resultado) {
          // Debug: loga todos os campos relevantes para imposto pago
          console.log('[DEBUG impostoPago]', {
            status_darf_swing_trade: resultado.status_darf_swing_trade,
            status_darf_day_trade: resultado.status_darf_day_trade,
            ir_pagar_swing: resultado.ir_pagar_swing,
            ir_pagar_day: resultado.ir_pagar_day,
            resultado
          });
          setDados(prev => ({
            ...prev,
            mercadoVista: {
              acoes: {
                // Agora igual ao resultado líquido do mês (operações comuns e day trade)
                operacoesComuns: resultado.ganho_liquido_swing?.toFixed(2).replace('.', ',') || '0,00',
                dayTrade: resultado.ganho_liquido_day?.toFixed(2).replace('.', ',') || '0,00',
              },
            },
            resultados: {
              resultadoLiquido: {
                operacoesComuns: resultado.ganho_liquido_swing?.toFixed(2).replace('.', ',') || '0,00',
                dayTrade: resultado.ganho_liquido_day?.toFixed(2).replace('.', ',') || '0,00',
              },
              resultadoNegativo: {
                operacoesComuns: resultado.resultado_negativo_ate_mes_anterior_swing?.toFixed(2).replace('.', ',') || '0,00',
                dayTrade: resultado.resultado_negativo_ate_mes_anterior_day?.toFixed(2).replace('.', ',') || '0,00',
              },
              baseCalculo: {
                operacoesComuns: resultado.ganho_liquido_swing?.toFixed(2).replace('.', ',') || '0,00',
                dayTrade: resultado.ganho_liquido_day?.toFixed(2).replace('.', ',') || '0,00',
              },
              prejuizoCompensar: {
                operacoesComuns: resultado.prejuizo_acumulado_swing?.toFixed(2).replace('.', ',') || '0,00',
                dayTrade: resultado.prejuizo_acumulado_day?.toFixed(2).replace('.', ',') || '0,00',
              },
              aliquotaImposto: prev.resultados.aliquotaImposto,
              impostoDevido: {
                operacoesComuns: resultado.ir_devido_swing?.toFixed(2).replace('.', ',') || '0,00',
                dayTrade: resultado.ir_devido_day?.toFixed(2).replace('.', ',') || '0,00',
              },
            },
            consolidacao: {
              totalImpostoDevido: ((resultado.ir_devido_swing || 0) + (resultado.ir_devido_day || 0)).toFixed(2).replace('.', ','),
              impostoAPagar: ((resultado.ir_pagar_swing || 0) + (resultado.ir_pagar_day || 0)).toFixed(2).replace('.', ','),
              impostoPago: (() => {
                const swingPago = (resultado.status_darf_swing_trade || '').toLowerCase() === 'pago';
                const dayPago = (resultado.status_darf_day_trade || '').toLowerCase() === 'pago';
                if (swingPago && dayPago) {
                  return (((resultado.ir_pagar_swing || 0) + (resultado.ir_pagar_day || 0)).toFixed(2).replace('.', ','));
                }
                if (swingPago) {
                  return (resultado.ir_pagar_swing || 0).toFixed(2).replace('.', ',');
                }
                if (dayPago) {
                  return (resultado.ir_pagar_day || 0).toFixed(2).replace('.', ',');
                }
                return '0,00';
              })(),
            },
          }));
        } else {
          setDados({
            mercadoVista: {
              acoes: { operacoesComuns: '0,00', dayTrade: '0,00' },
            },
            resultados: {
              resultadoLiquido: { operacoesComuns: '0,00', dayTrade: '0,00' },
              resultadoNegativo: { operacoesComuns: '0,00', dayTrade: '0,00' },
              baseCalculo: { operacoesComuns: '0,00', dayTrade: '0,00' },
              prejuizoCompensar: { operacoesComuns: '0,00', dayTrade: '0,00' },
              aliquotaImposto: { operacoesComuns: '15%', dayTrade: '20%' },
              impostoDevido: { operacoesComuns: '0,00', dayTrade: '0,00' }
            },
            consolidacao: {
              totalImpostoDevido: '0,00',
              impostoAPagar: '0,00',
              impostoPago: '0,00'
            }
          });
        }
      } catch (error) {
        console.error('Erro ao buscar resultados:', error);
      }
    }
    fetchResultadosMensais(mesAtivo);
  }, [mesAtivo, ano]);

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-400 to-blue-300 p-3 flex items-center">
          <div className="w-6 h-6 bg-green-500 rounded mr-2 flex items-center justify-center">
            <span className="text-white font-bold text-xs">W</span>
          </div>
          <h1 className="text-white text-lg font-semibold">Renda Variável - Operações Comuns/Day-Trade</h1>
        </div>
        {/* Content */}
        <div className="p-4">
          {/* Aviso informativo */}
          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">i</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Este demonstrativo deve ser preenchido pelo contribuinte pessoa física, residente ou domiciliado no Brasil, que durante o ano-calendário de 2024 efetuou no Brasil:</span>
                </p>
                <ul className="mt-2 text-sm text-blue-700 space-y-1">
                  <li>a) alienação de ações no mercado à vista em bolsa de valores;</li>
                  <li>b) alienação de ouro, ativo financeiro, no mercado disponível ou à vista em bolsa de mercadorias, de futuro ou diretamente junto a instituições financeiras;</li>
                  <li>c) operações nos mercados a termo, de opções e futuro, realizadas em bolsa de valores, de mercadorias e de futuros, com qualquer ativo;</li>
                  <li>d) operações realizadas em mercados de liquidação futura, fora de bolsa, inclusive com opções flexíveis.</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            {/* Sidebar de meses (vertical tabs) */}
            <div className="w-32 space-y-1">
              {meses.map((mes) => (
                <button
                  key={mes}
                  onClick={() => setMesAtivo(mes)}
                  className={`w-full p-2 text-sm text-left rounded ${
                    mesAtivo === mes 
                      ? 'bg-blue-100 text-blue-800 font-medium border border-blue-300' 
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                  type="button"
                >
                  {mes}
                </button>
              ))}
            </div>
            {/* Conteúdo principal do mês selecionado */}
            <div className="flex-1 space-y-4">
              <div className="mb-4">
                <span className="inline-block bg-blue-200 text-blue-900 px-3 py-1 rounded font-semibold text-sm">
                  {mesAtivo}
                </span>
              </div>
              {/* Mercado à Vista */}
              <div className="border border-gray-300 rounded">
                <div className="bg-blue-100 p-2 flex items-center justify-between">
                  <span className="font-medium text-blue-800">⊖ Mercado à Vista</span>
                </div>
                <div className="p-3 space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-sm">
                    <div className="col-span-6 font-medium text-gray-700">Tipo de Mercado/Ativo</div>
                    <div className="col-span-3 text-center font-medium text-blue-600">Operações Comuns</div>
                    <div className="col-span-3 text-center font-medium text-blue-600">Day-Trade</div>
                  </div>
                  {/* Linhas de dados */}
                  <div className="space-y-1">
                    <div className="grid grid-cols-12 gap-2 text-sm py-1">
                      <div className="col-span-6 text-gray-700">Mercado à vista - ações</div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-right" value={dados.mercadoVista.acoes.operacoesComuns} readOnly />
                      </div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-right" value={dados.mercadoVista.acoes.dayTrade} readOnly />
                      </div>
                    </div>
                    {/* Campos de ouro e ouroFinForaBolsa desabilitados */}
                    <div className="grid grid-cols-12 gap-2 text-sm py-1 opacity-50 pointer-events-none">
                      <div className="col-span-6 text-gray-700">Mercado à vista - ouro</div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-right" value={''} disabled />
                      </div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-right" value={''} disabled />
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-2 text-sm py-1 opacity-50 pointer-events-none">
                      <div className="col-span-6 text-gray-700">Mercado à vista - ouro at. fin. fora bolsa</div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-right" value={''} disabled />
                      </div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-right" value={''} disabled />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Mercado Opções, Futuro, Termo desabilitados */}
              <div className="border border-gray-300 rounded opacity-50 pointer-events-none relative group">
                <div className="bg-blue-100 p-2" style={{ pointerEvents: 'auto', cursor: 'help', position: 'relative', zIndex: 30 }}>
                  <span className="font-medium text-blue-800">⊕ Mercado Opções</span>
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full mt-1 w-80 bg-gray-100 text-gray-800 text-xs rounded border border-gray-300 shadow px-4 py-2 opacity-0 group-hover:opacity-100 transition pointer-events-auto select-none flex items-center gap-2"
                    style={{ pointerEvents: 'auto', minHeight: '40px' }}>
                    <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4 text-gray-500 flex-shrink-0' fill='none' viewBox='0 0 24 24' stroke='currentColor'><circle cx='12' cy='12' r='10' strokeWidth='2' /><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 16v-4m0-4h.01' /></svg>
                    Este componente é meramente decorativo para deixar a página o mais parecida possível com programa da Receita Federal
                  </div>
                </div>
              </div>
              <div className="border border-gray-300 rounded opacity-50 pointer-events-none relative group">
                <div className="bg-blue-100 p-2" style={{ pointerEvents: 'auto', cursor: 'help', position: 'relative', zIndex: 30 }}>
                  <span className="font-medium text-blue-800">⊕ Mercado Futuro</span>
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full mt-1 w-80 bg-gray-100 text-gray-800 text-xs rounded border border-gray-300 shadow px-4 py-2 opacity-0 group-hover:opacity-100 transition pointer-events-auto select-none flex items-center gap-2"
                    style={{ pointerEvents: 'auto', minHeight: '40px' }}>
                    <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4 text-gray-500 flex-shrink-0' fill='none' viewBox='0 0 24 24' stroke='currentColor'><circle cx='12' cy='12' r='10' strokeWidth='2' /><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 16v-4m0-4h.01' /></svg>
                    Este componente é meramente decorativo para deixar a página o mais parecida possível com programa da Receita Federal
                  </div>
                </div>
              </div>
              <div className="border border-gray-300 rounded opacity-50 pointer-events-none relative group">
                <div className="bg-blue-100 p-2" style={{ pointerEvents: 'auto', cursor: 'help', position: 'relative', zIndex: 30 }}>
                  <span className="font-medium text-blue-800">⊕ Mercado a Termo</span>
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full mt-1 w-80 bg-gray-100 text-gray-800 text-xs rounded border border-gray-300 shadow px-4 py-2 opacity-0 group-hover:opacity-100 transition pointer-events-auto select-none flex items-center gap-2"
                    style={{ pointerEvents: 'auto', minHeight: '40px' }}>
                    <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4 text-gray-500 flex-shrink-0' fill='none' viewBox='0 0 24 24' stroke='currentColor'><circle cx='12' cy='12' r='10' strokeWidth='2' /><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 16v-4m0-4h.01' /></svg>
                    Este componente é meramente decorativo para deixar a página o mais parecida possível com programa da Receita Federal
                  </div>
                </div>
              </div>
              {/* Resultados */}
              <div className="border border-gray-300 rounded">
                <div className="bg-blue-100 p-2">
                  <span className="font-medium text-blue-800">⊖ Resultados</span>
                </div>
                <div className="p-3 space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-sm">
                    <div className="col-span-6"></div>
                    <div className="col-span-3 text-center font-medium text-blue-600">Operações Comuns</div>
                    <div className="col-span-3 text-center font-medium text-blue-600">Day-Trade</div>
                  </div>
                  <div className="space-y-1">
                    <div className="grid grid-cols-12 gap-2 text-sm py-1">
                      <div className="col-span-6 text-gray-700">RESULTADO LÍQUIDO DO MÊS</div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-right" value={dados.resultados.resultadoLiquido.operacoesComuns} readOnly />
                      </div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-right" value={dados.resultados.resultadoLiquido.dayTrade} readOnly />
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-2 text-sm py-1">
                      <div className="col-span-6 text-gray-700">Resultado negativo até o mês anterior</div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-right" value={dados.resultados.resultadoNegativo.operacoesComuns} readOnly />
                      </div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-right" value={dados.resultados.resultadoNegativo.dayTrade} readOnly />
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-2 text-sm py-1">
                      <div className="col-span-6 text-gray-700">BASE DE CÁLCULO DO IMPOSTO</div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-right" value={dados.resultados.baseCalculo.operacoesComuns} readOnly />
                      </div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-right" value={dados.resultados.baseCalculo.dayTrade} readOnly />
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-2 text-sm py-1">
                      <div className="col-span-6 text-gray-700">Prejuízo a compensar</div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-right" value={dados.resultados.prejuizoCompensar.operacoesComuns} readOnly />
                      </div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-right" value={dados.resultados.prejuizoCompensar.dayTrade} readOnly />
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-2 text-sm py-1">
                      <div className="col-span-6 text-gray-700">Alíquota do imposto</div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-center bg-gray-100" value={dados.resultados.aliquotaImposto.operacoesComuns} readOnly />
                      </div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-center bg-gray-100" value={dados.resultados.aliquotaImposto.dayTrade} readOnly />
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-2 text-sm py-1">
                      <div className="col-span-6 text-gray-700">IMPOSTO DEVIDO</div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-right" value={dados.resultados.impostoDevido.operacoesComuns} readOnly />
                      </div>
                      <div className="col-span-3">
                        <input className="w-full p-1 text-xs border border-gray-300 rounded text-right" value={dados.resultados.impostoDevido.dayTrade} readOnly />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Consolidação do Mês */}
              <div className="border border-gray-300 rounded">
                <div className="bg-blue-100 p-2">
                  <span className="font-medium text-blue-800">Consolidação do Mês</span>
                </div>
                <div className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">Total do imposto devido</span>
                        <input className="w-20 p-1 text-xs border border-gray-300 rounded text-right" value={dados.consolidacao.totalImpostoDevido} readOnly />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">Imposto a pagar</span>
                        <input className="w-20 p-1 text-xs border border-gray-300 rounded text-right" value={dados.consolidacao.impostoAPagar} readOnly />
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">Imposto pago</span>
                        <input className="w-20 p-1 text-xs border border-gray-300 rounded text-right" value={dados.consolidacao.impostoPago} readOnly />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}