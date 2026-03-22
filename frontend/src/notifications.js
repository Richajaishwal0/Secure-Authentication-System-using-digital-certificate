import {
  collection, addDoc, query, orderBy,
  onSnapshot, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { ADMIN_EMAIL } from './firebase'

// Collection path: notifications/{email}/items
const col = (email) => collection(db, 'notifications', email.toLowerCase(), 'items')

export function sendNotification(toEmail, { type, title, message, serial }) {
  return addDoc(col(toEmail), {
    type,
    title,
    message,
    serial:    serial || null,
    read:      false,
    createdAt: serverTimestamp(),
  })
}

// Always writes to admin's fixed collection
export function sendAdminNotification({ type, title, message, fromEmail }) {
  return addDoc(col(ADMIN_EMAIL), {
    type,
    title,
    message,
    fromEmail: fromEmail || null,
    read:      false,
    createdAt: serverTimestamp(),
  })
}

export function subscribeNotifications(email, callback) {
  const q = query(col(email), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export function markRead(email, notifId) {
  return updateDoc(doc(db, 'notifications', email.toLowerCase(), 'items', notifId), { read: true })
}
