const fs = require('fs');
let code = fs.readFileSync('src/pages/ProfileDetails.tsx', 'utf8');

const target1 = `{profile.estadoNascimento ? STATE_DEMONYMS[profile.estadoNascimento] || profile.estadoNascimento : ''}`;
const replace1 = `{profile.estadoNascimento || ''}`;

code = code.replace(target1, replace1);

const targetImport = `import { STATE_DEMONYMS } from '../lib/demonyms';`;
code = code.replace(targetImport, '');

fs.writeFileSync('src/pages/ProfileDetails.tsx', code);
console.log('fixed demonyms');
