const fs = require('fs');
let code = fs.readFileSync('src/pages/ProfileDetails.tsx', 'utf8');

const target = `const newFotos = [...editFotosAdicionais];
                                newFotos.splice(index, 1);
                                setEditFotosAdicionais(newFotos);`;
const replace = `const newFotos = [...editFotosAdicionais];
                                newFotos[index] = '';
                                setEditFotosAdicionais(newFotos);`;

code = code.replace(target, replace);
fs.writeFileSync('src/pages/ProfileDetails.tsx', code);
console.log('done delete patch');
