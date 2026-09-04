import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  projectId: 'ai-studio-prod-2024',
});

const db = getFirestore(app, 'ai-studio-4d43440a-d4ea-442a-a497-70a81e9de266');

async function run() {
  try {
    const snapshot = await db.collection('users').limit(1).get();
    console.log('Success! Found docs:', snapshot.size);
  } catch (err: any) {
    console.error('Error fetching users:', err);
  }
}

run();

