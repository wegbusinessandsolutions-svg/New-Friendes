import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ projectId: 'ai-studio-4d43440a-d4ea-442a-a497-70a81e9de266' });

async function main() {
  try {
    const db = getFirestore();
    const configRef = db.collection('settings').doc('app_config');
    const docSnap = await configRef.get();
    
    const defaultConfig = {
      maintenanceMode: false,
      registrationEnabled: true,
      globalBannerText: '',
      autoVerifyNewUsers: false,
      appCustomTitle: 'New Friends.br'
    };

    if (!docSnap.exists) {
      console.log('Document settings/app_config does not exist. Creating it with defaults...');
      await configRef.set(defaultConfig);
      console.log('Successfully created and initialized settings/app_config');
    } else {
      console.log('Document settings/app_config already exists:', docSnap.data());
      // Let's ensure any missing keys are merged
      await configRef.set(defaultConfig, { merge: true });
      console.log('Successfully merged default config keys');
    }
  } catch (err: any) {
    console.error('Error initializing settings/app_config:', err.message);
  }
}
main();
