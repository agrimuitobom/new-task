import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCd_6a72oVMqSKWretMc040VrjJINqFzr4",
  authDomain: "new-task-d5127.firebaseapp.com",
  projectId: "new-task-d5127",
  storageBucket: "new-task-d5127.firebasestorage.app",
  messagingSenderId: "848366931136",
  appId: "1:848366931136:web:cdd2d8904f1f49bfe9f125",
  measurementId: "G-176N732CN7",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
