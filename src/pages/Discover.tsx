import { getDemonym } from '../lib/demonyms';
import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import CachedLazyImage from '../components/CachedLazyImage';

import { MapPin, SlidersHorizontal, Flame, UserPlus, Users, ChevronDown, CheckCircle, X, ShieldCheck, Search, Tag, Filter, Ban, Heart, MessageCircle } from 'lucide-react';
import { doc, setDoc, updateDoc, serverTimestamp, getDoc, collection, query, onSnapshot, addDoc } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';

export interface NearbyUser {
  userId: string;
  distance: string;
  profile: any;
  distanceValue?: number;
  idVerified?: boolean;
  status?: 'online' | 'offline' | 'invisivel';
  lastActive?: number;
}

export const MOCK_USERS: NearbyUser[] = [
  {
    userId: 'mock1',
    distance: '150m',
    distanceValue: 150,
    idVerified: true,
    profile: { nome: 'Ana', apelido: 'Aninha', idade: 25, sexo: 'feminino', bio: 'Adoro viajar e conhecer pessoas novas!', estadoNascimento: 'Goiás', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80', facialVerified: true, verified: true, hobbies: ['Viagens', 'Fotografia', 'Música'] }
  },
  {
    userId: 'mock2',
    distance: '300m',
    distanceValue: 300,
    profile: { nome: 'Carlos', apelido: 'Carlinhos', idade: 28, sexo: 'masculino', bio: 'Bora tomar uma?', estadoNascimento: 'Mato Grosso', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80', hobbies: ['Futebol', 'Churrasco', 'Cerveja'] }
  },
  {
    userId: 'mock3',
    distance: '450m',
    distanceValue: 450,
    idVerified: true,
    profile: { nome: 'Beatriz', apelido: 'Bia', idade: 31, sexo: 'feminino', bio: 'Sempre em busca de boas risadas', estadoNascimento: 'Mato Grosso do Sul', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80', facialVerified: true, hobbies: ['Cinema', 'Livros', 'Café'] }
  },
  {
    userId: 'mock4',
    distance: '750m',
    distanceValue: 750,
    profile: { nome: 'Marcos', apelido: 'Marcão', idade: 35, sexo: 'masculino', bio: 'Fã de esportes e natureza', estadoNascimento: 'Distrito Federal', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80', facialVerified: true, verified: true, hobbies: ['Esportes', 'Trilhas', 'Natureza'] }
  },
  {
    userId: 'mock5',
    distance: '1,2km',
    distanceValue: 1200,
    profile: { nome: 'Camila', apelido: 'Cami', idade: 38, sexo: 'feminino', bio: 'Fotografia e vinhos', estadoNascimento: 'São Paulo', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80', hobbies: ['Fotografia', 'Vinhos', 'Artes'] }
  },
  {
    userId: 'mock6',
    distance: '1,8km',
    distanceValue: 1800,
    idVerified: true,
    profile: { nome: 'Roberto', apelido: 'Beto', idade: 41, sexo: 'masculino', bio: 'Vida leve', estadoNascimento: 'Rio de Janeiro', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80', facialVerified: true, hobbies: ['Yoga', 'Meditação', 'Praia'] }
  },
  {
    userId: 'mock7',
    distance: '2,3km',
    distanceValue: 2300,
    profile: { nome: 'Fernanda', apelido: 'Fê', idade: 45, sexo: 'feminino', bio: 'Cinema e pipoca', estadoNascimento: 'Minas Gerais', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80', hobbies: ['Cinema', 'Séries', 'Culinária'] }
  },
  {
    userId: 'mock8',
    distance: '2,9km',
    distanceValue: 2900,
    profile: { nome: 'Sérgio', apelido: 'Serginho', idade: 50, sexo: 'masculino', bio: 'Caminhadas pelo parque', estadoNascimento: 'Espírito Santo', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80', hobbies: ['Caminhada', 'Parques', 'Leitura'] }
  },
  {
    userId: 'mock9',
    distance: '3,5km',
    distanceValue: 3500,
    profile: { nome: 'Mônica', apelido: 'Môni', idade: 55, sexo: 'feminino', bio: 'Amo animais e a natureza', estadoNascimento: 'Bahia', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80', hobbies: ['Animais', 'Plantas', 'Natureza'] }
  },
  {
    userId: 'mock10',
    distance: '4,1km',
    distanceValue: 4100,
    profile: { nome: 'Bruno', apelido: 'Bruninho', idade: 23, sexo: 'masculino', bio: 'Jogador de basquete nas horas vagas', estadoNascimento: 'Pernambuco', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80', hobbies: ['Basquete', 'Games', 'Música'] }
  },
  {
    userId: 'mock11',
    distance: '4,8km',
    distanceValue: 4800,
    profile: { nome: 'Juliana', apelido: 'Ju', idade: 27, sexo: 'feminino', bio: 'Apaixonada por culinária e café', estadoNascimento: 'Ceará', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80', facialVerified: true, hobbies: ['Culinária', 'Café', 'Doces'] }
  },
  {
    userId: 'mock12',
    distance: '5,5km',
    distanceValue: 5500,
    profile: { nome: 'Daniel', apelido: 'Dani', idade: 30, sexo: 'masculino', bio: 'Desenvolvedor, músico e viciado em podcast', estadoNascimento: 'Maranhão', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=400&q=80', hobbies: ['Tecnologia', 'Música', 'Podcasts'] }
  },
  {
    userId: 'mock13',
    distance: '6,2km',
    distanceValue: 6200,
    profile: { nome: 'Amanda', apelido: 'Amy', idade: 29, sexo: 'feminino', bio: 'Pratico yoga e amo o pôr do sol', estadoNascimento: 'Paraíba', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&q=80', facialVerified: true, hobbies: ['Yoga', 'Praia', 'Meditação'] }
  },
  {
    userId: 'mock14',
    distance: '7,1km',
    distanceValue: 7100,
    profile: { nome: 'Lucas', apelido: 'Luquinhas', idade: 32, sexo: 'masculino', bio: 'Gosto de acampar e tocar violão', estadoNascimento: 'Rio Grande do Norte', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80', hobbies: ['Camping', 'Violão', 'Música'] }
  },
  {
    userId: 'mock15',
    distance: '8,0km',
    distanceValue: 8000,
    profile: { nome: 'Patrícia', apelido: 'Patty', idade: 34, sexo: 'feminino', bio: 'Arquiteta, adoro museus e exposições', estadoNascimento: 'Alagoas', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&q=80', hobbies: ['Artes', 'Design', 'Museus'] }
  },
  {
    userId: 'mock16',
    distance: '9,2km',
    distanceValue: 9200,
    profile: { nome: 'Thiago', apelido: 'Thi', idade: 26, sexo: 'masculino', bio: 'Gosto de correr e ler bons livros', estadoNascimento: 'Piauí', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80', hobbies: ['Corrida', 'Livros', 'Caminhada'] }
  },
  {
    userId: 'mock17',
    distance: '10,5km',
    distanceValue: 10500,
    profile: { nome: 'Gabriela', apelido: 'Gabi', idade: 33, sexo: 'feminino', bio: 'Apaixonada por trilhas e praia', estadoNascimento: 'Sergipe', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=400&q=80', hobbies: ['Trilhas', 'Praia', 'Surf'] }
  },
  {
    userId: 'mock18',
    distance: '12,5km',
    distanceValue: 12500,
    profile: { nome: 'Felipe', apelido: 'Lipe', idade: 24, sexo: 'masculino', bio: 'Amante de tecnologia e novos gadgets', estadoNascimento: 'Amazonas', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=400&q=80', hobbies: ['Tecnologia', 'Games', 'Música'] }
  },
  {
    userId: 'mock19',
    distance: '15,0km',
    distanceValue: 15000,
    profile: { nome: 'Letícia', apelido: 'Lelê', idade: 22, sexo: 'feminino', bio: 'Estudante de design, amo ilustrações', estadoNascimento: 'Pará', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400&q=80', hobbies: ['Design', 'Ilustração', 'Artes'] }
  },
  {
    userId: 'mock20',
    distance: '18,5km',
    distanceValue: 18500,
    profile: { nome: 'Rodrigo', apelido: 'Rod', idade: 36, sexo: 'masculino', bio: 'Cozinheiro amador e fã de rock clássico', estadoNascimento: 'Tocantins', fotoPrincipalUrl: 'https://images.unsplash.com/photo-1489980508314-941910ded1f4?w=400&q=80', hobbies: ['Culinária', 'Rock', 'Música'] }
  }
];

export const POPULAR_INTERESTS = [
  'Viagens', 'Fotografia', 'Música', 'Esportes', 'Vinhos', 'Yoga', 'Cinema', 'Natureza', 'Tecnologia', 'Café', 'Culinária', 'Artes', 'Leitura', 'Games'
];

export default function Discover({ onInitialLoadStart, onInitialLoadEnd }: { onInitialLoadStart?: () => void, onInitialLoadEnd?: () => void } = {}) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(auth.currentUser);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchUser, setMatchUser] = useState<NearbyUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (onInitialLoadStart) {
      onInitialLoadStart();
    }
  }, [onInitialLoadStart]);

  const [radius, setRadius] = useState<number>(() => {
    const saved = localStorage.getItem('search_radius');
    return saved ? Number(saved) : 5000;
  });
  const [genderFilter, setGenderFilter] = useState('todos');
  const [ageFilter, setAgeFilter] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [tempRadius, setTempRadius] = useState<number>(radius);
  const [tempGender, setTempGender] = useState<string>(genderFilter);
  const [tempAge, setTempAge] = useState<string>(ageFilter);
  const [tempInterests, setTempInterests] = useState<string[]>(selectedInterests);

  // Sync temp states whenever Advanced Filters panel is opened
  useEffect(() => {
    if (showAdvancedFilters) {
      setTempRadius(radius);
      setTempGender(genderFilter);
      setTempAge(ageFilter);
      setTempInterests(selectedInterests);
    }
  }, [showAdvancedFilters]);
  const [users, setUsers] = useState<NearbyUser[]>(MOCK_USERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentUserNickname, setCurrentUserNickname] = useState('');
  const [isCurrentUserVerified, setIsCurrentUserVerified] = useState<boolean | null>(null);
  const [userStatus, setUserStatus] = useState<'online' | 'offline' | 'invisivel'>('online');
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [showGeoModal, setShowGeoModal] = useState(false);

  // Sync radius changes to localStorage
  useEffect(() => {
    localStorage.setItem('search_radius', radius.toString());
  }, [radius]);

  // Determine status color of each card based on availability status and distance range
  const getCardStatusColor = (u: NearbyUser) => {
    if (u.status === 'offline') {
      return 'bg-slate-400'; // Gray (Offline)
    }
    if (u.distanceValue !== undefined && u.distanceValue > 50000 && u.distanceValue !== Infinity) {
      return 'bg-slate-400'; // Gray (Offline / Fora do limite do app)
    }
    if (u.distanceValue !== undefined && u.distanceValue > radius && u.distanceValue !== Infinity) {
      return 'bg-slate-400'; // Gray (Fora de alcance)
    }
    
    // Fallback to profile availability status
    const status = u.profile?.statusBolinha || 'disponivel';
    if (status === 'indisponivel') return 'bg-rose-500'; // Red
    if (status === 'restricoes') return 'bg-amber-500'; // Yellow
    if (!isUserOnline(u)) return 'bg-slate-400'; // Gray (Offline)
    return 'bg-emerald-400 animate-pulse'; // Green (Disponível & Online)
  };

  const getCardStatusLabel = (u: NearbyUser) => {
    if (u.status === 'offline') {
      return 'Offline';
    }
    if (u.distanceValue !== undefined && u.distanceValue > 50000 && u.distanceValue !== Infinity) {
      return 'Offline';
    }
    if (u.distanceValue !== undefined && u.distanceValue > radius && u.distanceValue !== Infinity) {
      return 'Fora de alcance';
    }
    const status = u.profile?.statusBolinha || 'disponivel';
    if (status === 'indisponivel') return 'Não Disponível';
    if (status === 'restricoes') return 'Restrições';
    if (!isUserOnline(u)) return 'Offline';
    return 'Disponível';
  };

  const isUserOnline = (u: NearbyUser) => {
    if (u.status === 'offline') return false;
    if (!u.lastActive || u.status !== 'online') return false;
    return Date.now() - u.lastActive < 120000;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [radius, genderFilter, ageFilter, searchQuery, selectedInterests]);

  const handleStatusChange = async (newStatus: 'online' | 'offline' | 'invisivel') => {
    setUserStatus(newStatus);
    setIsStatusMenuOpen(false);
    if (!auth.currentUser) return;
    try {
      const timestamp = Date.now();
      await setDoc(doc(db, 'locations', auth.currentUser.uid), {
        status: newStatus,
        visivel: newStatus === 'online'
      }, { merge: true });

      // Save status change to location history
      await addDoc(collection(db, 'locations', auth.currentUser.uid, 'history'), {
        tipo: 'alteracao_status',
        status: newStatus,
        timestamp: timestamp
      });
    } catch (err) {
      console.error('Error updating status', err);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const [currentUserCoords, setCurrentUserCoords] = useState<{lat: number, lng: number} | null>(null);

  const fetchNearby = async (isSilent = false, customCoords?: {lat: number, lng: number}) => {
    if (!auth.currentUser) return;
    if (!isSilent) {
      setLoading(true);
    }
    setError('');
    try {
      const { getDocs, collection, query, where, doc, getDoc } = await import('firebase/firestore');
      
      let coords = customCoords || currentUserCoords;
      if (!coords) {
        const myLocDoc = await getDoc(doc(db, 'locations', auth.currentUser.uid));
        if (myLocDoc.exists()) {
          const d = myLocDoc.data();
          if (d.lat && d.lng) {
            coords = { lat: d.lat, lng: d.lng };
            setCurrentUserCoords(coords);
          }
        }
      }
      if (!coords) {
        return;
      }

      // Fetch all visible locations
      const locsQuery = query(collection(db, 'locations'), where('visivel', '==', true));
      const locsSnap = await getDocs(locsQuery);

      // Fetch blocked users
      const blockedIds = new Set<string>();
      try {
        const blockedByMeQuery = query(collection(db, 'blocks'), where('blockedBy', '==', auth.currentUser.uid));
        const blockedByMeSnap = await getDocs(blockedByMeQuery);
        blockedByMeSnap.docs.forEach(d => {
          const uId = d.data().blockedUser;
          if (uId) blockedIds.add(uId);
        });
      } catch (err) {
        console.warn('Could not fetch blockedByMe list:', err);
      }

      try {
        const blockedMeQuery = query(collection(db, 'blocks'), where('blockedUser', '==', auth.currentUser.uid));
        const blockedMeSnap = await getDocs(blockedMeQuery);
        blockedMeSnap.docs.forEach(d => {
          const uId = d.data().blockedBy;
          if (uId) blockedIds.add(uId);
        });
      } catch (err) {
        console.warn('Could not fetch blockedMe list:', err);
      }

      const locsMap: Record<string, { distance: string; distanceValue: number; status: 'online' | 'offline' | 'invisivel'; lastActive: number }> = {};
      const { distanceBetween } = await import('geofire-common');

      for (const docSnap of locsSnap.docs) {
        const locData = docSnap.data();
        if (blockedIds.has(docSnap.id)) continue;
        if (!locData.lat || !locData.lng) continue;

        const distanceInKm = distanceBetween([locData.lat, locData.lng], [coords.lat, coords.lng]);
        const distanceInM = distanceInKm * 1000;
        const displayDistance = `${distanceInKm.toFixed(2).replace('.', ',')} km`;

        locsMap[docSnap.id] = {
          distance: displayDistance,
          distanceValue: distanceInM,
          status: (locData.status as any) || 'online',
          lastActive: locData.atualizadoEm || 0,
        };
      }

      // Fetch all public profiles
      const usersSnap = await getDocs(collection(db, 'users'));
      const realUsers = [];

      for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        if (userId === auth.currentUser.uid) continue;
        if (blockedIds.has(userId)) continue;

        const data = userDoc.data();
        if (data?.status?.ativo && !data?.status?.banido && data?.ocultarPerfil !== true) {
          const loc = locsMap[userId];
          if (loc) {
            realUsers.push({
              userId,
              distance: loc.distance,
              distanceValue: loc.distanceValue,
              idVerified: data?.idVerified || false,
              status: loc.status,
              lastActive: loc.lastActive,
              profile: {
                ...data?.profile,
                verified: data?.verified
              }
            });
          } else {
            // Include offline/non-active user so they can be searched by name
            realUsers.push({
              userId,
              distance: 'Offline',
              distanceValue: Infinity,
              idVerified: data?.idVerified || false,
              status: 'offline' as const,
              lastActive: 0,
              profile: {
                ...data?.profile,
                verified: data?.verified
              }
            });
          }
        }
      }

      const allUsers = [...realUsers].sort((a, b) => {
        const distA = a.distanceValue ?? 999999;
        const distB = b.distanceValue ?? 999999;
        return distA - distB;
      });

      setUsers(allUsers);
    } catch (err: any) {
      console.error('Error fetching nearby users, falling back to mock users:', err);
      // Fallback gracefully to MOCK_USERS to ensure the UI is fully functional even when offline or during DB sync errors
      setUsers(MOCK_USERS);
    } finally {
      if (!isSilent) {
        setLoading(false);
        if (onInitialLoadEnd) {
          onInitialLoadEnd();
        }
      }
    }
  };


  useEffect(() => {
    if (!currentUser) return;
    
    // Try to load cached user nickname and verification status instantly
    try {
      const cacheKey = `user_profile_cache_${currentUser.uid}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
        const profile = cachedData.profile || {};
        setCurrentUserNickname(profile.apelido || profile.nome || cachedData.apelido || cachedData.nome || '');
        setIsCurrentUserVerified(cachedData.idVerified || false);
      }
    } catch (cacheErr) {
      console.error('Error reading user profile cache in Discover:', cacheErr);
    }
    
    // Fetch user profile
    const fetchProfile = async () => {
      try {
        const { getDoc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const uData = userDoc.data();
          setCurrentUserNickname(uData.apelido || uData.nome || uData.profile?.apelido || uData.profile?.nome || '');
          setIsCurrentUserVerified(uData.idVerified || false);
          
          // Save to cache
          try {
            if (uData.batterySaverEnabled !== undefined) {
              localStorage.setItem('battery_saver_enabled', uData.batterySaverEnabled ? 'true' : 'false');
            }
            localStorage.setItem(`user_profile_cache_${currentUser.uid}`, JSON.stringify(uData));
          } catch (cacheErr) {
            console.error('Error writing user profile cache in Discover:', cacheErr);
          }
        }
        
        const locDoc = await getDoc(doc(db, 'locations', currentUser.uid));
        if (locDoc.exists() && locDoc.data().status) {
          setUserStatus(locDoc.data().status);
        } else {
          await setDoc(doc(db, 'locations', currentUser.uid), {
            status: 'online',
            visivel: true
          }, { merge: true });
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    };
    fetchProfile();

    let intervalId: any;
    
    const updatePositionAndFetch = async (isSilent = false) => {
      if (!navigator.geolocation) {
         console.warn('Geolocalização não é suportada neste navegador.');
         fetchNearby(isSilent);
         return;
      }

      if (!isSilent && !localStorage.getItem('geo_alert_shown')) {
         setShowGeoModal(true);
         if (onInitialLoadEnd) onInitialLoadEnd();
         return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentUserCoords({ lat: latitude, lng: longitude });
          const { geohashForLocation } = await import('geofire-common');
          const hash = geohashForLocation([latitude, longitude]);

          
          try {
            const timestamp = Date.now();
            await setDoc(doc(db, 'locations', currentUser.uid), {
              geohash: hash,
              lat: latitude,
              lng: longitude,
              atualizadoEm: timestamp
            }, { merge: true });

            // Record coordinates update to history subcollection
            await addDoc(collection(db, 'locations', currentUser.uid, 'history'), {
              tipo: 'atualizacao_coordenadas',
              lat: latitude,
              lng: longitude,
              timestamp: timestamp
            });
          } catch (e) {
            console.error('Erro ao salvar localização:', e);
          }
          
          fetchNearby(isSilent, { lat: latitude, lng: longitude });
        },
        (err) => {
          console.warn('Geolocation error, falling back to cached or default location:', err);
          fetchNearby(isSilent);
        },
        { 
          enableHighAccuracy: localStorage.getItem('battery_saver_enabled') !== 'true', 
          timeout: 10000, 
          maximumAge: localStorage.getItem('battery_saver_enabled') === 'true' ? 300000 : 60000 
        }
      );
    };
    
    // Initial load - not silent so it displays loading skeletons
    updatePositionAndFetch(false);

    // Refresh dynamically, checking every 10 seconds.
    // If Battery Saver is active, we update every 5 minutes (300000ms), else every 1 minute (60000ms).
    let lastCheckTime = Date.now();
    intervalId = setInterval(() => {
      const isBatterySaver = localStorage.getItem('battery_saver_enabled') === 'true';
      const intervalMs = isBatterySaver ? 300000 : 60000;
      const now = Date.now();
      if (now - lastCheckTime >= intervalMs) {
        lastCheckTime = now;
        updatePositionAndFetch(true);
      }
    }, 10000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line
  }, [showGeoModal, currentUser]);

  useEffect(() => {
    fetchNearby();
    // eslint-disable-next-line
  }, [radius]);

  useEffect(() => {
    if (!currentUser) return;
    
    // Listen to locations collection in real-time to update user online statuses
    const q = query(collection(db, 'locations'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const locMap: Record<string, { status: string; lastActive: number }> = {};
      snapshot.forEach((doc) => {
        const d = doc.data();
        locMap[doc.id] = {
          status: d.status || 'online',
          lastActive: d.atualizadoEm || 0,
        };
      });

      setUsers((prevUsers) =>
        prevUsers.map((u) => {
          if (locMap[u.userId]) {
            return {
              ...u,
              status: locMap[u.userId].status as any,
              lastActive: locMap[u.userId].lastActive,
            };
          }
          return u;
        })
      );
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'locations');
    });

    return () => unsubscribe();
  }, [currentUser]);

  const radiusOptions = [
    50,
    ...Array.from({ length: 20 }, (_, i) => (i + 1) * 100),
    2500,
    ...Array.from({ length: 48 }, (_, i) => (i + 3) * 1000)
  ];

  return (
    <div className="flex flex-col font-sans">
      <div className="bg-white dark:bg-slate-900 p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-sm">
        {currentUserNickname && (
          <div className="mb-4 flex items-center justify-between">
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {getGreeting()}, {currentUserNickname}
            </div>
            <div className="relative">
              <button 
                onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-full text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
              >
                 <span className={`w-2 h-2 rounded-full ${userStatus === 'online' ? 'bg-emerald-500' : userStatus === 'invisivel' ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                 <span className="capitalize">{userStatus === 'invisivel' ? 'Invisível' : userStatus}</span>
                 <ChevronDown className="w-3 h-3" />
              </button>
              
              {isStatusMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-50 overflow-hidden">
                   {(['online', 'offline', 'invisivel'] as const).map(s => (
                     <button
                       key={s}
                       onClick={() => handleStatusChange(s)}
                       className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                     >
                       <span className={`w-2 h-2 rounded-full ${s === 'online' ? 'bg-emerald-500' : s === 'invisivel' ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                       <span className="capitalize">{s === 'invisivel' ? 'Invisível' : s}</span>
                     </button>
                   ))}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex items-start gap-3 mb-4 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 rounded-xl border border-indigo-100/50 dark:border-indigo-900/30">
          <div className="flex items-center -space-x-0.5 p-2 bg-indigo-100 dark:bg-indigo-950 rounded-lg shrink-0 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-600 dark:text-blue-400"><path d="M16 3h5v5"/><path d="m21 3-6.75 6.75"/><circle cx="10" cy="14" r="6"/></svg>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-pink-500"><circle cx="12" cy="9" r="6"/><path d="M12 15v7"/><path d="M9 19h6"/></svg>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-snug">
            Procure por novas conexões locais, conheça o perfil das pessoas ao seu lado.
          </p>
        </div>

        {/* Barra de Busca Avançada & Filtros */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por nome, bio ou interesses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-semibold pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm ${
              showAdvancedFilters || genderFilter !== 'todos' || ageFilter !== 'todos' || selectedInterests.length > 0 || radius !== 5000
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-850 text-indigo-600 dark:text-indigo-400 font-extrabold'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" />
            <span>Filtros</span>
            {(genderFilter !== 'todos' || ageFilter !== 'todos' || selectedInterests.length > 0 || radius !== 5000) && (
              <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></span>
            )}
          </button>
        </div>

        {/* Painel de Filtros Avançados Collapsible */}
        {showAdvancedFilters && (
          <div className="mb-4 bg-slate-50/50 dark:bg-slate-850/40 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-4 space-y-5 animate-fadeIn">
            {/* Raio de busca */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" /> Distância Máxima de Busca (Raio)
                </span>
                <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                  {tempRadius >= 1000 ? `${tempRadius/1000} km`.replace('.', ',') : `${tempRadius} m`}
                </span>
              </div>
              <input 
                type="range" 
                min="0" 
                max={radiusOptions.length - 1} 
                value={radiusOptions.indexOf(tempRadius) !== -1 ? radiusOptions.indexOf(tempRadius) : 0}
                onChange={(e) => setTempRadius(radiusOptions[Number(e.target.value)])}
                className="w-full accent-indigo-600 h-1.5 bg-slate-250 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="relative w-full h-8 mt-1 text-slate-400 dark:text-slate-500 font-medium px-1">
                {radiusOptions.map((opt, i) => {
                  const isLabel = [100, 500, 1000, 5000, 10000, 20000, 30000, 40000, 50000].includes(opt);
                  const leftPercent = (i / (radiusOptions.length - 1)) * 100;
                  
                  if (isLabel) {
                    const text = opt >= 1000 ? `${opt/1000}km`.replace('.', ',') : `${opt}m`;
                    return (
                      <div 
                        key={opt} 
                        className="absolute top-0 text-center cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" 
                        style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
                        onClick={() => setTempRadius(opt)}
                      >
                        <div className="h-1 w-px bg-slate-300 dark:bg-slate-700 mx-auto"></div>
                        <span className="block text-[8px] text-slate-500 mt-0.5">{text}</span>
                      </div>
                    );
                  }
                  
                  return (
                    <div 
                      key={opt} 
                      className="absolute top-0 text-center cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" 
                      style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
                      onClick={() => setTempRadius(opt)}
                    >
                      <span className="block text-slate-300 dark:text-slate-750 font-bold leading-none -mt-1.5">.</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sexo & Idade Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Sexo */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Gênero</span>
                <div className="flex gap-1.5">
                  {['todos', 'masculino', 'feminino'].map(gen => (
                    <button
                      key={gen}
                      onClick={() => setTempGender(gen)}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-colors ${
                        tempGender === gen
                           ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                           : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {gen === 'todos' ? 'Todos' : gen.charAt(0).toUpperCase() + gen.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Idade */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Faixa Etária</span>
                <div className="flex flex-wrap gap-1">
                  {['todos', '18-25', '26-35', '36-44', '45-55', '55-70'].map(age => (
                    <button
                      key={age}
                      onClick={() => setTempAge(age)}
                      className={`px-2 py-1.5 text-[10px] font-bold rounded-lg border transition-colors flex-1 min-w-[45px] ${
                        tempAge === age
                           ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                           : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {age === 'todos' ? 'Todos' : age}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Interesses / Hobbies */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-slate-500" /> Filtrar por Interesses / Hobbies
              </span>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_INTERESTS.map(interest => {
                  const isSelected = tempInterests.includes(interest);
                  return (
                    <button
                      key={interest}
                      onClick={() => {
                        if (isSelected) {
                          setTempInterests(prev => prev.filter(i => i !== interest));
                        } else {
                          setTempInterests(prev => [...prev, interest]);
                        }
                      }}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-full border transition-all duration-150 flex items-center gap-1 cursor-pointer ${
                        isSelected
                           ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600 shadow-sm'
                           : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                      }`}
                    >
                      <span>{interest}</span>
                      {isSelected && <span className="text-[9px] font-bold">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-200/50 dark:border-slate-800/50 flex justify-between items-center gap-4">
              <button
                onClick={() => {
                  setTempRadius(5000);
                  setTempGender('todos');
                  setTempAge('todos');
                  setTempInterests([]);
                  setRadius(5000);
                  setGenderFilter('todos');
                  setAgeFilter('todos');
                  setSearchQuery('');
                  setSelectedInterests([]);
                  setShowAdvancedFilters(false);
                }}
                className="text-[10px] font-bold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Limpar filtros de busca
              </button>

              <button
                onClick={() => {
                  setRadius(tempRadius);
                  setGenderFilter(tempGender);
                  setAgeFilter(tempAge);
                  setSelectedInterests(tempInterests);
                  setShowAdvancedFilters(false);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1 cursor-pointer"
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Verification Reminder Banner */}
        {isCurrentUserVerified === false && (
          <div className="p-4 bg-gradient-to-r from-purple-50 to-fuchsia-50 rounded-2xl border border-purple-100/60 shadow-sm flex flex-col sm:flex-row items-center gap-4">
            <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider">Verificação Pendente</h4>
              <p className="text-xs text-purple-700 font-semibold mt-0.5 leading-relaxed">
                Valide seus documentos pessoais por inteligência artificial para conquistar o selo de confiança <b>Identificação Confirmada</b> e destacar seu perfil!
              </p>
            </div>
            <Link 
              to={`/profile/${auth.currentUser?.uid}?validateDoc=true`}
              className="bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0"
            >
              Validar Documentos
            </Link>
          </div>
        )}

        {error && (
           <div className="bg-red-50 text-red-500 p-3 rounded-xl text-xs border border-red-100 font-medium">
             {error}
           </div>
        )}
        
        {loading ? (
          <div className="animate-pulse space-y-4">
             {[1,2,3].map(i => (
               <div key={i} className="bg-white rounded-2xl p-4 h-32 flex gap-4">
                 <div className="w-20 h-20 rounded-full bg-gray-200 shrink-0"></div>
                 <div className="flex-1 space-y-2 py-2">
                   <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                   <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                 </div>
               </div>
             ))}
          </div>
        ) : (() => {
           const filteredUsers = users.filter(u => {
             // Filter by radius & online status
             // If there is no active search query, only display online/nearby users within selected radius
             if (!searchQuery.trim()) {
               const dist = u.distanceValue ?? 0;
               if (u.status === 'offline') return false;
               if (dist > radius) return false;
             }

             if (genderFilter !== 'todos' && u.profile?.sexo !== genderFilter) return false;

             // Filter by text search query (matches nome, apelido, bio, or hobbies)
             if (searchQuery.trim()) {
               const query = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
               const nome = (u.profile?.nome || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
               const apelido = (u.profile?.apelido || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
               const bio = (u.profile?.bio || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
               const rawHobbies = Array.isArray(u.profile?.hobbies) ? u.profile.hobbies : typeof u.profile?.hobbies === 'string' ? u.profile.hobbies.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                const hobbies = rawHobbies.map((h: string) => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

               const matchesNome = nome.includes(query);
               const matchesApelido = apelido.includes(query);
               const matchesBio = bio.includes(query);
               const matchesHobbies = hobbies.some((h: string) => h.includes(query));

               if (!matchesNome && !matchesApelido && !matchesBio && !matchesHobbies) {
                 return false;
               }
             }

             // Filter by selected interest pills (matches any of the selected interests)
             if (selectedInterests.length > 0) {
               const rawUserHobbies = Array.isArray(u.profile?.hobbies) ? u.profile.hobbies : typeof u.profile?.hobbies === 'string' ? u.profile.hobbies.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                const userHobbies = rawUserHobbies.map((h: string) => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
               const userBio = (u.profile?.bio || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

               const matchesAnyInterest = selectedInterests.some(interest => {
                 const query = interest.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                 const hasInHobbies = userHobbies.some((h: string) => h.includes(query));
                 const hasInBio = userBio.includes(query);
                 return hasInHobbies || hasInBio;
               });

               if (!matchesAnyInterest) {
                 return false;
               }
             }
             if (ageFilter !== 'todos') {
               const age = u.profile?.idade;
               if (!age) return false;
               if (ageFilter === '18-25' && (age < 18 || age > 25)) return false;
               if (ageFilter === '26-35' && (age < 26 || age > 35)) return false;
               if (ageFilter === '36-44' && (age < 36 || age > 44)) return false;
               if (ageFilter === '45-55' && (age < 45 || age > 55)) return false;
               if (ageFilter === '55-70' && (age < 55 || age > 70)) return false;
             }
             return true;
           });

           const totalPages = Math.ceil(filteredUsers.length / 12);
            const paginatedUsers = filteredUsers.slice((currentPage - 1) * 12, currentPage * 12);

            if (filteredUsers.length === 0) {
             return (
               <div className="text-center py-12 text-gray-400">
                 <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MapPin className="w-8 h-8 text-gray-300" />
                 </div>
                 <p>Ninguém encontrado com estes filtros.</p>
                 <p className="text-sm text-slate-500">Tente ajustar as opções ou o raio.</p>
               </div>
             );
           }

           return (
             <div className="flex flex-col">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mb-8">
               {paginatedUsers.map(u => (
                 <div key={u.userId} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col hover:border-indigo-300 dark:hover:border-indigo-850 transition-colors group">
                   <Link to={`/profile/${u.userId}`} className="block relative aspect-[4/5] overflow-hidden">
                     <CachedLazyImage 
                       src={u.profile?.fotoPrincipalUrl || ''} 
                       alt={u.profile?.nome || 'Foto de Perfil'} 
                       className="transition-transform group-hover:scale-105 duration-500" 
                       fallbackSeed={u.userId} 
                     />
                     <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/50 to-transparent opacity-90"></div>
                     <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/45 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 shadow-sm">
                       <span className={`w-1.5 h-1.5 rounded-full ${getCardStatusColor(u)}`}></span>
                       <span className="text-[8px] font-bold text-white uppercase tracking-wider">
                         {getCardStatusLabel(u)}
                       </span>
                     </div>
                     <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                       <MapPin className="w-3 h-3 text-indigo-300" /> {u.distance}
                      </div>
                      <div className="absolute bottom-2 left-2 flex flex-col gap-1 items-start max-w-[95%]">
                        {u.profile?.facialVerified && (
                          <div className="bg-blue-600/95 backdrop-blur-md text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-md border border-blue-400/30 tracking-wide uppercase">
                            <ShieldCheck className="w-3 h-3 text-blue-100 shrink-0" />
                            <span>Rosto Verificado IA</span>
                          </div>
                        )}
                        {u.idVerified && (
                          <div className="bg-emerald-600/95 backdrop-blur-md text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-md border border-emerald-400/30 tracking-wide uppercase">
                            <CheckCircle className="w-3 h-3 text-emerald-100 shrink-0" />
                            <span>Doc Confirmado</span>
                          </div>
                        )}
                        {u.profile?.verified && !u.idVerified && (
                          <div className="bg-emerald-500/95 backdrop-blur-md text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-md border border-emerald-400/30 tracking-wide uppercase">
                            <CheckCircle className="w-3 h-3 text-emerald-100 shrink-0" />
                            <span>Verificado</span>
                          </div>
                        )}
                      </div>
                    </Link>
                   
                   <div className="p-2.5 flex-1 flex flex-col bg-white dark:bg-slate-900">
                     <Link to={`/profile/${u.userId}`} className="mb-2.5 flex flex-col group-hover:text-indigo-600 transition-colors">
                        <div className="font-bold text-[14px] leading-tight text-slate-800 dark:text-slate-100 flex items-center gap-1 truncate">
                          {u.profile?.apelido || u.profile?.nome}, {u.profile?.idade}
                          {u.profile?.verified && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                          {u.profile?.facialVerified && <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0 fill-blue-50" aria-label="Verificação Facial por IA" />}
                          {u.idVerified && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 fill-emerald-50" aria-label="Identificação Confirmada" />}
                        </div>
                        <div className="flex justify-between items-center text-[11px] mt-0.5">
                          {u.profile?.estadoNascimento ? (
                            <span className="font-medium text-slate-500 dark:text-slate-400 truncate">
                              {getDemonym(u.profile.estadoNascimento, u.profile.sexo)}
                            </span>
                          ) : <span className="font-medium text-slate-400 dark:text-slate-600">---</span>}
                          {u.profile?.profissao && (
                            <span className="font-medium text-slate-500 dark:text-slate-400 truncate ml-2 text-right">
                              {u.profile.profissao}
                            </span>
                          )}
                        </div>
                     </Link>
                     <div className="flex gap-1.5 mt-auto">
                        <button 
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!currentUser) {
                              alert("Por favor, faça login para interagir!");
                              return;
                            }
                            try {
                              const reqSentRef = doc(db, 'friendRequests', `${currentUser.uid}_${u.userId}`);
                              const reqRecRef = doc(db, 'friendRequests', `${u.userId}_${currentUser.uid}`);
                              
                              const reqRecSnap = await getDoc(reqRecRef);
                              
                              if (reqRecSnap.exists() && reqRecSnap.data().status === 'pending') {
                                // Instant match because they sent us a request already!
                                await updateDoc(reqRecRef, {
                                  status: 'accepted',
                                  updatedAt: serverTimestamp()
                                });
                                
                                await setDoc(doc(db, 'connections', `${currentUser.uid}_${u.userId}`), {
                                  users: [currentUser.uid, u.userId],
                                  permissions: {},
                                  categories: {
                                    [currentUser.uid]: 'Geral',
                                    [u.userId]: 'Geral'
                                  },
                                  createdAt: serverTimestamp()
                                });
                                
                                setMatchUser(u);
                                setShowMatchModal(true);
                              } else {
                                const reqSentSnap = await getDoc(reqSentRef);
                                if (reqSentSnap.exists()) {
                                  alert('Você já interagiu com este usuário!');
                                  return;
                                }
                                
                                await setDoc(reqSentRef, {
                                  fromUserId: currentUser.uid,
                                  toUserId: u.userId,
                                  status: 'pending',
                                  createdAt: serverTimestamp()
                                });
                                
                                // Mock user instant engagement simulation
                                if (u.userId.startsWith('mock') && Math.random() < 0.45) {
                                  setTimeout(async () => {
                                    await updateDoc(reqSentRef, {
                                      status: 'accepted',
                                      updatedAt: serverTimestamp()
                                    });
                                    
                                    await setDoc(doc(db, 'connections', `${currentUser.uid}_${u.userId}`), {
                                      users: [currentUser.uid, u.userId],
                                      permissions: {},
                                      categories: {
                                        [currentUser.uid]: 'Geral',
                                        [u.userId]: 'Geral'
                                      },
                                      createdAt: serverTimestamp()
                                    });
                                    
                                    setMatchUser(u);
                                    setShowMatchModal(true);
                                  }, 600);
                                } else {
                                  alert('Você enviou um flerte! Se for mútuo, dará match! ❤️');
                                }
                              }
                            } catch (err) {
                              console.error(err);
                              alert('Erro ao enviar flerte.');
                            }
                          }}
                          className="flex-1 flex items-center justify-center bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer active:scale-95"
                          title="Flertar"
                        >
                          <Flame className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!currentUser) {
                              alert("Por favor, faça login para interagir!");
                              return;
                            }
                            try {
                              const reqSentRef = doc(db, 'friendRequests', `${currentUser.uid}_${u.userId}`);
                              const reqRecRef = doc(db, 'friendRequests', `${u.userId}_${currentUser.uid}`);
                              
                              const reqRecSnap = await getDoc(reqRecRef);
                              
                              if (reqRecSnap.exists() && reqRecSnap.data().status === 'pending') {
                                // Accept existing request
                                await updateDoc(reqRecRef, {
                                  status: 'accepted',
                                  updatedAt: serverTimestamp()
                                });
                                
                                await setDoc(doc(db, 'connections', `${currentUser.uid}_${u.userId}`), {
                                  users: [currentUser.uid, u.userId],
                                  permissions: {},
                                  categories: {
                                    [currentUser.uid]: 'Geral',
                                    [u.userId]: 'Geral'
                                  },
                                  createdAt: serverTimestamp()
                                });
                                
                                alert('Vocês agora estão conectados!');
                              } else {
                                const reqSentSnap = await getDoc(reqSentRef);
                                if (reqSentSnap.exists()) {
                                  alert('Você já enviou uma solicitação para este usuário!');
                                  return;
                                }
                                
                                await setDoc(reqSentRef, {
                                  fromUserId: currentUser.uid,
                                  toUserId: u.userId,
                                  status: 'pending',
                                  createdAt: serverTimestamp()
                                });
                                alert('Solicitação enviada!');
                              }
                            } catch (err) {
                              console.error(err);
                              alert('Erro ao enviar solicitação.');
                            }
                          }}
                          className="flex-1 flex items-center justify-center bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-750 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer active:scale-95"
                          title="Adicionar como amigo"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!currentUser) return;
                            const confirmBlock = window.confirm(`Deseja realmente bloquear ${u.profile?.apelido || u.profile?.nome || 'este usuário'}? Isso impedirá futuras interações e removerá este perfil do seu feed.`);
                            if (!confirmBlock) return;
                            try {
                              const blockRef = doc(db, 'blocks', `${currentUser.uid}_${u.userId}`);
                              await setDoc(blockRef, {
                                blockedBy: currentUser.uid,
                                blockedUser: u.userId,
                                createdAt: serverTimestamp()
                              });
                              alert('Usuário bloqueado com sucesso!');
                              // Instantly filter out of local user list
                              setUsers(prev => prev.filter(user => user.userId !== u.userId));
                            } catch (err) {
                              console.error(err);
                              alert('Erro ao bloquear usuário.');
                            }
                          }}
                          className="flex-1 flex items-center justify-center bg-slate-50 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-750 hover:border-red-200 dark:hover:border-red-900 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer active:scale-95"
                          title="Bloquear Usuário"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      </div>
                   </div>
                 </div>
               ))}
             </div>

             {totalPages > 1 && (
               <div className="flex items-center justify-center gap-1.5 mt-4 self-center">
                 <button
                   disabled={currentPage === 1}
                   onClick={() => {
                     setCurrentPage(p => Math.max(1, p - 1));
                     window.scrollTo({ top: 0, behavior: 'smooth' });
                   }}
                   className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                 >
                   Anterior
                 </button>
                 {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                   <button
                     key={page}
                     onClick={() => {
                       setCurrentPage(page);
                       window.scrollTo({ top: 0, behavior: 'smooth' });
                     }}
                     className={`w-8 h-8 rounded-lg text-xs font-bold border transition-colors ${
                       currentPage === page
                         ? 'bg-indigo-600 text-white border-indigo-600'
                         : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                     }`}
                   >
                     {page}
                   </button>
                 ))}
                 <button
                   disabled={currentPage === totalPages}
                   onClick={() => {
                     setCurrentPage(p => Math.min(totalPages, p + 1));
                     window.scrollTo({ top: 0, behavior: 'smooth' });
                   }}
                   className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                 >
                   Próximo
                 </button>
               </div>
             )}
           </div>
         );
       })()}
      </div>

      {showGeoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <MapPin className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
              Acesso à Localização
            </h3>
            <p className="text-sm text-slate-600 text-center mb-6">
              Para conectar você com pessoas próximas, o aplicativo solicitará acesso à sua localização. Por favor, permita o acesso para uma melhor experiência.
            </p>
            <button
              onClick={() => {
                localStorage.setItem('geo_alert_shown', 'true');
                setShowGeoModal(false);
              }}
              className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Entendi e Permitir
            </button>
          </div>
        </div>
      )}

      {showMatchModal && matchUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center animate-in zoom-in duration-300 relative border border-slate-100 dark:border-slate-800">
            <button 
              onClick={() => setShowMatchModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="relative w-28 h-28 mx-auto mb-6">
              <div className="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-25"></div>
              <div className="relative w-28 h-28 rounded-full border-4 border-rose-500 overflow-hidden shadow-lg">
                <img 
                  src={matchUser.profile?.fotoPrincipalUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'} 
                  alt={matchUser.profile?.nome}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-rose-500 text-white p-2.5 rounded-full shadow-md">
                <Heart className="w-5 h-5 fill-white animate-bounce" />
              </div>
            </div>

            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-indigo-600 mb-2">
              Deu Match! ❤️
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
              Você e <strong>{matchUser.profile?.apelido || matchUser.profile?.nome}</strong> demonstraram interesse mútuo!
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowMatchModal(false);
                  navigate('/chats');
                }}
                className="w-full bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                Conversar Agora
              </button>
              
              <button
                onClick={() => setShowMatchModal(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3 px-4 rounded-xl transition-all active:scale-[0.98]"
              >
                Continuar Procurando
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
