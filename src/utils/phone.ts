/**
 * Formata números de telefone/WhatsApp brasileiros no padrão:
 * - (DD) XXXXX-XXXX (Padrão celular nacional de 11 dígitos)
 * - (XX) XXXXXX-XXXX (Para São Paulo ou casos com 12 dígitos)
 * - (DD) XXXX-XXXX (Para fixo de 10 dígitos)
 */
export function formatBrazilianPhone(value: string): string {
  if (!value) return '';
  let digits = value.replace(/\D/g, '');

  // Limite máximo de dígitos (até 12 dígitos com DDD)
  if (digits.length > 12) {
    digits = digits.slice(0, 12);
  }

  if (digits.length === 0) return '';
  if (digits.length === 1) return `(${digits}`;
  if (digits.length === 2) return `(${digits}) `;

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  // Caso São Paulo (DDD 11 ou 12-19) com 12 dígitos: (XX) XXXXXX-XXXX
  if (digits.length === 12) {
    const part1 = rest.slice(0, 6);
    const part2 = rest.slice(6, 10);
    return `(${ddd}) ${part1}-${part2}`;
  }

  // Padrão celular de 11 dígitos: (DD) XXXXX-XXXX
  if (rest.length > 8) {
    const part1 = rest.slice(0, 5);
    const part2 = rest.slice(5, 9);
    return `(${ddd}) ${part1}-${part2}`;
  }

  // Padrão fixo de 10 dígitos: (DD) XXXX-XXXX
  if (rest.length > 4) {
    const part1 = rest.slice(0, 4);
    const part2 = rest.slice(4, 8);
    return `(${ddd}) ${part1}-${part2}`;
  }

  // Em digitação intermediária
  return `(${ddd}) ${rest}`;
}
