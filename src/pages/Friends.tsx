import { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc, serverTimestamp, onSnapshot, documentId } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Link } from 'react-router-dom';
import { Check, Clock, X, Ban, User, Phone, Mail, Plus, Trash, Tag, Settings, ChevronDown, Search, Sparkles } from 'lucide-react';
import CachedLazyImage from '../components/CachedLazyImage';

interface FriendRequest {
  id: string;
  fromUserId: string;
  createdAt: any;
  profile: any;
}

interface Connection {
  id: string;
  friendId: string;
  profile: any;
  permissions: any;
  categories?: any;
  createdAt?: any;
}

export default function Friends() {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'views'>('friends');
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [profileViews, setProfileViews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userStatuses, setUserStatuses] = useState<Record<string, { status: string; lastActive: number }>>({});

  // Categories states
  const [myProfile, setMyProfile] = useState<any>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('all');
  const [isManagingCategories, setIsManagingCategories] = useState(false);

  // Cache for user profiles to optimize loading and prevent N+1 queries
  const userProfilesCacheRef = useRef<Record<string, any>>({});

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'locations'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const statuses: Record<string, { status: string; lastActive: number }> = {};
      snapshot.forEach((doc) => {
        const d = doc.data();
        statuses[doc.id] = {
          status: d.status || 'online',
          lastActive: d.atualizadoEm || 0,
        };
      });
      setUserStatuses(statuses);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'locations');
    });

    return () => unsubscribe();
  }, []);

  const isUserOnline = (userId: string) => {
    const userLoc = userStatuses[userId];
    if (!userLoc || userLoc.status !== 'online') return false;
    return Date.now() - userLoc.lastActive < 120000;
  };

  const getLastSeenText = (userId: string) => {
    const userLoc = userStatuses[userId];
    if (!userLoc) return 'Offline';
    if (userLoc.status !== 'online') {
      return 'Offline';
    }
    const diff = Date.now() - userLoc.lastActive;
    if (diff < 120000) return 'Online agora';
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) {
      return `Ativo há ${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `Ativo há ${hours}h`;
    }
    return 'Offline';
  };

  // Sync user's categories from Firestore
  useEffect(() => {
    if (!auth.currentUser) return;

    const myUserDocRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribeMyUser = onSnapshot(myUserDocRef, (snap) => {
      if (snap.exists()) {
        setMyProfile(snap.data());
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${auth.currentUser?.uid}`);
    });

    return () => {
      unsubscribeMyUser();
    };
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    setLoading(true);
    
    if (activeTab === 'requests') {
      fetchRequests();
    } else if (activeTab === 'views') {
      fetchViews();
    } else {
      fetchConnections();
    }
  }, [activeTab]);

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 1) return 'Agora mesmo';
    if (mins < 60) return `Há ${mins} min`;
    if (hours < 24) return `Há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    return `Há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  };

  const isRecentConnection = (createdAt: any): boolean => {
    if (!createdAt) return false;
    let ms = 0;
    if (typeof createdAt.toMillis === 'function') {
      ms = createdAt.toMillis();
    } else if (createdAt.seconds) {
      ms = createdAt.seconds * 1000;
    } else if (typeof createdAt === 'number') {
      ms = createdAt;
    } else if (typeof createdAt === 'string') {
      ms = new Date(createdAt).getTime();
    } else if (createdAt instanceof Date) {
      ms = createdAt.getTime();
    }
    if (!ms) return false;
    const diffMs = Date.now() - ms;
    const oneDayMs = 24 * 60 * 60 * 1000;
    return diffMs >= 0 && diffMs <= oneDayMs;
  };

  const fetchUserProfilesWithCache = async (userIds: string[]): Promise<Record<string, any>> => {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    const missingIds = uniqueIds.filter(id => !userProfilesCacheRef.current[id]);
    
    if (missingIds.length > 0) {
      const profiles: Record<string, any> = {};
      const chunks: string[][] = [];
      for (let i = 0; i < missingIds.length; i += 30) {
        chunks.push(missingIds.slice(i, i + 30));
      }
      
      try {
        const promises = chunks.map(async (chunk) => {
          const q = query(collection(db, 'users'), where(documentId(), 'in', chunk));
          const snap = await getDocs(q);
          snap.forEach((doc) => {
            profiles[doc.id] = doc.data();
          });
        });
        await Promise.all(promises);
      } catch (err) {
        console.error("Error fetching missing user profiles, falling back to parallel getDoc:", err);
        const fallbackPromises = missingIds.map(async (uid) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
              profiles[uid] = userDoc.data();
            }
          } catch (e) {
            console.error(`Error fetching user doc ${uid}:`, e);
          }
        });
        await Promise.all(fallbackPromises);
      }
      
      userProfilesCacheRef.current = {
        ...userProfilesCacheRef.current,
        ...profiles
      };
    }
    
    return userProfilesCacheRef.current;
  };

  const fetchViews = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(
        collection(db, 'profileViews'),
        where('visitedId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      
      const visitorIds = snapshot.docs.map(d => d.data().visitorId).filter(Boolean);
      const profiles = await fetchUserProfilesWithCache(visitorIds);
      
      const viewsList: any[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        const userProfile = profiles[data.visitorId];
        if (userProfile) {
          viewsList.push({
            id: d.id,
            visitorId: data.visitorId,
            visitedId: data.visitedId,
            timestamp: data.timestamp,
            profile: userProfile.profile || {}
          });
        }
      }

      // Fallback/enrichment with high-fidelity mock views if no real views
      if (viewsList.length === 0) {
        const mockIds = ['mock1', 'mock2', 'mock3'];
        const mockTimes = [
          Date.now() - 1000 * 60 * 12,    // 12 mins ago
          Date.now() - 1000 * 60 * 145,   // 2 hours ago
          Date.now() - 1000 * 60 * 60 * 5 // 5 hours ago
        ];
        
        const { MOCK_USERS } = await import('./Discover');
        for (let i = 0; i < mockIds.length; i++) {
          const mUser = MOCK_USERS.find(u => u.userId === mockIds[i]);
          if (mUser) {
            viewsList.push({
              id: `mock_view_${mockIds[i]}`,
              visitorId: mockIds[i],
              visitedId: auth.currentUser.uid,
              timestamp: mockTimes[i],
              profile: mUser.profile || {}
            });
          }
        }
      }

      // Sort by timestamp descending
      viewsList.sort((a, b) => {
        const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (typeof a.timestamp === 'number' ? a.timestamp : 0);
        const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (typeof b.timestamp === 'number' ? b.timestamp : 0);
        return tB - tA;
      });

      setProfileViews(viewsList);
    } catch (error) {
      console.error("Error fetching profile views:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(
        collection(db, 'friendRequests'),
        where('toUserId', '==', auth.currentUser.uid),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      
      const fromUserIds = snapshot.docs.map(d => d.data().fromUserId).filter(Boolean);
      const profiles = await fetchUserProfilesWithCache(fromUserIds);
      
      const reqs: FriendRequest[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        const userProfile = profiles[data.fromUserId];
        if (userProfile) {
          reqs.push({
            id: d.id,
            fromUserId: data.fromUserId,
            createdAt: data.createdAt,
            profile: userProfile.profile || {}
          });
        }
      }
      setRequests(reqs);
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConnections = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(
        collection(db, 'connections'),
        where('users', 'array-contains', auth.currentUser.uid)
      );
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const connsTemp: { docId: string; data: any; friendId: string }[] = [];
        const friendIds: string[] = [];

        for (const d of snapshot.docs) {
          const data = d.data();
          const friendId = data.users.find((u: string) => u !== auth.currentUser!.uid);
          if (friendId) {
            connsTemp.push({ docId: d.id, data, friendId });
            friendIds.push(friendId);
          }
        }

        const profiles = await fetchUserProfilesWithCache(friendIds);

        const conns: Connection[] = [];
        for (const item of connsTemp) {
          const userProfile = profiles[item.friendId];
          if (userProfile) {
            const categories = item.data.categories || {};
            if (!categories[auth.currentUser!.uid]) {
              try {
                await updateDoc(doc(db, 'connections', item.docId), {
                  [`categories.${auth.currentUser!.uid}`]: 'Geral'
                });
                categories[auth.currentUser!.uid] = 'Geral';
              } catch (err) {
                console.error("Error auto-categorizing connection:", err);
              }
            }

            conns.push({
              id: item.docId,
              friendId: item.friendId,
              profile: userProfile.profile || {},
              permissions: item.data.permissions || {},
              categories: categories,
              createdAt: item.data.createdAt
            });
          }
        }
        setConnections(conns);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'connections');
      });
      
      return () => unsubscribe();
    } catch (error) {
      console.error("Error fetching connections:", error);
      setLoading(false);
    }
  };

  const handleAction = async (requestId: string, fromUserId: string, action: 'accepted' | 'rejected' | 'blocked' | 'later') => {
    if (!auth.currentUser) return;
    try {
      if (action === 'later') {
        setRequests(prev => prev.filter(r => r.id !== requestId));
        return;
      }
      if (action === 'blocked') {
        const confirmBlock = window.confirm('Tem certeza de que deseja bloquear este usuário? Vocês não serão mais amigos e não verão mais os perfis um do outro.');
        if (!confirmBlock) return;
      }
      await updateDoc(doc(db, 'friendRequests', requestId), {
        status: action,
        updatedAt: serverTimestamp()
      });

      if (action === 'accepted') {
        await setDoc(doc(db, 'connections', `${auth.currentUser.uid}_${fromUserId}`), {
          users: [auth.currentUser.uid, fromUserId],
          permissions: {},
          categories: {
            [auth.currentUser.uid]: 'Geral',
            [fromUserId]: 'Geral'
          },
          createdAt: serverTimestamp()
        });
      } else if (action === 'blocked') {
        await setDoc(doc(db, 'blocks', `${auth.currentUser.uid}_${fromUserId}`), {
          blockedBy: auth.currentUser.uid,
          blockedUser: fromUserId,
          createdAt: serverTimestamp()
        });
      }
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (error) {
      console.error("Error handling action:", error);
    }
  };

  const togglePermission = async (connectionId: string, type: 'showPhone' | 'showEmail', currentValue: boolean) => {
    if (!auth.currentUser) return;
    try {
      const connRef = doc(db, 'connections', connectionId);
      const connDoc = await getDoc(connRef);
      if (connDoc.exists()) {
        const permissions = connDoc.data().permissions || {};
        const myPermissions = permissions[auth.currentUser.uid] || {};
        
        await updateDoc(connRef, {
          [`permissions.${auth.currentUser.uid}`]: {
            ...myPermissions,
            [type]: !currentValue
          }
        });
      }
    } catch (error) {
      console.error("Error toggling permission:", error);
    }
  };

  const toggleBothPermissions = async (connectionId: string, currentPhone: boolean, currentEmail: boolean) => {
    if (!auth.currentUser) return;
    try {
      const connRef = doc(db, 'connections', connectionId);
      const connDoc = await getDoc(connRef);
      if (connDoc.exists()) {
        const permissions = connDoc.data().permissions || {};
        const myPermissions = permissions[auth.currentUser.uid] || {};
        
        const newValue = !(currentPhone || currentEmail);
        
        await updateDoc(connRef, {
          [`permissions.${auth.currentUser.uid}`]: {
            ...myPermissions,
            showPhone: newValue,
            showEmail: newValue
          }
        });
      }
    } catch (error) {
      console.error("Error toggling permissions:", error);
    }
  };

  const handleAddCategory = async () => {
    if (!auth.currentUser) return;
    const name = newCategoryName.trim();
    if (!name) return;
    
    const currentCategories = myProfile?.friendCategories || [];
    if (currentCategories.length >= 10) {
      alert("Você só pode adicionar até 10 categorias.");
      return;
    }
    if (currentCategories.some((c: string) => c.toLowerCase() === name.toLowerCase())) {
      alert("Esta categoria já existe.");
      return;
    }
    if (name.toLowerCase() === 'geral') {
      alert("A categoria 'Geral' já é o padrão.");
      return;
    }
    
    try {
      const updated = [...currentCategories, name];
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        friendCategories: updated
      });
      setNewCategoryName('');
    } catch (error) {
      console.error("Error adding category:", error);
    }
  };

  const handleRemoveCategory = async (name: string) => {
    if (!auth.currentUser) return;
    const confirmDelete = window.confirm(`Tem certeza que deseja excluir a categoria "${name}"? Os amigos nesta categoria voltarão para "Geral".`);
    if (!confirmDelete) return;

    try {
      const currentCategories = myProfile?.friendCategories || [];
      const updated = currentCategories.filter((c: string) => c !== name);
      
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        friendCategories: updated
      });
      
      if (selectedFilterCategory === name) {
        setSelectedFilterCategory('all');
      }
    } catch (error) {
      console.error("Error removing category:", error);
    }
  };

  const handleUpdateFriendCategory = async (connectionId: string, category: string) => {
    if (!auth.currentUser) return;
    try {
      const connRef = doc(db, 'connections', connectionId);
      await updateDoc(connRef, {
        [`categories.${auth.currentUser.uid}`]: category || 'Geral'
      });
    } catch (error) {
      console.error("Error updating friend category:", error);
    }
  };

  // Helper to remove accents for robust searching
  const removeAccents = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  };

  // Filter connections list by selected category & search query
  const filteredConnections = connections.filter(conn => {
    // 1. Category Filter
    const assignedCat = conn.categories?.[auth.currentUser!.uid] || 'Geral';
    const matchesCategory = selectedFilterCategory === 'all' || assignedCat === selectedFilterCategory;
    if (!matchesCategory) return false;

    // 2. Search Query Filter (nome or apelido)
    if (!searchQuery.trim()) return true;
    const qNormalized = removeAccents(searchQuery);
    const nomeNormalized = removeAccents(conn.profile?.nome || '');
    const apelidoNormalized = removeAccents(conn.profile?.apelido || '');
    return nomeNormalized.includes(qNormalized) || apelidoNormalized.includes(qNormalized);
  });

  return (
    <div className="flex flex-col font-sans p-4 pb-20 max-w-4xl mx-auto w-full overflow-x-hidden">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Painel de Amigos</h2>
      
      <div className="flex flex-col sm:flex-row bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-6 gap-1">
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${activeTab === 'friends' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
        >
          Meus Amigos
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${activeTab === 'requests' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
        >
          Solicitações
        </button>
        <button
          onClick={() => setActiveTab('views')}
          className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${activeTab === 'views' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
        >
          Visitas ao Perfil
        </button>
      </div>
      
      {loading ? (
        <div className="text-center py-8 text-slate-400">Carregando...</div>
      ) : activeTab === 'requests' ? (
        requests.length === 0 ? (
          <div className="text-center py-12 text-slate-400 flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
               <User className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="dark:text-slate-400">Nenhuma solicitação pendente.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(req => (
              <div key={req.id} className="bg-white dark:bg-slate-850 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-750">
                <div className="flex items-center gap-4 mb-4">
                  <Link to={`/profile/${req.fromUserId}`} className="shrink-0">
                    <CachedLazyImage 
                      src={req.profile.fotoPrincipalUrl || ''} 
                      alt={req.profile.nome || 'Foto de Perfil'} 
                      className="w-16 h-16 rounded-full object-cover border-2 border-slate-50 dark:border-slate-800 shadow-sm" 
                      fallbackSeed={req.fromUserId} 
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/profile/${req.fromUserId}`} className="block">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate">{req.profile.apelido || req.profile.nome}, {req.profile.idade}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{req.profile.bio}</p>
                    </Link>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button 
                    onClick={() => handleAction(req.id, req.fromUserId, 'accepted')}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 py-2 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Check className="w-4 h-4 shrink-0" /> <span className="truncate">Aceitar</span>
                  </button>
                  <button 
                    onClick={() => handleAction(req.id, req.fromUserId, 'later')}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 py-2 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Clock className="w-4 h-4 shrink-0" /> <span className="truncate">Mais tarde</span>
                  </button>
                  <button 
                    onClick={() => handleAction(req.id, req.fromUserId, 'rejected')}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 py-2 rounded-xl text-xs font-bold transition-colors"
                  >
                    <X className="w-4 h-4 shrink-0" /> <span className="truncate">Não Aceitar</span>
                  </button>
                  <button 
                    onClick={() => handleAction(req.id, req.fromUserId, 'blocked')}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-800 dark:bg-zinc-700 text-white hover:bg-zinc-900 dark:hover:bg-zinc-600 py-2 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Ban className="w-4 h-4 shrink-0" /> <span className="truncate">Bloquear</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeTab === 'views' ? (
        profileViews.length === 0 ? (
          <div className="text-center py-12 text-slate-400 flex flex-col items-center bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
               <User className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="dark:text-slate-400 font-semibold">Ninguém visualizou seu perfil ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {profileViews.map(view => {
              const ts = view.timestamp?.toMillis ? view.timestamp.toMillis() : (typeof view.timestamp === 'number' ? view.timestamp : Date.now());
              return (
                <Link 
                  key={view.id}
                  to={`/profile/${view.visitorId}`}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center hover:shadow-md hover:border-indigo-100 dark:hover:border-slate-700 transition-all duration-200 group relative"
                >
                  <div className="relative mb-2.5 shrink-0">
                    <CachedLazyImage 
                      src={view.profile.fotoPrincipalUrl || ''} 
                      alt={view.profile.nome || 'Foto de Perfil'} 
                      className="w-18 h-18 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-slate-50 dark:border-slate-800 shadow-sm group-hover:scale-105 transition-transform duration-200 animate-fade-in" 
                      fallbackSeed={view.visitorId} 
                    />
                  </div>
                  <div className="w-full min-w-0 flex flex-col items-center">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight truncate w-full">
                      {view.profile.apelido || view.profile.nome}
                      {view.profile.idade ? `, ${view.profile.idade}` : ''}
                    </h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate w-full mt-0.5 mb-2 h-4">
                      {view.profile.bio || 'Visualizou seu perfil'}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-extrabold px-2 py-0.5 rounded-md w-fit">
                      <Clock className="w-3 h-3" /> {formatTime(ts)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )
      ) : (
        <>
          {/* Search Input */}
          {connections.length > 0 && (
            <div className="mb-4 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4.5 w-4.5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Pesquisar amigos por nome ou apelido..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-10 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-850 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Categories Filter and Settings Panel */}
          <div className="mb-6 bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-indigo-500" /> Categorias de Amigos
              </h3>
              <button
                onClick={() => setIsManagingCategories(!isManagingCategories)}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3 py-1.5 rounded-lg transition-colors w-full sm:w-auto justify-center sm:justify-start"
              >
                <Settings className="w-3.5 h-3.5" />
                {isManagingCategories ? 'Fechar' : 'Gerenciar'}
              </button>
            </div>

            {/* Manage Categories Form */}
            {isManagingCategories && (
              <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-850">
                <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                  Adicionar Nova Categoria (Até 10: {(myProfile?.friendCategories || []).length}/10)
                </h4>
                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Ex: Faculdade, Trabalho, Futebol..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    maxLength={20}
                    className="flex-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleAddCategory}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Criar
                  </button>
                </div>

                {/* List existing custom categories */}
                {(myProfile?.friendCategories || []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(myProfile?.friendCategories || []).map((cat: string) => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg text-xs font-bold border border-indigo-100/50 dark:border-indigo-900/50"
                      >
                        {cat}
                        <button
                          onClick={() => handleRemoveCategory(cat)}
                          className="hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500">Nenhuma categoria personalizada criada.</p>
                )}
              </div>
            )}

            {/* Wrap Category Pills Filter */}
            <div className="flex flex-wrap gap-2 pb-1">
              <button
                onClick={() => setSelectedFilterCategory('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border shrink-0 transition-all ${
                  selectedFilterCategory === 'all'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Todos ({connections.length})
              </button>
              <button
                onClick={() => setSelectedFilterCategory('Geral')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border shrink-0 transition-all ${
                  selectedFilterCategory === 'Geral'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Geral ({connections.filter(c => (c.categories?.[auth.currentUser!.uid] || 'Geral') === 'Geral').length})
              </button>
              {(myProfile?.friendCategories || []).map((cat: string) => {
                const count = connections.filter(c => c.categories?.[auth.currentUser!.uid] === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedFilterCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border shrink-0 transition-all ${
                      selectedFilterCategory === cat
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {filteredConnections.length === 0 ? (
            <div className="text-center py-12 text-slate-400 flex flex-col items-center bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                 {searchQuery ? (
                   <Search className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                 ) : (
                   <User className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                 )}
              </div>
              {searchQuery ? (
                <>
                  <p className="dark:text-slate-400 font-semibold break-words">Nenhum amigo encontrado para "{searchQuery}".</p>
                  <p className="text-xs mt-2 text-slate-450 dark:text-slate-500">Verifique a grafia ou tente buscar por outro termo.</p>
                </>
              ) : (
                <p className="dark:text-slate-400">Nenhum amigo nesta categoria.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredConnections.map(conn => {
                const myPermissions = conn.permissions?.[auth.currentUser!.uid] || { showPhone: false, showEmail: false };
                const assignedCat = conn.categories?.[auth.currentUser!.uid] || 'Geral';
                const online = isUserOnline(conn.friendId);
                
                return (
                  <div key={conn.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-4 mb-4">
                      <Link to={`/profile/${conn.friendId}`} className="shrink-0 relative">
                        <CachedLazyImage 
                          src={conn.profile.fotoPrincipalUrl || ''} 
                          alt={conn.profile.nome || 'Foto de Perfil'} 
                          className="w-16 h-16 rounded-full object-cover border-2 border-slate-50 dark:border-slate-800 shadow-sm" 
                          fallbackSeed={conn.friendId} 
                        />
                        <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 shadow-sm ${online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/profile/${conn.friendId}`} className="block">
                          <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-2">
                            <span className="truncate">{conn.profile.apelido || conn.profile.nome}, {conn.profile.idade}</span>
                            {isRecentConnection(conn.createdAt) && (
                              <span className="inline-flex items-center gap-0.5 bg-rose-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-sm animate-pulse uppercase tracking-wider shrink-0">
                                <Sparkles className="w-2.5 h-2.5" /> Novo
                              </span>
                            )}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-[60%]">{conn.profile.bio}</p>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className={`text-[10px] font-semibold shrink-0 ${online ? 'text-emerald-500' : 'text-slate-400'}`}>
                              {getLastSeenText(conn.friendId)}
                            </span>
                          </div>
                        </Link>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Dropdown to change category */}
                      <div className="flex-1 w-full md:w-auto">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Categoria de Amigo:</label>
                        <div className="relative">
                          <select
                            value={assignedCat}
                            onChange={(e) => handleUpdateFriendCategory(conn.id, e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none pr-8 cursor-pointer"
                          >
                            <option value="Geral">Geral</option>
                            {(myProfile?.friendCategories || []).map((cat: string) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                      
                      {/* Phone / Email visibility */}
                      <div className="flex-1 w-full md:w-auto">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Permissão para ver meus contatos:</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button 
                            onClick={() => toggleBothPermissions(conn.id, myPermissions.showPhone, myPermissions.showEmail)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-colors border ${(myPermissions.showPhone || myPermissions.showEmail) ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
                          >
                            <Phone className="w-3.5 h-3.5 shrink-0" /> 
                            <span className="truncate">{(myPermissions.showPhone || myPermissions.showEmail) ? 'Ocultar N. Whatsapp e e-mail' : 'Liberar N. Whatsapp e e-mail'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
