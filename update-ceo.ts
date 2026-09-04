import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ projectId: 'ai-studio-4d43440a-d4ea-442a-a497-70a81e9de266' });

async function main() {
  try {
    const db = getFirestore();
    const snapshot = await db.collection('users').where('email', '==', 'ceo@newfriends.com').get();
    
    if (snapshot.empty) {
      console.log('User not found in Firestore.');
      return;
    }

    const doc = snapshot.docs[0];
    await db.collection('users').doc(doc.id).set({ verified: true, role: 'Admin' }, { merge: true });
    console.log(`Successfully updated ${doc.id} to verified and Admin`);
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}
main();
