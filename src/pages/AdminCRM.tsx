import React, { useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { 
  Shield, 
  User, 
  Trash2, 
  Edit2, 
  Search, 
  Activity, 
  Users, 
  CheckCircle, 
  Settings, 
  AlertCircle, 
  Save,
  Ban, 
  BarChart3, 
  Crown, 
  ShieldCheck, 
  MapPin, 
  X, 
  Lock, 
  Unlock, 
  Calendar, 
  MessageSquare, 
  TrendingUp, 
  BadgeHelp,
  Camera,
  Compass,
  Clock,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { getUserRegistrationId } from '../utils/userId';
import ZodiacBadge from '../components/ZodiacBadge';

interface CrmUser {
  id: string;
  email: string;
  role?: string;
  codigoUsuario?: string;
  idNumerico?: string;
  createdAt?: any;
  criadoEm?: number;
  profile?: {
    nome: string;
    apelido?: string;
    cidadeNascimento?: string;
    estadoNascimento?: string;
    idade?: string | number;
    sexo?: string;
    dataNascimento?: string;
    fotoPrincipalUrl?: string;
    verified?: boolean;
    email?: string;
    codigoUsuario?: string;
    idNumerico?: string;
  };
  status?: {
    ativo?: boolean;
    banido?: boolean;
    verificadoIdade?: boolean;
  };
  // Flat properties fallback for backwards compatibility
  nome?: string;
  apelido?: string;
  cidadeNascimento?: string;
  estadoNascimento?: string;
  idade?: string | number;
  sexo?: string;
  verified?: boolean;
}

export default function AdminCRM() {
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSexo, setFilterSexo] = useState('');
  const [filterDataNasc, setFilterDataNasc] = useState('');
  const [filterCidade, setFilterCidade] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'reports'>('users');
  const [appConfig, setAppConfig] = useState({
    maintenanceMode: false,
    registrationEnabled: true,
    globalBannerText: '',
    autoVerifyNewUsers: false,
    requireEmailVerification: false,
    appCustomTitle: 'New Friends.br'
  });

  // Reports state
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [activeNotification, setActiveNotification] = useState<{
    id: string;
    reporterName: string;
    reportedName: string;
    motivo: string;
    descricao?: string;
  } | null>(null);



  // Edit user profile modal state
  const [editingUser, setEditingUser] = useState<CrmUser | null>(null);
  const [editForm, setEditForm] = useState({
    nome: '',
    apelido: '',
    cidadeNascimento: '',
    estadoNascimento: '',
    email: '',
    role: 'Usuário'
  });

  // Usage Report modal state
  const [reportUser, setReportUser] = useState<CrmUser | null>(null);
  const [reportData, setReportData] = useState<{
    connectionsCount: number;
    requestsSentCount: number;
    requestsReceivedCount: number;
    shortMessagesSentCount: number;
    loading: boolean;
  } | null>(null);

  // Geolocation monitoring and timeline states
  const [reportUserLocation, setReportUserLocation] = useState<any | null>(null);
  const [reportUserLocationHistory, setReportUserLocationHistory] = useState<any[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
    fetchConfig();
    fetchReports();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    const email = auth.currentUser.email;
    if (email !== 'ceo@newfriends.com' && email !== 'sac@wegbusiness.com' && email !== 'ceo@wegbusiness.com' && email !== 'wegbusinessandsolutions@gmail.com') {
      return;
    }

    let isFirstLoad = true;
    let unsubscribe: () => void;

    const setupListener = async () => {
      const { collection, onSnapshot, query, orderBy } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');

      const q = query(collection(db, 'reports'), orderBy('criadoEm', 'desc'));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const reportsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        reportsList.sort((a: any, b: any) => (b.criadoEm || 0) - (a.criadoEm || 0));
        setReports(reportsList);
        
        if (!isFirstLoad) {
          const docChanges = snapshot.docChanges();
          const addedPending = docChanges.find(change => change.type === 'added' && change.doc.data().status === 'pendente');
          if (addedPending) {
            const data = addedPending.doc.data();
            const deUser = users.find(u => u.id === data.deUserId);
            const contraUser = users.find(u => u.id === data.contraUserId);
            const deName = deUser?.profile?.nome || deUser?.nome || 'Um usuário';
            const contraName = contraUser?.profile?.nome || contraUser?.nome || 'outro perfil';
            
            setActiveNotification({
              id: addedPending.doc.id,
              reporterName: deName,
              reportedName: contraName,
              motivo: data.motivo,
              descricao: data.descricao
            });
            
            try {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav');
              audio.volume = 0.4;
              audio.play().catch(() => {});
            } catch (e) {}
          }
        }
        isFirstLoad = false;
      }, (error) => {
        console.error("Error subscribing to reports in real-time:", error);
      });
    };

    setupListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [users]);

  const fetchConfig = async () => {
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const configDoc = await getDoc(doc(db, 'settings', 'app_config'));
      if (configDoc.exists()) {
        setAppConfig(prev => ({ ...prev, ...configDoc.data() }));
      }
    } catch (err) {
      console.error("Error fetching config:", err);
    }
  };

  const fetchUsers = async () => {
    if (!auth.currentUser) return;
    try {
      if (auth.currentUser.email !== 'ceo@newfriends.com' && auth.currentUser.email !== 'sac@wegbusiness.com' && auth.currentUser.email !== 'ceo@wegbusiness.com' && auth.currentUser.email !== 'wegbusinessandsolutions@gmail.com') {
         navigate('/');
         return;
      }
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const usersSnap = await getDocs(collection(db, 'users'));
      const data = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CrmUser[];
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    if (!auth.currentUser) return;
    const email = auth.currentUser.email;
    if (email !== 'ceo@newfriends.com' && email !== 'sac@wegbusiness.com' && email !== 'ceo@wegbusiness.com' && email !== 'wegbusinessandsolutions@gmail.com') {
      return;
    }
    setReportsLoading(true);
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const reportsSnap = await getDocs(collection(db, 'reports'));
      const reportsList = reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      reportsList.sort((a: any, b: any) => (b.criadoEm || 0) - (a.criadoEm || 0));
      setReports(reportsList);
    } catch (err) {
      console.error("Error fetching reports:", err);
    } finally {
      setReportsLoading(false);
    }
  };



  const handleResolveReport = async (reportId: string) => {
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      await updateDoc(doc(db, 'reports', reportId), { status: 'resolvido' });
      setReports(reports.map(r => r.id === reportId ? { ...r, status: 'resolvido' } : r));
      alert('Denúncia marcada como resolvida.');
    } catch (err) {
      console.error("Error resolving report:", err);
      alert('Erro ao resolver denúncia.');
    }
  };

  const handleBanReportedUser = async (userId: string, reportId: string) => {
    if (!window.confirm('Deseja realmente BANIR este usuário denunciado? Ele perderá acesso ao aplicativo imediatamente.')) return;
    try {
      const { doc, setDoc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      await setDoc(doc(db, 'users', userId), {
        status: {
          banido: true
        }
      }, { merge: true });
      
      await updateDoc(doc(db, 'reports', reportId), { status: 'resolvido_banido' });
      
      setReports(reports.map(r => r.id === reportId ? { ...r, status: 'resolvido_banido' } : r));
      setUsers(users.map(u => u.id === userId ? {
        ...u,
        status: {
          ...u.status,
          banido: true
        }
      } : u));
      
      alert('Usuário banido com sucesso e denúncia encerrada.');
    } catch (err) {
      console.error("Error banning reported user:", err);
      alert('Erro ao banir usuário.');
    }
  };

  // Safe Getters to handle flat vs nested profile structures cleanly
  const getUserNome = (u: CrmUser) => u.profile?.nome || u.nome || 'Sem nome';
  const getUserApelido = (u: CrmUser) => u.profile?.apelido || u.apelido || 'Sem apelido';
  const getUserCidade = (u: CrmUser) => u.profile?.cidadeNascimento || u.cidadeNascimento || 'Não informada';
  const getUserEstado = (u: CrmUser) => u.profile?.estadoNascimento || u.estadoNascimento || 'Não informado';
  const getUserVerified = (u: CrmUser) => u.profile?.verified || u.verified || false;
  const getUserFoto = (u: CrmUser) => u.profile?.fotoPrincipalUrl || '';
  const getUserIdade = (u: CrmUser) => u.profile?.idade || u.idade || '--';
  const getUserSexo = (u: CrmUser) => u.profile?.sexo || u.sexo || '--';
  const getUserEmail = (u: CrmUser) => u.profile?.email || u.email || 'Não informado';
  const isUserBanned = (u: CrmUser) => u.status?.banido || false;

  const formatGeoTime = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      const d = new Date(Number(timestamp));
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return 'N/A';
    }
  };

  const handleOpenEdit = (user: CrmUser) => {
    setEditingUser(user);
    setEditForm({
      nome: getUserNome(user),
      apelido: getUserApelido(user),
      cidadeNascimento: getUserCidade(user),
      estadoNascimento: getUserEstado(user),
      email: getUserEmail(user) === 'Não informado' ? '' : getUserEmail(user),
      role: user.role || 'Usuário'
    });
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      // Update nested profile and root role
      await setDoc(doc(db, 'users', editingUser.id), {
        profile: {
          nome: editForm.nome,
          apelido: editForm.apelido,
          cidadeNascimento: editForm.cidadeNascimento,
          estadoNascimento: editForm.estadoNascimento,
          email: editForm.email,
        },
        role: editForm.role
      }, { merge: true });

      setUsers(users.map(u => u.id === editingUser.id ? {
        ...u,
        role: editForm.role,
        profile: {
          ...u.profile,
          nome: editForm.nome,
          apelido: editForm.apelido,
          cidadeNascimento: editForm.cidadeNascimento,
          estadoNascimento: editForm.estadoNascimento,
          email: editForm.email,
        },
        nome: editForm.nome,
        apelido: editForm.apelido,
        cidadeNascimento: editForm.cidadeNascimento,
        estadoNascimento: editForm.estadoNascimento,
        email: editForm.email,
      } : u));
      
      setEditingUser(null);
    } catch (err) {
      console.error("Error saving user profile edits:", err);
      alert("Erro ao salvar as alterações do usuário.");
    }
  };

  const handleToggleVerified = async (user: CrmUser) => {
    const currentStatus = getUserVerified(user);
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      await setDoc(doc(db, 'users', user.id), {
        verified: !currentStatus,
        emailVerified: !currentStatus,
        profile: {
          verified: !currentStatus,
          emailVerified: !currentStatus
        }
      }, { merge: true });

      setUsers(users.map(u => u.id === user.id ? { 
        ...u, 
        verified: !currentStatus,
        emailVerified: !currentStatus,
        profile: {
          ...u.profile,
          nome: getUserNome(u),
          verified: !currentStatus,
          emailVerified: !currentStatus
        }
      } : u));
    } catch (err) {
      console.error("Error toggling verified status:", err);
    }
  };

  const handleToggleBlock = async (user: CrmUser) => {
    const isBanned = isUserBanned(user);
    const confirmMsg = isBanned 
      ? `Deseja realmente DESBLOQUEAR o usuário ${getUserNome(user)}?`
      : `Deseja realmente BLOQUEAR/BANIR o usuário ${getUserNome(user)}? Ele perderá acesso ao aplicativo imediatamente.`;
      
    if (!window.confirm(confirmMsg)) return;

    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      await setDoc(doc(db, 'users', user.id), {
        status: {
          banido: !isBanned
        }
      }, { merge: true });
      
      setUsers(users.map(u => u.id === user.id ? {
        ...u,
        status: {
          ...u.status,
          banido: !isBanned
        }
      } : u));
    } catch (err) {
      console.error("Error toggling ban status:", err);
    }
  };

  const handleToggleAdmin = async (user: CrmUser) => {
    const currentRole = user.role || 'Usuário';
    const isCurrentlyAdmin = currentRole === 'Admin';
    const targetRole = isCurrentlyAdmin ? 'Usuário' : 'Admin';
    
    const confirmMsg = isCurrentlyAdmin 
      ? `Deseja remover o cargo de Administrador de ${getUserNome(user)}?`
      : `Tem certeza que deseja promover ${getUserNome(user)} a Administrador? Ele terá acesso total ao CRM e configurações.`;
      
    if (!window.confirm(confirmMsg)) return;

    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      await setDoc(doc(db, 'users', user.id), { role: targetRole }, { merge: true });
      
      setUsers(users.map(u => u.id === user.id ? { ...u, role: targetRole } : u));
    } catch (err) {
      console.error("Error promoting user to admin:", err);
    }
  };

  const handleViewReport = async (user: CrmUser) => {
    setReportUser(user);
    setReportData({
      connectionsCount: 0,
      requestsSentCount: 0,
      requestsReceivedCount: 0,
      shortMessagesSentCount: 0,
      loading: true
    });
    setReportUserLocation(null);
    setReportUserLocationHistory([]);
    setLocationLoading(true);

    try {
      const { collection, query, where, getDocs, doc, getDoc, orderBy, limit } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');

      const connectionsQuery = query(collection(db, 'connections'), where('users', 'array-contains', user.id));
      const reqSentQuery = query(collection(db, 'friendRequests'), where('fromUserId', '==', user.id));
      const reqRecQuery = query(collection(db, 'friendRequests'), where('toUserId', '==', user.id));
      const shortMsgsQuery = query(collection(db, 'shortMessages'), where('fromUserId', '==', user.id));

      const [connSnap, reqSentSnap, reqRecSnap, shortMsgsSnap] = await Promise.all([
        getDocs(connectionsQuery),
        getDocs(reqSentQuery),
        getDocs(reqRecQuery),
        getDocs(shortMsgsQuery)
      ]);

      setReportData({
        connectionsCount: connSnap.size,
        requestsSentCount: reqSentSnap.size,
        requestsReceivedCount: reqRecSnap.size,
        shortMessagesSentCount: shortMsgsSnap.size,
        loading: false
      });

      // Fetch active location document
      try {
        const locSnap = await getDoc(doc(db, 'locations', user.id));
        if (locSnap.exists()) {
          setReportUserLocation(locSnap.data());
        }

        // Fetch location and activity history subcollection
        const historyQuery = query(
          collection(db, 'locations', user.id, 'history'),
          orderBy('timestamp', 'desc'),
          limit(10)
        );
        const historySnap = await getDocs(historyQuery);
        const list = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setReportUserLocationHistory(list);
      } catch (locErr) {
        console.warn("Could not load real location or history subcollection:", locErr);
      } finally {
        setLocationLoading(false);
      }
    } catch (err) {
      console.error("Error generating usage report:", err);
      setReportData(prev => prev ? { ...prev, loading: false } : null);
      setLocationLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário definitivamente da base de dados? Esta ação é irreversível.')) return;
    if (!auth.currentUser) return;
    
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      await deleteDoc(doc(db, 'users', userId));
      setUsers(users.filter(u => u.id !== userId));
      alert('Usuário excluído com sucesso.');
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir usuário. Verifique as regras de segurança no Firebase Console.');
    }
  };

  const handleSaveSettings = async (updatedSettings: typeof appConfig) => {
    setConfigLoading(true);
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      await setDoc(doc(db, 'settings', 'app_config'), updatedSettings, { merge: true });
      alert('Configurações globais salvas com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar as configurações.');
    } finally {
      setConfigLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const regId = getUserRegistrationId(u);
    const matchSearch = getUserNome(u).toLowerCase().includes(searchTerm.toLowerCase()) || 
      getUserApelido(u).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getUserEmail(u).toLowerCase().includes(searchTerm.toLowerCase()) ||
      regId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.id.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchSexo = filterSexo ? u.profile?.sexo === filterSexo : true;
    const matchDataNasc = filterDataNasc ? u.profile?.dataNascimento === filterDataNasc : true;
    const matchCidade = filterCidade ? u.profile?.cidadeNascimento?.toLowerCase().includes(filterCidade.toLowerCase()) : true;

    return matchSearch && matchSexo && matchDataNasc && matchCidade;
  });

  return (
    <div className="flex flex-col font-sans p-4 min-h-screen bg-slate-50">
      
      {/* Header Panel */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              Painel CRM Administrativo
            </h1>
            <p className="text-sm text-slate-400 font-medium">
              Gestão de usuários, moderação de acessos, relatórios e configurações do sistema.
            </p>
          </div>
        </div>
        
        {/* Short info */}
        <div className="flex flex-col items-end gap-2">
          <div className="text-xs text-slate-400 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 self-start md:self-auto font-mono">
            Desenvolvido por: W.E.G. Business
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 mb-6 bg-white rounded-xl p-1 shadow-sm border">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Users className="w-4 h-4" />
          Usuários Cadastrados
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Settings className="w-4 h-4" />
          Configurações do App
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'reports' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <AlertCircle className="w-4 h-4 text-rose-500" />
          Denúncias Perfil
          {reports.filter(r => r.status === 'pendente').length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
              {reports.filter(r => r.status === 'pendente').length}
            </span>
          )}
        </button>

      </div>

      {activeTab === 'users' ? (
        <>
          {/* Key Metrics cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total de Usuários</div>
                <div className="text-2xl font-black text-slate-800">{users.length}</div>
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Administradores</div>
                <div className="text-2xl font-black text-slate-800">
                  {users.filter(u => u.role === 'Admin').length}
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <Ban className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Contas Bloqueadas</div>
                <div className="text-2xl font-black text-slate-800">
                  {users.filter(u => isUserBanned(u)).length}
                </div>
              </div>
            </div>
          </div>

          {/* Search bar and Filters */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 space-y-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar usuário por nome, apelido ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <select
                  value={filterSexo}
                  onChange={(e) => setFilterSexo(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Filtrar por Sexo (Todos)</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                </select>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Data Nasc. (DD/MM/AAAA)"
                  value={filterDataNasc}
                  onChange={(e) => setFilterDataNasc(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Cidade de Nascimento"
                  value={filterCidade}
                  onChange={(e) => setFilterCidade(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-500 font-bold">Carregando usuários da plataforma...</p>
            </div>
          ) : (
            <div className="pb-24">
              {/* Desktop Wide View: Grid Table */}
              <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Grid Header */}
                <div className="grid grid-cols-[1.5fr_1fr_1.2fr_1fr_1.2fr] gap-4 bg-slate-100 p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <div>Usuário</div>
                  <div>Apelido</div>
                  <div>Localização</div>
                  <div>Nível / Status</div>
                  <div className="text-right pr-4">Ações do Administrador</div>
                </div>

                {/* Grid Rows */}
                <div className="divide-y divide-slate-100">
                  {filteredUsers.map(user => {
                    const nome = getUserNome(user);
                    const apelido = getUserApelido(user);
                    const cidade = getUserCidade(user);
                    const estado = getUserEstado(user);
                    const isBanned = isUserBanned(user);
                    const verified = getUserVerified(user);
                    const isUserAdmin = user.role === 'Admin';

                    return (
                      <div key={user.id} className="grid grid-cols-[1.5fr_1fr_1.2fr_1fr_1.2fr] gap-4 p-4 items-center hover:bg-slate-50/50 transition-colors">
                        
                        {/* User identity cell */}
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-black shrink-0 relative">
                            {getUserFoto(user) ? (
                              <img src={getUserFoto(user)} alt={nome} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <span>{nome ? nome[0].toUpperCase() : <User className="w-5 h-5" />}</span>
                            )}
                            <ZodiacBadge user={user} variant="avatar-badge" />
                            {isBanned && (
                              <span className="absolute -bottom-1 -right-1 bg-red-600 text-white p-0.5 rounded-full z-10">
                                <Lock className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-800 truncate flex items-center gap-1.5 text-sm">
                              {nome}
                              {verified && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" aria-label="Verificado" />}
                            </h3>
                            <p className="text-[11px] text-slate-500 truncate font-mono">
                              <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded mr-1">ID: {getUserRegistrationId(user)}</span>
                              <span>{getUserEmail(user)}</span>
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {getUserIdade(user)} anos • {getUserSexo(user)}
                            </p>
                          </div>
                        </div>

                        {/* Apelido Cell */}
                        <div className="min-w-0">
                          <span className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-full">
                            @{apelido}
                          </span>
                        </div>

                        {/* Localização Cell */}
                        <div className="text-xs text-slate-600 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{cidade} - {estado}</span>
                        </div>

                        {/* Nível / Status Cell */}
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${isUserAdmin ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-600'}`}>
                            {user.role || 'Usuário'}
                          </span>
                          {isBanned && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-red-600 text-white rounded">
                              Bloqueado
                            </span>
                          )}
                        </div>

                        {/* Action column (Icon list) */}
                        <div className="flex items-center justify-end gap-1.5 pr-2">
                          
                          {/* 1. Editar */}
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Editar Dados e Função"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* 2. Bloquear / Desbloquear */}
                          <button
                            onClick={() => handleToggleBlock(user)}
                            className={`p-2 rounded-lg transition-colors ${isBanned ? 'text-red-600 bg-red-50 hover:bg-red-100' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                            title={isBanned ? "Desbloquear Usuário" : "Bloquear Usuário"}
                          >
                            <Ban className="w-4 h-4" />
                          </button>

                          {/* 3. Relatório de Uso */}
                          <button
                            onClick={() => handleViewReport(user)}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Relatório de Uso"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>

                          {/* 4. Tornar Administrador */}
                          <button
                            onClick={() => handleToggleAdmin(user)}
                            className={`p-2 rounded-lg transition-colors ${isUserAdmin ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            title={isUserAdmin ? "Remover privilégios de Admin" : "Tornar Administrador"}
                          >
                            <Crown className="w-4 h-4" />
                          </button>

                          {/* Delete profile completely */}
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 text-slate-300 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir Definitivamente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobile View: Cards Grid */}
              <div className="md:hidden grid grid-cols-1 gap-4">
                {filteredUsers.map(user => {
                  const nome = getUserNome(user);
                  const apelido = getUserApelido(user);
                  const cidade = getUserCidade(user);
                  const estado = getUserEstado(user);
                  const isBanned = isUserBanned(user);
                  const verified = getUserVerified(user);
                  const isUserAdmin = user.role === 'Admin';

                  return (
                    <div key={user.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4">
                      
                      {/* Identity & Basic details */}
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold shrink-0 relative">
                          {getUserFoto(user) ? (
                            <img src={getUserFoto(user)} alt={nome} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span>{nome ? nome[0].toUpperCase() : <User className="w-5 h-5" />}</span>
                          )}
                          <ZodiacBadge user={user} variant="avatar-badge" />
                          {isBanned && (
                            <span className="absolute -bottom-1 -right-1 bg-red-600 text-white p-0.5 rounded-full z-10">
                              <Lock className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-base">
                            {nome}
                            {verified && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                          </h3>
                          <p className="text-xs text-slate-500 font-mono truncate">
                            <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded mr-1">ID: {getUserRegistrationId(user)}</span>
                            <span>{getUserEmail(user)}</span>
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {getUserIdade(user)} anos • {getUserSexo(user)}
                          </p>
                        </div>
                      </div>

                      <hr className="border-slate-100" />

                      {/* Display Requested info block: Apelido, Cidade, Estado */}
                      <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Apelido</div>
                          <div className="font-bold text-slate-700 truncate">@{apelido}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Localização</div>
                          <div className="font-semibold text-slate-700 truncate">{cidade} - {estado}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Nível</div>
                          <div className="font-bold text-indigo-600">{user.role || 'Usuário'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Status</div>
                          <div className="font-bold">
                            {isBanned ? (
                              <span className="text-red-600">Bloqueado</span>
                            ) : (
                              <span className="text-emerald-600">Ativo</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions row footer */}
                      <div className="flex items-center justify-between mt-1 pt-3 border-t border-slate-100">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Ações do Admin:</div>
                        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                          
                          {/* 1. Editar */}
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4.5 h-4.5" />
                          </button>

                          {/* 2. Bloquear */}
                          <button
                            onClick={() => handleToggleBlock(user)}
                            className={`p-2 rounded-md transition-colors ${isBanned ? 'text-red-600 bg-red-50' : 'text-slate-400 hover:text-red-600'}`}
                            title={isBanned ? "Desbloquear" : "Bloquear"}
                          >
                            <Ban className="w-4.5 h-4.5" />
                          </button>

                          {/* 3. Relatório */}
                          <button
                            onClick={() => handleViewReport(user)}
                            className="p-2 text-amber-600 hover:bg-amber-100 rounded-md transition-colors"
                            title="Relatório de Uso"
                          >
                            <BarChart3 className="w-4.5 h-4.5" />
                          </button>

                          {/* 4. Tornar Admin */}
                          <button
                            onClick={() => handleToggleAdmin(user)}
                            className={`p-2 rounded-md transition-colors ${isUserAdmin ? 'text-indigo-600 bg-indigo-100' : 'text-slate-400'}`}
                            title="Tornar Administrador"
                          >
                            <Crown className="w-4.5 h-4.5" />
                          </button>

                          {/* Delete completely */}
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 text-slate-300 hover:text-red-700"
                            title="Excluir"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>

                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

              {filteredUsers.length === 0 && (
                <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl text-slate-400 font-medium">
                  <BadgeHelp className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  Nenhum usuário localizado para os termos buscados.
                </div>
              )}
            </div>
          )}
        </>
      ) : activeTab === 'settings' ? (
        /* Settings Tab (Global Controls) */
        <div className="space-y-4 pb-24">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                Controles Globais do Sistema
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Ajustes imediatos nas políticas de cadastro, manutenção e validação de novos perfis.
              </p>
            </div>

            <hr className="border-slate-100" />

            {/* Modo Manutenção */}
            <div className="flex items-center justify-between py-2">
              <div className="space-y-1 max-w-[70%]">
                <label className="text-sm font-bold text-slate-800">Modo Manutenção Geral</label>
                <p className="text-xs text-slate-400">Suspende o uso geral de contas de usuários, mostrando tela de indisponibilidade temporária.</p>
              </div>
              <button
                type="button"
                onClick={() => setAppConfig(prev => ({ ...prev, maintenanceMode: !prev.maintenanceMode }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${appConfig.maintenanceMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${appConfig.maintenanceMode ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Permitir Novos Cadastros */}
            <div className="flex items-center justify-between py-2 border-t border-slate-100">
              <div className="space-y-1 max-w-[70%]">
                <label className="text-sm font-bold text-slate-800">Permitir Novos Cadastros</label>
                <p className="text-xs text-slate-400">Habilita ou suspende a criação de novas contas na tela inicial do sistema.</p>
              </div>
              <button
                type="button"
                onClick={() => setAppConfig(prev => ({ ...prev, registrationEnabled: !prev.registrationEnabled }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${appConfig.registrationEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${appConfig.registrationEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Auto-verificar novos usuários */}
            <div className="flex items-center justify-between py-2 border-t border-slate-100">
              <div className="space-y-1 max-w-[70%]">
                <label className="text-sm font-bold text-slate-800">Auto-verificar novos cadastros</label>
                <p className="text-xs text-slate-400">Concede o selo verificado automaticamente a todos os novos perfis que finalizarem a etapa inicial.</p>
              </div>
              <button
                type="button"
                onClick={() => setAppConfig(prev => ({ ...prev, autoVerifyNewUsers: !prev.autoVerifyNewUsers }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${appConfig.autoVerifyNewUsers ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${appConfig.autoVerifyNewUsers ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Exigir confirmação de e-mail */}
            <div className="flex items-center justify-between py-2 border-t border-slate-100">
              <div className="space-y-1 max-w-[70%]">
                <label className="text-sm font-bold text-slate-800">Exigir confirmação de e-mail para acesso</label>
                <p className="text-xs text-slate-400">Quando desligado, usuários podem navegar no app mesmo se o e-mail estiver na caixa de spam ou atrasar a entrega.</p>
              </div>
              <button
                type="button"
                onClick={() => setAppConfig(prev => ({ ...prev, requireEmailVerification: !prev.requireEmailVerification }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${appConfig.requireEmailVerification ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${appConfig.requireEmailVerification ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-indigo-600" />
              Customização de Identidade e Alertas
            </h2>

            {/* Título do App */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Título do Aplicativo (Cabeçalho)</label>
              <input
                type="text"
                value={appConfig.appCustomTitle}
                onChange={(e) => setAppConfig(prev => ({ ...prev, appCustomTitle: e.target.value }))}
                className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-800 font-semibold"
                placeholder="New Friends.br"
              />
            </div>

            {/* Texto do Banner de Alerta */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Banner Global de Alerta</label>
              <textarea
                value={appConfig.globalBannerText}
                onChange={(e) => setAppConfig(prev => ({ ...prev, globalBannerText: e.target.value }))}
                rows={3}
                className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-800"
                placeholder="Insira um comunicado oficial. Deixe vazio para ocultar."
              />
            </div>
          </div>

          <button
            onClick={() => handleSaveSettings(appConfig)}
            disabled={configLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors active:scale-95 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {configLoading ? 'Salvando Configurações...' : 'Salvar Alterações'}
          </button>
        </div>
      ) : (
        /* Reports Tab (Denúncias e Moderação) */
        <div className="space-y-4 pb-24">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-500" />
                  Denúncias Recebidas
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Analise as denúncias enviadas pelos usuários e tome ações moderadoras como advertência ou banimento imediato.
                </p>
              </div>
              <button 
                onClick={fetchReports}
                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-bold flex items-center gap-1 border border-indigo-100"
              >
                Atualizar Lista
              </button>
            </div>

            {reportsLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold">Carregando denúncias...</span>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-16 text-slate-400 font-medium">
                <ShieldCheck className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
                Excelente! Nenhuma denúncia pendente ou registrada na plataforma.
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => {
                  const reporter = users.find(u => u.id === report.deUserId);
                  const reported = users.find(u => u.id === report.contraUserId);

                  const reporterName = reporter ? (reporter.profile?.nome || reporter.nome || reporter.profile?.apelido || 'Usuário') : `ID: ${report.deUserId ? report.deUserId.substring(0,6) : '...'}`;
                  const reportedName = reported ? (reported.profile?.nome || reported.nome || reported.profile?.apelido || 'Usuário') : `ID: ${report.contraUserId ? report.contraUserId.substring(0,6) : '...'}`;
                  const isReportedBanned = reported?.status?.banido || false;

                  return (
                    <div 
                      key={report.id} 
                      className={`p-4 rounded-xl border transition-all ${
                        report.status === 'pendente' 
                          ? 'bg-rose-50/40 border-rose-100 shadow-sm' 
                          : 'bg-slate-50/50 border-slate-200 opacity-75'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            report.status === 'pendente' 
                              ? 'bg-rose-100 text-rose-700' 
                              : report.status === 'resolvido_banido'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-slate-200 text-slate-600'
                          }`}>
                            {report.status === 'pendente' ? 'Pendente' : report.status === 'resolvido_banido' ? 'Resolvido (Banido)' : 'Resolvido'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {report.criadoEm ? new Date(report.criadoEm).toLocaleString('pt-BR') : 'Sem data'}
                          </span>
                        </div>
                        <span className="text-xs font-black text-rose-600 capitalize">
                          Motivo: {report.motivo ? report.motivo.replace('_', ' ') : 'Não informado'}
                        </span>
                      </div>

                      <div className="space-y-1.5 mb-3 text-xs">
                        <p className="font-semibold text-slate-700">
                          <span className="text-slate-400 font-medium">De:</span> {reporterName} 
                          <span className="text-slate-400 font-medium ml-2">Contra:</span> <strong className="text-slate-800">{reportedName}</strong>
                          {isReportedBanned && <span className="ml-1 bg-red-100 text-red-700 px-1.5 py-0.2 rounded text-[9px] font-bold">BANIDO</span>}
                        </p>
                        {report.descricao && (
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-slate-600 font-medium whitespace-pre-wrap leading-relaxed">
                            {report.descricao}
                          </div>
                        )}
                      </div>

                      {report.status === 'pendente' && (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleResolveReport(report.id)}
                            className="py-1.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                          >
                            Arquivar/Resolver
                          </button>
                          {!isReportedBanned && (
                            <button
                              onClick={() => handleBanReportedUser(report.contraUserId, report.id)}
                              className="py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-lg text-[11px] transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
                            >
                              <Ban className="w-3 h-3" />
                              Banir Usuário Denunciado
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL 1: EDIT PROFILE / DETAILS --- */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-2.5 sm:p-4 z-50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] border border-slate-200 dark:border-slate-800">
            
            {/* Modal Header */}
            <div className="bg-indigo-600 text-white px-5 py-4 flex items-center justify-between shrink-0 shadow-xs">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5" />
                <h2 className="font-extrabold text-base">Editar Cadastro & Nível</h2>
              </div>
              <button 
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form - Scrollable with min-h-0 so flexbox allows scrolling */}
            <form id="edit-user-form" onSubmit={handleSaveUserEdit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
              
              {/* User Email & Registration ID (Info only) */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-sans font-semibold">ID do Usuário:</span>
                  <span className="font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                    {getUserRegistrationId(editingUser)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-sans font-semibold">E-mail de Cadastro:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">
                    {getUserEmail(editingUser)}
                  </span>
                </div>
              </div>

              {/* Nome */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nome Completo</label>
                <input
                  required
                  type="text"
                  value={editForm.nome}
                  onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Apelido */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Apelido (Nickname)</label>
                <input
                  required
                  type="text"
                  value={editForm.apelido}
                  onChange={(e) => setEditForm({ ...editForm, apelido: e.target.value })}
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-semibold"
                />
              </div>

              {/* E-mail */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">E-mail de Cadastro</label>
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Cidade */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cidade de Nascimento / Residência</label>
                <input
                  required
                  type="text"
                  value={editForm.cidadeNascimento}
                  onChange={(e) => setEditForm({ ...editForm, cidadeNascimento: e.target.value })}
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Estado */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Estado (UF)</label>
                <input
                  required
                  type="text"
                  value={editForm.estadoNascimento}
                  onChange={(e) => setEditForm({ ...editForm, estadoNascimento: e.target.value })}
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 uppercase"
                  maxLength={2}
                  placeholder="Ex: SP"
                />
              </div>

              {/* Função / Role */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Função Administrativa / Cargo</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                >
                  <option value="Usuário">Usuário (Padrão)</option>
                  <option value="Moderador">Moderador</option>
                  <option value="Admin">Administrador</option>
                </select>
              </div>

              {/* Seal option verification */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleToggleVerified(editingUser)}
                  className={`w-full py-2.5 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    getUserVerified(editingUser) 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' 
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {getUserVerified(editingUser) ? 'Remover Selo de Conta Verificada' : 'Verificar Conta (Atribuir Selo de Confiança)'}
                </button>
              </div>

            </form>

            {/* Modal Sticky Footer with Confirmation Buttons - ALWAYS VISIBLE on mobile & desktop */}
            <div className="shrink-0 p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex gap-2.5 z-10 shadow-lg">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="flex-1 py-3 text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl transition-all cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="edit-user-form"
                className="flex-1 py-3 text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl shadow-md shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Cadastro</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- MODAL 2: USAGE REPORT --- */}
      {reportUser && reportData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="bg-amber-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                <h2 className="font-extrabold text-base">Relatório de Uso do Usuário</h2>
              </div>
              <button 
                onClick={() => setReportUser(null)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
              
              {/* Profile Overview Card */}
              <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold overflow-hidden">
                  {getUserFoto(reportUser) ? (
                    <img src={getUserFoto(reportUser)} alt={getUserNome(reportUser)} className="w-full h-full object-cover" />
                  ) : (
                    <span>{getUserNome(reportUser)[0].toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1">
                    {getUserNome(reportUser)}
                    {getUserVerified(reportUser) && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                  </h3>
                  <p className="text-xs text-slate-500">@{getUserApelido(reportUser)}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{getUserEmail(reportUser)}</p>
                </div>
              </div>

              {/* Statistics Grid */}
              {reportData.loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-slate-400">
                  <div className="w-6 h-6 border-3 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs font-bold">Consultando estatísticas no Firestore...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  
                  <div className="grid grid-cols-2 gap-3">
                    
                    {/* Connections count */}
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-center">
                      <div className="text-2xl font-black text-blue-700">{reportData.connectionsCount}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">Conexões Ativas</div>
                    </div>

                    {/* Quick messages sent */}
                    <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 text-center">
                      <div className="text-2xl font-black text-purple-700">{reportData.shortMessagesSentCount}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">Mensagens Curtas</div>
                    </div>

                    {/* Friend Requests Sent */}
                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-center">
                      <div className="text-2xl font-black text-indigo-700">{reportData.requestsSentCount}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">Solicitações Env.</div>
                    </div>

                    {/* Friend Requests Received */}
                    <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 text-center">
                      <div className="text-2xl font-black text-amber-700">{reportData.requestsReceivedCount}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">Solicitações Rec.</div>
                    </div>

                  </div>

                  {/* Summary of overall engagement */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-2">
                    <div className="font-bold text-slate-700 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                      Análise de Engajamento
                    </div>
                    <p className="leading-relaxed">
                      O usuário possui um total de <strong className="text-slate-800">{reportData.connectionsCount + reportData.shortMessagesSentCount}</strong> interações diretas. 
                      Sua taxa de reciprocidade de amizades é de{' '}
                      <strong className="text-slate-800">
                        {reportData.requestsSentCount > 0 
                          ? `${Math.round((reportData.connectionsCount / reportData.requestsSentCount) * 100)}%` 
                          : '0%'}
                      </strong>.
                    </p>
                    <p className="text-[10px] text-slate-400">
                      * Dados compilados de forma segura em tempo real a partir das conexões e chats ativos da plataforma.
                    </p>
                  </div>

                  {/* --- MONITORAMENTO DE GEOLOCALIZAÇÃO --- */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-4">
                    <div className="font-bold text-slate-700 flex items-center gap-1.5 text-xs">
                      <Compass className="w-4 h-4 text-indigo-600" />
                      Monitoramento de Localização
                    </div>

                    {locationLoading ? (
                      <div className="py-4 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-bold">
                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        Carregando informações geolocalizadas...
                      </div>
                    ) : reportUserLocation ? (
                      <div className="space-y-4">
                        {/* Current Coordinates Card */}
                        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 text-xs shadow-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-bold text-slate-800 flex items-center gap-1 text-[11px]">
                                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                                Coordenadas Atuais
                              </div>
                              <p className="text-[10px] text-slate-500 font-mono mt-1">
                                Lat: {reportUserLocation.lat?.toFixed(6) || 'N/A'}, Lng: {reportUserLocation.lng?.toFixed(6) || 'N/A'}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                reportUserLocation.status === 'online' 
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                  : reportUserLocation.status === 'invisivel'
                                  ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                  : 'bg-rose-50 text-rose-600 border border-rose-100'
                              }`}>
                                {reportUserLocation.status || 'offline'}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] pt-1.5 border-t border-slate-100">
                            <div>
                              <span className="text-slate-400 font-semibold uppercase text-[8px]">Endereço Aproximado</span>
                              <p className="font-bold text-slate-700 leading-tight">
                                {reportUserLocation.bairro || 'Bairro N/D'}, {reportUserLocation.cidade || 'Cidade N/D'}
                              </p>
                              <p className="text-[9px] text-slate-500 font-semibold">
                                {reportUserLocation.estado || 'Estado N/D'}{reportUserLocation.pais ? `, ${reportUserLocation.pais}` : ''}
                              </p>
                            </div>
                            <div className="text-right flex flex-col justify-end">
                              <span className="text-slate-400 font-semibold uppercase text-[8px]">Último Sinal</span>
                              <p className="font-bold text-slate-600 font-mono flex items-center gap-1 justify-end text-[10px]">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {formatGeoTime(reportUserLocation.atualizadoEm)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Visual Location Timeline */}
                        <div className="space-y-3">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-indigo-500" />
                            Histórico de Atividades Recentes
                          </div>

                          <div className="relative pl-5 space-y-4 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-[1.5px] before:bg-slate-200">
                            {(reportUserLocationHistory.length > 0 
                              ? reportUserLocationHistory 
                              : [
                                  {
                                    id: 'sim-1',
                                    tipo: 'atualizacao_coordenadas',
                                    lat: reportUserLocation.lat,
                                    lng: reportUserLocation.lng,
                                    timestamp: reportUserLocation.atualizadoEm || Date.now()
                                  },
                                  {
                                    id: 'sim-2',
                                    tipo: 'alteracao_status',
                                    status: reportUserLocation.status || 'online',
                                    timestamp: (reportUserLocation.atualizadoEm || Date.now()) - 5 * 60 * 1000
                                  },
                                  {
                                    id: 'sim-3',
                                    tipo: 'presenca_conexao',
                                    status: 'online',
                                    timestamp: (reportUserLocation.atualizadoEm || Date.now()) - 30 * 60 * 1000
                                  }
                                ]
                            ).map((node: any, idx: number) => {
                              const isSim = typeof node.id === 'string' && node.id.startsWith('sim-');
                              return (
                                <div key={node.id || idx} className="relative text-xs">
                                  {/* Timeline marker */}
                                  <span className={`absolute left-[-21px] top-1.5 w-[11px] h-[11px] rounded-full ring-4 ring-slate-50 flex items-center justify-center ${
                                    node.tipo === 'atualizacao_coordenadas' 
                                      ? 'bg-rose-500' 
                                      : node.tipo === 'alteracao_status' 
                                      ? 'bg-amber-500' 
                                      : 'bg-indigo-500'
                                  }`} />

                                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-sm flex flex-col gap-1">
                                    <div className="flex justify-between items-start gap-2">
                                      <span className="font-bold text-slate-700 text-[10px]">
                                        {node.tipo === 'atualizacao_coordenadas' ? (
                                          <span className="flex items-center gap-1 text-rose-700 font-bold">
                                            <MapPin className="w-3 h-3 shrink-0" />
                                            Coordenadas Capturadas
                                          </span>
                                        ) : node.tipo === 'alteracao_status' ? (
                                          <span className="flex items-center gap-1 text-amber-700 font-bold">
                                            <RefreshCw className="w-3 h-3 shrink-0" />
                                            Alteração de Status
                                          </span>
                                        ) : (
                                          <span className="flex items-center gap-1 text-indigo-700 font-bold">
                                            <Activity className="w-3 h-3 shrink-0" />
                                            Presença Verificada
                                          </span>
                                        )}
                                      </span>
                                      <span className="text-[9px] text-slate-400 font-mono font-bold">
                                        {formatGeoTime(node.timestamp)}
                                      </span>
                                    </div>

                                    {node.tipo === 'atualizacao_coordenadas' && (
                                      <p className="text-[9px] text-slate-500 font-mono leading-none">
                                        Lat: {node.lat?.toFixed(5)}, Lng: {node.lng?.toFixed(5)}
                                      </p>
                                    )}

                                    {node.tipo === 'alteracao_status' && (
                                      <p className="text-[9px] text-slate-500 font-medium leading-none">
                                        Alterou status para <strong className="text-slate-700 font-black">{node.status}</strong>
                                      </p>
                                    )}

                                    {node.tipo === 'presenca_conexao' && (
                                      <p className="text-[9px] text-slate-500 font-medium leading-none">
                                        Status de conexão sincronizado como <strong className="text-slate-700 font-black">{node.status}</strong>
                                      </p>
                                    )}

                                    {isSim && (
                                      <span className="text-[8px] bg-indigo-50 text-indigo-600 font-bold px-1 py-0.5 rounded self-start mt-0.5 uppercase tracking-wide">
                                        Registro Inicial
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-white rounded-xl border border-dashed border-slate-200 text-center text-[11px] text-slate-400">
                        <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-1.5 animate-bounce" />
                        Nenhuma atividade geolocalizada ativa foi encontrada para este usuário.
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* Close button */}
              <button
                type="button"
                onClick={() => setReportUser(null)}
                className="w-full py-3 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
              >
                Fechar Relatório
              </button>

            </div>
          </div>
        </div>
      )}



      {/* Real-time Notification Banner for Admins */}
      <AnimatePresence>
        {activeNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 bg-rose-600 text-white rounded-2xl shadow-2xl p-5 border border-rose-500/30 flex items-start gap-4"
          >
            <div className="p-2.5 bg-white/20 rounded-xl shrink-0">
              <AlertCircle className="w-6 h-6 text-white animate-bounce" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h4 className="text-sm font-black uppercase tracking-wider text-rose-100">Nova Denúncia de Perfil</h4>
              <p className="text-xs font-bold text-white mt-1">
                {activeNotification.reporterName} denunciou {activeNotification.reportedName}
              </p>
              <p className="text-[11px] bg-black/20 p-2 rounded-lg mt-2 text-rose-100 font-medium">
                <span className="font-bold text-white">Motivo:</span> {activeNotification.motivo ? activeNotification.motivo.replace('_', ' ') : 'Não informado'}
                {activeNotification.descricao && (
                  <>
                    <br />
                    <span className="font-bold text-white">Detalhes:</span> "{activeNotification.descricao}"
                  </>
                )}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    setActiveTab('reports');
                    setActiveNotification(null);
                  }}
                  className="bg-white text-rose-700 hover:bg-rose-50 text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-all active:scale-95"
                >
                  Ver Denúncias
                </button>
                <button
                  onClick={() => setActiveNotification(null)}
                  className="bg-transparent hover:bg-white/10 text-white border border-white/20 text-xs font-bold px-4 py-2 rounded-lg transition-all active:scale-95"
                >
                  Fechar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
