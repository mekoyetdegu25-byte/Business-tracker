// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// ያንተ የFirebase ፕሮጀክት መረጃ
const firebaseConfig = {
  apiKey: "AIzaSyDcA1t2fOA98U9KsngvDEih6TmEZb1-v0E",
  authDomain: "hotel-tracker-c3571.firebaseapp.com",
  projectId: "hotel-tracker-c3571",
  storageBucket: "hotel-tracker-c3571.firebasestorage.app",
  messagingSenderId: "1024629386649",
  appId: "1:1024629386649:web:c689f920c780e400797708"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
