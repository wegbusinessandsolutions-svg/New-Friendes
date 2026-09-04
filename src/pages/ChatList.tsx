import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Link } from 'react-router-dom';
import { MessageCircle, User, Tag, Search, X } from 'lucide-react';
import CachedLazyImage from '../components/CachedLazyImage';

interface ChatConnection {
  id: string; // The friend's UID
  profile: any;
  connectionId: string;
  categories?: Record<string, string>;
  createdAt?: number;
}

export default function ChatList({ onLoadStart, onLoadEnd }: { onLoadStart?: () => void, onLoadEnd?: () => void } = {}) {
  const [connections, setConnections] = useState<ChatConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [userStatuses, setUserStatuses] = useState<Record<string, { status: string; lastActive: number }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [recentInteractions, setRecentInteractions] = useState<Record<string, boolean>>({});
  const [chatData, setChatData] = useState<Record<string, { lastMessageAt: number }>>({});
  
  // Categories states
  const [myProfile, setMyProfile] = useState<any>(null);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('all');

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'chats'),
      where('participantes', 'array-contains', auth.currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recent: Record<string, boolean> = {};
      const chats: Record<string, { lastMessageAt: number }> = {};
      const now = Date.now();
      snapshot.forEach(doc => {
        const d = doc.data();
        const friendId = d.participantes.find((p: string) => p !== auth.currentUser!.uid);
        if (friendId) {
          if (d.ultimaMensagemEm) {
            chats[friendId] = {
              lastMessageAt: d.ultimaMensagemEm
            };
            if (now - d.ultimaMensagemEm < 900000) {
              recent[friendId] = true;
            }
          }
        }
      });
      setRecentInteractions(recent);
      setChatData(chats);
    }, (err) => {
      console.error("Error fetching chats for recent interactions:", err);
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  // Real-time listener for current user's profile/categories
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
    if (onLoadStart) onLoadStart();

    const q = query(
      collection(db, 'connections'),
      where('users', 'array-contains', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const conns: ChatConnection[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        const friendId = data.users.find((u: string) => u !== auth.currentUser!.uid);
        if (friendId) {
          const userDoc = await getDoc(doc(db, 'users', friendId));
          if (userDoc.exists()) {
            conns.push({
              id: friendId,
              connectionId: d.id,
              profile: userDoc.data().profile || {},
              createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
              categories: data.categories || {}
            });
          }
        }
      }
      setConnections(conns);
      setLoading(false);
      if (onLoadEnd) onLoadEnd();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'connections');
      if (onLoadEnd) onLoadEnd();
    });

    return () => unsubscribe();
  }, [onLoadStart, onLoadEnd]);

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
  }, [auth.currentUser]);

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

  const formatLastMessageDate = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d atrás`;
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  // Helper to get assigned category for a connection
  const getConnectionCategory = (conn: ChatConnection) => {
    if (!auth.currentUser) return 'Geral';
    return conn.categories?.[auth.currentUser.uid] || 'Geral';
  };

  // Helper to remove accents for robust searching
  const removeAccents = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  };

  // Filter connections by selected category and search query
  const filteredConnections = connections.filter(conn => {
    // 1. Filter by category
    const matchesCategory = selectedFilterCategory === 'all' || getConnectionCategory(conn) === selectedFilterCategory;
    if (!matchesCategory) return false;

    // 2. Filter by search query (nome or apelido)
    if (!searchQuery.trim()) return true;
    const qNormalized = removeAccents(searchQuery);
    const nomeNormalized = removeAccents(conn.profile?.nome || '');
    const apelidoNormalized = removeAccents(conn.profile?.apelido || '');
    return nomeNormalized.includes(qNormalized) || apelidoNormalized.includes(qNormalized);
  }).sort((a, b) => {
    const timeA = chatData[a.id]?.lastMessageAt || a.createdAt || 0;
    const timeB = chatData[b.id]?.lastMessageAt || b.createdAt || 0;
    return timeB - timeA;
  });

  return (
    <div className="flex flex-col font-sans p-4 pb-20 max-w-md mx-auto w-full">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-indigo-500" /> Bate-papo
      </h2>

      {/* Search Input */}
      {!loading && connections.length > 0 && (
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

      {/* Category Pills Filter list */}
      {!loading && connections.length > 0 && (
        <div className="mb-6 bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <Tag className="w-3.5 h-3.5 text-indigo-500" /> Filtrar por Categoria
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
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
              Geral ({connections.filter(c => getConnectionCategory(c) === 'Geral').length})
            </button>
            {(myProfile?.friendCategories || []).map((cat: string) => {
              const count = connections.filter(c => getConnectionCategory(c) === cat).length;
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
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-400">Carregando conexões...</div>
      ) : connections.length === 0 ? (
        <div className="text-center py-12 text-slate-400 flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
             <User className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          </div>
          <p className="dark:text-slate-400">Você ainda não tem amigos para conversar.</p>
          <p className="text-xs mt-2 text-slate-400 dark:text-slate-500">Suas conexões aprovadas aparecerão aqui.</p>
        </div>
      ) : filteredConnections.length === 0 ? (
        <div className="text-center py-12 text-slate-400 flex flex-col items-center bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
             {searchQuery ? (
               <Search className="w-8 h-8 text-slate-300 dark:text-slate-600" />
             ) : (
               <Tag className="w-8 h-8 text-slate-300 dark:text-slate-600" />
             )}
          </div>
          {searchQuery ? (
            <>
              <p className="dark:text-slate-400 font-semibold">Nenhum amigo encontrado para "{searchQuery}".</p>
              <p className="text-xs mt-2 text-slate-450 dark:text-slate-500">Verifique a grafia ou tente buscar por outro termo.</p>
            </>
          ) : (
            <>
              <p className="dark:text-slate-400">Nenhum amigo encontrado na categoria "{selectedFilterCategory}".</p>
              <p className="text-xs mt-2 text-slate-400 dark:text-slate-500">Classifique algum amigo nesta categoria no painel de amigos.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredConnections.map(conn => {
            const chatId = [auth.currentUser!.uid, conn.id].sort().join('_');
            const online = isUserOnline(conn.id);
            const assignedCat = getConnectionCategory(conn);
            
            return (
              <Link 
                to={`/chat/${chatId}`} 
                key={conn.id} 
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4 hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors"
              >
                <div className={`shrink-0 relative rounded-full ${(recentInteractions[conn.id] || (conn.createdAt && (Date.now() - conn.createdAt < 900000))) ? 'ring-4 ring-indigo-500/50 animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.6)]' : ''}`}>
                  <CachedLazyImage 
                    src={conn.profile.fotoPrincipalUrl || ''} 
                    alt={conn.profile.nome || 'Foto de Perfil'} 
                    className="w-16 h-16 aspect-square rounded-full object-cover border-2 border-slate-100 dark:border-slate-800 shadow-sm animate-fade-in" 
                    fallbackSeed={conn.id} 
                    style={{ aspectRatio: '1/1', width: '64px', height: '64px', borderRadius: '50%' }}
                  />
                  <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 shadow-sm ${online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{conn.profile.apelido || conn.profile.nome}</h3>
                    <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-indigo-100/50 dark:border-indigo-900/50">
                      <Tag className="w-2.5 h-2.5" />
                      {assignedCat}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className={`text-xs font-semibold truncate ${online ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {getLastSeenText(conn.id)}
                    </p>
                    {chatData[conn.id]?.lastMessageAt && (
                      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        Última interação: {formatLastMessageDate(chatData[conn.id].lastMessageAt)}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
