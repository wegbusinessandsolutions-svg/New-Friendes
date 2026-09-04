import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import fs from 'fs';

const rules = fs.readFileSync('firestore.rules', 'utf8');

async function main() {
  try {
    const env = await initializeTestEnvironment({
      projectId: 'demo-test',
      firestore: { rules }
    });
    console.log("Compile Success");
    await env.cleanup();
  } catch (e) {
    console.error("Compile Error:");
    console.error(e.message);
  }
}
main();
