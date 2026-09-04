const fs = require('fs');
let code = fs.readFileSync('src/pages/Discover.tsx', 'utf8');

const target1 = `{u.profile?.estadoNascimento && STATE_DEMONYMS[u.profile.estadoNascimento] && (
                             <span className="text-[11px] font-medium text-white/90 drop-shadow-sm mt-0.5 truncate capitalize">
                               {STATE_DEMONYMS[u.profile.estadoNascimento]}
                             </span>
                           )}`;
const replace1 = `{u.profile?.estadoNascimento && (
                             <span className="text-[11px] font-medium text-white/90 drop-shadow-sm mt-0.5 truncate">
                               {u.profile.estadoNascimento}
                             </span>
                           )}`;
code = code.replace(target1, replace1);

const targetImport = `import { STATE_DEMONYMS } from '../lib/demonyms';`;
code = code.replace(targetImport, '');

fs.writeFileSync('src/pages/Discover.tsx', code);
console.log('done discover');
