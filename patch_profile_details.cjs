const fs = require('fs');

let code = fs.readFileSync('src/pages/ProfileDetails.tsx', 'utf8');

// Add emailRevealed state
code = code.replace(
  "const [phoneRevealed, setPhoneRevealed] = useState(false);",
  "const [phoneRevealed, setPhoneRevealed] = useState(false);\n  const [emailRevealed, setEmailRevealed] = useState(false);"
);

// We need to change the updateConnectionState logic
code = code.replace(
  /const updateConnectionState = \(sent: any, rec: any\) => \{[\s\S]*?setPhoneRevealed\(false\);\n\s*\}\n\s*\};/m,
  `const updateConnectionState = (sent: any, rec: any) => {
            if (sent) {
              if (sent.status === 'accepted') {
                setConnectionStatus('connected');
              } else if (sent.status === 'pending') {
                setConnectionStatus('sent_pending');
              } else if (sent.status === 'rejected') {
                setConnectionStatus('rejected');
              } else if (sent.status === 'blocked') {
                setConnectionStatus('blocked');
              }
            } else if (rec) {
              if (rec.status === 'accepted') {
                setConnectionStatus('connected');
              } else if (rec.status === 'pending') {
                setConnectionStatus('received_pending');
              }
            } else {
              setConnectionStatus('none');
              setPhoneRevealed(false);
              setEmailRevealed(false);
            }
          };`
);

fs.writeFileSync('src/pages/ProfileDetails.tsx', code);
console.log('Patched ProfileDetails.tsx states');
