import axios from 'axios';

function getConfig() {
  const env = process.env.MPESA_ENV || 'production';
  return {
    baseUrl: env === 'sandbox'
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke',
    consumerKey: process.env.C2B_CONSUMER_KEY || '',
    consumerSecret: process.env.C2B_CONSUMER_SECRET || '',
    passkey: process.env.C2B_PASSKEY || '',
    paybill: process.env.C2B_PAYBILL || '',
    callbackUrl: process.env.C2B_CALLBACK_URL || '',
  };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get OAuth access token from Safaricom Daraja API.
 * Caches the token until 1 minute before expiry.
 */
export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const { baseUrl, consumerKey, consumerSecret } = getConfig();
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  const { data } = await axios.get(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } },
  );

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000,
  };

  return data.access_token;
}

/**
 * Generate the password and timestamp for STK Push.
 */
function generatePassword(): { password: string; timestamp: string } {
  const { paybill, passkey } = getConfig();
  const now = new Date();
  const timestamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');

  const password = Buffer.from(`${paybill}${passkey}${timestamp}`).toString('base64');
  return { password, timestamp };
}

/**
 * Normalise a Kenyan phone number to 2547XXXXXXXX format.
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s+-]/g, '');
  if (cleaned.startsWith('0')) return `254${cleaned.slice(1)}`;
  if (cleaned.startsWith('254')) return cleaned;
  return cleaned;
}

/**
 * Initiate an M-Pesa STK Push (Lipa Na M-Pesa Online).
 * Returns the Safaricom response which includes CheckoutRequestID.
 */
export async function stkPush(params: {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc?: string;
}): Promise<{
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}> {
  const { baseUrl, paybill, callbackUrl } = getConfig();
  const token = await getAccessToken();
  const { password, timestamp } = generatePassword();
  const phone = normalizePhone(params.phoneNumber);

  const payload = {
    BusinessShortCode: paybill,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.ceil(params.amount),
    PartyA: phone,
    PartyB: paybill,
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: params.accountReference,
    TransactionDesc: params.transactionDesc || 'Azizi Credits',
  };

  const { data } = await axios.post(
    `${baseUrl}/mpesa/stkpush/v1/processrequest`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  return data;
}

/**
 * Query the status of an STK Push transaction.
 */
export async function stkQuery(checkoutRequestId: string): Promise<{
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
}> {
  const { baseUrl, paybill } = getConfig();
  const token = await getAccessToken();
  const { password, timestamp } = generatePassword();

  const { data } = await axios.post(
    `${baseUrl}/mpesa/stkpushquery/v1/query`,
    {
      BusinessShortCode: paybill,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );

  return data;
}
