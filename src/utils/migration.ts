import { doc, updateDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { Firestore } from 'firebase/firestore';

/**
 * Normalizes any birthdate string into DD-MM-AAAA format.
 * Supports:
 * - DD/MM/AAAA
 * - YYYY-MM-DD
 * - DD-MM-AAAA
 */
export function convertToDDMMAAAA(dob: string): string {
  if (!dob) return '';
  const clean = dob.trim();
  
  // Format 1: DD/MM/AAAA or similar with slash
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      const p0 = parts[0].padStart(2, '0');
      const p1 = parts[1].padStart(2, '0');
      const p2 = parts[2];
      // Check if p0 is year (4 digits)
      if (p0.length === 4) {
        return `${p2}-${p1}-${p0}`;
      }
      return `${p0}-${p1}-${p2}`;
    }
  }
  
  // Format 2: YYYY-MM-DD
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      const p0 = parts[0];
      const p1 = parts[1].padStart(2, '0');
      const p2 = parts[2].padStart(2, '0');
      // If it's YYYY-MM-DD
      if (p0.length === 4) {
        return `${p2}-${p1}-${p0}`;
      }
      // If it's already DD-MM-AAAA
      return `${p0.padStart(2, '0')}-${p1}-${p2}`;
    }
  }
  
  return clean;
}

/**
 * Calculates age based on a birthdate string.
 * Supports DD-MM-AAAA, DD/MM/AAAA, and YYYY-MM-DD.
 */
export function calculateAge(dob: string): number {
  if (!dob) return 0;
  const today = new Date();
  let birthDate: Date;
  
  if (dob.includes('/') || dob.includes('-')) {
    const parts = dob.includes('/') ? dob.split('/') : dob.split('-');
    if (parts.length === 3) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10) - 1; // months are 0-indexed
      const p2 = parseInt(parts[2], 10);
      
      // Check if parts[0] is year (e.g. value > 31)
      if (p0 > 31) {
        birthDate = new Date(p0, p1, p2);
      } else {
        birthDate = new Date(p2, p1, p0);
      }
    } else {
      return 0;
    }
  } else {
    birthDate = new Date(dob);
  }

  if (isNaN(birthDate.getTime())) {
    return 0;
  }

  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Executes a one-time migration on user login.
 * If the user is an admin or privileged role, it migrates ALL users.
 * Otherwise, it migrates only the logged-in user's profile.
 */
export async function runBirthdateMigration(db: Firestore, currentUser: { uid: string; email?: string | null }) {
  if (!currentUser) return;

  const cacheKey = `birthdate_migration_done_${currentUser.uid}`;
  const alreadyMigrated = localStorage.getItem(cacheKey);
  if (alreadyMigrated) {
    console.log(`[Birthdate Migration] Already processed in this browser session for UID: ${currentUser.uid}`);
    return;
  }

  try {
    const isAdmin = currentUser.email === 'ceo@newfriends.com' || 
                    currentUser.email === 'sac@wegbusiness.com' || 
                    currentUser.email === 'ceo@wegbusiness.com' || 
                    currentUser.email === 'wegbusinessandsolutions@gmail.com';

    console.log(`[Birthdate Migration] Starting migration. Is admin: ${isAdmin}`);

    if (isAdmin) {
      // Fetch all users and migrate them in batches
      const querySnapshot = await getDocs(collection(db, 'users'));
      console.log(`[Birthdate Migration] Fetched ${querySnapshot.size} user documents for migration.`);
      
      const batch = writeBatch(db);
      let migrationCount = 0;

      querySnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        let needsUpdate = false;
        const updatePayload: any = {};

        // 1. Check root level dataNascimento
        if (userData.dataNascimento) {
          const formatted = convertToDDMMAAAA(userData.dataNascimento);
          if (formatted !== userData.dataNascimento) {
            updatePayload.dataNascimento = formatted;
            needsUpdate = true;
            console.log(`[Birthdate Migration] Root birthdate of user ${userDoc.id} changed from "${userData.dataNascimento}" to "${formatted}"`);
          }
        }

        // 2. Check profile level dataNascimento
        if (userData.profile?.dataNascimento) {
          const formatted = convertToDDMMAAAA(userData.profile.dataNascimento);
          if (formatted !== userData.profile.dataNascimento) {
            updatePayload['profile.dataNascimento'] = formatted;
            needsUpdate = true;
            console.log(`[Birthdate Migration] Profile birthdate of user ${userDoc.id} changed from "${userData.profile.dataNascimento}" to "${formatted}"`);
          }
        }

        // Recalculate age if any date was migrated or if profile.idade is wrong
        if (needsUpdate) {
          const finalDob = updatePayload['profile.dataNascimento'] || updatePayload.dataNascimento || userData.profile?.dataNascimento || userData.dataNascimento;
          if (finalDob) {
            const currentAge = calculateAge(finalDob);
            updatePayload['profile.idade'] = currentAge;
            if (userData.idade !== undefined) {
              updatePayload.idade = currentAge;
            }
          }
        }

        if (needsUpdate) {
          batch.update(doc(db, 'users', userDoc.id), updatePayload);
          migrationCount++;
        }
      });

      if (migrationCount > 0) {
        await batch.commit();
        console.log(`[Birthdate Migration] Successfully completed migration of ${migrationCount} users.`);
      } else {
        console.log('[Birthdate Migration] No users required birthdate formatting changes.');
      }
    } else {
      // Migrate only the current user's document
      await runBirthdateMigrationSingleUser(db, currentUser.uid);
    }

    localStorage.setItem(cacheKey, 'true');
  } catch (error) {
    console.error("[Birthdate Migration] Error running migration:", error);
  }
}

export async function runBirthdateMigrationSingleUser(db: Firestore, userId: string) {
  try {
    const { getDoc } = await import('firebase/firestore');
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      let needsUpdate = false;
      const updatePayload: any = {};

      if (userData.dataNascimento) {
        const formatted = convertToDDMMAAAA(userData.dataNascimento);
        if (formatted !== userData.dataNascimento) {
          updatePayload.dataNascimento = formatted;
          needsUpdate = true;
        }
      }

      if (userData.profile?.dataNascimento) {
        const formatted = convertToDDMMAAAA(userData.profile.dataNascimento);
        if (formatted !== userData.profile.dataNascimento) {
          updatePayload['profile.dataNascimento'] = formatted;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        const finalDob = updatePayload['profile.dataNascimento'] || updatePayload.dataNascimento || userData.profile?.dataNascimento || userData.dataNascimento;
        if (finalDob) {
          const currentAge = calculateAge(finalDob);
          updatePayload['profile.idade'] = currentAge;
          if (userData.idade !== undefined) {
            updatePayload.idade = currentAge;
          }
        }
        await updateDoc(userRef, updatePayload);
        console.log(`[Birthdate Migration] Migrated single user profile for UID: ${userId}`);
      }
    }
  } catch (err) {
    console.error(`[Birthdate Migration] Error migrating single user profile ${userId}:`, err);
  }
}
