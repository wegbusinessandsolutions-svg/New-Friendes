const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.applicationDefault() });
admin.firestore().collection('users').limit(1).get().then(snap => {
  console.log("Success:", snap.docs.length);
}).catch(console.error);
