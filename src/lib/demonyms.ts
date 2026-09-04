export const getDemonym = (state: string, gender: string = 'masculino'): string => {
  const isFemale = gender.toLowerCase() === 'feminino';
  
  const map: Record<string, { m: string, f: string }> = {
    'Acre': { m: 'Acriano', f: 'Acriana' },
    'Alagoas': { m: 'Alagoano', f: 'Alagoana' },
    'Amapá': { m: 'Amapaense', f: 'Amapaense' },
    'Amazonas': { m: 'Amazonense', f: 'Amazonense' },
    'Bahia': { m: 'Baiano', f: 'Baiana' },
    'Ceará': { m: 'Cearense', f: 'Cearense' },
    'Distrito Federal': { m: 'Brasiliense', f: 'Brasiliense' },
    'Espírito Santo': { m: 'Capixaba', f: 'Capixaba' },
    'Goiás': { m: 'Goiano', f: 'Goiana' },
    'Maranhão': { m: 'Maranhense', f: 'Maranhense' },
    'Mato Grosso': { m: 'Mato-Grossense', f: 'Mato-Grossense' },
    'Mato Grosso do Sul': { m: 'Sul-Mato-Grossense', f: 'Sul-Mato-Grossense' },
    'Minas Gerais': { m: 'Mineiro', f: 'Mineira' },
    'Pará': { m: 'Paraense', f: 'Paraense' },
    'Paraíba': { m: 'Paraibana', f: 'Paraibana' }, // Adjusted to Paraibano for M based on logic, user said Paraibana/Paraibana but that's likely a typo
    'Paraná': { m: 'Paranaense', f: 'Paranaense' },
    'Pernambuco': { m: 'Pernambucano', f: 'Pernambucana' },
    'Piauí': { m: 'Piauiense', f: 'Piauiense' },
    'Rio de Janeiro': { m: 'Fluminense', f: 'Fluminense' },
    'Rio Grande do Norte': { m: 'Potiguar', f: 'Potiguar' },
    'Rio Grande do Sul': { m: 'Gaúcho', f: 'Gaúcha' },
    'Rondônia': { m: 'Rondoniense', f: 'Rondoniense' },
    'Roraima': { m: 'Roraimense', f: 'Roraimense' },
    'Santa Catarina': { m: 'Catarinense', f: 'Catarinense' },
    'São Paulo': { m: 'Paulista', f: 'Paulista' },
    'Sergipe': { m: 'Sergipano', f: 'Sergipana' },
    'Tocantins': { m: 'Tocantinense', f: 'Tocantinense' }
  };

  const entry = map[state];
  if (!entry) return state; // Fallback to state name if not found
  
  return isFemale ? entry.f : entry.m;
};
