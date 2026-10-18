/**
 * Utilitário para envio de mensagens de emergência via WhatsApp,
 * formatando o número de telefone com o DDI do Brasil (55) e codificando o texto de forma segura.
 */

export const formatPhoneForWhatsApp = (phone: string): string => {
  if (!phone) return '';
  let digitsOnly = phone.replace(/\D/g, '');

  // Ajustar formato do Brasil (DDD + 8 ou 9 dígitos) caso não tenha DDI
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    digitsOnly = '55' + digitsOnly;
  }

  return digitsOnly;
};

export const createWhatsAppUri = (phone: string, message: string): string => {
  const digitsOnly = formatPhoneForWhatsApp(phone);
  const encodedMsg = encodeURIComponent(message);
  return `https://api.whatsapp.com/send?phone=${digitsOnly}&text=${encodedMsg}`;
};

export const openWhatsApp = (phone: string, message: string) => {
  if (!phone) return;
  const whatsappUrl = createWhatsAppUri(phone, message);

  try {
    const link = document.createElement('a');
    link.href = whatsappUrl;
    link.target = '_blank';
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
    console.error('Falha ao abrir WhatsApp:', err);
    window.open(whatsappUrl, '_blank');
  }
};

/**
 * Converte dataUrl base64 em File para permitir compartilhamento direto se o navegador suportar.
 */
export const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
};
