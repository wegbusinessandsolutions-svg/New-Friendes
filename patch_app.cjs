const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(
  "if (!user.emailVerified && !isAdmin) {",
  "// REMOVED EMAIL VERIFICATION BLOCK FOR TESTING\n  if (false && !user.emailVerified && !isAdmin) {"
);

fs.writeFileSync('src/App.tsx', app);
