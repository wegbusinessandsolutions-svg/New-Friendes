const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

// Undo delete patches
rules = rules.replace(/allow delete: if isPrivilegedEmail\(\);/g, "allow delete: if false;");
rules = rules.replace(/allow delete: if \(isSignedIn\(\) && request\.auth\.uid in existing\(\)\.users\) \|\| isPrivilegedEmail\(\);/g, "allow delete: if isSignedIn() && request.auth.uid in existing().users;");
rules = rules.replace(/allow delete: if \(isSignedIn\(\) && request\.auth\.uid in existing\(\)\.participantes\) \|\| isPrivilegedEmail\(\);/g, "allow delete: if isSignedIn() && request.auth.uid in existing().participantes;");
rules = rules.replace(/allow delete: if \(isSignedIn\(\) && request\.auth\.uid == userId\) \|\| isPrivilegedEmail\(\);/g, "allow delete: if isSignedIn() && request.auth.uid == userId;");
rules = rules.replace(/allow delete: if \(isSignedIn\(\) && existing\(\)\.blockedBy == request\.auth\.uid\) \|\| isPrivilegedEmail\(\);/g, "allow delete: if isSignedIn() && existing().blockedBy == request.auth.uid;");
rules = rules.replace(/allow list: if isSignedIn\(\) && \( request\.auth\.uid in resource\.data\.participantes \|\| chatId\.matches\('\.\*' \+ request\.auth\.uid \+ '\.\*'\) \|\| isPrivilegedEmail\(\) \);/g, "allow list: if isSignedIn() && (\n        request.auth.uid in resource.data.participantes ||\n        chatId.matches('.*' + request.auth.uid + '.*')\n      );");

fs.writeFileSync('firestore.rules', rules);
