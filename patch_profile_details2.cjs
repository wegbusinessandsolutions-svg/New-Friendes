const fs = require('fs');

let code = fs.readFileSync('src/pages/ProfileDetails.tsx', 'utf8');

// find where unsubscribeReqRec is defined and add connection listening
code = code.replace(
  /unsubscribeReqRec = onSnapshot[\s\S]*?\}\);/m,
  `$&
          
          const q = query(
            collection(db, 'connections'),
            where('users', 'array-contains', auth.currentUser.uid)
          );
          unsubscribeConn = onSnapshot(q, (snap) => {
            const conn = snap.docs.find(d => d.data().users.includes(id));
            if (conn) {
              const data = conn.data();
              const theirPerms = data.permissions?.[id] || { showPhone: false, showEmail: false };
              setPhoneRevealed(theirPerms.showPhone);
              setEmailRevealed(theirPerms.showEmail);
            } else {
              setPhoneRevealed(false);
              setEmailRevealed(false);
            }
          });`
);

// We need to declare unsubscribeConn at the top of the useEffect
code = code.replace(
  /let unsubscribeProfile: any;/m,
  "let unsubscribeProfile: any;\n    let unsubscribeConn: any;"
);

// We need to call unsubscribeConn() in the cleanup function
code = code.replace(
  /if \(unsubscribeReqRec\) unsubscribeReqRec\(\);/m,
  "if (unsubscribeReqRec) unsubscribeReqRec();\n      if (unsubscribeConn) unsubscribeConn();"
);

fs.writeFileSync('src/pages/ProfileDetails.tsx', code);
console.log('Patched ProfileDetails.tsx connection listener');
