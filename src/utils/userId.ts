/**
 * Utilitários para criação e gerenciamento do ID do Usuário.
 * Regra: Data(DDMMAA) + Hora(HHMMSS)
 * Exemplo: 23/09/2026 às 17:20:16 -> "230926172016"
 */

export function generateUserRegistrationId(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dd = pad(date.getDate());
  const mm = pad(date.getMonth() + 1);
  const aa = String(date.getFullYear()).slice(-2);
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${dd}${mm}${aa}${hh}${min}${ss}`;
}

export function getUserRegistrationId(user: any): string {
  if (!user) return '';
  if (user.codigoUsuario) return String(user.codigoUsuario);
  if (user.idNumerico) return String(user.idNumerico);
  if (user.profile?.codigoUsuario) return String(user.profile.codigoUsuario);
  if (user.profile?.idNumerico) return String(user.profile.idNumerico);

  // Derivação retroativa a partir de data de criação (se disponível)
  if (user.createdAt) {
    try {
      let d: Date | null = null;
      if (typeof user.createdAt.toDate === 'function') {
        d = user.createdAt.toDate();
      } else if (user.createdAt instanceof Date) {
        d = user.createdAt;
      } else if (typeof user.createdAt === 'number') {
        d = new Date(user.createdAt);
      } else if (typeof user.createdAt === 'string') {
        d = new Date(user.createdAt);
      }
      if (d && !isNaN(d.getTime())) {
        return generateUserRegistrationId(d);
      }
    } catch {
      // Ignora erro de parsing
    }
  }

  return user.id || '';
}
