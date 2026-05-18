import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { CreditCard, Phone, Wallet, CheckCircle, XCircle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

interface Transaction {
  date: string;
  type: 'fund' | 'charge' | 'refund';
  amount: number;
  balance: number;
  description: string;
  channel: string;
  phoneNumber?: string;
  duration?: number;
  reference?: string;
  status: string;
}

interface CreditPackage {
  amount: number;
  credits: number;
  label: string;
  description: string;
}

interface Pricing {
  voiceCallPerMinute: number;
  whatsappPerMessage: number;
  phoneNumberPurchase: number;
}

interface CreditData {
  availableCredits: number;
  totalFunded: number;
  totalUsed: number;
  transactions: Transaction[];
  pricing: Pricing;
  packages: CreditPackage[];
}

type PaymentStep = 'select' | 'processing' | 'success' | 'failed';

export const CreditsPage: React.FC = () => {
  const { request } = useApi();
  const [credits, setCredits] = useState<CreditData | null>(null);
  const [selectedAmount, setSelectedAmount] = useState(500);
  const [customAmount, setCustomAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mpesa');
  const [paymentPhone, setPaymentPhone] = useState('');

  // Payment flow state
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('select');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [pollTimer, setPollTimer] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCredits = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/credits' });
      setCredits(data);
    } catch (error) {
      console.error('Failed to load credits');
    }
  }, [request]);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const getFinalAmount = () => {
    if (customAmount && parseFloat(customAmount) > 0) return parseFloat(customAmount);
    return selectedAmount;
  };

  const getCreditsForAmount = (amount: number) => {
    const pricing = credits?.pricing;
    if (!pricing) return { minutes: 0, messages: 0 };
    return {
      minutes: Math.floor(amount / pricing.voiceCallPerMinute),
      messages: Math.floor(amount / pricing.whatsappPerMessage),
    };
  };

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  };

  const handlePay = async () => {
    const amount = getFinalAmount();
    if (amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if ((paymentMethod === 'mpesa' || paymentMethod === 'airtel') && !paymentPhone) {
      toast.error(`Enter your ${paymentMethod === 'mpesa' ? 'M-Pesa' : 'Airtel'} phone number`);
      return;
    }

    setPaymentAmount(amount);
    setPaymentStep('processing');
    setPaymentMessage('Initiating payment...');
    setPollTimer(120);

    try {
      // Step 1: Initiate payment
      const result = await request({
        method: 'POST',
        url: '/credits/initiate',
        data: { amount, paymentMethod, phoneNumber: paymentPhone || undefined },
      });

      setPaymentMessage(result.message);
      setPaymentRef(result.reference);

      // Step 2: Start polling for confirmation
      const paymentId = result.paymentId;
      let seconds = 120;

      countdownRef.current = setInterval(() => {
        seconds--;
        setPollTimer(seconds);
        if (seconds <= 0) {
          stopPolling();
          setPaymentStep('failed');
          setPaymentMessage('Payment timed out. No confirmation received.');
        }
      }, 1000);

      pollRef.current = setInterval(async () => {
        try {
          const status = await request({
            method: 'GET',
            url: `/credits/status/${paymentId}`,
          });

          if (status.status === 'completed') {
            stopPolling();
            setPaymentStep('success');
            setPaymentMessage(status.message);
            setPaymentRef(status.reference);
            // Update balance in real-time
            setCredits((prev) => prev ? {
              ...prev,
              availableCredits: status.availableCredits,
              totalFunded: status.totalFunded,
            } : prev);
            // Reload full data
            setTimeout(() => loadCredits(), 500);
          } else if (status.status === 'failed') {
            stopPolling();
            setPaymentStep('failed');
            setPaymentMessage(status.message);
          }
          // If still pending, keep polling
        } catch {
          // Ignore poll errors, keep trying
        }
      }, 2000);
    } catch (error: any) {
      stopPolling();
      setPaymentStep('failed');
      setPaymentMessage(error?.response?.data?.error || 'Payment initiation failed');
    }
  };

  const resetPayment = () => {
    stopPolling();
    setPaymentStep('select');
    setPaymentMessage('');
    setPaymentRef('');
    setPaymentAmount(0);
    setCustomAmount('');
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const channelLabel = (ch: string) => {
    const map: Record<string, string> = {
      mpesa: 'M-Pesa', airtel: 'Airtel Money', voice_call: 'Voice Call',
      whatsapp: 'WhatsApp', phone_number: 'Phone Number', card: 'Card', system: 'System',
    };
    return map[ch] || ch;
  };

  const channelColor = (ch: string) => {
    const map: Record<string, string> = {
      mpesa: 'bg-green-100 text-green-700', airtel: 'bg-red-100 text-red-700',
      voice_call: 'bg-blue-100 text-blue-700', whatsapp: 'bg-emerald-100 text-emerald-700',
      phone_number: 'bg-purple-100 text-purple-700', card: 'bg-indigo-100 text-indigo-700',
      system: 'bg-gray-100 text-gray-700',
    };
    return map[ch] || 'bg-gray-100 text-gray-700';
  };

  const equiv = getCreditsForAmount(getFinalAmount());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Voice Credits</h1>
        <p className="text-gray-600 mt-2">Manage your voice AI credits, fund your account, and view transaction history</p>
      </div>

      {/* Top Up + Balance — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Top Up form — immediately visible */}
        <div className="lg:col-span-2">
          <Card>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Top Up Account</h2>
            <p className="text-sm text-gray-500 mb-5">Select amount, enter phone number, and pay instantly</p>

            {/* Amount Selection */}
            <div className="mb-5">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                Select Amount
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {(credits?.packages || []).map((pkg) => (
                  <button
                    key={pkg.amount}
                    onClick={() => { setSelectedAmount(pkg.amount); setCustomAmount(''); }}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      selectedAmount === pkg.amount && !customAmount
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-bold text-gray-900">{pkg.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{pkg.description}</p>
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <label className="block text-xs text-gray-500 mb-1">Or enter custom amount (KES)</label>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Custom amount"
                  min="1"
                  className="w-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Credit Equivalency */}
            <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-semibold text-blue-800 mb-1">
                KES {getFinalAmount().toLocaleString()} will give you:
              </p>
              <div className="flex gap-6 text-sm text-blue-700">
                <span>{equiv.minutes} minutes of voice calls</span>
                <span>or {equiv.messages.toLocaleString()} WhatsApp messages</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="mb-5">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                Payment Method
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => setPaymentMethod('mpesa')}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    paymentMethod === 'mpesa' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xs">M</div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">M-Pesa</p>
                    <p className="text-xs text-gray-500">STK push to your phone</p>
                  </div>
                </button>
                <button
                  onClick={() => setPaymentMethod('airtel')}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    paymentMethod === 'airtel' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-xs">A</div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">Airtel Money</p>
                    <p className="text-xs text-gray-500">STK push to your phone</p>
                  </div>
                </button>
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    paymentMethod === 'card' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <CreditCard className="w-10 h-10 text-indigo-600" />
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">Credit/Debit Card</p>
                    <p className="text-xs text-gray-500">Visa, Mastercard</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Phone Number */}
            {(paymentMethod === 'mpesa' || paymentMethod === 'airtel') && (
              <div className="mb-5">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  {paymentMethod === 'mpesa' ? 'M-Pesa' : 'Airtel'} Phone Number
                </label>
                <div className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={paymentPhone}
                    onChange={(e) => setPaymentPhone(e.target.value)}
                    placeholder={paymentMethod === 'mpesa' ? '0712345678' : '0733456789'}
                    className="w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  You'll receive an STK push on this number to confirm payment
                </p>
              </div>
            )}

            {/* Pay Button */}
            <button
              onClick={handlePay}
              className="w-full px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg hover:shadow-2xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105 active:scale-95"
            >
              Pay KES {getFinalAmount().toLocaleString()} via {paymentMethod === 'mpesa' ? 'M-Pesa' : paymentMethod === 'airtel' ? 'Airtel Money' : 'Card'}
            </button>
          </Card>
        </div>

        {/* Right: Balance summary */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Available Balance</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  KES {credits?.availableCredits.toFixed(2) || '0.00'}
                </p>
              </div>
              <Wallet className="w-12 h-12 text-green-200" />
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <p className="text-gray-600 text-xs font-medium">Total Funded</p>
              <p className="text-xl font-bold text-blue-600 mt-1">
                KES {credits?.totalFunded.toFixed(2) || '0.00'}
              </p>
            </Card>
            <Card>
              <p className="text-gray-600 text-xs font-medium">Total Used</p>
              <p className="text-xl font-bold text-red-600 mt-1">
                KES {credits?.totalUsed.toFixed(2) || '0.00'}
              </p>
            </Card>
          </div>

          {/* How to Pay — shown when balance is zero */}
          {credits && credits.availableCredits === 0 && credits.totalFunded === 0 && (
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
              <h3 className="text-sm font-bold text-gray-900 mb-2">How to Top Up</h3>
              <ol className="space-y-1.5 text-xs text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
                  <span>Pick an amount on the left</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                  <span>Enter your M-Pesa phone number</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">3</span>
                  <span>Tap <strong>Pay</strong> and enter your PIN</span>
                </li>
              </ol>
              <p className="text-[10px] text-gray-500 mt-2">Or pay manually via Paybill: <strong>4141855</strong></p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Processing Modal */}
      {paymentStep !== 'select' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md text-center">
            {paymentStep === 'processing' && (
              <>
                <div className="mb-6">
                  <Loader className="w-16 h-16 text-green-500 mx-auto animate-spin" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Processing Payment</h2>
                <p className="text-gray-600 mb-4">{paymentMessage}</p>
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-2xl font-bold text-gray-900">KES {paymentAmount.toLocaleString()}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {paymentMethod === 'mpesa' ? 'M-Pesa' : paymentMethod === 'airtel' ? 'Airtel Money' : 'Card'}
                    {paymentPhone && ` • ${paymentPhone}`}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  <span>Waiting for confirmation... ({pollTimer}s)</span>
                </div>
                <p className="text-xs text-gray-400">
                  {paymentMethod === 'mpesa'
                    ? 'Check your phone for the M-Pesa prompt and enter your PIN'
                    : paymentMethod === 'airtel'
                    ? 'Check your phone for the Airtel Money prompt and enter your PIN'
                    : 'Processing your card payment...'}
                </p>
                <button
                  onClick={resetPayment}
                  className="mt-4 text-sm text-red-500 hover:text-red-700 font-medium"
                >
                  Cancel
                </button>
              </>
            )}

            {paymentStep === 'success' && (
              <>
                <div className="mb-6">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                </div>
                <h2 className="text-xl font-bold text-green-700 mb-2">Payment Successful!</h2>
                <p className="text-gray-600 mb-4">{paymentMessage}</p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Amount</span>
                    <span className="font-bold text-gray-900">KES {paymentAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Reference</span>
                    <span className="font-mono text-gray-900">{paymentRef}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Method</span>
                    <span className="text-gray-900">
                      {paymentMethod === 'mpesa' ? 'M-Pesa' : paymentMethod === 'airtel' ? 'Airtel Money' : 'Card'}
                    </span>
                  </div>
                  {paymentPhone && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Phone</span>
                      <span className="text-gray-900">{paymentPhone}</span>
                    </div>
                  )}
                  <div className="border-t border-green-200 pt-2 mt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">New Balance</span>
                      <span className="font-bold text-green-700">KES {credits?.availableCredits.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <Button onClick={resetPayment} className="w-full">
                  Done
                </Button>
              </>
            )}

            {paymentStep === 'failed' && (
              <>
                <div className="mb-6">
                  <XCircle className="w-16 h-16 text-red-500 mx-auto" />
                </div>
                <h2 className="text-xl font-bold text-red-700 mb-2">Payment Failed</h2>
                <p className="text-gray-600 mb-6">{paymentMessage}</p>
                <div className="flex gap-3">
                  <button
                    onClick={resetPayment}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <Button onClick={() => { resetPayment(); setTimeout(handlePay, 100); }} className="flex-1">
                    Retry
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Transaction History */}
      <Card>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Transaction History</h2>
        <p className="text-sm text-gray-500 mb-4">All funding, usage, and refund activity</p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left px-3 py-3 text-xs font-bold text-gray-600 uppercase">Date</th>
                <th className="text-left px-3 py-3 text-xs font-bold text-gray-600 uppercase">Time</th>
                <th className="text-left px-3 py-3 text-xs font-bold text-gray-600 uppercase">Type</th>
                <th className="text-left px-3 py-3 text-xs font-bold text-gray-600 uppercase">Channel</th>
                <th className="text-left px-3 py-3 text-xs font-bold text-gray-600 uppercase">Number</th>
                <th className="text-left px-3 py-3 text-xs font-bold text-gray-600 uppercase">Duration</th>
                <th className="text-right px-3 py-3 text-xs font-bold text-gray-600 uppercase">Amount</th>
                <th className="text-right px-3 py-3 text-xs font-bold text-gray-600 uppercase">Balance</th>
                <th className="text-left px-3 py-3 text-xs font-bold text-gray-600 uppercase">Reference</th>
                <th className="text-left px-3 py-3 text-xs font-bold text-gray-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {(!credits?.transactions || credits.transactions.length === 0) ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-400">
                    No transactions yet. Fund your account to get started.
                  </td>
                </tr>
              ) : (
                [...credits.transactions].reverse().map((tx, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">{formatDate(tx.date)}</td>
                    <td className="px-3 py-3 text-sm text-gray-500 whitespace-nowrap">{formatTime(tx.date)}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        tx.type === 'fund' ? 'bg-green-100 text-green-700'
                        : tx.type === 'charge' ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                      }`}>
                        {tx.type === 'fund' ? 'Credit' : tx.type === 'charge' ? 'Debit' : 'Refund'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${channelColor(tx.channel)}`}>
                        {channelLabel(tx.channel)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm font-mono text-gray-600">{tx.phoneNumber || '-'}</td>
                    <td className="px-3 py-3 text-sm text-gray-600">{formatDuration(tx.duration)}</td>
                    <td className={`px-3 py-3 text-sm font-semibold text-right whitespace-nowrap ${
                      tx.type === 'fund' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {tx.type === 'fund' ? '+' : '-'} KES {Math.abs(tx.amount).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-sm font-mono text-right whitespace-nowrap">
                      KES {tx.balance?.toFixed(2) || '-'}
                    </td>
                    <td className="px-3 py-3 text-xs font-mono text-gray-400">{tx.reference || '-'}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        tx.status === 'completed' ? 'bg-green-100 text-green-700'
                        : tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
