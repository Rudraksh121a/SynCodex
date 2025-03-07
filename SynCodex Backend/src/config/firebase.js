import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../firebase-service-account.json"), "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
  });
}
console.log("✅ Firebase Admin Initialized:", admin.apps.length);

const db = admin.firestore();
export { db };


export default admin; 