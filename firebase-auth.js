import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, GoogleAuthProvider,
  signInWithPopup, signOut, onAuthStateChanged, updateProfile, reload,
  setPersistence, browserLocalPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, collection, query,
  where, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyABhbtobTavDofKnAzgXVuutK05fSmN9Aw",
  authDomain: "cedi-to-yuan.firebaseapp.com",
  projectId: "cedi-to-yuan",
  storageBucket: "cedi-to-yuan.firebasestorage.app",
  messagingSenderId: "22277087236",
  appId: "1:22277087236:web:1da86ba53d7d4dd54b1551"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export const ADMIN_EMAIL = "johngamor123@gmail.com";

/* ---------- AUTH ---------- */
export const watchUser = cb => onAuthStateChanged(auth, cb);

export const setRemember = yes =>
  setPersistence(auth, yes ? browserLocalPersistence : browserSessionPersistence);

export async function registerUser(name, email, password) {
  const c = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(c.user, { displayName: name.trim() });
  try { await sendEmailVerification(c.user); } catch (e) { console.error(e); }
  return c.user;
}
export const loginUser = (email, password) =>
  signInWithEmailAndPassword(auth, email.trim(), password).then(c => c.user);
export const googleLogin = () =>
  signInWithPopup(auth, new GoogleAuthProvider()).then(c => c.user);
export const logoutUser = () => signOut(auth);
export const resetPassword = email => sendPasswordResetEmail(auth, email.trim());
export const updateName = name => updateProfile(auth.currentUser, { displayName: name.trim() });

export async function resendVerify() {
  const u = auth.currentUser;
  if (!u) throw new Error("Please log in first.");
  await reload(u);
  if (u.emailVerified) return "verified";
  await sendEmailVerification(u);
  return "sent";
}
export async function reloadUser() {
  const u = auth.currentUser;
  if (u) await reload(u);
  return auth.currentUser;
}

/* ---------- PROFILE ---------- */
export const getProfile = async uid => {
  const s = await getDoc(doc(db, "users", uid));
  return s.exists() ? s.data() : null;
};
export const saveProfile = (uid, data) =>
  setDoc(doc(db, "users", uid), data, { merge: true });

/* ---------- SETTINGS ---------- */
export const watchConfig = cb =>
  onSnapshot(doc(db, "settings", "config"),
    s => cb(s.exists() ? s.data() : null),
    e => console.error("config error", e));

export const saveConfig = c =>
  setDoc(doc(db, "settings", "config"), { ...c, updated: serverTimestamp() });

/* ---------- ORDERS ---------- */
export const createOrder = o =>
  addDoc(collection(db, "orders"), { ...o, createdAt: serverTimestamp() });

export const watchMyOrders = (uid, cb) =>
  onSnapshot(query(collection(db, "orders"), where("uid", "==", uid)),
    s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
    e => console.error("orders error", e));

export const watchAllOrders = cb =>
  onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")),
    s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
    e => console.error("admin orders error", e));

export const adminSet = (id, fields, touch = true) =>
  updateDoc(doc(db, "orders", id), touch ? { ...fields, updatedAt: serverTimestamp() } : fields);

export const claimPaid = (id, ref) =>
  updateDoc(doc(db, "orders", id), {
    payStatus: "Customer says paid", customerRef: ref, paidClaimAt: serverTimestamp()
  });

export const cancelMine = id =>
  updateDoc(doc(db, "orders", id), { status: "Cancelled", payStatus: "Cancelled by customer" });
export const watchAnnounce = cb =>
  onSnapshot(doc(db, "settings", "announce"),
    s => cb(s.exists() ? s.data() : null),
    e => console.error("announce error", e));

export const saveAnnounce = text =>
  setDoc(doc(db, "settings", "announce"), { text, at: serverTimestamp() });