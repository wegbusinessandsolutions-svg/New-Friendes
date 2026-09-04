/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter, Routes, Route, Navigate, Link, useLocation, Outlet } from 'react-router-dom';
import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType, perf } from './lib/firebase';
import { doc, getDoc, onSnapshot, setDoc, collection, addDoc } from 'firebase/firestore';
import { trace } from 'firebase/performance';
import { Shield, Moon, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import Login from './pages/Login';
import VerifyEmail from './pages/VerifyEmail';
import Onboarding from './pages/Onboarding';

// Lazy loaded pages for optimal speed and smaller initial chunk size
const Discover = lazy(() => import('./pages/Discover'));
const ProfileDetails = lazy(() => import('./pages/ProfileDetails'));
const ChatList = lazy(() => import('./pages/ChatList'));
const ChatRoom = lazy(() => import('./pages/ChatRoom'));
const Friends = lazy(() => import('./pages/Friends'));
const QuickMessages = lazy(() => import('./pages/QuickMessages'));
const AdminCRM = lazy(() => import('./pages/AdminCRM'));
const FlirtSwipe = lazy(() => import('./pages/FlirtSwipe'));
const RecentActivities = lazy(() => import('./pages/RecentActivities'));

import Header from './components/Header';
import Navigation from './components/Navigation';
import { useTheme, applyTheme, Theme } from './lib/theme';
import WalkthroughTour from './components/WalkthroughTour';
import ConnectionAnimation from './components/ConnectionAnimation';
import { ErrorBoundary } from './components/ErrorBoundary';
import AppFaceLockScreen from './components/AppFaceLockScreen';

export default function App() {
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDocVerified, setUserDocVerified] = useState<boolean>(false);
  const [isStandby, setIsStandby] = useState<boolean>(false);
  const [faceVerificationRequired, setFaceVerificationRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showConnectionAnim, setShowConnectionAnim] = useState(false);

  // Traces refs for Firebase Performance Monitoring
  const discoverTraceRef = useRef<any>(null);
  const connectionsTraceRef = useRef<any>(null);

  // Cached profile state ref to avoid redundant component re-renders on minor writes
  const lastProfileStateRef = useRef({
    hasProfile: false,
    role: null as string | null,
    verified: false,
    isStandby: false,
    faceVerificationRequired: false
  });

  const handleDiscoverStart = () => {
    if (!perf) return;
    try {
      if (!discoverTraceRef.current) {
        const t = trace(perf, 'discover_initial_load_latency');
        t.start();
        discoverTraceRef.current = t;
        console.log('[Firebase Performance] Iniciou rastreamento: discover_initial_load_latency');
      }
    } catch (err) {
      console.warn('Erro ao iniciar trace do Discover:', err);
    }
  };

  const handleDiscoverEnd = () => {
    try {
      if (discoverTraceRef.current) {
        discoverTraceRef.current.stop();
        discoverTraceRef.current = null;
        console.log('[Firebase Performance] Parou e registrou rastreamento: discover_initial_load_latency');
      }
    } catch (err) {
      console.warn('Erro ao parar trace do Discover:', err);
    }
  };

  const handleChatsStart = () => {
    if (!perf) return;
    try {
      if (!connectionsTraceRef.current) {
        const t = trace(perf, 'connections_screen_load_time');
        t.start();
        connectionsTraceRef.current = t;
        console.log('[Firebase Performance] Iniciou rastreamento: connections_screen_load_time');
      }
    } catch (err) {
      console.warn('Erro ao iniciar trace de Conexões:', err);
    }
  };

  const handleChatsEnd = () => {
    try {
      if (connectionsTraceRef.current) {
        connectionsTraceRef.current.stop();
        connectionsTraceRef.current = null;
        console.log('[Firebase Performance] Parou e registrou rastreamento: connections_screen_load_time');
      }
    } catch (err) {
      console.warn('Erro ao parar trace de Conexões:', err);
    }
  };

  const [appConfig, setAppConfig] = useState<any>({
    maintenanceMode: false,
    registrationEnabled: true,
    globalBannerText: '',
    autoVerifyNewUsers: false,
    appCustomTitle: 'New Friends.br'
  });

  // Listen to global app configurations
  useEffect(() => {
    const configRef = doc(db, 'settings', 'app_config');
    const unsubscribe = onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        setAppConfig(snap.data());
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'settings/app_config');
    });
    return () => unsubscribe();
  }, []);

  // Listen for manual tour starts and automatic tours for new users
  useEffect(() => {
    const handleStartTour = () => {
      sessionStorage.removeItem('tour_current_step');
      setShowTour(true);
    };
    window.addEventListener('start-walkthrough-tour', handleStartTour);
    return () => window.removeEventListener('start-walkthrough-tour', handleStartTour);
  }, []);

  useEffect(() => {
    if (user && hasProfile) {
      const tourDone = localStorage.getItem('new_user_tour_done');
      if (!tourDone) {
        const timer = setTimeout(() => {
          setShowTour(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [user, hasProfile]);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      setUser(u);

      if (u) {
        // Run birthdate format migration in the background to ensure DD-MM-AAAA format
        import('./utils/migration').then(({ runBirthdateMigration, runBirthdateMigrationSingleUser }) => {
          runBirthdateMigration(db, u);
          runBirthdateMigrationSingleUser(db, u.uid);
        }).catch(err => console.error("Failed to load migration script:", err));

        if (sessionStorage.getItem('just_logged_in') === 'true') {
          setShowConnectionAnim(true);
        }

        // Real-time listener for user profile/document updates
        const userDocRef = doc(db, 'users', u.uid);
        unsubscribeDoc = onSnapshot(userDocRef, async (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const nextHasProfile = true;
            const nextRole = data.role || null;
            const nextVerified = data.verified || false;
            const nextIsStandby = data.status?.ativo === false;
            const nextFaceRequired = data.faceLoginEnabled === true && sessionStorage.getItem(`face_verified_${u.uid}`) !== 'true';

            const last = lastProfileStateRef.current;
            const changed = last.hasProfile !== nextHasProfile ||
                            last.role !== nextRole ||
                            last.verified !== nextVerified ||
                            last.isStandby !== nextIsStandby ||
                            last.faceVerificationRequired !== nextFaceRequired;

            if (changed) {
              lastProfileStateRef.current = {
                hasProfile: nextHasProfile,
                role: nextRole,
                verified: nextVerified,
                isStandby: nextIsStandby,
                faceVerificationRequired: nextFaceRequired
              };
              setHasProfile(nextHasProfile);
              setUserRole(nextRole);
              setUserDocVerified(nextVerified);
              setIsStandby(nextIsStandby);
              setFaceVerificationRequired(nextFaceRequired);
            }

            // Sync user preference theme dynamically if present
            if (data.theme && ['light', 'dark', 'system'].includes(data.theme)) {
              const currentTheme = localStorage.getItem('theme');
              if (currentTheme !== data.theme) {
                setTheme(data.theme as Theme);
              }
            }
          } else {
            const nextHasProfile = false;
            const nextRole = null;
            const nextVerified = false;
            const nextIsStandby = false;
            const nextFaceRequired = false;

            const last = lastProfileStateRef.current;
            const changed = last.hasProfile !== nextHasProfile ||
                            last.role !== nextRole ||
                            last.verified !== nextVerified ||
                            last.isStandby !== nextIsStandby ||
                            last.faceVerificationRequired !== nextFaceRequired;

            if (changed) {
              lastProfileStateRef.current = {
                hasProfile: nextHasProfile,
                role: nextRole,
                verified: nextVerified,
                isStandby: nextIsStandby,
                faceVerificationRequired: nextFaceRequired
              };
              setHasProfile(nextHasProfile);
              setUserRole(nextRole);
              setUserDocVerified(nextVerified);
              setIsStandby(nextIsStandby);
              setFaceVerificationRequired(nextFaceRequired);
            }

            // Automatic onboarding / initialization for admin emails
            const isAdminEmail = u.email === 'ceo@newfriends.com' || u.email === 'sac@wegbusiness.com' || u.email === 'ceo@wegbusiness.com' || u.email === 'wegbusinessandsolutions@gmail.com';
            if (isAdminEmail) {
              try {
                const { setDoc } = await import('firebase/firestore');
                const isAdminWeg = u.email === 'sac@wegbusiness.com' || u.email === 'ceo@wegbusiness.com' || u.email === 'wegbusinessandsolutions@gmail.com';
                await setDoc(doc(db, 'users', u.uid), { 
                  verified: true, 
                  role: 'Admin',
                  nome: isAdminWeg ? 'Admin WEG' : 'CEO',
                  apelido: isAdminWeg ? 'Admin' : 'CEO',
                  profile: {
                    nome: isAdminWeg ? 'Admin WEG' : 'CEO',
                    apelido: isAdminWeg ? 'Admin' : 'CEO',
                    idade: 35,
                    sexo: 'masculino',
                    bio: 'Painel Administrativo do App',
                    fotoPrincipalUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&q=80',
                    statusBolinha: 'disponivel',
                    email: u.email
                  }
                }, { merge: true });
                setHasProfile(true);
              } catch (err) {
                console.error("Error initializing admin profile:", err);
              }
            }
          }
          setLoading(false);
        }, (err) => {
          console.error("onSnapshot failed for user profile, trying manual getDoc fallback:", err);
          getDoc(userDocRef).then((snap) => {
            const nextHasProfile = snap.exists();
            let nextRole = null;
            let nextVerified = false;
            let nextIsStandby = false;
            let nextFaceRequired = false;

            if (snap.exists()) {
              const data = snap.data();
              nextRole = data.role || null;
              nextVerified = data.verified || false;
              nextIsStandby = data.status?.ativo === false;
              nextFaceRequired = data.faceLoginEnabled === true && sessionStorage.getItem(`face_verified_${u.uid}`) !== 'true';
            }

            const last = lastProfileStateRef.current;
            const changed = last.hasProfile !== nextHasProfile ||
                            last.role !== nextRole ||
                            last.verified !== nextVerified ||
                            last.isStandby !== nextIsStandby ||
                            last.faceVerificationRequired !== nextFaceRequired;

            if (changed) {
              lastProfileStateRef.current = {
                hasProfile: nextHasProfile,
                role: nextRole,
                verified: nextVerified,
                isStandby: nextIsStandby,
                faceVerificationRequired: nextFaceRequired
              };
              setHasProfile(nextHasProfile);
              setUserRole(nextRole);
              setUserDocVerified(nextVerified);
              setIsStandby(nextIsStandby);
              setFaceVerificationRequired(nextFaceRequired);
            }
            setLoading(false);
          }).catch((getErr) => {
            handleFirestoreError(getErr, OperationType.GET, `users/${u.uid}`);
            setLoading(false);
          });
        });
      } else {
        const nextHasProfile = false;
        const nextRole = null;
        const nextVerified = false;
        const nextIsStandby = false;
        const nextFaceRequired = false;

        const last = lastProfileStateRef.current;
        const changed = last.hasProfile !== nextHasProfile ||
                        last.role !== nextRole ||
                        last.verified !== nextVerified ||
                        last.isStandby !== nextIsStandby ||
                        last.faceVerificationRequired !== nextFaceRequired;

        if (changed) {
          lastProfileStateRef.current = {
            hasProfile: nextHasProfile,
            role: nextRole,
            verified: nextVerified,
            isStandby: nextIsStandby,
            faceVerificationRequired: nextFaceRequired
          };
          setHasProfile(nextHasProfile);
          setUserRole(nextRole);
          setUserDocVerified(nextVerified);
          setIsStandby(nextIsStandby);
          setFaceVerificationRequired(nextFaceRequired);
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
  }, []);

  // Refined real-time presence system with optimized offline updates
  useEffect(() => {
    if (!user || !hasProfile) return;

    const userLocRef = doc(db, 'locations', user.uid);
    let currentPrefStatus = 'online';

    // Subscribes to the user's status preference (e.g., 'invisivel') to avoid overwriting manually configured statuses
    const unsubUserLoc = onSnapshot(userLocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status) {
          currentPrefStatus = data.status;
        }
      }
    });

    let lastLoggedStatus: string | null = null;

    const setPresenceStatus = async (status: 'online' | 'offline') => {
      if (!auth.currentUser) return;
      try {
        if (currentPrefStatus === 'invisivel') {
          // Keep invisivel status but update freshness timestamp
          await setDoc(userLocRef, {
            atualizadoEm: Date.now()
          }, { merge: true });
          return;
        }

        const timestamp = Date.now();
        await setDoc(userLocRef, {
          status: status,
          atualizadoEm: timestamp
        }, { merge: true });

        // Log to history only when presence state changes
        if (lastLoggedStatus !== status) {
          lastLoggedStatus = status;
          await addDoc(collection(db, 'locations', user.uid, 'history'), {
            tipo: 'presenca_conexao',
            status: status,
            timestamp: timestamp
          });
        }
      } catch (err) {
        console.error(`Error updating user presence to ${status}: `, err);
      }
    };

    const updatePresence = () => {
      if (!auth.currentUser) return;
      if (document.visibilityState === 'visible' && navigator.onLine) {
        setPresenceStatus('online');
      }
    };

    // Update status to online immediately upon mount
    updatePresence();

    // Maintain session freshness every 30 seconds
    const interval = setInterval(updatePresence, 30000);

    const handleVisibilityChange = () => {
      if (!auth.currentUser) return;
      const isSos = localStorage.getItem('sos_tracking_active') === 'true';
      if (document.visibilityState === 'visible') {
        setPresenceStatus('online');
      } else {
        if (!isSos) {
          setPresenceStatus('offline');
        }
      }
    };

    const handleUnload = () => {
      if (!auth.currentUser) return;
      const isSos = localStorage.getItem('sos_tracking_active') === 'true';
      if (currentPrefStatus !== 'invisivel' && !isSos) {
        setDoc(userLocRef, {
          status: 'offline',
          atualizadoEm: Date.now()
        }, { merge: true }).catch(err => console.error("Error setting offline on unload:", err));
      }
    };

    const handleNetworkOnline = () => {
      if (auth.currentUser) setPresenceStatus('online');
    };
    const handleNetworkOffline = () => {
      if (auth.currentUser) {
        const isSos = localStorage.getItem('sos_tracking_active') === 'true';
        if (!isSos) {
          setPresenceStatus('offline');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('online', handleNetworkOnline);
    window.addEventListener('offline', handleNetworkOffline);

    return () => {
      clearInterval(interval);
      unsubUserLoc();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('online', handleNetworkOnline);
      window.removeEventListener('offline', handleNetworkOffline);

      const isSos = localStorage.getItem('sos_tracking_active') === 'true';
      if (currentPrefStatus !== 'invisivel' && auth.currentUser && !isSos) {
        setDoc(userLocRef, {
          status: 'offline',
          atualizadoEm: Date.now()
        }, { merge: true }).catch(err => console.error("Error setting offline on cleanup:", err));
      }
    };
  }, [user, hasProfile]);

  // Register Service Worker for PWA / background support
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg: any) => {
          console.log('[Service Worker] Registered successfully with scope:', reg.scope);
          if ('sync' in reg) {
            reg.sync.register('sos-sync').catch((err: any) => {
              console.warn('[Service Worker] Sync registration failed:', err);
            });
          }
        })
        .catch((err) => {
          console.error('[Service Worker] Registration failed:', err);
        });
    }
  }, []);

  // Background SOS emergency location tracking (updates every 3 minutes, using watchPosition for background persistence)
  useEffect(() => {
    if (!user) return;

    let watchId: number | null = null;

    const trackSosLocation = async () => {
      const active = localStorage.getItem('sos_tracking_active') === 'true';
      if (!active) {
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }
        return;
      }

      if (!navigator.geolocation) return;

      // Ensure we have a continuous watchPosition active
      if (watchId === null) {
        watchId = navigator.geolocation.watchPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const timestamp = Date.now();
            try {
              const { geohashForLocation } = await import('geofire-common');
              const hash = geohashForLocation([latitude, longitude]);

              // Update primary location and set active flag so they appear online and in SOS mode
              await setDoc(doc(db, 'locations', user.uid), {
                geohash: hash,
                lat: latitude,
                lng: longitude,
                atualizadoEm: timestamp,
                status: 'online', // Keep online so they are visible
                sosActive: true
              }, { merge: true });

              await addDoc(collection(db, 'locations', user.uid, 'history'), {
                tipo: 'sos_tracking',
                lat: latitude,
                lng: longitude,
                timestamp: timestamp
              });
              console.log("[SOS Tracker Background] Location updated:", latitude, longitude);

              // Check if we should send a WhatsApp location update message (every 3 minutes, skipping the first run)
              const lastWaSent = localStorage.getItem('sos_last_wa_sent');
              const phone = localStorage.getItem('sos_contact_phone');
              const now = Date.now();
              if (lastWaSent && phone) {
                const diff = now - parseInt(lastWaSent, 10);
                // Check if at least 2.5 minutes (150000ms) have passed
                if (diff >= 150000) {
                  const pad = (n: number) => n.toString().padStart(2, '0');
                  const dObj = new Date(now);
                  const day = pad(dObj.getDate());
                  const month = pad(dObj.getMonth() + 1);
                  const year = dObj.getFullYear();
                  const hours = pad(dObj.getHours());
                  const minutes = pad(dObj.getMinutes());
                  const seconds = pad(dObj.getSeconds());
                  const dateTimeStr = `${day}/${month}/${year} às ${hours}:${minutes}:${seconds}`;

                  const locationUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;

                  const formattedMessage = `⚠️ [ALERTA DE EMERGÊNCIA ATUALIZADO] Minha posição atual é essa: ${locationUrl}\nData e horário: ${dateTimeStr}\n\nPor favor vá atualizando as autoridades policiais.`;

                  let cleanPhone = phone.replace(/\D/g, '');
                  if (cleanPhone.length === 11 || cleanPhone.length === 10) {
                    cleanPhone = '55' + cleanPhone;
                  }
                  const encodedMsg = encodeURIComponent(formattedMessage);
                  const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;

                  localStorage.setItem('sos_last_wa_sent', now.toString());
                  window.open(waUrl, '_blank');
                  console.log("[SOS Tracker Background] Opened WhatsApp update message redirect.");
                }
              } else if (!lastWaSent && phone) {
                localStorage.setItem('sos_last_wa_sent', now.toString());
              }
            } catch (err) {
              console.error("[SOS Tracker] Error saving tracking location:", err);
            }
          },
          (err) => {
            console.warn("[SOS Tracker] Geolocation watch error during SOS tracking:", err);
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
      }
    };

    // Run immediately if active
    trackSosLocation();

    // Check and update every 3 minutes (180000 ms) as a robust fallback
    const interval = setInterval(() => {
      trackSosLocation();
    }, 180000);

    // Listen to localStorage changes in the same window (custom SOS stop event)
    const handleStorageChange = () => {
      trackSosLocation();
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user]);

  const isAdmin = user && (
    user.email === 'ceo@newfriends.com' || 
    user.email === 'sac@wegbusiness.com' || 
    user.email === 'ceo@wegbusiness.com' || 
    user.email === 'wegbusinessandsolutions@gmail.com' ||
    userRole === 'Admin' ||
    userRole === 'CEO'
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-500 font-medium">
        Carregando...
      </div>
    );
  }

  return (
    <HashRouter>
      <AnimatedRoutes
        user={user}
        setUser={setUser}
        isAdmin={isAdmin}
        appConfig={appConfig}
        faceVerificationRequired={faceVerificationRequired}
        setFaceVerificationRequired={setFaceVerificationRequired}
        isStandby={isStandby}
        hasProfile={hasProfile}
        setHasProfile={setHasProfile}
        showTour={showTour}
        setShowTour={setShowTour}
        showConnectionAnim={showConnectionAnim}
        setShowConnectionAnim={setShowConnectionAnim}
        handleDiscoverStart={handleDiscoverStart}
        handleDiscoverEnd={handleDiscoverEnd}
        handleChatsStart={handleChatsStart}
        handleChatsEnd={handleChatsEnd}
      />
    </HashRouter>
  );
}

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
      className="w-full flex-1 flex flex-col"
    >
      {children}
    </motion.div>
  );
}

interface AuthenticatedLayoutProps {
  user: User | null;
  setUser: (user: User | null) => void;
  isAdmin: boolean;
  appConfig: any;
  faceVerificationRequired: boolean;
  setFaceVerificationRequired: (val: boolean) => void;
  isStandby: boolean;
  hasProfile: boolean;
  setHasProfile: (val: boolean) => void;
  showTour: boolean;
  setShowTour: (show: boolean) => void;
  showConnectionAnim: boolean;
  setShowConnectionAnim: (show: boolean) => void;
}

function AuthenticatedLayout({
  user,
  setUser,
  isAdmin,
  appConfig,
  faceVerificationRequired,
  setFaceVerificationRequired,
  isStandby,
  hasProfile,
  setHasProfile,
  showTour,
  setShowTour,
  showConnectionAnim,
  setShowConnectionAnim
}: AuthenticatedLayoutProps) {
  // 1. Unauthenticated state
  if (!user) {
    return <Login />;
  }

  // 2. Maintenance Mode screen block
  if (appConfig?.maintenanceMode && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 px-6 font-sans text-white text-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mb-6 animate-pulse">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold mb-3">Modo Manutenção Ativo</h1>
        <p className="text-slate-400 text-sm max-w-sm leading-relaxed mb-6">
          Estamos realizando melhorias e manutenção programada no aplicativo. Voltaremos em breve!
        </p>
        <button
          onClick={() => auth.signOut()}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition-all"
        >
          Sair da Conta
        </button>
      </div>
    );
  }

  // 3. Face lock verification block
  if (faceVerificationRequired) {
    return (
      <AppFaceLockScreen 
        user={user} 
        onSuccess={() => {
          sessionStorage.setItem(`face_verified_${user.uid}`, 'true');
          setFaceVerificationRequired(false);
        }}
        onCancel={async () => {
          setFaceVerificationRequired(false);
          await auth.signOut();
        }}
      />
    );
  }

  // 4. Standby check block
  if (isStandby) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 px-6 font-sans text-center relative max-w-md w-full mx-auto border-x border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/40 rounded-3xl flex items-center justify-center shadow-md mb-6 border border-amber-200/30">
          <Moon className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Modo StandBy Ativo</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8 font-medium">
          Sua conta está adormecida no modo StandBy. Seus dados e conexões permanecem salvos com segurança, mas seu perfil está invisível para os outros usuários.
        </p>
        <div className="space-y-3 w-full px-4">
          <button
            onClick={async () => {
              try {
                const { doc, updateDoc } = await import('firebase/firestore');
                await updateDoc(doc(db, 'users', user.uid), {
                  'status.ativo': true
                });
                alert(`E-mail de confirmação enviado para ${user.email}. Sua conta foi reativada com sucesso! Bem-vindo(a) de volta! 😊`);
              } catch (e) {
                console.error(e);
                alert('Erro ao reativar conta. Por favor, tente novamente.');
              }
            }}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold rounded-xl text-sm transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reativar Minha Conta</span>
          </button>
          <button
            onClick={() => auth.signOut()}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-350 rounded-xl text-xs font-bold transition-all border border-slate-200/40 dark:border-slate-800/40 cursor-pointer"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    );
  }

  // 5. Onboarding profile block
  if (!hasProfile) {
    return <Onboarding onComplete={() => setHasProfile(true)} />;
  }

  // 6. Email verification block
  if (!user.emailVerified && !isAdmin) {
    return (
      <VerifyEmail 
        user={user} 
        onVerified={async () => {
          await auth.currentUser?.reload();
          setUser({ ...auth.currentUser } as User);
        }} 
      />
    );
  }

  // 7. Render fully authenticated layout & app shell with outlet
  return (
    <div id="app-container" className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 mx-auto max-w-md w-full relative shadow-2xl overflow-hidden border-x border-slate-200 dark:border-slate-800">
      <Header onStartTour={() => {
        sessionStorage.removeItem('tour_current_step');
        setShowTour(true);
      }} />
      
      {/* Global Alert Banner */}
      {appConfig?.globalBannerText && (
        <div className="bg-amber-500 text-white px-4 py-2 text-xs font-bold flex items-center gap-2 text-center justify-center border-b border-amber-600 shrink-0">
          <span className="shrink-0">📢</span>
          <span className="truncate">{appConfig.globalBannerText}</span>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-[92px]">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      
      <Navigation />

      {/* Walkthrough Tour Overlay */}
      {showTour && <WalkthroughTour onClose={() => setShowTour(false)} />}

      {/* Connection Animation Overlay */}
      {showConnectionAnim && (
        <ConnectionAnimation onComplete={() => {
          setShowConnectionAnim(false);
          sessionStorage.removeItem('just_logged_in');
        }} />
      )}
    </div>
  );
}

interface AnimatedRoutesProps {
  user: User | null;
  setUser: (user: User | null) => void;
  isAdmin: boolean;
  appConfig: any;
  faceVerificationRequired: boolean;
  setFaceVerificationRequired: (val: boolean) => void;
  isStandby: boolean;
  hasProfile: boolean;
  setHasProfile: (val: boolean) => void;
  showTour: boolean;
  setShowTour: (show: boolean) => void;
  showConnectionAnim: boolean;
  setShowConnectionAnim: (show: boolean) => void;
  handleDiscoverStart: () => void;
  handleDiscoverEnd: () => void;
  handleChatsStart: () => void;
  handleChatsEnd: () => void;
}

function AnimatedRoutes({
  user,
  setUser,
  isAdmin,
  appConfig,
  faceVerificationRequired,
  setFaceVerificationRequired,
  isStandby,
  hasProfile,
  setHasProfile,
  showTour,
  setShowTour,
  showConnectionAnim,
  setShowConnectionAnim,
  handleDiscoverStart,
  handleDiscoverEnd,
  handleChatsStart,
  handleChatsEnd
}: AnimatedRoutesProps) {
  const location = useLocation();

  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400 dark:text-slate-500 font-sans">
        <div className="w-8 h-8 border-4 border-indigo-650 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Carregando...</p>
      </div>
    }>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route element={
            <AuthenticatedLayout
              user={user}
              setUser={setUser}
              isAdmin={isAdmin}
              appConfig={appConfig}
              faceVerificationRequired={faceVerificationRequired}
              setFaceVerificationRequired={setFaceVerificationRequired}
              isStandby={isStandby}
              hasProfile={hasProfile}
              setHasProfile={setHasProfile}
              showTour={showTour}
              setShowTour={setShowTour}
              showConnectionAnim={showConnectionAnim}
              setShowConnectionAnim={setShowConnectionAnim}
            />
          }>
            <Route
              path="/"
              element={
                <PageTransition>
                  <Discover
                    onInitialLoadStart={handleDiscoverStart}
                    onInitialLoadEnd={handleDiscoverEnd}
                  />
                </PageTransition>
              }
            />
            <Route
              path="/flirt"
              element={
                <PageTransition>
                  <FlirtSwipe />
                </PageTransition>
              }
            />
            <Route
              path="/admin"
              element={
                <PageTransition>
                  <AdminCRM />
                </PageTransition>
              }
            />
            <Route
              path="/profile/:id"
              element={
                <PageTransition>
                  <ProfileDetails />
                </PageTransition>
              }
            />
            <Route
              path="/quick-messages"
              element={
                <PageTransition>
                  <QuickMessages />
                </PageTransition>
              }
            />
            <Route
              path="/friend-requests"
              element={
                <PageTransition>
                  <Friends />
                </PageTransition>
              }
            />
            <Route
              path="/chats"
              element={
                <PageTransition>
                  <ChatList
                    onLoadStart={handleChatsStart}
                    onLoadEnd={handleChatsEnd}
                  />
                </PageTransition>
              }
            />
            <Route
              path="/chat/:chatId"
              element={
                <PageTransition>
                  <ChatRoom />
                </PageTransition>
              }
            />
            <Route
              path="/recent-activities"
              element={
                <PageTransition>
                  <RecentActivities />
                </PageTransition>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}
