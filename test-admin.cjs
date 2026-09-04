const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp({ credential: applicationDefault() });
getFirestore().collection('users').limit(1).get().then(snap => {
  console.log("Success:", snap.docs.length);
}).catch(console.error);
