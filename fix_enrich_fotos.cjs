const fs = require('fs');
let code = fs.readFileSync('src/pages/ProfileDetails.tsx', 'utf8');

const target1 = `      fotos: baseProfile.fotosAdicionais && baseProfile.fotosAdicionais.length > 0 
        ? [baseProfile.fotoPrincipalUrl, ...baseProfile.fotosAdicionais] 
        : extraPics,`;
const replace1 = `      fotos: userId.startsWith('mock') ? extraPics : (baseProfile.fotosAdicionais && baseProfile.fotosAdicionais.length > 0 
        ? [baseProfile.fotoPrincipalUrl, ...baseProfile.fotosAdicionais] 
        : [baseProfile.fotoPrincipalUrl]),`;

code = code.replace(target1, replace1);
fs.writeFileSync('src/pages/ProfileDetails.tsx', code);
console.log('fixed enrich fotos');
