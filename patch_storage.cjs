const fs = require('fs');
let code = fs.readFileSync('src/pages/ProfileDetails.tsx', 'utf8');

const importTarget = `import { auth, db, storage } from '../lib/firebase';`;
code = code.replace(importTarget, `import { auth, db } from '../lib/firebase';\nimport { resizeImage } from '../lib/resizeImage';`);

const importTarget2 = `import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';`;
code = code.replace(importTarget2, ``);

const regex = /if \(pendingFotoPrincipal\) \{[\s\S]*?setIsUploadingImage\(false\);/m;

const replaceStr = `if (pendingFotoPrincipal) {
        setIsUploadingImage(true);
        finalFotoPrincipalUrl = await resizeImage(pendingFotoPrincipal);
      }

      if (Object.keys(pendingFotosAdicionais).length > 0) {
        setIsUploadingImage(true);
        for (const [idxStr, fileRaw] of Object.entries(pendingFotosAdicionais)) {
          const file = fileRaw as File;
          const idx = parseInt(idxStr);
          finalFotosAdicionais[idx] = await resizeImage(file);
        }
      }

      setIsUploadingImage(false);`;

code = code.replace(regex, replaceStr);
fs.writeFileSync('src/pages/ProfileDetails.tsx', code);
console.log('done ProfileDetails');
