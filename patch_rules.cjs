const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

rules = rules.replace(
  /allow delete: if false;/g,
  "allow delete: if isPrivilegedEmail();"
);

rules = rules.replace(
  /allow list: if isSignedIn\(\) && \(\s*request\.auth\.uid in resource\.data\.participantes\s*\|\|\s*chatId\.matches\('.\*' \+ request\.auth\.uid \+ '\.\*'\)\s*\);/g,
  "allow list: if isSignedIn() && ( request.auth.uid in resource.data.participantes || chatId.matches('.*' + request.auth.uid + '.*') || isPrivilegedEmail() );"
);

rules = rules.replace(
  /allow delete: if isSignedIn\(\) && request\.auth\.uid in existing\(\)\.users;/g,
  "allow delete: if (isSignedIn() && request.auth.uid in existing().users) || isPrivilegedEmail();"
);

rules = rules.replace(
  /allow delete: if isSignedIn\(\) && request\.auth\.uid in existing\(\)\.participantes;/g,
  "allow delete: if (isSignedIn() && request.auth.uid in existing().participantes) || isPrivilegedEmail();"
);

rules = rules.replace(
  /allow delete: if isSignedIn\(\) && request\.auth\.uid == userId;/g,
  "allow delete: if (isSignedIn() && request.auth.uid == userId) || isPrivilegedEmail();"
);

rules = rules.replace(
  /allow delete: if isSignedIn\(\) && existing\(\)\.blockedBy == request\.auth\.uid;/g,
  "allow delete: if (isSignedIn() && existing().blockedBy == request.auth.uid) || isPrivilegedEmail();"
);

fs.writeFileSync('firestore.rules', rules);
