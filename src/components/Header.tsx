import { useEffect, useState } from 'react';
import { Link, useLocation, matchPath } from 'react-router-dom';
import { LogOut, User, ChevronDown, HelpCircle, Siren, Users, Phone, Check, Loader2, ShieldAlert, Sparkles, MapPin, Calendar, X, MessageSquare } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, addDoc, collection, serverTimestamp, getDoc, query, where, getDocs } from 'firebase/firestore';
import { MOCK_USERS } from '../pages/Discover';
import { openNativeSms } from '../utils/sms';
import { PWAHeaderInstallButton } from './PWAInstallBanner';

interface HeaderProps {
  onStartTour?: () => void;
}

export default function Header({ onStartTour }: HeaderProps) {
  const location = useLocation();
  const [myProfile, setMyProfile] = useState<any>(null);
  const [viewedProfile, setViewedProfile] = useState<any>(null);
  const [viewedUserDistanceValue, setViewedUserDistanceValue] = useState<number | null>(null);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);
  const [searchRadius, setSearchRadius] = useState<number>(50000);
  const [appTitle, setAppTitle] = useState('Perto.br');

  // Listen to custom app title
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'app_config'), (snap) => {
      if (snap.exists() && snap.data().appCustomTitle) {
        setAppTitle(snap.data().appCustomTitle);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'settings/app_config');
    });
    return () => unsubscribe();
  }, []);

  // Sync radius from localStorage on navigation
  useEffect(() => {
    const saved = localStorage.getItem('search_radius');
    if (saved) {
      setSearchRadius(Number(saved));
    }
  }, [location]);

  // Listen to my own user profile in Firestore
  useEffect(() => {
    if (!auth.currentUser) return;

    // Load from cache instantly on mount
    try {
      const cacheKey = `user_profile_cache_${auth.currentUser.uid}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setMyProfile(JSON.parse(cached));
      }
    } catch (cacheErr) {
      console.error('Error reading user profile cache in Header:', cacheErr);
    }

    const myUserDocRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribeMyUser = onSnapshot(myUserDocRef, (snap) => {
      if (snap.exists()) {
        const uData = snap.data();
        setMyProfile(uData);
        // Save/Sync to cache
        try {
          localStorage.setItem(`user_profile_cache_${auth.currentUser?.uid}`, JSON.stringify(uData));
        } catch (cacheErr) {
          console.error('Error writing user profile cache in Header:', cacheErr);
        }
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${auth.currentUser?.uid}`);
    });

    return () => {
      unsubscribeMyUser();
    };
  }, []);

  // Detect if viewing another user's profile
  const match = matchPath({ path: '/profile/:id' }, location.pathname);
  const viewedId = match?.params.id;
  const isViewingOthers = viewedId && viewedId !== auth.currentUser?.uid;

  // Listen to viewed user's profile and calculate distance
  useEffect(() => {
    if (!isViewingOthers || !auth.currentUser || !viewedId) {
      setViewedProfile(null);
      setViewedUserDistanceValue(null);
      return;
    }

    // Check if mock user
    const matchedMock = MOCK_USERS.find(u => u.userId === viewedId);
    if (matchedMock) {
      setViewedProfile({ profile: matchedMock.profile });
      setViewedUserDistanceValue(matchedMock.distanceValue || null);
      return;
    }

    const viewedUserDocRef = doc(db, 'users', viewedId);
    const unsubscribeViewed = onSnapshot(viewedUserDocRef, (snap) => {
      if (snap.exists()) {
        setViewedProfile(snap.data());
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${viewedId}`);
    });

    // Distance calculation real-time listener
    const myLocDocRef = doc(db, 'locations', auth.currentUser.uid);
    const viewedLocDocRef = doc(db, 'locations', viewedId);
    let unsubscribeViewedLoc: (() => void) | null = null;

    const unsubscribeMyLoc = onSnapshot(myLocDocRef, (myLocSnap) => {
      if (unsubscribeViewedLoc) {
        unsubscribeViewedLoc();
        unsubscribeViewedLoc = null;
      }
      if (myLocSnap.exists()) {
        const myData = myLocSnap.data();
        unsubscribeViewedLoc = onSnapshot(viewedLocDocRef, (viewedLocSnap) => {
          if (viewedLocSnap.exists()) {
            const viewedData = viewedLocSnap.data();
            if (myData.lat && myData.lng && viewedData.lat && viewedData.lng) {
              import('geofire-common').then(({ distanceBetween }) => {
                const distInKm = distanceBetween([viewedData.lat, viewedData.lng], [myData.lat, myData.lng]);
                setViewedUserDistanceValue(distInKm * 1000);
              });
            }
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `locations/${viewedId}`);
        });
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `locations/${auth.currentUser?.uid}`);
    });

    return () => {
      unsubscribeViewed();
      unsubscribeMyLoc();
      if (unsubscribeViewedLoc) {
        (unsubscribeViewedLoc as () => void)();
      }
    };
  }, [viewedId, isViewingOthers]);

  const handleSignOut = () => {
    setIsSignOutConfirmOpen(true);
  };

  const handleConfirmSignOut = async () => {
    try {
      await signOut(auth);
      setIsSignOutConfirmOpen(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getMockStatusBolinha = (userId: string) => {
    const charSum = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const statusOptions = ['disponivel', 'restricoes', 'indisponivel'] as const;
    return statusOptions[charSum % statusOptions.length];
  };

  // Determine current status state, color and label
  const getStatusDetails = () => {
    let statusBolinha = 'disponivel';
    let isOutOfRange = false;
    let isOffline = false;
    let label = 'Disponível';
    let colorClass = 'bg-emerald-500 hover:shadow-emerald-200/50';

    if (isViewingOthers && viewedId) {
      // Viewing another profile
      const matchedMock = MOCK_USERS.find(u => u.userId === viewedId);
      if (matchedMock) {
        statusBolinha = getMockStatusBolinha(viewedId);
        const dist = matchedMock.distanceValue || 0;
        if (dist > 500000) {
          isOffline = true;
        } else if (dist > searchRadius) {
          isOutOfRange = true;
        }
      } else if (viewedProfile) {
        statusBolinha = viewedProfile.profile?.statusBolinha || 'disponivel';
        if (viewedUserDistanceValue !== null) {
          if (viewedUserDistanceValue > 500000) {
            isOffline = true;
          } else if (viewedUserDistanceValue > searchRadius) {
            isOutOfRange = true;
          }
        }
      }
    } else {
      // My own profile / global
      statusBolinha = myProfile?.profile?.statusBolinha || 'disponivel';
    }

    if (isOffline) {
      label = 'Offline';
      colorClass = 'bg-slate-400 hover:shadow-slate-200';
    } else if (isOutOfRange) {
      label = 'Fora de alcance';
      colorClass = 'bg-slate-400 hover:shadow-slate-200';
    } else if (statusBolinha === 'disponivel') {
      label = 'Aberto a novas amizades e interação';
      colorClass = 'bg-emerald-500 hover:shadow-emerald-200';
    } else if (statusBolinha === 'restricoes') {
      label = 'Algumas restrições serão impostas';
      colorClass = 'bg-amber-500 hover:shadow-amber-200';
    } else if (statusBolinha === 'indisponivel') {
      label = 'Todas as interações indisponíveis';
      colorClass = 'bg-rose-500 hover:shadow-rose-200';
    }

    return { label, colorClass, statusBolinha, isOutOfRange: isOutOfRange || isOffline };
  };

  const handleUpdateMyStatus = async (newStatus: 'disponivel' | 'restricoes' | 'indisponivel') => {
    if (!auth.currentUser) return;
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        'profile.statusBolinha': newStatus
      });
      setIsStatusMenuOpen(false);
    } catch (err) {
      console.error("Error updating statusBolinha", err);
    }
  };

  const [isSendingHelp, setIsSendingHelp] = useState(false);

  // SOS Panic Button custom states
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const [sosStep, setSosStep] = useState<'select' | 'confirm'>('select');
  const [sosFriends, setSosFriends] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<{ id?: string; nome: string; telefone: string } | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [sosLocation, setSosLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [formattedMessage, setFormattedMessage] = useState('');
  const [isSosTrackingActive, setIsSosTrackingActive] = useState(localStorage.getItem('sos_tracking_active') === 'true');
  const [isDeactivateSosModalOpen, setIsDeactivateSosModalOpen] = useState(false);

  useEffect(() => {
    const handleStorage = () => {
      setIsSosTrackingActive(localStorage.getItem('sos_tracking_active') === 'true');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Trigger modal and fetch connections
  const handleQuickHelp = async () => {
    if (!auth.currentUser) return;
    if (isSosTrackingActive) {
      setIsDeactivateSosModalOpen(true);
      return;
    }
    setIsSosModalOpen(true);
    setSosStep('select');
    setSelectedFriend(null);
    setManualName('');
    setManualPhone('');
    setSosLocation(null);
    setLoadingFriends(true);

    try {
      const q = query(
        collection(db, 'connections'),
        where('users', 'array-contains', auth.currentUser.uid)
      );
      const snap = await getDocs(q);
      const friendsList: any[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        const friendId = data.users.find((u: string) => u !== auth.currentUser!.uid);
        if (friendId) {
          const friendDoc = await getDoc(doc(db, 'users', friendId));
          if (friendDoc.exists()) {
            const friendData = friendDoc.data();
            friendsList.push({
              id: friendId,
              nome: friendData.profile?.nome || friendData.profile?.apelido || 'Amigo',
              telefone: friendData.profile?.telefone || '',
              fotoUrl: friendData.profile?.fotoPrincipalUrl || '',
            });
          }
        }
      }
      setSosFriends(friendsList);
    } catch (err) {
      console.error("Error loading SOS friends:", err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleSelectContact = async (contact: { id?: string; nome: string; telefone: string }) => {
    setSelectedFriend(contact);
    setSosStep('confirm');
    setLoadingLocation(true);

    // Try to get dynamic GPS high-accuracy position
    let coords: { lat: number; lng: number } | null = null;
    try {
      coords = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (!navigator.geolocation) {
          resolve(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => {
            console.warn("SOS Geolocation error:", err);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 6000 }
        );
      });
    } catch (e) {
      console.error(e);
    }

    // Fallback to saved location
    if (!coords && auth.currentUser) {
      try {
        const locDoc = await getDoc(doc(db, 'locations', auth.currentUser.uid));
        if (locDoc.exists()) {
          const lData = locDoc.data();
          if (lData.lat && lData.lng) {
            coords = { lat: lData.lat, lng: lData.lng };
          }
        }
      } catch (e) {
        console.error("SOS location doc fallback error:", e);
      }
    }

    setSosLocation(coords);
    setLoadingLocation(false);

    // Format the date/time
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    const dateTimeStr = `${day}/${month}/${year} às ${hours}:${minutes}:${seconds}`;

    const locationUrl = coords 
      ? `https://maps.google.com/?q=${coords.lat},${coords.lng}`
      : 'Localização atual indisponível';

    const toTitleCase = (str: string | undefined | null) => {
      if (!str || typeof str !== 'string') return 'Não informado';
      return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    // Fetch details from database profile
    const pNome = toTitleCase(myProfile?.profile?.nome);
    const pIdade = myProfile?.profile?.idade || 'Não informado';
    const pSexo = toTitleCase(myProfile?.profile?.sexo);
    const pAltura = myProfile?.profile?.altura ? (myProfile.profile.altura.toString().includes('m') ? myProfile.profile.altura : `${myProfile.profile.altura}m`) : 'Não informado';
    const pCor = toTitleCase(myProfile?.profile?.cor);

    // Mensagem resumida e direta para SMS via operadora de celular (sem depender de internet)
    const msg = `🚨 SOS EMERGÊNCIA!
Estou em perigo e preciso de socorro. Acione a polícia agora (190)! NÃO ME LIGUE no momento para não me comprometer.

Localização em tempo real:
${locationUrl}

Dados da Vítima:
- Nome: ${pNome}
- Idade: ${pIdade} | Sexo: ${pSexo}
- Altura: ${pAltura} | Cor: ${pCor}
Horário: ${dateTimeStr}`;

    setFormattedMessage(msg);
  };

  const handleConfirmSendSOS = async () => {
    if (!auth.currentUser || !selectedFriend) return;
    try {
      setIsSendingHelp(true);
      
      // Save emergency alert in Firestore
      await addDoc(collection(db, 'emergency_alerts'), {
        userId: auth.currentUser.uid,
        userName: myProfile?.profile?.nome || 'Usuário',
        timestamp: serverTimestamp(),
        coordinates: sosLocation,
        emergencyContact: selectedFriend,
        messageText: formattedMessage,
        canalEnvio: 'sms_operadora',
        status: 'active'
      });

      // Activate real-time tracking (runs in App.tsx every 3 minutes)
      localStorage.setItem('sos_tracking_active', 'true');
      localStorage.setItem('sos_contact_phone', selectedFriend.telefone);
      localStorage.setItem('sos_last_wa_sent', Date.now().toString());
      setIsSosTrackingActive(true);
      
      // Trigger local storage event
      window.dispatchEvent(new Event('storage'));

      // Disparar aplicativo nativo de SMS da operadora celular (funciona sem internet)
      openNativeSms(selectedFriend.telefone, formattedMessage);
      
      setIsSosModalOpen(false);
    } catch (err) {
      console.error("Error triggering SOS send:", err);
      
      localStorage.setItem('sos_tracking_active', 'true');
      localStorage.setItem('sos_contact_phone', selectedFriend.telefone);
      localStorage.setItem('sos_last_wa_sent', Date.now().toString());
      setIsSosTrackingActive(true);
      window.dispatchEvent(new Event('storage'));

      // Abre o SMS mesmo em caso de erro no salvamento do banco
      openNativeSms(selectedFriend.telefone, formattedMessage);
      setIsSosModalOpen(false);
    } finally {
      setIsSendingHelp(false);
    }
  };

  const handleStopSosTracking = async () => {
    localStorage.removeItem('sos_tracking_active');
    localStorage.removeItem('sos_contact_phone');
    localStorage.removeItem('sos_last_wa_sent');
    setIsSosTrackingActive(false);
    window.dispatchEvent(new Event('storage'));

    if (auth.currentUser) {
      try {
        await updateDoc(doc(db, 'locations', auth.currentUser.uid), {
          sosActive: false
        });
        console.log('[SOS] Cleared sosActive flag in Firestore.');
      } catch (err) {
        console.error('Error clearing sosActive flag in Firestore:', err);
      }
    }
  };

  const statusInfo = getStatusDetails();

  // Verification status checks for the current user
  const isEmailVerified = Boolean(
    auth.currentUser?.emailVerified ||
    myProfile?.emailVerified ||
    myProfile?.verified ||
    myProfile?.profile?.emailVerified ||
    myProfile?.profile?.verified
  );
  const isIdVerified = Boolean(myProfile?.idVerified || myProfile?.profile?.idVerified);
  const isFacialVerified = Boolean(myProfile?.facialVerified || myProfile?.profile?.facialVerified);
  const hasProfilePhoto = Boolean(myProfile?.profile?.fotoPrincipalUrl);

  const hasPendingVerifications = !isEmailVerified || !isIdVerified || !isFacialVerified || !hasProfilePhoto;

  return (
    <>
      <header className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 sm:p-4 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* User Icon on Top Left Corner with Verification State Indicator Badge */}
          <Link 
            id="tour-profile-btn"
            to={`/profile/${auth.currentUser?.uid}`} 
            className="relative flex items-center justify-center rounded-full transition-all active:scale-95 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0"
            title={hasPendingVerifications ? "Meu Perfil (Verificações Pendentes!)" : "Meu Perfil (Todas as Verificações Cumpridas)"}
          >
            <div className="w-9 h-9 rounded-full border-2 border-indigo-600 dark:border-indigo-500 flex items-center justify-center bg-white dark:bg-slate-950 p-[2px] shadow-sm">
              <div className="w-full h-full rounded-full overflow-hidden bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
                {myProfile?.profile?.fotoPrincipalUrl ? (
                  <img 
                    src={myProfile.profile.fotoPrincipalUrl} 
                    alt="Eu" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <User className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                )}
              </div>
            </div>

            {/* Over the user icon in the top left corner:
                Red pulsing circle when pending verifications exist,
                Green circle when all verifications are fulfilled! */}
            <span 
              className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 shadow-md transition-all ${
                hasPendingVerifications 
                  ? 'bg-rose-500 animate-pulse ring-2 ring-rose-400/80 shadow-rose-500/50' 
                  : 'bg-emerald-500 ring-2 ring-emerald-400/80 shadow-emerald-500/30'
              }`}
              title={
                hasPendingVerifications 
                  ? 'Possui verificações pendentes (Clique para completar no Perfil)' 
                  : 'Todas as verificações foram cumpridas com sucesso!'
              }
            />
          </Link>

          <Link to="/" className="flex items-center gap-2 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-indigo-600 dark:text-indigo-400 flex items-center gap-2 font-friendly truncate">
              <span className="truncate">
                {appTitle.split(/(\.br| br)/i).map((part, index) => {
                  if (part.toLowerCase() === '.br' || part.toLowerCase() === ' br') {
                    return <span key={index} className="text-emerald-500">{part}</span>;
                  }
                  return part;
                })}
              </span>
              <img src="https://flagcdn.com/w40/br.png" alt="Brasil" className="w-5 h-auto rounded-sm object-cover shrink-0" />
            </h1>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Quick Help / Panic Button */}
          <button
            onClick={handleQuickHelp}
            disabled={isSendingHelp && !isSosTrackingActive}
            className={`p-2 rounded-full transition-all duration-300 flex items-center justify-center shadow-sm ${
              isSosTrackingActive 
                ? 'bg-red-600 dark:bg-red-500 text-white animate-pulse ring-2 ring-yellow-400 dark:ring-yellow-500 scale-105 hover:scale-110 shadow-red-500/40' 
                : isSendingHelp 
                ? 'bg-red-100 text-red-300' 
                : 'bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400'
            }`}
            title={isSosTrackingActive ? "Desativar Rastreamento de Emergência (SOS)" : "Ajuda Rápida (Alerta de Emergência)"}
          >
            <Siren className={`w-5 h-5 ${isSosTrackingActive ? 'text-yellow-300 animate-bounce' : isSendingHelp ? 'animate-pulse' : ''}`} />
          </button>

          {/* PWA Quick Install Trigger */}
          <PWAHeaderInstallButton />

          {/* Walkthrough Tour Help Trigger */}
          <button
            onClick={() => {
              if (onStartTour) {
                onStartTour();
              } else {
                window.dispatchEvent(new Event('start-walkthrough-tour'));
              }
            }}
            className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-full transition-colors flex items-center justify-center animate-bounce-subtle"
            title="Ver Tour de Boas-Vindas"
          >
            <HelpCircle className="w-5 h-5 text-indigo-550 dark:text-indigo-400" />
          </button>

          {/* Status Indicator Dot (Bolinha) */}
          <div className="relative hidden sm:block">
            <button
              id="tour-status"
              onClick={() => {
                if (!isViewingOthers) {
                  setIsStatusMenuOpen(!isStatusMenuOpen);
                }
              }}
              disabled={isViewingOthers}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-150/50 dark:hover:bg-slate-800/80 transition-colors active:scale-95 text-slate-700 dark:text-slate-300"
              title={isViewingOthers ? `Status de quem você está vendo: ${statusInfo.label}` : `Seu Status: ${statusInfo.label} (Clique para mudar)`}
            >
              <div
                className={`w-5.5 h-5.5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md transition-all ${statusInfo.colorClass} ${
                  isViewingOthers ? 'cursor-default' : 'cursor-pointer animate-pulse'
                }`}
              >
                <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
              </div>
            </button>

            {/* Quick status selection menu for current user */}
            {!isViewingOthers && isStatusMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsStatusMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-50 dark:border-slate-800">
                    Seu Status
                  </div>
                  <button
                    onClick={() => handleUpdateMyStatus('indisponivel')}
                    className="w-full text-left px-3.5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-start gap-3 transition-colors border-b border-slate-50 dark:border-slate-800"
                  >
                    <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0 mt-0.5"></span>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-rose-600 dark:text-rose-400">Não Disponível</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight whitespace-normal text-left">
                        Você estará online, porém com restrições. Ficará claro que não quer interação com pessoas fora do seu grupo de amigos. Você será informado caso alguém desrespeite a regra, com opção de bloquear imediatamente o infrator.
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleUpdateMyStatus('restricoes')}
                    className="w-full text-left px-3.5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-start gap-3 transition-colors border-b border-slate-50 dark:border-slate-800"
                  >
                    <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0 mt-0.5"></span>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-amber-600 dark:text-amber-400">Restrições</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight whitespace-normal text-left">
                        Aberto a interações com algumas restrições. Ao ser contactado, você poderá usar respostas automáticas rápidas para dispensar o contato se não houver interesse.
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleUpdateMyStatus('disponivel')}
                    className="w-full text-left px-3.5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-start gap-3 transition-colors"
                  >
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0 mt-0.5"></span>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">Disponível</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight whitespace-normal text-left">
                        Você estará aberto a interações e poderá interagir abertamente, como lhe convier.
                      </span>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          <button onClick={handleSignOut} className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 rounded-full transition-colors" title="Sair">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Confirmation Modal */}
      {isSignOutConfirmOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Overlay mask */}
          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" onClick={() => setIsSignOutConfirmOpen(false)} />
          
          {/* Card dialog */}
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-slate-800 max-w-[320px] w-full text-center flex flex-col items-center">
            <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/30 text-rose-500 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
              <LogOut className="w-7 h-7" />
            </div>
            
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight mb-2">
              Deseja realmente sair?
            </h3>
            
            <p className="text-[11px] text-slate-550 dark:text-slate-400 font-medium leading-relaxed mb-6">
              Você será desconectado do aplicativo e precisará fazer login novamente para continuar interagindo com novos amigos.
            </p>
            
            <div className="flex w-full gap-2.5">
              <button
                onClick={() => setIsSignOutConfirmOpen(false)}
                className="flex-1 py-2.5 px-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-[10px] transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmSignOut}
                className="flex-1 py-2.5 px-4 bg-rose-500 hover:bg-rose-600 text-white font-extrabold rounded-xl text-[10px] transition-colors shadow-lg shadow-rose-550/10 active:scale-[0.98]"
              >
                Sim, Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOS Modal */}
      {isSosModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          {/* Overlay mask */}
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setIsSosModalOpen(false)} />
          
          {/* Modal Container */}
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-[0_25px_60px_rgba(0,0,0,0.45)] border border-slate-100 dark:border-slate-800 max-w-md w-full text-center flex flex-col items-center">
            
            {/* Close Button */}
            <button 
              onClick={() => setIsSosModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Icon */}
            <div className="w-14 h-14 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mb-4 shadow-inner animate-pulse">
              <Siren className="w-8 h-8" />
            </div>

            <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight mb-1 uppercase tracking-tight">
              ⚠️ Alerta de Emergência (SOS)
            </h3>
            
            <p className="text-[11px] text-slate-550 dark:text-slate-400 font-medium leading-relaxed mb-6">
              Em situações de perigo, você pode alertar uma pessoa de confiança com seus dados e localização de forma rápida.
            </p>

            {/* Reminder to only use in real emergencies */}
            <div className="w-full bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3.5 rounded-2xl text-left flex gap-3 items-start mb-6">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider block">
                  ⚠️ ALERTA DE USO RESPONSÁVEL
                </span>
                <span className="text-[9.5px] text-amber-700 dark:text-amber-300 font-bold leading-relaxed block mt-0.5">
                  Por favor, utilize este botão APENAS em situações REAIS de emergência. O acionamento indevido gera falsos alertas e compromete a segurança de todos.
                </span>
              </div>
            </div>

            {sosStep === 'select' && (
              <div className="w-full space-y-5 text-left">
                {/* Option 1: Choose from Friends/Connections */}
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-550 uppercase tracking-wider block">
                    Selecione um Amigo do Aplicativo
                  </span>
                  
                  {loadingFriends ? (
                    <div className="flex items-center justify-center py-4 text-xs font-semibold text-slate-500 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Carregando contatos de confiança...
                    </div>
                  ) : sosFriends.length === 0 ? (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-100 dark:border-slate-800/60">
                      Você não tem amigos conectados no momento. Utilize a opção manual de digitação abaixo.
                    </p>
                  ) : (
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                      {sosFriends.map((friend) => (
                        <button
                          key={friend.id}
                          onClick={() => {
                            if (!friend.telefone) {
                              alert("Este amigo não possui número de telefone cadastrado no perfil dele. Por favor, digite o número manualmente.");
                              setManualName(friend.nome);
                              return;
                            }
                            handleSelectContact(friend);
                          }}
                          className="w-full flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 rounded-xl transition-all border border-slate-100 dark:border-slate-800/60 cursor-pointer text-left group"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                              {friend.fotoUrl ? (
                                <img src={friend.fotoUrl} alt={friend.nome} className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-4 h-4 text-indigo-550" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-850 dark:text-slate-200 group-hover:text-red-600 transition-colors">
                                {friend.nome}
                              </p>
                              <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                <Phone className="w-2.5 h-2.5 shrink-0" /> {friend.telefone || 'Sem número cadastrado'}
                              </p>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 px-2 py-1 rounded-lg shadow-sm">
                            Escolher
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-150 dark:border-slate-800"></div>
                  <span className="flex-shrink mx-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">OU</span>
                  <div className="flex-grow border-t border-slate-150 dark:border-slate-800"></div>
                </div>

                {/* Option 2: Manual Contact Input */}
                <div className="space-y-3">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-550 uppercase tracking-wider block">
                    Inserir Contato Manualmente
                  </span>
                  
                  <div className="space-y-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 block">
                        Nome do Contato de Emergência
                      </label>
                      <input
                        type="text"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="Ex: Mãe, Pai, Irmão, Amigo Próximo"
                        className="w-full text-xs font-semibold p-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-150"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 block">
                        Número de Celular para SMS (com DDD)
                      </label>
                      <input
                        type="tel"
                        value={manualPhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        placeholder="Ex: 11 99999-9999"
                        className="w-full text-xs font-semibold p-2.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-150"
                      />
                    </div>
                  </div>

                  <button
                    disabled={!manualName.trim() || !manualPhone.trim()}
                    onClick={() => handleSelectContact({ nome: manualName, telefone: manualPhone })}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-750 disabled:opacity-40 disabled:pointer-events-none text-white font-extrabold rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" /> Avançar com Contato Manual
                  </button>
                </div>
                
                {/* Cancel Emergency */}
                <div className="pt-2 border-t border-slate-150 dark:border-slate-800 mt-4">
                  <button
                    onClick={() => setIsSosModalOpen(false)}
                    className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-900/40 dark:text-red-400 font-extrabold rounded-xl text-xs transition-all border border-red-200 dark:border-red-900/30 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" /> Cancelar a Emergência
                  </button>
                </div>
              </div>
            )}

            {sosStep === 'confirm' && (
              <div className="w-full space-y-4 text-left">
                <div className="p-3 bg-red-50/50 dark:bg-red-950/25 border border-red-100 dark:border-red-900/30 rounded-xl flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-[11px] font-black text-red-800 dark:text-red-400 uppercase tracking-wider">
                      Confirmação de Envio (SMS Operadora)
                    </h4>
                    <p className="text-[10px] text-red-700 dark:text-red-300 font-semibold leading-relaxed mt-0.5">
                      Você está prestes a alertar por SMS o contato <strong className="text-red-900 dark:text-white font-extrabold">{selectedFriend?.nome} ({selectedFriend?.telefone})</strong> via operadora celular.
                    </p>
                  </div>
                </div>

                {loadingLocation ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-2.5 text-center bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-100 dark:border-slate-800">
                    <Loader2 className="w-6 h-6 animate-spin text-red-600 dark:text-red-400" />
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                      Buscando dados no banco e localizando você...
                    </p>
                    <p className="text-[9px] text-slate-400 font-medium px-4 leading-normal">
                      Isso garante que sua localização seja enviada de forma precisa.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      Visualização da Mensagem Resumida (SMS Operadora)
                    </label>
                    <div className="w-full bg-rose-50/40 dark:bg-slate-950 text-slate-700 dark:text-slate-300 p-4 rounded-2xl border border-rose-100 dark:border-slate-800 text-[10.5px] font-medium leading-relaxed whitespace-pre-line overflow-y-auto max-h-56 custom-scrollbar shadow-inner relative">
                      <div className="absolute top-2 right-2 bg-rose-600 text-white rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                        <MessageSquare className="w-2.5 h-2.5" /> SMS Operadora
                      </div>
                      {formattedMessage}
                    </div>
                  </div>
                )}

                <div className="flex w-full gap-2.5 pt-2">
                  <button
                    onClick={() => setSosStep('select')}
                    className="flex-1 py-3 px-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors border border-slate-200/40 dark:border-slate-700/40 cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    disabled={loadingLocation || isSendingHelp}
                    onClick={handleConfirmSendSOS}
                    className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-lg shadow-rose-500/10 active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45"
                  >
                    {isSendingHelp ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <>
                        <MessageSquare className="w-4 h-4" /> Enviar SMS de Emergência
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SOS Deactivation Modal */}
      {isDeactivateSosModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Overlay mask */}
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setIsDeactivateSosModalOpen(false)} />
          
          {/* Modal Container */}
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-[0_25px_60px_rgba(0,0,0,0.45)] border border-slate-100 dark:border-slate-800 max-w-sm w-full text-center flex flex-col items-center">
            
            {/* Close Button */}
            <button 
              onClick={() => setIsDeactivateSosModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Icon */}
            <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight mb-2 uppercase tracking-tight">
              Desativar Rastreamento SOS?
            </h3>
            
            <p className="text-[11px] text-slate-550 dark:text-slate-400 font-medium leading-relaxed mb-6">
              O rastreamento de emergência ativo será desativado e sua localização deixará de ser transmitida de 3 em 3 minutos para seu contato de confiança.
            </p>

            <div className="flex w-full gap-2.5">
              <button
                onClick={() => setIsDeactivateSosModalOpen(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-650 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-slate-200/40 dark:border-slate-700/40"
              >
                Voltar
              </button>
              <button
                onClick={() => {
                  handleStopSosTracking();
                  setIsDeactivateSosModalOpen(false);
                }}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Desativar SOS
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
