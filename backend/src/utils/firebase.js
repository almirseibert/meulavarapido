// Firebase Admin — usado só para verificar o ID token do Phone Auth no cadastro.
// Configurar via env: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.
let admin = null;
let initialized = false;

function getAdmin() {
  if (initialized) return admin;
  initialized = true;
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    console.warn('[firebase] Credenciais ausentes — verificação de telefone desativada (modo dev).');
    return null;
  }
  try {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          // a chave privada vem com \n escapado no .env
          privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }
  } catch (e) {
    console.error('[firebase] Falha ao inicializar:', e.message);
    admin = null;
  }
  return admin;
}

function isConfigured() {
  return !!getAdmin();
}

/**
 * Verifica o ID token do Firebase e retorna { phone, uid }.
 * Lança erro se o token for inválido ou não tiver telefone.
 */
async function verifyPhoneToken(idToken) {
  const a = getAdmin();
  if (!a) {
    const err = new Error('Verificação por telefone indisponível no servidor.');
    err.code = 'firebase-unavailable';
    throw err;
  }
  const decoded = await a.auth().verifyIdToken(idToken);
  return { phone: decoded.phone_number || null, uid: decoded.uid };
}

module.exports = { verifyPhoneToken, isConfigured };
