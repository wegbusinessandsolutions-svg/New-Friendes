const fs = require('fs');
let code = fs.readFileSync('src/pages/ProfileDetails.tsx', 'utf8');

const target = `setIsUploadingImage(false);

      const userRef = doc(db, 'users', auth.currentUser.uid);`;
const replace = `setIsUploadingImage(false);

      finalFotosAdicionais = finalFotosAdicionais.filter(url => url);

      const userRef = doc(db, 'users', auth.currentUser.uid);`;

code = code.replace(target, replace);
fs.writeFileSync('src/pages/ProfileDetails.tsx', code);
console.log('done filter');
