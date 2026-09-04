const fs = require('fs');

let code = fs.readFileSync('src/pages/Discover.tsx', 'utf8');

// Replace allUsers = [...realUsers, ...MOCK_USERS] with allUsers = [...realUsers]
code = code.replace(/const allUsers = \[\.\.\.realUsers, \.\.\.MOCK_USERS\]/, 'const allUsers = [...realUsers]');

fs.writeFileSync('src/pages/Discover.tsx', code);
console.log('Removed MOCK_USERS from display');
