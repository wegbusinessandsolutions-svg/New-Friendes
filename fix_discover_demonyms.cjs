const fs = require('fs');

let code = fs.readFileSync('src/pages/Discover.tsx', 'utf8');

if (!code.includes('import { getDemonym } from')) {
  code = "import { getDemonym } from '../lib/demonyms';\n" + code;
}

const target = `{u.profile.estadoNascimento}`;
const replace = `{getDemonym(u.profile.estadoNascimento, u.profile.sexo)}`;
code = code.replace(target, replace);

fs.writeFileSync('src/pages/Discover.tsx', code);
console.log('done fixing discover demonyms');
