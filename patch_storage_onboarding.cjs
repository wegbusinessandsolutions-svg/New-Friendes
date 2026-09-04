const fs = require('fs');
let code = fs.readFileSync('src/pages/Onboarding.tsx', 'utf8');

const importTarget = `import { auth, db, storage } from '../lib/firebase';`;
code = code.replace(importTarget, `import { auth, db } from '../lib/firebase';\nimport { resizeImage } from '../lib/resizeImage';`);

const importTarget2 = `import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';`;
code = code.replace(importTarget2, ``);

const regex = /if \(pendingFotoPrincipal\) \{[\s\S]*?finalFotoPrincipalUrl = await getDownloadURL\(fileRef\);\n      \}/m;

const replaceStr = `if (pendingFotoPrincipal) {
        setIsUploadingImage(true);
        finalFotoPrincipalUrl = await resizeImage(pendingFotoPrincipal);
      }`;

code = code.replace(regex, replaceStr);
fs.writeFileSync('src/pages/Onboarding.tsx', code);
console.log('done Onboarding');
