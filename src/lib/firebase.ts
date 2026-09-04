import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getPerformance, FirebasePerformance } from 'firebase/performance';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

let dbInstance;
try {
  // Try standard getFirestore first, which uses fast WebSockets/WebChannel
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
} catch (err) {
  console.warn("Failed to initialize standard Firestore, falling back to long polling:", err);
  try {
    dbInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId);
  } catch (err2) {
    console.error("Critical failure initializing Firestore:", err2);
    dbInstance = getFirestore(app);
  }
}

export const db = dbInstance;

export const auth = getAuth(app);
auth.languageCode = 'pt';
export const storage = getStorage(app);

export let perf: FirebasePerformance | null = null;
if (typeof window !== 'undefined') {
  try {
    perf = getPerformance(app);
  } catch (err) {
    console.warn("Performance Monitoring não é suportado ou falhou ao inicializar:", err);
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client is running in offline mode.");
    }
  }
}
testConnection();
