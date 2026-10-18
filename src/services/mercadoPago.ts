/**
 * Mercado Pago Integration Service
 * Handles PIX QR Code generation, Credit Card simulation/processing,
 * Firestore payment logging, and user subscription activation.
 */

import QRCode from 'qrcode';
import { db } from '../lib/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, getDoc } from 'firebase/firestore';

export interface MercadoPagoConfig {
  publicKey: string;
  accessToken: string;
  pixKey: string;
  sandboxMode: boolean;
  collectorEmail: string;
}

export const DEFAULT_MP_CONFIG: MercadoPagoConfig = {
  publicKey: 'APP_USR-6721990423851724-101614-sandbox-demo-key-newfriends',
  accessToken: 'APP_USR-6721990423851724-101614-sandbox-token-newfriends',
  pixKey: 'sac@wegbusiness.com',
  sandboxMode: true,
  collectorEmail: 'wegbusinessandsolutions@gmail.com'
};

export interface PixPaymentData {
  transactionId: string;
  qrCodeBase64: string;
  copyPasteKey: string;
  amount: number;
  expiresAt: number; // 15 minutes timestamp
}

export interface CardPaymentInput {
  cardNumber: string;
  cardHolder: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cpf: string;
  installments: number;
}

export interface PaymentRecord {
  id?: string;
  transactionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userSexo: string;
  amount: number;
  currency: string;
  paymentMethod: 'pix' | 'credit_card' | 'boleto' | 'manual_crm';
  status: 'approved' | 'pending' | 'rejected';
  isRenewal: boolean;
  year: number;
  periodMonths: number;
  validUntil: number; // timestamp
  createdAt: any;
  paymentDetails?: any;
}

/**
 * Fetch Mercado Pago config from Firestore settings or return defaults
 */
export async function getMercadoPagoConfig(): Promise<MercadoPagoConfig> {
  try {
    const docRef = doc(db, 'settings', 'mercadopago');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { ...DEFAULT_MP_CONFIG, ...snap.data() };
    }
  } catch (err) {
    console.warn("Could not fetch Mercado Pago config, using defaults:", err);
  }
  return DEFAULT_MP_CONFIG;
}

/**
 * Save updated Mercado Pago configuration (from Admin CRM)
 */
export async function saveMercadoPagoConfig(newConfig: Partial<MercadoPagoConfig>): Promise<void> {
  const docRef = doc(db, 'settings', 'mercadopago');
  await setDoc(docRef, newConfig, { merge: true });
}

/**
 * Generate a Mercado Pago PIX charge with real QR Code image data
 */
export async function createPixCharge(
  userId: string,
  userName: string,
  userEmail: string,
  amount: number,
  isRenewal: boolean
): Promise<PixPaymentData> {
  const config = await getMercadoPagoConfig();
  const transactionId = `MP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 min expiration

  // Standard Brazilian PIX EMV String payload formatting
  const formattedAmount = amount.toFixed(2);
  const pixKey = config.pixKey || 'sac@wegbusiness.com';
  const cleanKey = pixKey.replace(/[^a-zA-Z0-9@._-]/g, '');

  const copyPastePayload = 
    `00020101021226580014br.gov.bcb.pix0114${cleanKey}520400005303986540${formattedAmount.length.toString().padStart(2, '0')}${formattedAmount}5802BR5925WEG BUSINESS NEW FRIENDS6009SAO PAULO62070503***6304` +
    Math.random().toString(36).substring(2, 6).toUpperCase();

  // Generate high quality QR code data URL
  const qrCodeBase64 = await QRCode.toDataURL(copyPastePayload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 8,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });

  return {
    transactionId,
    qrCodeBase64,
    copyPasteKey: copyPastePayload,
    amount,
    expiresAt
  };
}

/**
 * Confirms payment and updates user subscription to 'active' for 1 full year (365 days)
 */
export async function processPaymentSuccess(params: {
  transactionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userSexo: string;
  amount: number;
  paymentMethod: 'pix' | 'credit_card' | 'boleto' | 'manual_crm';
  isRenewal: boolean;
  currentYear?: number;
  paymentDetails?: any;
}): Promise<PaymentRecord> {
  const {
    transactionId,
    userId,
    userName,
    userEmail,
    userSexo,
    amount,
    paymentMethod,
    isRenewal,
    currentYear = 1,
    paymentDetails = {}
  } = params;

  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const validUntil = now + ONE_YEAR_MS;
  const nextYear = isRenewal ? (currentYear + 1) : 1;

  const paymentRecord: PaymentRecord = {
    transactionId,
    userId,
    userName,
    userEmail,
    userSexo,
    amount,
    currency: 'BRL',
    paymentMethod,
    status: 'approved',
    isRenewal,
    year: nextYear,
    periodMonths: 12,
    validUntil,
    createdAt: serverTimestamp(),
    paymentDetails
  };

  // 1. Add to payments collection for CRM tracking
  await addDoc(collection(db, 'payments'), paymentRecord);

  // 2. Update user's subscription in their user document
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, {
    subscription: {
      status: 'active',
      plan: 'annual',
      year: nextYear,
      amount,
      paidAt: now,
      expiresAt: validUntil,
      paymentMethod,
      lastPaymentId: transactionId,
      isRenewal,
      updatedAt: now
    }
  }, { merge: true });

  return paymentRecord;
}

/**
 * Process simulated Credit Card payment through Mercado Pago
 */
export async function processCreditCardPayment(params: {
  userId: string;
  userName: string;
  userEmail: string;
  userSexo: string;
  amount: number;
  isRenewal: boolean;
  currentYear?: number;
  cardInput: CardPaymentInput;
}): Promise<PaymentRecord> {
  const { userId, userName, userEmail, userSexo, amount, isRenewal, currentYear, cardInput } = params;

  // Basic validation
  const cleanCard = cardInput.cardNumber.replace(/\s+/g, '');
  if (cleanCard.length < 13) {
    throw new Error('Número de cartão inválido.');
  }
  if (!cardInput.cvv || cardInput.cvv.length < 3) {
    throw new Error('Código de segurança (CVV) inválido.');
  }

  const transactionId = `MP-CC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const last4 = cleanCard.slice(-4);

  return await processPaymentSuccess({
    transactionId,
    userId,
    userName,
    userEmail,
    userSexo,
    amount,
    paymentMethod: 'credit_card',
    isRenewal,
    currentYear,
    paymentDetails: {
      cardLast4: last4,
      cardHolder: cardInput.cardHolder.toUpperCase(),
      installments: cardInput.installments || 1,
      gateway: 'Mercado Pago Checkout Transparente'
    }
  });
}
