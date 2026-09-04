const fs = require('fs');

let code = fs.readFileSync('src/pages/ProfileDetails.tsx', 'utf8');

if (!code.includes('import { getDemonym } from')) {
  code = code.replace("import { Home, Compass, User, UserPlus", "import { getDemonym } from '../lib/demonyms';\nimport { Home, Compass, User, UserPlus");
}

const target = `{profile.estadoNascimento || ''}`;
const replace = `{profile.estadoNascimento ? getDemonym(profile.estadoNascimento, profile.sexo) : ''}`;
code = code.replace(target, replace);

fs.writeFileSync('src/pages/ProfileDetails.tsx', code);
console.log('done fixing profile demonyms');
