import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, onIdTokenChanged, setPersistence, signInWithEmailAndPassword, browserLocalPersistence, User as FirebaseAuthUser } from "firebase/auth";
import { getFirestore, setLogLevel, doc, onSnapshot, setDoc, getDoc, serverTimestamp, FieldValue, Timestamp, Unsubscribe, DocumentSnapshot } from "firebase/firestore";

import { FirebaseUser, FirebaseCustomClaims, IFakeFillerOptions, User } from "src/types";

type AuthStateChangeCallback = (user: FirebaseUser, claims: FirebaseCustomClaims) => void;
type OptionsChangeCallback = (options: IFakeFillerOptions) => void;
type SettingsSchema = {
  options: string;
  updatedAt: FieldValue;
};

const app = initializeApp({
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const auth = getAuth(app);
const db = getFirestore(app);

setLogLevel("silent");

let firebaseUser: FirebaseUser | null = null;
let firebaseClaims: FirebaseCustomClaims | null = null;
let userClaimsUpdatedAt: FieldValue | null = null;
let optionsUpdatedAt: FieldValue | null = null;
let userSnapshotUnsubscribe: Unsubscribe | null = null;
let authStateChangeCallback: AuthStateChangeCallback | null = null;

let optionsSnapshotUnsubscribe: Unsubscribe | null = null;
let optionsChangeCallback: OptionsChangeCallback | null = null;

function unsubscribeAllSnapshots() {
  if (userSnapshotUnsubscribe) {
    userSnapshotUnsubscribe();
  }

  if (optionsSnapshotUnsubscribe) {
    optionsSnapshotUnsubscribe();
  }
}

function onNewSettings(snapshot: DocumentSnapshot<Partial<SettingsSchema>>) {
  const data = snapshot.data();

  if (!snapshot.metadata.hasPendingWrites && data && data.updatedAt && data.options) {
    optionsUpdatedAt = data.updatedAt;
    const options = JSON.parse(data.options) as IFakeFillerOptions;
    if (optionsChangeCallback) {
      optionsChangeCallback(options);
    }
  }
}

async function onNewClaims(snapshot: DocumentSnapshot<Partial<User>>) {
  const data = snapshot.data();

  if (firebaseUser && data && data.claimsUpdatedAt) {
    if (userClaimsUpdatedAt && !data.claimsUpdatedAt.isEqual(userClaimsUpdatedAt)) {
      await firebaseUser.getIdToken(true);
    }

    userClaimsUpdatedAt = data.claimsUpdatedAt;
  }
}

onAuthStateChanged(auth, (user: FirebaseAuthUser | null) => {
  firebaseUser = user;

  if (user) {
    unsubscribeAllSnapshots();

    userSnapshotUnsubscribe = onSnapshot(doc(db, "users", user.uid), onNewClaims);
    optionsSnapshotUnsubscribe = onSnapshot(doc(db, "settings", user.uid), onNewSettings);
  } else {
    unsubscribeAllSnapshots();

    if (authStateChangeCallback) {
      authStateChangeCallback(null, null);
    }
  }
});

onIdTokenChanged(auth, async (user: FirebaseAuthUser | null) => {
  if (authStateChangeCallback) {
    if (user) {
      const result = await user.getIdTokenResult(false);
      firebaseClaims = result.claims as FirebaseCustomClaims;
      authStateChangeCallback(user, firebaseClaims);
    } else {
      authStateChangeCallback(null, null);
    }
  }
});

export function onAuthStateChange(callback: AuthStateChangeCallback) {
  authStateChangeCallback = callback;
}

export function onOptionsChange(callback: OptionsChangeCallback) {
  optionsChangeCallback = callback;
}

export async function login(email: string, password: string) {
  await setPersistence(auth, browserLocalPersistence);
  const result = await signInWithEmailAndPassword(auth, email, password);
  if (result && result.user && result.user.email) {
    firebaseUser = result.user;
    return firebaseUser;
  }

  return null;
}

export function logout() {
  unsubscribeAllSnapshots();
  optionsUpdatedAt = null;
  return auth.signOut();
}

export async function saveOptionsToDb(options: IFakeFillerOptions) {
  if (firebaseUser && firebaseClaims && firebaseClaims.subscribed) {
    const updatedAt = serverTimestamp();

    await setDoc(doc(db, "settings", firebaseUser.uid),
      { options: JSON.stringify(options), updatedAt },
      { merge: true }
    );

    return updatedAt;
  }

  return null;
}

export async function getOptionsLastUpdatedTimestamp() {
  if (optionsUpdatedAt) {
    return (optionsUpdatedAt as Timestamp).toDate();
  }

  if (firebaseUser) {
    const result = await getDoc(doc(db, "settings", firebaseUser.uid));
    if (result.exists()) {
      optionsUpdatedAt = (result.data() as SettingsSchema).updatedAt;
      return (optionsUpdatedAt as Timestamp).toDate();
    }
  }

  return undefined;
}
