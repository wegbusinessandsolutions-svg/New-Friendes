import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  Users, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Search, 
  Filter, 
  Send, 
  PlusCircle, 
  Sparkles, 
  Calendar, 
  RefreshCw, 
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Settings,
  QrCode,
  Lock,
  MessageCircle,
  HelpCircle,
  ChevronDown,
  Gift
} from 'lucide-react';
import { 
  evaluateUserSubscription, 
  formatCurrencyBRL, 
  buildWhatsAppPaymentMessage,
  BASE_PRICES,
  RENEWAL_PRICES,
  SubscriptionEvaluation,
  SubscriptionStatus
} from '../../utils/subscription';
import { 
  getMercadoPagoConfig, 
  saveMercadoPagoConfig, 
  processPaymentSuccess,
  MercadoPagoConfig,
  PaymentRecord
} from '../../services/mercadoPago';
import { collection, getDocs, doc, setDoc, updateDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { openWhatsApp } from '../../utils/whatsapp';
import { motion, AnimatePresence } from 'motion/react';

interface AdminSubscriptionsTabProps {
  users: any[];
  onRefreshUsers: () => void;
}

export default function AdminSubscriptionsTab({ users, onRefreshUsers }: AdminSubscriptionsTabProps) {
  const [subTab, setSubTab] = useState<'users' | 'transactions' | 'settings'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'trial' | 'trial_expired' | 'active' | 'renewal_due' | 'lifetime_exempt'>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');
  
  // Payments / Transactions
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Mercado Pago config
  const [mpConfig, setMpConfig] = useState<MercadoPagoConfig>({
    publicKey: '',
    accessToken: '',
    pixKey: 'sac@wegbusiness.com',
    sandboxMode: true,
    collectorEmail: 'wegbusinessandsolutions@gmail.com'
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  // Manual payment / extension modal
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'activate' | 'extend' | 'exempt' | 'history' | null>(null);
  const [extensionDays, setExtensionDays] = useState(15);
  const [manualNote, setManualNote] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  // Load Mercado Pago config and Payments transactions
  useEffect(() => {
    loadConfig();
    subscribePayments();
  }, []);

  const loadConfig = async () => {
    const config = await getMercadoPagoConfig();
    setMpConfig(config);
  };

  const subscribePayments = () => {
    setLoadingPayments(true);
    const q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PaymentRecord[];
      setPayments(list);
      setLoadingPayments(false);
    }, (err) => {
      console.error("Erro ao carregar pagamentos:", err);
      setLoadingPayments(false);
    });

    return unsubscribe;
  };

  // Evaluate all users subscriptions for CRM aggregation
  const evaluatedUsers = users.map(user => {
    const evaluation = evaluateUserSubscription(user, user.email);
    const name = user.profile?.nome || user.nome || 'Sem nome';
    const phone = user.profile?.telefone || user.telefone || '';
    const email = user.email || user.profile?.email || '';
    const gender = evaluation.genderCategory;
    const photo = user.profile?.fotoPrincipalUrl || user.fotoPrincipalUrl;
    const userCode = user.codigoUsuario || user.idNumerico || user.id?.substring(0, 8);

    return {
      user,
      evaluation,
      name,
      phone,
      email,
      gender,
      photo,
      userCode
    };
  });

  // Calculate Key Metrics
  const totalRevenue = payments
    .filter(p => p.status === 'approved')
    .reduce((acc, p) => acc + (p.amount || 0), 0);

  const trialCount = evaluatedUsers.filter(u => u.evaluation.status === 'trial').length;
  const trialExpiredCount = evaluatedUsers.filter(u => u.evaluation.status === 'trial_expired').length;
  const activePaidCount = evaluatedUsers.filter(u => u.evaluation.status === 'active').length;
  const renewalDueCount = evaluatedUsers.filter(u => u.evaluation.status === 'renewal_due').length;
  const femaleActiveCount = evaluatedUsers.filter(u => u.evaluation.status === 'active' && u.gender === 'female').length;
  const maleActiveCount = evaluatedUsers.filter(u => u.evaluation.status === 'active' && u.gender === 'male').length;

  // Filter users
  const filteredUsers = evaluatedUsers.filter(item => {
    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = item.name.toLowerCase().includes(term);
      const matchEmail = item.email.toLowerCase().includes(term);
      const matchCode = item.userCode.toLowerCase().includes(term);
      const matchPhone = item.phone.includes(term);
      if (!matchName && !matchEmail && !matchCode && !matchPhone) return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (item.evaluation.status !== statusFilter) return false;
    }

    // Gender filter
    if (genderFilter !== 'all') {
      if (item.gender !== genderFilter) return false;
    }

    return true;
  });

  // Handle WhatsApp Reminder
  const handleSendWhatsAppNotification = (item: typeof evaluatedUsers[0]) => {
    if (!item.phone) {
      alert(`O usuário ${item.name} não possui número de telefone cadastrado no perfil.`);
      return;
    }

    const msg = buildWhatsAppPaymentMessage(
      item.name,
      item.gender,
      item.evaluation.status,
      item.evaluation.amountToPay,
      item.evaluation.trialDaysRemaining
    );

    openWhatsApp(item.phone, msg);
  };

  // Execute manual CRM actions
  const handleExecuteAction = async () => {
    if (!selectedUser) return;
    setProcessingAction(true);

    try {
      const userId = selectedUser.user.id;
      const userRef = doc(db, 'users', userId);

      if (actionType === 'activate') {
        const amount = selectedUser.evaluation.amountToPay;
        const txId = `CRM-MANUAL-${Date.now()}`;
        await processPaymentSuccess({
          transactionId: txId,
          userId,
          userName: selectedUser.name,
          userEmail: selectedUser.email,
          userSexo: selectedUser.gender,
          amount,
          paymentMethod: 'manual_crm',
          isRenewal: selectedUser.evaluation.isRenewal,
          currentYear: selectedUser.evaluation.isRenewal ? 2 : 1,
          paymentDetails: {
            adminNote: manualNote || 'Liberação manual efetuada pelo Administrador via CRM',
            adminEmail: 'Admin WEG',
            executedAt: new Date().toISOString()
          }
        });
        alert(`Anuidade liberada com sucesso para ${selectedUser.name}!`);
      } else if (actionType === 'extend') {
        const currentExt = selectedUser.user.subscription?.trialExtensionDays || 0;
        const newExt = currentExt + extensionDays;
        await setDoc(userRef, {
          subscription: {
            trialExtensionDays: newExt,
            updatedAt: Date.now(),
            notes: manualNote || `Período de teste estendido em +${extensionDays} dias pelo Admin.`
          }
        }, { merge: true });
        alert(`Período de teste estendido em +${extensionDays} dias para ${selectedUser.name}!`);
      } else if (actionType === 'exempt') {
        await setDoc(userRef, {
          subscription: {
            exempt: true,
            status: 'lifetime_exempt',
            updatedAt: Date.now(),
            notes: manualNote || 'Isenção concedida pelo Administrador.'
          }
        }, { merge: true });
        alert(`Isenção vitalícia concedida com sucesso para ${selectedUser.name}!`);
      }

      onRefreshUsers();
      setSelectedUser(null);
      setActionType(null);
      setManualNote('');
    } catch (err) {
      console.error("Erro ao executar ação de CRM:", err);
      alert('Erro ao processar ação no banco de dados.');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await saveMercadoPagoConfig(mpConfig);
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 3000);
    } catch (err) {
      console.error("Erro ao salvar configuração do Mercado Pago:", err);
      alert("Erro ao salvar credenciais do Mercado Pago.");
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Financial Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Total Revenue */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Faturamento</span>
          </div>
          <div className="text-xl font-black text-slate-800">{formatCurrencyBRL(totalRevenue)}</div>
          <div className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span>{payments.filter(p => p.status === 'approved').length} pagamentos aprovados</span>
          </div>
        </div>

        {/* Active Paid Users */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assinantes Pagos</span>
          </div>
          <div className="text-xl font-black text-indigo-600">{activePaidCount}</div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">
            <span className="text-pink-600 font-bold">{femaleActiveCount} fem</span> • <span className="text-blue-600 font-bold">{maleActiveCount} masc</span>
          </div>
        </div>

        {/* In Free Trial (30 days) */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Em Teste (30 dias)</span>
          </div>
          <div className="text-xl font-black text-blue-600">{trialCount}</div>
          <div className="text-[10px] text-blue-600 font-bold mt-1">
            100% gratuito em andamento
          </div>
        </div>

        {/* Trial Expired (Pending payment) */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Teste Expirado</span>
          </div>
          <div className="text-xl font-black text-amber-600">{trialExpiredCount}</div>
          <div className="text-[10px] text-amber-600 font-bold mt-1">
            Aguardando anuidade
          </div>
        </div>

        {/* Renewals Due (+50%) */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <RefreshCw className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Renovação (+50%)</span>
          </div>
          <div className="text-xl font-black text-purple-600">{renewalDueCount}</div>
          <div className="text-[10px] text-purple-600 font-bold mt-1">
            1 ano de uso concluído
          </div>
        </div>
      </div>

      {/* Internal Subtabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
        <button
          onClick={() => setSubTab('users')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            subTab === 'users' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Gestão de Assinantes & Usuários ({filteredUsers.length})</span>
        </button>

        <button
          onClick={() => setSubTab('transactions')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            subTab === 'transactions' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Transações Mercado Pago ({payments.length})</span>
        </button>

        <button
          onClick={() => setSubTab('settings')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            subTab === 'settings' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Configurações & Chaves Mercado Pago</span>
        </button>
      </div>

      {/* SUBTAB 1: USERS CRM */}
      {subTab === 'users' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome, email, código ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
              >
                <option value="all">Todos os Status</option>
                <option value="trial">Em Teste Gratuito (30 dias)</option>
                <option value="trial_expired">Teste Expirado (Pendente)</option>
                <option value="active">Assinatura Ativa (Ano 1)</option>
                <option value="renewal_due">Renovação Devida (+50%)</option>
                <option value="lifetime_exempt">Isentos / VIPs</option>
              </select>

              {/* Gender filter */}
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
              >
                <option value="all">Todos os Gêneros</option>
                <option value="female">Feminino (R$ 36,50)</option>
                <option value="male">Masculino (R$ 73,00)</option>
              </select>

              <button
                onClick={onRefreshUsers}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Recarregar usuários"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Pricing Summary Note */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 flex items-center justify-between text-xs text-indigo-900">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                <strong>Regra de Cobrança:</strong> 30 dias 100% gratuitos para todo novo usuário. Após 30 dias: 
                <strong className="text-pink-600 ml-1">Feminino R$ 36,50/ano</strong> | 
                <strong className="text-blue-600 ml-1">Masculino R$ 73,00/ano</strong>. 
                Renovação após 1 ano: <strong>+50% (R$ 54,75 fem / R$ 109,50 masc)</strong>.
              </span>
            </div>
          </div>

          {/* Users List Table / Cards */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Nenhum usuário encontrado com os filtros aplicados.
                </div>
              ) : (
                filteredUsers.map((item) => {
                  const { user, evaluation, name, phone, email, gender, photo, userCode } = item;
                  const status = evaluation.status;

                  return (
                    <div 
                      key={user.id} 
                      className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                    >
                      {/* Left: User Details */}
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                          alt={name}
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-slate-800 truncate">{name}</h4>
                            <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                              #{userCode}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              gender === 'female' 
                                ? 'bg-pink-100 text-pink-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {gender === 'female' ? 'Fem • R$ 36,50' : 'Masc • R$ 73,00'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span className="truncate">{email || 'Sem e-mail'}</span>
                            {phone && (
                              <span className="font-mono text-slate-600 flex items-center gap-1">
                                📞 {phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Middle: Subscription Status Badge & Trial Progress */}
                      <div className="flex flex-col items-start md:items-center min-w-[180px]">
                        {status === 'trial' && (
                          <div className="w-full">
                            <div className="flex items-center justify-between text-[11px] font-bold text-blue-600 mb-1">
                              <span className="flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-blue-500" />
                                30 dias grátis
                              </span>
                              <span>{evaluation.trialDaysRemaining}d restantes</span>
                            </div>
                            <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-blue-600 h-full rounded-full" 
                                style={{ 
                                  width: `${Math.min(100, Math.max(5, (evaluation.trialDaysRemaining / evaluation.trialDaysTotal) * 100))}%` 
                                }} 
                              />
                            </div>
                          </div>
                        )}

                        {status === 'trial_expired' && (
                          <span className="bg-amber-100 text-amber-800 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Teste Expirado (Deve {evaluation.amountFormatted})
                          </span>
                        )}

                        {status === 'active' && (
                          <div className="text-center">
                            <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              Assinatura Anual Ativa
                            </span>
                            {evaluation.expiresAtDate && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                Válida até {evaluation.expiresAtDate.toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        )}

                        {status === 'renewal_due' && (
                          <span className="bg-purple-100 text-purple-800 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 text-purple-600" />
                            Renovação +50% ({evaluation.amountFormatted})
                          </span>
                        )}

                        {status === 'lifetime_exempt' && (
                          <span className="bg-slate-100 text-slate-700 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                            Isento / Admin
                          </span>
                        )}
                      </div>

                      {/* Right: CRM Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* WhatsApp reminder button */}
                        <button
                          onClick={() => handleSendWhatsAppNotification(item)}
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Enviar lembrete / cobrança no WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4 text-emerald-600" />
                          <span className="hidden lg:inline">Avisar WhatsApp</span>
                        </button>

                        {/* Fast Activate / Renew */}
                        {status !== 'active' && status !== 'lifetime_exempt' && (
                          <button
                            onClick={() => {
                              setSelectedUser(item);
                              setActionType('activate');
                            }}
                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                            title="Liberar 1 ano de assinatura manualmente"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Liberar 1 Ano</span>
                          </button>
                        )}

                        {/* Extend trial */}
                        <button
                          onClick={() => {
                            setSelectedUser(item);
                            setActionType('extend');
                          }}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          title="Estender dias de teste"
                        >
                          <Gift className="w-4 h-4 text-indigo-600" />
                        </button>

                        {/* Exempt */}
                        {status !== 'lifetime_exempt' && (
                          <button
                            onClick={() => {
                              setSelectedUser(item);
                              setActionType('exempt');
                            }}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            title="Conceder isenção vitalícia"
                          >
                            <ShieldCheck className="w-4 h-4 text-slate-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: TRANSACTIONS MERCADO PAGO */}
      {subTab === 'transactions' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800">Histórico de Transações Mercado Pago</h3>
              <p className="text-xs text-slate-500">Todos os pagamentos processados via PIX, Cartão ou Liberação Manual.</p>
            </div>
            <div className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
              {payments.length} transações registradas
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3">ID Mercado Pago</th>
                    <th className="p-3">Usuário</th>
                    <th className="p-3">Gênero</th>
                    <th className="p-3">Método</th>
                    <th className="p-3">Valor</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Ano / Validade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        Nenhuma transação registrada no Mercado Pago ainda.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => {
                      const validDate = p.validUntil ? new Date(p.validUntil).toLocaleDateString('pt-BR') : '1 ano';
                      return (
                        <tr key={p.id || p.transactionId} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-indigo-600">
                            {p.transactionId}
                          </td>
                          <td className="p-3 font-bold text-slate-800">
                            <div>{p.userName || 'Usuário'}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{p.userEmail}</div>
                          </td>
                          <td className="p-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              p.userSexo?.toLowerCase().includes('fem') 
                                ? 'bg-pink-100 text-pink-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {p.userSexo || 'Padrão'}
                            </span>
                          </td>
                          <td className="p-3 font-mono">
                            {p.paymentMethod === 'pix' && '💠 PIX Mercado Pago'}
                            {p.paymentMethod === 'credit_card' && '💳 Cartão de Crédito'}
                            {p.paymentMethod === 'manual_crm' && '⚡ Liberação CRM'}
                            {!['pix', 'credit_card', 'manual_crm'].includes(p.paymentMethod) && p.paymentMethod}
                          </td>
                          <td className="p-3 font-black text-slate-800">
                            {formatCurrencyBRL(p.amount || 0)}
                          </td>
                          <td className="p-3">
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                              {p.status === 'approved' ? 'Aprovado' : p.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 font-mono text-[11px]">
                            {p.year ? `Ano ${p.year}` : 'Ano 1'} • Até {validDate}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: SETTINGS MERCADO PAGO */}
      {subTab === 'settings' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-2xl">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">Credenciais & Configurações do Mercado Pago</h3>
              <p className="text-xs text-slate-500">
                Configure as chaves da sua conta Mercado Pago para receber pagamentos de PIX e Cartão com segurança.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Chave Pública (Public Key)
              </label>
              <input
                type="text"
                placeholder="APP_USR-..."
                value={mpConfig.publicKey}
                onChange={(e) => setMpConfig({ ...mpConfig, publicKey: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Disponível no painel do Mercado Pago &gt; Suas Integrações &gt; Credenciais
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Token de Acesso (Access Token)
              </label>
              <input
                type="password"
                placeholder="APP_USR-..."
                value={mpConfig.accessToken}
                onChange={(e) => setMpConfig({ ...mpConfig, accessToken: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Chave PIX da Empresa (W.E.G. Business)
              </label>
              <input
                type="text"
                placeholder="sac@wegbusiness.com ou CNPJ"
                value={mpConfig.pixKey}
                onChange={(e) => setMpConfig({ ...mpConfig, pixKey: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="sandboxMode"
                checked={mpConfig.sandboxMode}
                onChange={(e) => setMpConfig({ ...mpConfig, sandboxMode: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="sandboxMode" className="text-xs font-bold text-slate-700 cursor-pointer">
                Modo Sandbox / Homologação (Permite testar e simular pagamentos aprovados instantaneamente)
              </label>
            </div>

            {configSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Configurações do Mercado Pago salvas com sucesso no banco de dados!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={savingConfig}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {savingConfig ? 'Salvando...' : 'Salvar Configurações do Mercado Pago'}
            </button>
          </form>
        </div>
      )}

      {/* Action Modal (Activate / Extend / Exempt) */}
      <AnimatePresence>
        {selectedUser && actionType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200"
            >
              <h3 className="text-base font-black text-slate-800 mb-1">
                {actionType === 'activate' && '⚡ Liberar Anuidade Manualmente'}
                {actionType === 'extend' && '🎁 Estender Período de Teste'}
                {actionType === 'exempt' && '👑 Conceder Isenção Vitalícia'}
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Usuário: <strong className="text-slate-800">{selectedUser.name}</strong> ({selectedUser.gender === 'female' ? 'Feminino - R$ 36,50' : 'Masculino - R$ 73,00'})
              </p>

              {actionType === 'activate' && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-900 mb-4">
                  Esta ação concederá <strong>1 ano inteiro (365 dias)</strong> de assinatura ativa ao usuário, liberando todos os recursos do aplicativo e registrando a transação no CRM.
                </div>
              )}

              {actionType === 'extend' && (
                <div className="mb-4">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Quantidade de dias adicionais de cortesia:
                  </label>
                  <select
                    value={extensionDays}
                    onChange={(e) => setExtensionDays(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value={7}>+7 dias extras</option>
                    <option value={15}>+15 dias extras</option>
                    <option value={30}>+30 dias extras (1 mês completo)</option>
                  </select>
                </div>
              )}

              <div className="mb-4">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Observação interna (opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ex: Pagou via PIX direto, cortesia comercial, etc."
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleExecuteAction}
                  disabled={processingAction}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {processingAction ? 'Processando...' : 'Confirmar e Salvar'}
                </button>
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setActionType(null);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
