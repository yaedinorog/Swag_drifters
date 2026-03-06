import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore/lite";

const firebaseConfig = {
  apiKey: "AIzaSyCGx9nNm8jA6poya9bvb35-sm1x4t2fsgI",
  authDomain: "swag-drifters-leaderboard.firebaseapp.com",
  projectId: "swag-drifters-leaderboard",
  storageBucket: "swag-drifters-leaderboard.firebasestorage.app",
  messagingSenderId: "681548818857",
  appId: "1:681548818857:web:2c910d5a98910193e17cb8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
