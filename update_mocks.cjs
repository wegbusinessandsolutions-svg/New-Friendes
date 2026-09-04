const fs = require('fs');

let code = fs.readFileSync('src/pages/Discover.tsx', 'utf8');

const states = [
  'Goiás', 'Mato Grosso', 'Mato Grosso do Sul', 'Distrito Federal', 'São Paulo', 'Rio de Janeiro', 'Minas Gerais', 'Espírito Santo', 'Bahia', 'Pernambuco', 'Ceará', 'Maranhão', 'Paraíba', 'Rio Grande do Norte', 'Alagoas', 'Piauí', 'Sergipe', 'Amazonas', 'Pará', 'Tocantins', 'Rondônia', 'Acre', 'Amapá', 'Roraima', 'Rio Grande do Sul', 'Paraná', 'Santa Catarina'
];

let stateIndex = 0;

code = code.replace(/estadoNascimento: 'Goiás'/g, () => {
  const st = states[stateIndex % states.length];
  stateIndex++;
  return `estadoNascimento: '${st}'`;
});

fs.writeFileSync('src/pages/Discover.tsx', code);
console.log('done states');
