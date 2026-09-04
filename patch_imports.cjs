const fs = require('fs');

['src/pages/ProfileDetails.tsx', 'src/pages/Onboarding.tsx'].forEach(file => {
  let code = fs.readFileSync(file, 'utf8');
  if (!code.includes('import { resizeImage }')) {
    code = "import { resizeImage } from '../lib/resizeImage';\n" + code;
    fs.writeFileSync(file, code);
  }
});
console.log('done imports');
