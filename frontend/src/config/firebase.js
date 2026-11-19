import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBHcyUTvck-khf5j55MwGplTV-U47pSW8Y',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'react-firebase-chat-ab0e7.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'react-firebase-chat-ab0e7',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'react-firebase-chat-ab0e7.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '381452605411',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:381452605411:web:f723b00046695bf66b32d6',
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export default app
