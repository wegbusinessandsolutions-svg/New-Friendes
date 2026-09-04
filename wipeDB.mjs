import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function wipe() {
  const collections = ['users', 'locations', 'history', 'interactions', 'connections', 'shortMessages', 'friendships', 'chats', 'verificationRequests', 'reports', 'blocks', 'profileViews', 'settings'];
  
  for (const col of collections) {
    console.log(`Wiping ${col}...`);
    try {
      const snap = await getDocs(collection(db, col));
      for (const d of snap.docs) {
        await deleteDoc(doc(db, col, d.id));
      }
      console.log(`Wiped ${snap.size} from ${col}`);
    } catch (e) {
      console.log(`Failed to wipe ${col}: ${e.message}`);
    }
  }
  console.log("Done");
}

wipe();
