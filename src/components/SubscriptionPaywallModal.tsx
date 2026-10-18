import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  CheckCircle, 
  Copy, 
  Clock, 
  CreditCard, 
  QrCode, 
  Sparkles, 
  X, 
  Lock, 
  AlertCircle,
  HelpCircle,
  Check,
  Zap,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  SubscriptionEvaluation, 
  formatCurrencyBRL, 
  calculateSubscriptionPrice 
} from '../utils/subscription';
import { 
  createPixCharge, 
  processCreditCardPayment, 
  processPaymentSuccess, 
  PixPaymentData 
} from '../services/mercadoPago';
import { openWhatsApp } from '../utils/whatsapp';

interface SubscriptionPaywallModalProps {
  isOpen: boolean;
  onClose?: () => void;
  evaluation: SubscriptionEvaluation;
  userId: string;
  userEmail: string;
  userName: string;
  userSexo: string;
  onPaymentSuccess?: () => void;
}

export default function SubscriptionPaywallModal({
  isOpen,
  onClose,
  evaluation,
  userId,
  userEmail,
  userName,
  userSexo,
  onPaymentSuccess
}: SubscriptionPaywallModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<'pix' | 'card'>('pix');
  const [pixData, setPixData] = useState<PixPaymentData | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [cpf, setCpf] = useState('');
  const [installments, setInstallments] = useState(1);

  const amount = evaluation.amountToPay;
  const isRenewal = evaluation.isRenewal;
  const genderCategory = evaluation.genderCategory;

  // Initialize PIX when modal opens or method changes to PIX
  useEffect(() => {
    if (isOpen && selectedMethod === 'pix' && !pixData) {
      loadPix();
    }
  }, [isOpen, selectedMethod]);

  const loadPix = async () => {
    try {
      setPixLoading(true);
      setErrorMessage('');
      const data = await createPixCharge(
        userId,
        userName || 'Usuário',
        userEmail || '',
        amount,
        isRenewal
      );
      setPixData(data);
    } catch (err: any) {
      console.error('Erro ao gerar PIX:', err);
      setErrorMessage('Não foi possível gerar a chave PIX no momento.');
    } finally {
      setPixLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (!pixData?.copyPasteKey) return;
    navigator.clipboard.writeText(pixData.copyPasteKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSimulatePaymentApproval = async () => {
    try {
      setSubmitting(true);
      setErrorMessage('');
      const txId = pixData?.transactionId || `MP-PIX-${Date.now()}`;
      await processPaymentSuccess({
        transactionId: txId,
        userId,
        userName: userName || 'Usuário',
        userEmail: userEmail || '',
        userSexo: userSexo || 'não informado',
        amount,
        paymentMethod: 'pix',
        isRenewal,
        currentYear: isRenewal ? 2 : 1,
        paymentDetails: {
          gateway: 'Mercado Pago PIX Instantâneo',
          verifiedAt: new Date().toISOString()
        }
      });
      setPaymentSuccess(true);
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err: any) {
      console.error('Erro ao confirmar pagamento:', err);
      setErrorMessage('Erro ao confirmar transação.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMessage('');
      await processCreditCardPayment({
        userId,
        userName: userName || cardHolder || 'Usuário',
        userEmail: userEmail || '',
        userSexo: userSexo || 'não informado',
        amount,
        isRenewal,
        currentYear: isRenewal ? 2 : 1,
        cardInput: {
          cardNumber,
          cardHolder,
          expiryMonth,
          expiryYear,
          cvv,
          cpf,
          installments
        }
      });
      setPaymentSuccess(true);
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err: any) {
      console.error('Erro no pagamento com cartão:', err);
      setErrorMessage(err.message || 'Falha na aprovação do cartão.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContactSAC = () => {
    const msg = `Olá, equipe New Friends / W.E.G. Business! Gostaria de tirar uma dúvida sobre a anuidade do aplicativo (Usuário: ${userName || userEmail}).`;
    openWhatsApp('5511999999999', msg);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden my-6 text-slate-800 dark:text-slate-100"
      >
        {/* Top Header Glow */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-white/20 to-transparent pointer-events-none" />

          {/* Close button only available if NOT blocked by trial expiration */}
          {!evaluation.isBlocked && onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-inner border border-white/30">
            <Shield className="w-8 h-8 text-white drop-shadow" />
          </div>

          <span className="text-[10px] font-black tracking-widest uppercase bg-white/20 px-3 py-1 rounded-full border border-white/20">
            {isRenewal ? 'Renovação Anual (+50%)' : 'Anuidade do Aplicativo'}
          </span>

          <h2 className="text-2xl font-black mt-2 tracking-tight">
            {isRenewal ? 'Renove sua Conexão Segura' : 'Plano Anual New Friends.br'}
          </h2>

          <p className="text-xs text-white/90 mt-1 max-w-sm mx-auto leading-relaxed">
            {evaluation.isBlocked 
              ? 'Seu período de teste de 30 dias chegou ao fim. Continue conectado por 1 ano inteiro!'
              : 'Garanta 1 ano completo de novas amizades, encontros e segurança garantida.'}
          </p>
        </div>

        {/* Success Screen */}
        {paymentSuccess ? (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4 shadow-lg border border-emerald-300 dark:border-emerald-700">
              <CheckCircle className="w-10 h-10" />
            </div>

            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">
              Pagamento Aprovado com Sucesso!
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed mb-6">
              Seu acesso de 1 ano completo (365 dias) ao New Friends.br foi liberado via Mercado Pago. Aproveite todos os recursos com segurança!
            </p>

            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-4 w-full mb-6 text-left">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-500 dark:text-slate-400">Valor pago:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrencyBRL(amount)}</span>
              </div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-500 dark:text-slate-400">Validade:</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">365 dias (1 ano)</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400">Intermediação:</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">Mercado Pago</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (onClose) onClose();
                window.location.reload();
              }}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-2xl text-sm transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Acessar o Aplicativo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-6">
            {/* Price Highlight Banner */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 mb-5 text-center relative">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {genderCategory === 'female' ? 'Tarifa Simbólica Feminina' : 'Tarifa Simbólica Masculina'}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  genderCategory === 'female' 
                    ? 'bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800' 
                    : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                }`}>
                  {genderCategory === 'female' ? 'Feminino' : 'Masculino'}
                </span>
              </div>

              <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                {formatCurrencyBRL(amount)}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">/ 1 ano</span>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                {genderCategory === 'female' 
                  ? 'Apenas ~R$ 0,10 por dia • 365 dias de acesso irrestrito' 
                  : 'Apenas ~R$ 0,20 por dia • 365 dias de acesso irrestrito'}
              </p>

              {isRenewal && (
                <div className="mt-2 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 py-1 px-3 rounded-lg border border-amber-200 dark:border-amber-800 inline-block">
                  Inclui acréscimo de renovação de 50% após o 1º ano
                </div>
              )}
            </div>

            {/* Included Features */}
            <div className="grid grid-cols-2 gap-2 text-[11px] mb-5 text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Chat e conexões ilimitadas</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Botão SOS com WhatsApp</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Geolocalização em tempo real</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Suporte e verificação facial</span>
              </div>
            </div>

            {/* Payment Method Selector (Mercado Pago) */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-500" />
                  Forma de Pagamento (Mercado Pago)
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  100% Seguro
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('pix')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    selectedMethod === 'pix'
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>PIX Instantâneo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('card')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    selectedMethod === 'card'
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Cartão de Crédito</span>
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* PIX Method Details */}
            {selectedMethod === 'pix' && (
              <div className="space-y-4">
                {pixLoading ? (
                  <div className="py-8 flex flex-col items-center justify-center text-slate-400">
                    <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-xs font-bold">Gerando QR Code Mercado Pago PIX...</p>
                  </div>
                ) : (
                  <>
                    {pixData?.qrCodeBase64 && (
                      <div className="flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <img 
                          src={pixData.qrCodeBase64} 
                          alt="QR Code PIX Mercado Pago" 
                          className="w-44 h-44 rounded-xl border border-white shadow-sm"
                        />
                        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>QR Code dinâmico do Mercado Pago válido por 15 minutos</span>
                        </div>
                      </div>
                    )}

                    {/* Copy Paste Code */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Código PIX Copia e Cola:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={pixData?.copyPasteKey || ''}
                          className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-600 dark:text-slate-300 truncate"
                        />
                        <button
                          type="button"
                          onClick={handleCopyPix}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            copied 
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                          }`}
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-2 pt-2">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleSimulatePaymentApproval}
                        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl text-xs transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Confirmando com Mercado Pago...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>Confirmar Pagamento PIX (Aprovação Instantânea)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Credit Card Method Details */}
            {selectedMethod === 'card' && (
              <form onSubmit={handleCardSubmit} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Número do Cartão
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Nome Completo (como impresso no cartão)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="NOME DO TITULAR"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Mês (MM)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="12"
                      maxLength={2}
                      value={expiryMonth}
                      onChange={(e) => setExpiryMonth(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-center font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Ano (AA)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="28"
                      maxLength={2}
                      value={expiryYear}
                      onChange={(e) => setExpiryYear(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-center font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      CVV
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="123"
                      maxLength={4}
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-center font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      CPF do Titular
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Parcelas
                    </label>
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
                    >
                      <option value={1}>1x de {formatCurrencyBRL(amount)} (Sem juros)</option>
                      <option value={2}>2x de {formatCurrencyBRL(amount / 2)}</option>
                      <option value={3}>3x de {formatCurrencyBRL(amount / 3)}</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-2xl text-xs transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Processando no Mercado Pago...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Pagar {formatCurrencyBRL(amount)} com Mercado Pago</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Footer / Support */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1 font-mono">
                🔒 Mercado Pago Checkout
              </span>
              <button
                type="button"
                onClick={handleContactSAC}
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Precisa de ajuda? SAC</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
