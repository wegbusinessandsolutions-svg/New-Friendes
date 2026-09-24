/**
 * Utilitário para envio de SMS de emergência utilizando a operadora de celular nativa,
 * permitindo o acionamento sem necessidade de internet ativa.
 */

export const createSmsUri = (phone: string, message: string): string => {
  // Limpar telefone deixando apenas dígitos
  let digitsOnly = phone.replace(/\D/g, '');

  // Ajustar formato do Brasil (DDD + 8 ou 9 dígitos) caso não tenha DDI
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    digitsOnly = '55' + digitsOnly;
  }

  const encodedMsg = encodeURIComponent(message);

  // RFC 5724 e Android utilizam '?body=', enquanto algumas versões do iOS utilizam '&body='
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const separator = isIOS ? '&body=' : '?body=';

  return `sms:+${digitsOnly}${separator}${encodedMsg}`;
};

export const openNativeSms = (phone: string, message: string) => {
  if (!phone) return;

  const smsUrl = createSmsUri(phone, message);

  try {
    // Acionamento seguro via elemento âncora para não ser bloqueado pelo navegador
    const link = document.createElement('a');
    link.href = smsUrl;
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 500);
  } catch (err) {
    console.error('Falha ao abrir aplicativo nativo de SMS:', err);
    window.location.href = smsUrl;
  }
};
