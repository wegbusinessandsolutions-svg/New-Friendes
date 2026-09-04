const fs = require('fs');

function replaceFetchWithBlob(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  
  if (!code.includes('function dataURLtoBlob')) {
    const dataURLtoBlobFunc = `
function dataURLtoBlob(dataurl) {
  var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], {type:mime});
}
`;
    // Add the function after imports
    code = code.replace(/import .*?;\n/, match => match + dataURLtoBlobFunc);
  }

  code = code.replace(/await \(await fetch\(resizedDataUrl\)\)\.blob\(\)/g, 'dataURLtoBlob(resizedDataUrl)');
  fs.writeFileSync(filePath, code);
}

replaceFetchWithBlob('src/pages/ProfileDetails.tsx');
replaceFetchWithBlob('src/pages/Onboarding.tsx');
console.log('Fixed blob conversion');
