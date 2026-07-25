// Import the functions you need from the SDKs you need
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyChD9W6hR-dk7l5OniKTTQQMMXPt7KTgfU",
  authDomain: "absen-kopkar.firebaseapp.com",
  projectId: "absen-kopkar",
  storageBucket: "absen-kopkar.firebasestorage.app",
  messagingSenderId: "848797740841",
  appId: "1:848797740841:web:adbc9c856132f725689138",
  measurementId: "G-LMC1C60FC4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const isFirebaseConfigured: boolean = true;

export function getFirebaseApp(): FirebaseApp {
  return app;
}

export function getDb(): Firestore {
  return getFirestore(app);
}

export function getFirebaseAuth(): Auth {
  return getAuth(app);
}
