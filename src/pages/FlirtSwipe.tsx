import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  setDoc, 
  doc, 
  updateDoc, 
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { 
  Heart, 
  X, 
  Star, 
  RotateCcw, 
  Zap, 
  CheckCircle, 
  MessageCircle, 
  MapPin, 
  Flame, 
  Info, 
  Compass, 
  AlertCircle,
  Sparkles,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getDemonym } from '../lib/demonyms';
import { MOCK_USERS, NearbyUser } from './Discover';
import ZodiacBadge from '../components/ZodiacBadge';

// Custom objectives for dating app fidelity
const OBJECTIVES = [
  "Algo sério, mas vamos ver...",
  "Bater um papo e dar risadas",
  "Fazer novas amizades",
  "Conexão verdadeira & cafés",
  "Aventuras e viagens compartilhadas",
  "Ainda descobrindo o que quero",
  "Companhia para shows e rolês"
];

const getObjectiveLabel = (obj: string) => {
  if (!obj) return '';
  const mapping: { [key: string]: string } = {
    'casual': 'Encontros casuais',
    'serio': 'Relacionamento sério',
    'amizade': 'Novas amizades',
    'no_momento': 'No momento'
  };
  return mapping[obj.toLowerCase()] || obj;
};

export default function FlirtSwipe() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<NearbyUser[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<number[]>([]); // Track indices for Undo
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | null>(null);
  
  // Match & Action Modals
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchUser, setMatchUser] = useState<NearbyUser | null>(null);
  const [icebreaker, setIcebreaker] = useState('Oi! Vi seu perfil e achei super interessante. Vamos conversar? 😊');
  const [showQuickChatModal, setShowQuickChatModal] = useState(false);
  const [quickChatUser, setQuickChatUser] = useState<NearbyUser | null>(null);
  const [quickMessageText, setQuickMessageText] = useState('');
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  
  // Swiped set to avoid showing already swiped profiles in this session
  const [swipedIds, setSwipedIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('swiped_user_ids');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Photo Carousel States & Timer
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // State for match overlay photo transitions
  const [matchPhotoIndex, setMatchPhotoIndex] = useState(0);

  // Transition match overlay photos every 3 seconds
  useEffect(() => {
    if (!showMatchModal) {
      setMatchPhotoIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setMatchPhotoIndex(prev => prev + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, [showMatchModal]);

  const hasMore = currentIndex < profiles.length;
  const currentProfile = hasMore ? profiles[currentIndex] : null;

  // Memoized lists of photos for current user and matched user in match overlay modal
  const currentUserPhotos = useMemo(() => {
    const list = [
      currentUserProfile?.profile?.fotoPrincipalUrl,
      ...(currentUserProfile?.profile?.fotosAdicionais || [])
    ].filter(Boolean);
    if (list.length === 0) {
      if (auth.currentUser?.photoURL) {
        list.push(auth.currentUser.photoURL);
      } else {
        list.push(`https://api.dicebear.com/9.x/notionists/svg?seed=${auth.currentUser?.uid}`);
      }
    }
    return list;
  }, [currentUserProfile]);

  const matchUserPhotos = useMemo(() => {
    if (!matchUser) return [];
    const list = [
      matchUser.profile.fotoPrincipalUrl,
      ...(matchUser.profile.fotosAdicionais || [])
    ].filter(Boolean);
    if (list.length === 0) {
      list.push(`https://api.dicebear.com/9.x/notionists/svg?seed=${matchUser.userId}`);
    }
    return list;
  }, [matchUser]);

  const activeCurrentUserPhoto = currentUserPhotos[matchPhotoIndex % currentUserPhotos.length];
  const activeMatchUserPhoto = matchUserPhotos[matchPhotoIndex % matchUserPhotos.length];

  // Generate 3 unique photos for each profile to feed the rotation carousel
  const profilePhotos = useMemo(() => {
    if (!currentProfile) return [];
    const mainPhoto = currentProfile.profile?.fotoPrincipalUrl || `https://api.dicebear.com/9.x/notionists/svg?seed=${currentProfile.userId}`;
    
    // Fallback Unsplash galleries per gender
    const isFemale = currentProfile.profile?.sexo === 'feminino';
    const list = isFemale ? [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80',
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&q=80',
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&q=80',
      'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=400&q=80',
      'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400&q=80'
    ] : [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80',
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80',
      'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=400&q=80',
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80',
      'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80',
      'https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=400&q=80',
      'https://images.unsplash.com/photo-1489980508314-941910ded1f4?w=400&q=80'
    ];

    // Compute consistent indexes based on the profile userId
    let hash = 0;
    for (let i = 0; i < currentProfile.userId.length; i++) {
      hash = currentProfile.userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx1 = Math.abs(hash) % list.length;
    const idx2 = Math.abs(hash + 1) % list.length;

    let photo2 = list[idx1];
    let photo3 = list[idx2];

    if (photo2 === mainPhoto) {
      photo2 = list[(idx1 + 1) % list.length];
    }
    if (photo3 === mainPhoto || photo3 === photo2) {
      photo3 = list[(idx2 + 2) % list.length];
    }

    return [mainPhoto, photo2, photo3];
  }, [currentProfile]);

  // Rotate photos every 3 seconds
  useEffect(() => {
    setCurrentPhotoIndex(0);
    if (!hasMore || !currentProfile) return;

    const interval = setInterval(() => {
      setCurrentPhotoIndex(prev => (prev + 1) % 3);
    }, 3000);

    return () => clearInterval(interval);
  }, [currentIndex, hasMore, currentProfile?.userId]);

  useEffect(() => {
    fetchSwipeProfiles();
  }, []);

  const fetchSwipeProfiles = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      // Fetch the current user's profile to get their interest/preference (interesse)
      let myInteresse = 'todos';
      
      // Load from local cache instantly
      try {
        const cached = localStorage.getItem(`user_profile_cache_${auth.currentUser.uid}`);
        if (cached) {
          const cachedData = JSON.parse(cached);
          myInteresse = cachedData?.profile?.interesse || 'todos';
          setCurrentUserProfile(cachedData);
        }
      } catch (cacheErr) {
        console.error("Error reading cached user profile in FlirtSwipe:", cacheErr);
      }

      const myUserDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (myUserDoc.exists()) {
        const uData = myUserDoc.data();
        myInteresse = uData?.profile?.interesse || 'todos';
        setCurrentUserProfile(uData);
        // Save to cache
        try {
          localStorage.setItem(`user_profile_cache_${auth.currentUser.uid}`, JSON.stringify(uData));
        } catch (cacheErr) {
          console.error("Error writing user profile cache in FlirtSwipe:", cacheErr);
        }
      }

      // Fetch coordinates of current user
      let myCoords = null;
      const myLocDoc = await getDoc(doc(db, 'locations', auth.currentUser.uid));
      if (myLocDoc.exists()) {
        const d = myLocDoc.data();
        if (d.lat && d.lng) {
          myCoords = { lat: d.lat, lng: d.lng };
        }
      }

      // Query active locations
      const locsQuery = query(collection(db, 'locations'), where('visivel', '==', true));
      const locsSnap = await getDocs(locsQuery);

      // Fetch blocked users
      const blockedIds = new Set<string>([auth.currentUser.uid]); // exclude self
      try {
        const blockedByMeSnap = await getDocs(query(collection(db, 'blocks'), where('blockedBy', '==', auth.currentUser.uid)));
        blockedByMeSnap.docs.forEach(d => {
          const uId = d.data().blockedUser;
          if (uId) blockedIds.add(uId);
        });
      } catch (err) {
        console.warn('Could not fetch blockedByMe list:', err);
      }

      try {
        const blockedMeSnap = await getDocs(query(collection(db, 'blocks'), where('blockedUser', '==', auth.currentUser.uid)));
        blockedMeSnap.docs.forEach(d => {
          const uId = d.data().blockedBy;
          if (uId) blockedIds.add(uId);
        });
      } catch (err) {
        console.warn('Could not fetch blockedMe list:', err);
      }

      const matchingList: NearbyUser[] = [];
      const { distanceBetween } = await import('geofire-common');

      for (const d of locsSnap.docs) {
        if (blockedIds.has(d.id)) continue;
        const locData = d.data();
        if (!locData.lat || !locData.lng) continue;

        let distanceValue = 2000; // default mockup
        let displayDistance = "Até 2 km";

        if (myCoords) {
          const km = distanceBetween([locData.lat, locData.lng], [myCoords.lat, myCoords.lng]);
          distanceValue = km * 1000;
          displayDistance = km < 1 ? `Até ${Math.ceil(km * 1000)} m` : `Até ${Math.ceil(km)} km`;
        }

        // Fetch user data
        const userDoc = await getDoc(doc(db, 'users', d.id));
        if (userDoc.exists()) {
          const uData = userDoc.data();
          if (uData?.status?.ativo && !uData?.status?.banido && uData?.ocultarPerfil !== true) {
            matchingList.push({
              userId: d.id,
              distance: displayDistance,
              distanceValue,
              idVerified: uData?.idVerified || false,
              profile: {
                ...uData?.profile,
                verified: uData?.verified
              }
            });
          }
        }
      }

      // Add mock users to ensure plentiful cards
      const loadedIds = new Set(matchingList.map(u => u.userId));
      MOCK_USERS.forEach(mock => {
        if (!loadedIds.has(mock.userId)) {
          matchingList.push(mock);
        }
      });

      // Filter by interest (gênero de preferência)
      const matchedByInterest = matchingList.filter(u => {
        const myInt = myInteresse.toLowerCase();
        if (myInt === 'todos' || myInt === 'ambos') return true;
        const targetSexo = u.profile?.sexo?.toLowerCase();
        if (myInt === 'homens' || myInt === 'masculino') return targetSexo === 'masculino';
        if (myInt === 'mulheres' || myInt === 'feminino') return targetSexo === 'feminino';
        return targetSexo === myInt;
      });

      // Filter out profiles already swiped in this session
      const filtered = matchedByInterest.filter(u => !swipedIds.has(u.userId));
      
      // Shuffle slightly or sort by distance
      filtered.sort((a, b) => (a.distanceValue || 9999) - (b.distanceValue || 9999));

      setProfiles(filtered);
    } catch (err) {
      console.error("Error loading swipe profiles:", err);
      // Fallback directly to mock users with preference filter
      let myInteresse = 'todos';
      try {
        const myUserDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (myUserDoc.exists()) {
          myInteresse = myUserDoc.data().profile?.interesse || 'todos';
        }
      } catch (e) {
        console.error("Error fetching my interest in fallback:", e);
      }
      
      const filteredMocks = MOCK_USERS.filter(u => {
        if (swipedIds.has(u.userId)) return false;
        const myInt = myInteresse.toLowerCase();
        if (myInt === 'todos' || myInt === 'ambos') return true;
        const targetSexo = u.profile?.sexo?.toLowerCase();
        if (myInt === 'homens' || myInt === 'masculino') return targetSexo === 'masculino';
        if (myInt === 'mulheres' || myInt === 'feminino') return targetSexo === 'feminino';
        return targetSexo === myInt;
      });
      setProfiles(filteredMocks);
    } finally {
      setLoading(false);
    }
  };

  const recordSwipe = (userId: string) => {
    const nextSet = new Set(swipedIds);
    nextSet.add(userId);
    setSwipedIds(nextSet);
    localStorage.setItem('swiped_user_ids', JSON.stringify(Array.from(nextSet)));
  };

  const handleLike = async () => {
    if (profiles.length === 0 || currentIndex >= profiles.length) return;
    const currentProfile = profiles[currentIndex];
    setSwipeDirection('right');
    recordSwipe(currentProfile.userId);

    // Add to history for Undo
    setHistory(prev => [...prev, currentIndex]);

    // Handle Match logic
    if (auth.currentUser) {
      try {
        const friendId = currentProfile.userId;
        // Verify if friend already liked or sent us a request
        const incomingReqRef = doc(db, 'friendRequests', `${friendId}_${auth.currentUser.uid}`);
        const incomingSnap = await getDoc(incomingReqRef);

        if (incomingSnap.exists() && incomingSnap.data().status === 'pending') {
          // It's an instant real match!
          await updateDoc(incomingReqRef, {
            status: 'accepted',
            updatedAt: serverTimestamp()
          });

          await setDoc(doc(db, 'connections', `${auth.currentUser.uid}_${friendId}`), {
            users: [auth.currentUser.uid, friendId],
            permissions: {},
            categories: {
              [auth.currentUser.uid]: 'Geral',
              [friendId]: 'Geral'
            },
            createdAt: serverTimestamp()
          });

          // Show Match Modal
          setMatchUser(currentProfile);
          setShowMatchModal(true);
        } else {
          // Send request
          const outgoingReqId = `${auth.currentUser.uid}_${friendId}`;
          const outgoingReqRef = doc(db, 'friendRequests', outgoingReqId);
          const outgoingSnap = await getDoc(outgoingReqRef);

          if (!outgoingSnap.exists()) {
            await setDoc(outgoingReqRef, {
              fromUserId: auth.currentUser.uid,
              toUserId: friendId,
              status: 'pending',
              createdAt: serverTimestamp()
            });
          }

          // If it's a mock profile, simulate 45% chance of instant match for engagement!
          if (friendId.startsWith('mock') && Math.random() < 0.45) {
            setTimeout(() => {
              setMatchUser(currentProfile);
              setShowMatchModal(true);
            }, 600);
          }
        }
      } catch (err) {
        console.error("Error during match handling:", err);
        // Fallback for offline/firestore errors
        if (currentProfile.userId.startsWith('mock') && Math.random() < 0.45) {
          setTimeout(() => {
            setMatchUser(currentProfile);
            setShowMatchModal(true);
          }, 600);
        }
      }
    }

    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setSwipeDirection(null);
    }, 400);
  };

  const handleDislike = () => {
    if (profiles.length === 0 || currentIndex >= profiles.length) return;
    const currentProfile = profiles[currentIndex];
    setSwipeDirection('left');
    recordSwipe(currentProfile.userId);

    setHistory(prev => [...prev, currentIndex]);

    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setSwipeDirection(null);
    }, 400);
  };

  const handleSuperLike = () => {
    if (profiles.length === 0 || currentIndex >= profiles.length) return;
    const currentProfile = profiles[currentIndex];
    setSwipeDirection('up');
    recordSwipe(currentProfile.userId);

    setHistory(prev => [...prev, currentIndex]);

    // Super Match modal is triggered instantly
    setTimeout(() => {
      setMatchUser(currentProfile);
      setShowMatchModal(true);
    }, 200);

    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setSwipeDirection(null);
    }, 400);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const lastIndex = history[history.length - 1];
    
    // Remove the last profile ID from swiped Set
    const lastProfile = profiles[lastIndex];
    if (lastProfile) {
      const nextSet = new Set(swipedIds);
      nextSet.delete(lastProfile.userId);
      setSwipedIds(nextSet);
      localStorage.setItem('swiped_user_ids', JSON.stringify(Array.from(nextSet)));
    }

    setHistory(prev => prev.slice(0, -1));
    setCurrentIndex(lastIndex);
  };

  const handleQuickChat = () => {
    if (profiles.length === 0 || currentIndex >= profiles.length) return;
    const currentProfile = profiles[currentIndex];
    setQuickChatUser(currentProfile);
    setQuickMessageText('');
    setShowQuickChatModal(true);
  };

  const sendQuickChatMessage = async () => {
    if (!quickChatUser || !auth.currentUser) return;
    
    const friendId = quickChatUser.userId;
    const msgText = quickMessageText.trim() || "Oi! Adorei seu perfil! Quer conversar? 👋";
    
    try {
      // Ensure there is a connection in the database so they can chat
      const connRef = doc(db, 'connections', `${auth.currentUser.uid}_${friendId}`);
      const connSnap = await getDoc(connRef);
      if (!connSnap.exists()) {
        await setDoc(connRef, {
          users: [auth.currentUser.uid, friendId],
          permissions: {},
          categories: {
            [auth.currentUser.uid]: 'Geral',
            [friendId]: 'Geral'
          },
          createdAt: serverTimestamp()
        });
      }

      const chatId = [auth.currentUser.uid, friendId].sort().join('_');
      const messageId = `msg_${Date.now()}_quick`;
      
      // Ensure parent chat document exists first
      const chatRef = doc(db, 'chats', chatId);
      await setDoc(chatRef, {
        participantes: [auth.currentUser.uid, friendId],
        ultimaMensagem: msgText,
        ultimaMensagemEm: new Date().getTime(),
        [`unreadCount_${friendId}`]: increment(1)
      }, { merge: true });

      // Send the actual message
      await setDoc(doc(db, 'chats', chatId, 'messages', messageId), {
        id: messageId,
        senderId: auth.currentUser.uid,
        type: 'text',
        text: msgText,
        sentAt: new Date().toISOString(),
        status: 'sent'
      });

      // Save locally for primary persistence
      const localHistoryKey = `chat_history_${chatId}`;
      const local = localStorage.getItem(localHistoryKey);
      const list = local ? JSON.parse(local) : [];
      list.push({
        id: messageId,
        senderId: auth.currentUser.uid,
        type: 'text',
        text: msgText,
        sentAt: new Date().toISOString(),
        status: 'sent'
      });
      localStorage.setItem(localHistoryKey, JSON.stringify(list));

      setShowQuickChatModal(false);
      navigate(`/chat/${chatId}`);
    } catch (err) {
      console.error("Error sending quick message:", err);
      // Fallback: just open chat room
      const chatId = [auth.currentUser.uid, friendId].sort().join('_');
      navigate(`/chat/${chatId}`);
    }
  };

  const sendMatchMessage = async () => {
    if (!matchUser || !auth.currentUser) return;
    
    const friendId = matchUser.userId;
    const msgText = icebreaker.trim() || 'Oi! Vi seu perfil e achei super interessante. Vamos conversar? 😊';
    
    try {
      // Connect
      const connRef = doc(db, 'connections', `${auth.currentUser.uid}_${friendId}`);
      const connSnap = await getDoc(connRef);
      if (!connSnap.exists()) {
        await setDoc(connRef, {
          users: [auth.currentUser.uid, friendId],
          permissions: {},
          categories: {
            [auth.currentUser.uid]: 'Geral',
            [friendId]: 'Geral'
          },
          createdAt: serverTimestamp()
        });
      }

      const chatId = [auth.currentUser.uid, friendId].sort().join('_');
      const messageId = `msg_${Date.now()}_match`;
      
      // Ensure parent chat document exists first
      const chatRef = doc(db, 'chats', chatId);
      await setDoc(chatRef, {
        participantes: [auth.currentUser.uid, friendId],
        ultimaMensagem: msgText,
        ultimaMensagemEm: new Date().getTime(),
        [`unreadCount_${friendId}`]: increment(1)
      }, { merge: true });

      // Send message
      await setDoc(doc(db, 'chats', chatId, 'messages', messageId), {
        id: messageId,
        senderId: auth.currentUser.uid,
        type: 'text',
        text: msgText,
        sentAt: new Date().toISOString(),
        status: 'sent'
      });

      setShowMatchModal(false);
      navigate(`/chat/${chatId}`);
    } catch (err) {
      console.error("Error sending match chat:", err);
      const chatId = [auth.currentUser.uid, friendId].sort().join('_');
      navigate(`/chat/${chatId}`);
    }
  };

  // Reset swiped list to swipe again
  const handleResetSwipes = () => {
    setSwipedIds(new Set());
    localStorage.removeItem('swiped_user_ids');
    setCurrentIndex(0);
    setHistory([]);
    fetchSwipeProfiles();
  };

  if (loading) {
    return (
      <div className="h-[calc(100dvh-140px)] flex flex-col items-center justify-center bg-slate-50 text-slate-500 font-medium">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-md mb-3 animate-bounce">
          <Flame className="w-6 h-6 animate-pulse" />
        </div>
        Carregando perfis interessantes...
      </div>
    );
  }


  return (
    <div className="h-[calc(100dvh-154px)] flex flex-col justify-between bg-slate-100 font-sans p-4 select-none overflow-hidden relative">
      
      {/* Immersive Tinder Header */}
      <div className="flex items-center justify-between py-1 px-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 rounded-full flex items-center justify-center text-white shadow-md">
            <Flame className="w-4.5 h-4.5 fill-current" />
          </div>
          <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-amber-500 tracking-tight text-lg">
            New Friends Flert
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleResetSwipes}
            className="p-2 bg-white hover:bg-slate-50 text-slate-500 hover:text-indigo-600 rounded-xl border border-slate-200/60 shadow-sm transition-all"
            title="Recomeçar do início"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold text-[10px] px-2.5 py-1.5 rounded-full shadow-inner flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" /> Swipe Ativo
          </div>
        </div>
      </div>

      {/* Swipe Cards Container */}
      <div className="flex-1 my-3 relative flex items-center justify-center">
        <AnimatePresence mode="popLayout">
          {hasMore && currentProfile ? (
            <motion.div
              key={currentProfile.userId}
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                x: swipeDirection === 'left' ? -350 : swipeDirection === 'right' ? 350 : 0,
                y: swipeDirection === 'up' ? -350 : 0,
                rotate: swipeDirection === 'left' ? -15 : swipeDirection === 'right' ? 15 : 0,
              }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="absolute w-full h-full max-w-sm rounded-[28px] overflow-hidden shadow-2xl border border-slate-200/50 bg-slate-900 cursor-grab active:cursor-grabbing flex flex-col justify-end"
            >
              {/* Profile Main Picture with smooth transition */}
              <AnimatePresence mode="wait">
                <motion.img 
                  key={`${currentProfile.userId}_${currentPhotoIndex}`}
                  src={profilePhotos[currentPhotoIndex] || `https://api.dicebear.com/9.x/notionists/svg?seed=${currentProfile.userId}`} 
                  alt={currentProfile.profile.nome} 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
              </AnimatePresence>

              {/* Top Horizon Stories Segment bars with automatic 3s progress indicators */}
              <div className="absolute top-3 left-0 right-0 px-4 flex gap-1.5 z-20">
                {profilePhotos.map((_, i) => (
                  <div 
                    key={i} 
                    className="h-1 flex-1 bg-white/25 rounded-full overflow-hidden relative"
                  >
                    {/* Filled state: if index is less than current index, it's fully colored */}
                    {i < currentPhotoIndex && (
                      <div className="absolute inset-0 bg-white" />
                    )}
                    {/* Active state: animating progress bar */}
                    {i === currentPhotoIndex && (
                      <motion.div 
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 3, ease: 'linear' }}
                        key={`${currentProfile.userId}_${i}`}
                        className="absolute inset-y-0 left-0 bg-white"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Bottom Info Gradient Shade Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none z-10" />

              {/* Info Overlay Content */}
              <div className="p-5 pb-6 text-white z-20 relative flex flex-col gap-2 pointer-events-auto">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-2xl font-black tracking-tight drop-shadow-md">
                    {currentProfile.profile.nome || currentProfile.profile.apelido}, {currentProfile.profile.idade}
                  </h3>
                  <ZodiacBadge user={currentProfile} variant="pill" />
                  {(currentProfile.idVerified || currentProfile.profile.verified) && (
                    <CheckCircle className="w-5 h-5 text-sky-400 fill-white shrink-0 shadow-sm" aria-label="Perfil verificado com IA" />
                  )}
                  {currentProfile.profile.facialVerified && (
                    <ShieldCheck className="w-5 h-5 text-emerald-400 fill-white shrink-0 shadow-sm" aria-label="Identidade facial certificada" />
                  )}
                </div>

                {/* Location Demonym Title Display */}
                {currentProfile.profile.estadoNascimento && (
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-300 drop-shadow flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    {getDemonym(currentProfile.profile.estadoNascimento, currentProfile.profile.sexo)} • {currentProfile.distance}
                  </p>
                )}

                {/* Looking-for Objective tag */}
                <div className="mt-1 self-start bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-3.5 py-1.5 flex items-center gap-2 shadow-inner">
                  <span className="text-xs">😍</span>
                  <span className="text-[11px] font-extrabold text-white tracking-tight leading-none">
                    {getObjectiveLabel(currentProfile.profile.objetivo) || OBJECTIVES[Math.floor(currentProfile.profile.idade % OBJECTIVES.length)]}
                  </span>
                </div>

                {/* User Bio */}
                {currentProfile.profile.bio && (
                  <p className="text-xs text-slate-200 mt-2 line-clamp-2 leading-relaxed drop-shadow-sm font-medium">
                    "{currentProfile.profile.bio}"
                  </p>
                )}
              </div>
            </motion.div>
          ) : (
            /* Empty State: No more profiles */
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center p-6 bg-white border border-slate-200 rounded-3xl max-w-sm w-full py-12 flex flex-col items-center shadow-lg"
            >
              <div className="w-16 h-16 bg-pink-50 text-pink-500 rounded-full flex items-center justify-center mb-4 shadow-inner">
                <Heart className="w-8 h-8 fill-current animate-pulse" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-lg">Acabaram os perfis por perto!</h3>
              <p className="text-slate-400 text-xs mt-2 max-w-xs leading-relaxed">
                Você visualizou e avaliou todos os perfis disponíveis no momento. 
              </p>
              <p className="text-slate-400 text-xs mt-1 font-medium">
                Deseja recomeçar para rever as pessoas?
              </p>
              
              <button 
                onClick={handleResetSwipes}
                className="mt-6 px-6 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 hover:opacity-95 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all active:scale-95 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Recomeçar de Novo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tinder Styled Action Circle Buttons Row */}
      {hasMore && (
        <div className="flex justify-center items-center gap-3 py-2 shrink-0">
          {/* Undo Button */}
          <button 
            onClick={handleUndo}
            disabled={history.length === 0}
            className="w-12 h-12 rounded-full bg-white border border-slate-100 shadow-md flex items-center justify-center text-amber-500 hover:scale-110 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 transition-all cursor-pointer"
            title="Desfazer último voto"
          >
            <RotateCcw className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Dislike X Button */}
          <button 
            onClick={handleDislike}
            className="w-14 h-14 rounded-full bg-white border border-slate-100 shadow-lg flex items-center justify-center text-pink-500 hover:scale-110 hover:bg-pink-50/50 active:scale-90 transition-all cursor-pointer"
            title="Sem interesse (Dislike)"
          >
            <X className="w-7 h-7 stroke-[2.5]" />
          </button>

          {/* Super Like Star Button */}
          <button 
            onClick={handleSuperLike}
            className="w-12 h-12 rounded-full bg-white border border-slate-100 shadow-md flex items-center justify-center text-sky-400 hover:scale-110 hover:bg-sky-50 active:scale-95 transition-all cursor-pointer"
            title="Super Like!"
          >
            <Star className="w-5 h-5 fill-current stroke-[2]" />
          </button>

          {/* Like Heart Button */}
          <button 
            onClick={handleLike}
            className="w-14 h-14 rounded-full bg-white border border-slate-100 shadow-lg flex items-center justify-center text-emerald-500 hover:scale-110 hover:bg-emerald-50 active:scale-90 transition-all cursor-pointer"
            title="Flertar / Like!"
          >
            <Heart className="w-7 h-7 fill-current stroke-[2.5]" />
          </button>

          {/* Quick Chat Zap Button */}
          <button 
            onClick={handleQuickChat}
            className="w-12 h-12 rounded-full bg-white border border-slate-100 shadow-md flex items-center justify-center text-purple-600 hover:scale-110 hover:bg-purple-50 active:scale-95 transition-all cursor-pointer"
            title="Chat Rápido Direto"
          >
            <Zap className="w-5 h-5 fill-current stroke-[2]" />
          </button>
        </div>
      )}

      {/* Match Overlay Modal */}
      {showMatchModal && matchUser && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-6 animate-fadeIn">
          <div className="text-center space-y-1 mb-8">
            <h2 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-400 text-4xl tracking-tighter uppercase animate-pulse">
              Deu Match!
            </h2>
            <p className="text-xs text-slate-300 font-bold">
              Você e {matchUser.profile.nome} curtiram um ao outro.
            </p>
          </div>

          {/* Avatar circles */}
          <div className="flex justify-center items-center gap-6 my-6 relative">
            <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden relative rotate-[-6deg] bg-slate-900">
              <AnimatePresence mode="wait">
                <motion.img 
                  key={`me_${matchPhotoIndex % currentUserPhotos.length}`}
                  src={activeCurrentUserPhoto} 
                  alt="Me" 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>
            </div>
            
            <div className="absolute w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg border-4 border-black z-10 animate-bounce">
              <Heart className="w-6 h-6 fill-current text-white" />
            </div>

            <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden relative rotate-[6deg] bg-slate-900">
              <AnimatePresence mode="wait">
                <motion.img 
                  key={`match_${matchPhotoIndex % matchUserPhotos.length}`}
                  src={activeMatchUserPhoto} 
                  alt="Match" 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>
            </div>
          </div>

          {/* Instant Icebreaker Area */}
          <div className="w-full max-w-sm mt-8 space-y-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">Mensagem de Quebra-Gelo</span>
              <textarea 
                value={icebreaker}
                onChange={(e) => setIcebreaker(e.target.value)}
                placeholder="Diga um oi especial..."
                className="w-full bg-slate-950 text-white text-xs p-3 rounded-xl border border-white/10 focus:outline-none focus:border-indigo-500 resize-none"
                rows={3}
              />
            </div>

            <div className="space-y-2.5">
              <button 
                onClick={sendMatchMessage}
                className="w-full bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-extrabold py-3.5 rounded-2xl text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageCircle className="w-4.5 h-4.5" /> Enviar Mensagem & Iniciar Chat
              </button>
              
              <button 
                onClick={() => setShowMatchModal(false)}
                className="w-full bg-white/10 hover:bg-white/15 text-slate-200 font-extrabold py-3 rounded-2xl text-xs transition-all cursor-pointer"
              >
                Continuar Flertando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Chat Overlay Modal */}
      {showQuickChatModal && quickChatUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[24px] w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center shadow-inner shrink-0">
                  <Zap className="w-4.5 h-4.5 fill-current" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">Chat Rápido Direto</h3>
                  <p className="text-[10px] text-slate-400 font-semibold">Envie um flerte rápido para {quickChatUser.profile.nome}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowQuickChatModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3.5 bg-slate-50 border border-slate-100 rounded-2xl p-3">
              <img 
                src={quickChatUser.profile.fotoPrincipalUrl || `https://api.dicebear.com/9.x/notionists/svg?seed=${quickChatUser.userId}`} 
                alt="Target" 
                className="w-11 h-11 rounded-full object-cover border border-slate-200 shadow-sm shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-slate-800 block">{quickChatUser.profile.nome}, {quickChatUser.profile.idade}</span>
                <span className="text-[10px] text-slate-400 truncate block">"{quickChatUser.profile.bio || 'Sem biografia disponível.'}"</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sua Mensagem Instantânea</label>
              <textarea 
                value={quickMessageText}
                onChange={(e) => setQuickMessageText(e.target.value)}
                placeholder="Oi! Adorei seu perfil! Quer conversar? 👋"
                className="w-full border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:outline-none focus:border-purple-500 resize-none bg-slate-50"
                rows={3}
              />
            </div>

            <button 
              onClick={sendQuickChatMessage}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-3 rounded-2xl text-xs shadow-md shadow-purple-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <SendIcon className="w-4.5 h-4.5" /> Enviar Mensagem Rápida agora
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Micro inner send icon
function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
    </svg>
  );
}
