const fs = require('fs');

let content = fs.readFileSync('src/pages/ChatList.tsx', 'utf8');

content = content.replace(
  "categories?: Record<string, string>;",
  "categories?: Record<string, string>;\n  createdAt?: number;"
);

content = content.replace(
  "profile: userDoc.data().profile || {},",
  "profile: userDoc.data().profile || {},\n              createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),"
);

content = content.replace(
  /recentInteractions\[conn\.id\]/g,
  "(recentInteractions[conn.id] || (conn.createdAt && (Date.now() - conn.createdAt < 900000)))"
);

fs.writeFileSync('src/pages/ChatList.tsx', content);
