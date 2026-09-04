const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

rules = rules.replace(
  /allow create: if isSignedIn\(\) && request\.auth\.uid == userId && \(\s*\(\s*isUserPublicValid\(incoming\(\)\) &&\s*\(!\('role' in incoming\(\)\) \|\| incoming\(\)\.role == 'User'\) &&\s*\(!\('verified' in incoming\(\)\) \|\| incoming\(\)\.verified is boolean\)\) \|\|\s*isPrivilegedEmail\(\)\s*\);/g,
  "allow create: if isSignedIn() && request.auth.uid == userId && (\n        (isUserPublicValid(incoming()) && !('role' in incoming()) && !('verified' in incoming())) ||\n        isPrivilegedEmail()\n      );"
);

fs.writeFileSync('firestore.rules', rules);
