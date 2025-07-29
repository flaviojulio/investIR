/**
 * Utilitários para validação e formatação de CPF no frontend
 */

/**
 * Remove formatação do CPF, deixando apenas números
 */
export function limparCPF(cpf: string): string {
  if (!cpf) return ''
  return cpf.replace(/\D/g, '')
}

/**
 * Formata CPF no padrão brasileiro xxx.xxx.xxx-xx
 */
export function formatarCPF(cpf: string): string {
  if (!cpf) return ''
  
  const cpfLimpo = limparCPF(cpf)
  
  // Se não tem 11 dígitos, retorna como está
  if (cpfLimpo.length !== 11) {
    return cpf
  }
  
  return `${cpfLimpo.slice(0, 3)}.${cpfLimpo.slice(3, 6)}.${cpfLimpo.slice(6, 9)}-${cpfLimpo.slice(9)}`
}

/**
 * Formata CPF conforme o usuário digita (máscara dinâmica)
 */
export function formatarCPFInput(value: string): string {
  if (!value) return ''
  
  const cpfLimpo = limparCPF(value)
  
  // Limita a 11 dígitos
  const cpfTruncado = cpfLimpo.slice(0, 11)
  
  // Aplica formatação progressiva
  if (cpfTruncado.length <= 3) {
    return cpfTruncado
  } else if (cpfTruncado.length <= 6) {
    return `${cpfTruncado.slice(0, 3)}.${cpfTruncado.slice(3)}`
  } else if (cpfTruncado.length <= 9) {
    return `${cpfTruncado.slice(0, 3)}.${cpfTruncado.slice(3, 6)}.${cpfTruncado.slice(6)}`
  } else {
    return `${cpfTruncado.slice(0, 3)}.${cpfTruncado.slice(3, 6)}.${cpfTruncado.slice(6, 9)}-${cpfTruncado.slice(9)}`
  }
}

/**
 * Valida CPF usando o algoritmo oficial brasileiro
 */
export function validarCPF(cpf: string): boolean {
  if (!cpf) return false
  
  const cpfLimpo = limparCPF(cpf)
  
  // Verifica se tem 11 dígitos
  if (cpfLimpo.length !== 11) return false
  
  // Verifica se não são todos os dígitos iguais
  if (cpfLimpo === cpfLimpo[0].repeat(11)) return false
  
  // Calcula o primeiro dígito verificador
  let soma = 0
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpfLimpo[i]) * (10 - i)
  }
  
  let resto = soma % 11
  const primeiroDigito = resto < 2 ? 0 : 11 - resto
  
  // Verifica o primeiro dígito
  if (parseInt(cpfLimpo[9]) !== primeiroDigito) return false
  
  // Calcula o segundo dígito verificador
  soma = 0
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpfLimpo[i]) * (11 - i)
  }
  
  resto = soma % 11
  const segundoDigito = resto < 2 ? 0 : 11 - resto
  
  // Verifica o segundo dígito
  return parseInt(cpfLimpo[10]) === segundoDigito
}

/**
 * Verifica se o CPF está completo (11 dígitos)
 */
export function isCPFCompleto(cpf: string): boolean {
  const cpfLimpo = limparCPF(cpf)
  return cpfLimpo.length === 11
}

/**
 * Máscara para input de CPF - retorna o valor formatado e a posição do cursor
 */
export function aplicarMascaraCPF(value: string, cursorPosition: number): { value: string; cursorPosition: number } {
  const valorFormatado = formatarCPFInput(value)
  
  // Ajusta posição do cursor considerando os caracteres de formatação adicionados
  let novaPosicao = cursorPosition
  const caracteresAdicionados = valorFormatado.length - limparCPF(value).length
  
  if (caracteresAdicionados > 0) {
    // Se adicionou pontos ou hífen, ajusta cursor
    const valorAnterior = formatarCPFInput(value.slice(0, cursorPosition))
    novaPosicao = valorAnterior.length
  }
  
  return {
    value: valorFormatado,
    cursorPosition: Math.min(novaPosicao, valorFormatado.length)
  }
}