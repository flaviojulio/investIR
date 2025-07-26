// Utilitário para debug de autenticação

export function debugAuth() {
  if (typeof window === 'undefined') {
    console.log('🔍 [AuthDebug] Executando no servidor, não pode verificar localStorage');
    return;
  }

  const token = localStorage.getItem('token');
  
  if (!token) {
    console.error('🚨 [AuthDebug] Token não encontrado no localStorage');
    console.log('🔍 [AuthDebug] Chaves disponíveis no localStorage:', Object.keys(localStorage));
    return;
  }

  console.log('🔍 [AuthDebug] Token encontrado:', token);
  
  // Verificar se o token é válido (JWT tem 3 partes separadas por .)
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.error('🚨 [AuthDebug] Token não parece ser um JWT válido (deve ter 3 partes)');
    return;
  }

  try {
    // Decodificar o payload (base64)
    const payload = JSON.parse(atob(parts[1]));
    console.log('🔍 [AuthDebug] Payload do token:', payload);
    
    // Verificar expiração
    if (payload.exp) {
      const expirationDate = new Date(payload.exp * 1000);
      const now = new Date();
      console.log('🔍 [AuthDebug] Token expira em:', expirationDate);
      console.log('🔍 [AuthDebug] Data atual:', now);
      
      if (expirationDate < now) {
        console.error('🚨 [AuthDebug] Token EXPIRADO!');
      } else {
        console.log('✅ [AuthDebug] Token ainda válido');
      }
    }
  } catch (error) {
    console.error('🚨 [AuthDebug] Erro ao decodificar token:', error);
  }
}

// Função para ser chamada no console do browser
(window as any).debugAuth = debugAuth;
