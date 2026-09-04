import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  where, 
  getDocs, 
  getDoc, 
  setDoc,
  deleteDoc,
  doc,
  increment
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { getDemonym } from '../lib/demonyms';
import { resizeImage } from '../lib/resizeImage';
import { 
  Send, 
  ArrowLeft, 
  MoreVertical, 
  Mic, 
  MicOff, 
  Video, 
  Check, 
  CheckCheck, 
  Play, 
  Pause, 
  Smile, 
  Trash2, 
  Clock, 
  Info, 
  Volume2, 
  X,
  AlertCircle,
  Ban,
  UserX,
  MapPin,
  Compass,
  Store,
  Navigation,
  Loader2,
  Camera, Shield, Share2
} from 'lucide-react';

interface ChatMessage {
  id: string;
  senderId: string;
  type: 'text' | 'emoticon' | 'audio' | 'video' | 'location' | 'photo';
  text?: string;
  mediaData?: string;
  locationData?: {
    lat: number;
    lng: number;
    name?: string;
    address?: string;
  };
  sentAt: string;
  seenAt?: string;
  openedAt?: string;
  status: 'sent' | 'seen' | 'opened';
  deletedFor?: string[];
  deletedForAll?: boolean;
  read?: boolean;
}

const EMOTICONS = ["😀", "😂", "😍", "😎", "😜", "👍", "❤️", "🔥", "🎉", "🚀", "👀", "👏", "🙌", "💩"];

const getObjectiveLabel = (obj: string) => {
  if (!obj) return '';
  const mapping: { [key: string]: string } = {
    'casual': 'Casuais',
    'serio': 'Sério',
    'amizade': 'Amizade',
    'no_momento': 'No momento'
  };
  const val = obj.toLowerCase();
  if (mapping[val]) return mapping[val];
  if (val.includes('sério') || val.includes('serio')) return 'Sério';
  if (val.includes('casual')) return 'Casuais';
  if (val.includes('amizade')) return 'Amizade';
  return obj;
};

const getObjectiveBadge = (obj: string) => {
  const label = getObjectiveLabel(obj);
  if (!label) return null;
  
  const text = (obj || '').toLowerCase();
  let emoji = '✨';
  let colorClass = 'bg-indigo-50 text-indigo-600 border border-indigo-100';
  
  if (text.includes('sério') || text.includes('serio') || text.includes('compromisso')) {
    emoji = '💝';
    colorClass = 'bg-rose-50 text-rose-600 border border-rose-100/60';
  } else if (text.includes('casual') || text.includes('pressa')) {
    emoji = '🔥';
    colorClass = 'bg-amber-50 text-amber-600 border border-amber-100/60';
  } else if (text.includes('amizade')) {
    emoji = '💬';
    colorClass = 'bg-teal-50 text-teal-600 border border-teal-100/60';
  }
  
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${colorClass}`}>
      <span>{emoji}</span>
      <span>{label}</span>
    </span>
  );
};

export default function ChatRoom() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  
  // Load initial messages from localStorage for client-only primary persistence
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!chatId) return [];
    const local = localStorage.getItem(`chat_history_${chatId}`);
    return local ? JSON.parse(local) : [];
  });
  
  const [newMessage, setNewMessage] = useState('');
  const [friendProfile, setFriendProfile] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [friendId, setFriendId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [chatReady, setChatReady] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(null);
  const [friendStatus, setFriendStatus] = useState<{ status: string; lastActive: number } | null>(null);
  
  // Blocking and Options states
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByFriend, setIsBlockedByFriend] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isBlockingUser, setIsBlockingUser] = useState(false);
  const [showUnblockConfirm, setShowUnblockConfirm] = useState(false);

  // Message deletion options states
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearMode, setClearMode] = useState<'all' | 'specific'>('all');
  const [specificSender, setSpecificSender] = useState<string>('');

  // Location sharing states
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isSimulatedLocation, setIsSimulatedLocation] = useState(false);
  
  // Media Recorder States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [friendIsTyping, setFriendIsTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);
  const isCurrentlyTypingRef = useRef(false);

  // Function to set typing status in Firestore
  const setMyTypingStatus = async (isTyping: boolean) => {
    if (!auth.currentUser || !chatId) return;
    try {
      isCurrentlyTypingRef.current = isTyping;
      await setDoc(doc(db, 'chats', chatId, 'typing', auth.currentUser.uid), {
        isTyping,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (err) {
      console.error("Error setting typing status:", err);
    }
  };

  const handleTyping = () => {
    if (!isCurrentlyTypingRef.current) {
      setMyTypingStatus(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setMyTypingStatus(false);
    }, 2500);
  };

  useEffect(() => {
    if (!auth.currentUser || !chatId) return;

    setChatReady(false);
    setLoading(true);

    // Extract friend ID from chatId (uid1_uid2)
    const ids = chatId.split('_');
    const fId = ids.find(id => id !== auth.currentUser!.uid);

    getDoc(doc(db, 'users', auth.currentUser!.uid)).then(d => {
      if (d.exists()) {
        setMyProfile(d.data().profile);
      }
    });

    let unsubStatus: (() => void) | undefined = undefined;
    let unsubTyping: (() => void) | undefined = undefined;
    let unsubMyBlock: (() => void) | undefined = undefined;
    let unsubFriendBlock: (() => void) | undefined = undefined;
    if (fId) {
      setFriendId(fId);

      const qConnections = query(
        collection(db, 'connections'),
        where('users', 'array-contains', auth.currentUser!.uid)
      );
      getDocs(qConnections).then(snapshot => {
        let friendFound = false;
        for (const d of snapshot.docs) {
          const data = d.data();
          if (data.users && data.users.includes(fId)) {
            friendFound = true;
            break;
          }
        }
        setIsFriend(friendFound);
      });

      // Fetch friend profile
      getDoc(doc(db, 'users', fId)).then(d => {
        if (d.exists()) {
          setFriendProfile(d.data().profile);
        }
      });

      // Listen to friend's real-time online/offline status
      unsubStatus = onSnapshot(doc(db, 'locations', fId), (docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data();
          setFriendStatus({
            status: d.status || 'online',
            lastActive: d.atualizadoEm || 0,
          });
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `locations/${fId}`);
      });

      // Listen to friend's real-time typing status
      unsubTyping = onSnapshot(doc(db, 'chats', chatId, 'typing', fId), (docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data();
          // Check if typing and updatedAt is fresh (within 15 seconds) to handle offline cases
          const isTyping = d.isTyping === true && (Date.now() - (d.updatedAt || 0) < 15000);
          setFriendIsTyping(isTyping);
        } else {
          setFriendIsTyping(false);
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `chats/${chatId}/typing/${fId}`);
      });

      // Listen to my block on friend
      unsubMyBlock = onSnapshot(doc(db, 'blocks', `${auth.currentUser.uid}_${fId}`), (docSnap) => {
        setIsBlockedByMe(docSnap.exists());
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `blocks/${auth.currentUser.uid}_${fId}`);
      });

      // Listen to friend's block on me
      unsubFriendBlock = onSnapshot(doc(db, 'blocks', `${fId}_${auth.currentUser.uid}`), (docSnap) => {
        setIsBlockedByFriend(docSnap.exists());
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `blocks/${fId}_${auth.currentUser.uid}`);
      });
    }

    // Ensure parent chat document exists
    const chatRef = doc(db, 'chats', chatId);
    getDoc(chatRef).then(async (snap) => {
      if (!snap.exists()) {
        try {
          await setDoc(chatRef, {
            participantes: ids,
            ultimaMensagem: 'Início da conversa',
            ultimaMensagemEm: new Date().getTime()
          });
          setChatReady(true);
        } catch (err) {
          console.error("Error creating chat parent:", err);
          // Fallback so it doesn't block forever
          setChatReady(true);
        }
      } else {
        setChatReady(true);
        updateDoc(chatRef, {
          [`unreadCount_${auth.currentUser!.uid}`]: 0
        }).catch(() => {});
      }
    }).catch(err => {
      console.error("Error checking chat parent:", err);
      setChatReady(true);
    });

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Set typing status to false on unmount
      if (auth.currentUser && chatId) {
        setDoc(doc(db, 'chats', chatId, 'typing', auth.currentUser.uid), {
          isTyping: false,
          updatedAt: Date.now()
        }, { merge: true }).catch(err => console.error("Error clearing typing status on unmount:", err));
      }
      if (unsubStatus) {
        unsubStatus();
      }
      if (unsubTyping) {
        unsubTyping();
      }
      if (unsubMyBlock) {
        unsubMyBlock();
      }
      if (unsubFriendBlock) {
        unsubFriendBlock();
      }
    };
  }, [chatId]);

  useEffect(() => {
    if (!auth.currentUser || !chatId || !chatReady) return;

    // Subscribe to messages in Firestore
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('sentAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Fetch fresh local messages list
      const local = localStorage.getItem(`chat_history_${chatId}`);
      let currentLocalMsgs: ChatMessage[] = local ? JSON.parse(local) : [];
      let hasChanges = false;

      for (const change of snapshot.docChanges()) {
        const docData = change.doc.data();
        const firestoreId = docData.id || change.doc.id;
        const existingIdx = currentLocalMsgs.findIndex(m => m.id === firestoreId);

        // Check if the message has been deleted for everyone or deleted for me
        const isDeletedForAll = docData.deletedForAll === true;
        const isDeletedForMe = Array.isArray(docData.deletedFor) && docData.deletedFor.includes(auth.currentUser?.uid);

        if (isDeletedForAll || isDeletedForMe) {
          if (existingIdx !== -1) {
            currentLocalMsgs.splice(existingIdx, 1);
            hasChanges = true;
          }
          continue;
        }

        if (change.type === 'added') {
          if (existingIdx === -1) {
            const newMsg: ChatMessage = {
              id: firestoreId,
              senderId: docData.senderId,
              type: docData.type || 'text',
              text: docData.text || '',
              mediaData: docData.mediaData || '',
              sentAt: docData.sentAt || new Date().toISOString(),
              seenAt: docData.seenAt || undefined,
              openedAt: docData.openedAt || undefined,
              status: docData.status || 'sent',
              deletedFor: docData.deletedFor || [],
              deletedForAll: docData.deletedForAll || false,
              locationData: docData.locationData || undefined,
              read: docData.read !== undefined ? docData.read : false
            };

            // If it's a message received from the friend and currently 'sent', set it to 'seen' and 'read'
            if (docData.senderId !== auth.currentUser?.uid && docData.status === 'sent') {
              newMsg.status = 'seen';
              newMsg.seenAt = new Date().toISOString();
              newMsg.read = true;
              
              // Sync 'seen' and 'read' state back to Firestore
              await updateDoc(change.doc.ref, {
                status: 'seen',
                seenAt: newMsg.seenAt,
                read: true
              }).catch(e => console.error("Error updating seen and read status in Firestore:", e));
              
              // Reset my unread count since I just read a new message
              updateDoc(doc(db, 'chats', chatId), {
                [`unreadCount_${auth.currentUser!.uid}`]: 0
              }).catch(() => {});
            }

            currentLocalMsgs.push(newMsg);
            hasChanges = true;
          } else {
            // Message exists locally. Verify if status, read status, or deletion state was updated remotely
            const localMsg = currentLocalMsgs[existingIdx];
            let msgChanged = false;
            if (docData.status !== localMsg.status) {
              localMsg.status = docData.status;
              if (docData.seenAt) localMsg.seenAt = docData.seenAt;
              if (docData.openedAt) localMsg.openedAt = docData.openedAt;
              msgChanged = true;
            }
            if (docData.read !== undefined && docData.read !== localMsg.read) {
              localMsg.read = docData.read;
              msgChanged = true;
            }
            if (JSON.stringify(docData.deletedFor || []) !== JSON.stringify(localMsg.deletedFor || [])) {
              localMsg.deletedFor = docData.deletedFor || [];
              msgChanged = true;
            }
            if (docData.deletedForAll !== localMsg.deletedForAll) {
              localMsg.deletedForAll = docData.deletedForAll || false;
              msgChanged = true;
            }
            if (msgChanged) {
              hasChanges = true;
            }
          }
        } else if (change.type === 'modified') {
          if (existingIdx !== -1) {
            const localMsg = currentLocalMsgs[existingIdx];
            let msgChanged = false;
            if (docData.status !== localMsg.status) {
              localMsg.status = docData.status;
              if (docData.seenAt) localMsg.seenAt = docData.seenAt;
              if (docData.openedAt) localMsg.openedAt = docData.openedAt;
              msgChanged = true;
            }
            if (docData.read !== undefined && docData.read !== localMsg.read) {
              localMsg.read = docData.read;
              msgChanged = true;
            }
            if (JSON.stringify(docData.deletedFor || []) !== JSON.stringify(localMsg.deletedFor || [])) {
              localMsg.deletedFor = docData.deletedFor || [];
              msgChanged = true;
            }
            if (docData.deletedForAll !== localMsg.deletedForAll) {
              localMsg.deletedForAll = docData.deletedForAll || false;
              msgChanged = true;
            }
            if (msgChanged) {
              hasChanges = true;
            }
          }
        }
      }

      // Automatically mark any existing sent/unread messages from friend in local array as 'seen' and 'read'
      currentLocalMsgs = currentLocalMsgs.map(msg => {
        if (msg.senderId !== auth.currentUser?.uid && (msg.status === 'sent' || !msg.read)) {
          const wasSent = msg.status === 'sent';
          if (wasSent) {
            msg.status = 'seen';
            msg.seenAt = new Date().toISOString();
          }
          msg.read = true;
          hasChanges = true;

          // Find the doc reference in snapshot to update remotely too
          const docSnap = snapshot.docs.find(d => (d.data().id || d.id) === msg.id);
          if (docSnap) {
            const updates: any = { read: true };
            if (wasSent) {
              updates.status = 'seen';
              updates.seenAt = msg.seenAt;
            }
            updateDoc(docSnap.ref, updates).catch(e => console.error("Error updating seen/read status for pre-existing:", e));
            
            // Reset my unread count since I just read a pre-existing message
            updateDoc(doc(db, 'chats', chatId), {
              [`unreadCount_${auth.currentUser!.uid}`]: 0
            }).catch(() => {});
          }
        }
        return msg;
      });

      if (hasChanges || currentLocalMsgs.length !== messages.length) {
        currentLocalMsgs.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
        localStorage.setItem(`chat_history_${chatId}`, JSON.stringify(currentLocalMsgs));
        setMessages(currentLocalMsgs);
      }
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [chatId, chatReady]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (friendIsTyping) {
      setTimeout(scrollToBottom, 50);
    }
  }, [friendIsTyping]);

  const saveMessageLocally = (msg: ChatMessage) => {
    const local = localStorage.getItem(`chat_history_${chatId}`);
    const list: ChatMessage[] = local ? JSON.parse(local) : [];
    if (!list.some(m => m.id === msg.id)) {
      list.push(msg);
      localStorage.setItem(`chat_history_${chatId}`, JSON.stringify(list));
      setMessages(list);
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleDeleteMessage = async (deleteType: 'me' | 'all') => {
    if (!messageToDelete || !auth.currentUser || !chatId) return;

    const msgId = messageToDelete.id;

    try {
      // 1. Update localStorage
      const local = localStorage.getItem(`chat_history_${chatId}`);
      if (local) {
        const currentLocalMsgs: ChatMessage[] = JSON.parse(local);
        const updatedMsgs = currentLocalMsgs.filter(m => m.id !== msgId);
        localStorage.setItem(`chat_history_${chatId}`, JSON.stringify(updatedMsgs));
        setMessages(updatedMsgs);
      }

      // 2. Update Firestore
      const q = query(
        collection(db, 'chats', chatId, 'messages'),
        where('id', '==', msgId)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        const docData = querySnapshot.docs[0].data();

        if (deleteType === 'all') {
          // Delete for everyone (only allowed if current user is sender)
          if (docData.senderId === auth.currentUser.uid) {
            await updateDoc(docRef, {
              deletedForAll: true
            });
          }
        } else {
          // Delete for me
          const currentDeletedFor = docData.deletedFor || [];
          if (!currentDeletedFor.includes(auth.currentUser.uid)) {
            await updateDoc(docRef, {
              deletedFor: [...currentDeletedFor, auth.currentUser.uid]
            });
          }
        }
      }
    } catch (err) {
      console.error("Error deleting message from Firestore:", err);
    } finally {
      setMessageToDelete(null);
    }
  };

  const handleClearMessages = async (mode: 'all' | 'specific', senderIdToClear?: string) => {
    if (!auth.currentUser || !chatId) return;

    try {
      // 1. Get current messages from Firestore
      const q = query(collection(db, 'chats', chatId, 'messages'));
      const snapshot = await getDocs(q);

      // Filter and update Firestore docs
      const batchPromises = snapshot.docs.map(async (docSnap) => {
        const docData = docSnap.data();
        const msgSenderId = docData.senderId;

        // Check if this message should be cleared
        let shouldClear = false;
        if (mode === 'all') {
          shouldClear = true;
        } else if (mode === 'specific' && senderIdToClear) {
          shouldClear = (msgSenderId === senderIdToClear);
        }

        if (shouldClear) {
          const currentDeletedFor = docData.deletedFor || [];
          if (!currentDeletedFor.includes(auth.currentUser!.uid)) {
            await updateDoc(docSnap.ref, {
              deletedFor: [...currentDeletedFor, auth.currentUser!.uid]
            });
          }
        }
      });

      await Promise.all(batchPromises);

      // 2. Update localStorage and state
      const local = localStorage.getItem(`chat_history_${chatId}`);
      if (local) {
        const currentLocalMsgs: ChatMessage[] = JSON.parse(local);
        const updatedMsgs = currentLocalMsgs.filter(m => {
          let shouldRemove = false;
          if (mode === 'all') {
            shouldRemove = true;
          } else if (mode === 'specific' && senderIdToClear) {
            shouldRemove = (m.senderId === senderIdToClear);
          }
          return !shouldRemove;
        });
        localStorage.setItem(`chat_history_${chatId}`, JSON.stringify(updatedMsgs));
        setMessages(updatedMsgs);
      }

      alert('Mensagens apagadas com sucesso!');
    } catch (err) {
      console.error("Error clearing messages:", err);
      alert('Erro ao apagar mensagens.');
    }
  };

  const sendLocationMessage = async (lat: number, lng: number, name?: string, address?: string) => {
    if (!auth.currentUser || !chatId) return;
    if (isBlockedByMe || isBlockedByFriend) {
      alert("Não é possível enviar mensagens nesta conversa.");
      return;
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const nowStr = new Date().toISOString();

    const localMsg: ChatMessage = {
      id: messageId,
      senderId: auth.currentUser.uid,
      type: 'location',
      text: name ? `Localização compartilhada: ${name}` : 'Localização em Tempo Real',
      sentAt: nowStr,
      status: 'sent',
      read: false,
      locationData: { lat, lng, name, address }
    };

    // Save locally
    saveMessageLocally(localMsg);

    // Upload to Firestore transit channel
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        id: messageId,
        senderId: auth.currentUser.uid,
        type: 'location',
        text: localMsg.text || '',
        sentAt: nowStr,
        status: 'sent',
        read: false,
        locationData: { lat, lng, name: name || '', address: address || '' }
      });
      
      if (friendId) {
        await updateDoc(doc(db, 'chats', chatId), {
          ultimaMensagem: localMsg.text || '📍 Localização',
          ultimaMensagemEm: new Date().getTime(),
          [`unreadCount_${friendId}`]: increment(1)
        });
      }
    } catch (error) {
      console.error("Error sending location to Firestore:", error);
    }
  };

  const handleCaptureLocation = () => {
    setIsLocationModalOpen(true);
    setLocationLoading(true);
    setLocationError(null);
    setCurrentCoords(null);
    setIsSimulatedLocation(false);

    if (!navigator.geolocation) {
      setupMockLocation();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCurrentCoords({ lat, lng });
        setLocationLoading(false);
      },
      (error) => {
        console.warn("Geolocation failed. Using fallback:", error);
        setupMockLocation();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const setupMockLocation = () => {
    // Default mock coordinates (São Paulo - Central Area)
    const lat = -23.55052;
    const lng = -46.633308;
    setCurrentCoords({ lat, lng });
    setIsSimulatedLocation(true);
    setLocationLoading(false);
  };

  const handleSendLocation = async () => {
    if (!currentCoords) return;
    await sendLocationMessage(currentCoords.lat, currentCoords.lng);
    setIsLocationModalOpen(false);
  };

  const handleBlockUser = async () => {
    if (!auth.currentUser || !friendId) return;
    const confirmBlock = window.confirm(
      `Deseja realmente bloquear este usuário? Isso removerá esta conversa de sua lista de chats e impedirá qualquer nova interação.`
    );
    if (!confirmBlock) return;

    setIsBlockingUser(true);
    try {
      // 1. Create block doc in Firestore blocks collection
      const blockId = `${auth.currentUser.uid}_${friendId}`;
      await setDoc(doc(db, 'blocks', blockId), {
        blockedBy: auth.currentUser.uid,
        blockedUser: friendId,
        createdAt: Date.now()
      });

      // 2. Query and delete any connection between these two users in Firestore connection collection
      const q = query(
        collection(db, 'connections'),
        where('users', 'array-contains', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      for (const d of snapshot.docs) {
        const data = d.data();
        if (data.users && data.users.includes(friendId)) {
          await deleteDoc(d.ref); // Delete connection document
        }
      }

      // 3. Update friend requests to blocked status
      const reqsQ = query(
        collection(db, 'friendRequests'),
        where('fromUserId', 'in', [auth.currentUser.uid, friendId]),
        where('toUserId', 'in', [auth.currentUser.uid, friendId])
      );
      const reqsSnapshot = await getDocs(reqsQ);
      for (const d of reqsSnapshot.docs) {
        await updateDoc(d.ref, {
          status: 'blocked',
          updatedAt: Date.now()
        });
      }

      // 4. Clear local storage history for this chat
      localStorage.removeItem(`chat_history_${chatId}`);

      alert('Usuário bloqueado com sucesso!');
      navigate('/chats'); // Navigate back to the chats list
    } catch (err) {
      console.error("Error blocking user:", err);
      alert('Ocorreu um erro ao bloquear o usuário.');
    } finally {
      setIsBlockingUser(false);
      setIsOptionsOpen(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlockedByMe || isBlockedByFriend) {
      alert("Não é possível enviar mensagens nesta conversa.");
      return;
    }
    if (!newMessage.trim() || !auth.currentUser || !chatId) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setMyTypingStatus(false);

    const textToSend = newMessage.trim();
    setNewMessage('');
    setShowEmojiPicker(false);

    await sendMediaMessage('text', textToSend);
  };

  const sendMediaMessage = async (type: 'text' | 'emoticon' | 'audio' | 'video' | 'photo', content: string) => {
    if (!auth.currentUser || !chatId) return;
    if (isBlockedByMe || isBlockedByFriend) {
      return;
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const nowStr = new Date().toISOString();

    const localMsg: ChatMessage = {
      id: messageId,
      senderId: auth.currentUser.uid,
      type,
      text: type === 'text' || type === 'emoticon' ? content : '',
      mediaData: type === 'audio' || type === 'video' || type === 'photo' ? content : undefined,
      sentAt: nowStr,
      status: 'sent',
      read: false
    };

    // Save locally
    saveMessageLocally(localMsg);

    // Upload to Firestore transit channel
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        id: messageId,
        senderId: auth.currentUser.uid,
        type,
        text: localMsg.text || '',
        mediaData: localMsg.mediaData || '',
        sentAt: nowStr,
        status: 'sent',
        read: false
      });
      
      if (friendId) {
        let textPreview = localMsg.text || '';
        if (type === 'audio') textPreview = '🎵 Áudio';
        if (type === 'video') textPreview = '📹 Vídeo';
        if (type === 'photo') textPreview = '📷 Foto';
        if (type === 'emoticon') textPreview = localMsg.text || '😀 Emoticon';

        await updateDoc(doc(db, 'chats', chatId), {
          ultimaMensagem: textPreview,
          ultimaMensagemEm: new Date().getTime(),
          [`unreadCount_${friendId}`]: increment(1)
        });
      }
    } catch (error) {
      console.error("Error sending message to Firestore:", error);
    }
  };

  // Audio Recorder Actions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          await sendMediaMessage('audio', base64data);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 59) {
            // Stop recording when limit is reached
            setTimeout(() => stopRecording(false), 0);
            alert("Limite máximo de gravação atingido (60 segundos).");
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Não foi possível acessar o microfone. Verifique as permissões de áudio no seu navegador.");
    }
  };

  const stopRecording = (cancel: boolean = false) => {
    if (!mediaRecorderRef.current || !isRecording) return;
    
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    
    if (cancel) {
      mediaRecorderRef.current.onstop = () => {
        if (mediaRecorderRef.current) {
          const stream = mediaRecorderRef.current.stream;
          stream.getTracks().forEach(track => track.stop());
        }
      };
      mediaRecorderRef.current.stop();
    } else {
      mediaRecorderRef.current.stop();
    }
  };

  const formatRecordingTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Video Selector Actions
  const triggerVideoSelect = () => {
    fileInputRef.current?.click();
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit video to 600KB so that base64 is safely under 1MB limit of Firestore
    if (file.size > 600 * 1024) {
      alert("Para garantir a entrega da mensagem, selecione um vídeo curto de no máximo 600KB. Vídeos maiores excedem o limite de transferência segura.");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      await sendMediaMessage('video', base64data);
    };
  };

  // Photo Selector Actions
  const triggerPhotoSelect = () => {
    photoInputRef.current?.click();
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Compress and resize image using our utility
      const base64data = await resizeImage(file);
      await sendMediaMessage('photo', base64data);
    } catch (err) {
      console.error("Error resizing image:", err);
      // Fallback to standard reading if resizing fails
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        await sendMediaMessage('photo', base64data);
      };
    }
  };

  // Trigger 'opened' action when play starts for audio/video messages from friend
  const handleMessageOpened = async (msgId: string) => {
    if (!auth.currentUser || !chatId) return;

    const local = localStorage.getItem(`chat_history_${chatId}`);
    if (!local) return;
    const currentLocalMsgs: ChatMessage[] = JSON.parse(local);

    const msgIdx = currentLocalMsgs.findIndex(m => m.id === msgId);
    if (msgIdx === -1) return;

    const msg = currentLocalMsgs[msgIdx];
    // Only mark as opened if it was sent by friend, and is not already opened
    if (msg.senderId !== auth.currentUser.uid && msg.status !== 'opened') {
      const nowStr = new Date().toISOString();
      msg.status = 'opened';
      msg.openedAt = nowStr;
      msg.read = true;

      // Update locally
      localStorage.setItem(`chat_history_${chatId}`, JSON.stringify(currentLocalMsgs));
      setMessages(currentLocalMsgs);

      // Sync to Firestore
      try {
        const q = query(
          collection(db, 'chats', chatId, 'messages'),
          where('id', '==', msgId)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          await updateDoc(querySnapshot.docs[0].ref, {
            status: 'opened',
            openedAt: nowStr,
            read: true
          });
        }
      } catch (err) {
        console.error("Error updating opened status on Firestore:", err);
      }
    }
  };

  const formatEventTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading) {
    return <div className="h-screen bg-slate-50 flex items-center justify-center font-semibold text-slate-500">Carregando conversa segura...</div>;
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-100 font-sans relative overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={() => navigate('/chats')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          {friendProfile && friendId && (
            <Link to={`/profile/${friendId}`} className="flex items-center justify-between flex-1 min-w-0 mr-3">
              {/* Left Side: Text Details (Apelido, Idade, Status, Demonym, Objective) */}
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-baseline gap-1.5">
                  <h2 className="font-extrabold text-slate-800 text-base truncate max-w-[150px] sm:max-w-none leading-none">
                    {friendProfile.apelido || friendProfile.nome}
                  </h2>
                  {friendProfile.idade && (
                    <span className="text-xs text-slate-500 font-bold shrink-0">
                      • {friendProfile.idade} anos
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  {/* Real-time status / typing */}
                  {friendIsTyping ? (
                    <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping shrink-0" />
                      digitando...
                    </span>
                  ) : friendStatus ? (
                    (() => {
                      const isOnline = friendStatus.status === 'online' && (Date.now() - friendStatus.lastActive < 120000);
                      return (
                        <span className={`text-[10px] font-extrabold flex items-center gap-1 shrink-0 ${isOnline ? 'text-emerald-500' : 'text-slate-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      );
                    })()
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse shrink-0" /> Conectando...
                    </span>
                  )}

                  {/* Demonym */}
                  {friendProfile.estadoNascimento && (
                    <span className="text-[9px] text-indigo-600 font-black bg-indigo-50 border border-indigo-100/60 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                      {getDemonym(friendProfile.estadoNascimento, friendProfile.sexo)}
                    </span>
                  )}

                  {/* Relationship Objective */}
                  {friendProfile.objetivo && getObjectiveBadge(friendProfile.objetivo)}
                </div>
              </div>

              {/* Right Side: Miniature Avatar image */}
              <div className="relative shrink-0 select-none">
                <img 
                  src={friendProfile.fotoPrincipalUrl || `https://api.dicebear.com/9.x/notionists/svg?seed=${friendId}`} 
                  alt="Friend" 
                  className="w-[68px] h-[68px] aspect-square rounded-full object-cover border-2 border-indigo-100 shadow-md hover:scale-105 active:scale-95 transition-transform"
                  style={{ width: '68px', height: '68px', aspectRatio: '1/1', borderRadius: '50%' }}
                />
                {friendStatus && (
                  (() => {
                    const isOnline = friendStatus.status === 'online' && (Date.now() - friendStatus.lastActive < 120000);
                    if (isOnline) {
                      return (
                        <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
                      );
                    }
                    return null;
                  })()
                )}
              </div>
            </Link>
          )}
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setIsOptionsOpen(!isOptionsOpen)}
            className="p-2 -mr-2 text-slate-400 hover:text-slate-700 transition-colors rounded-full hover:bg-slate-100"
            title="Opções"
            id="chat-options-btn"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {isOptionsOpen && (
            <>
              {/* Overlay background to close the dropdown when clicking outside */}
              <div 
                className="fixed inset-0 z-20" 
                onClick={() => setIsOptionsOpen(false)} 
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-30 animate-fadeIn" id="chat-options-dropdown">
                {friendId && (
                  <Link 
                    to={`/profile/${friendId}`}
                    onClick={() => setIsOptionsOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100/60"
                  >
                    <Info className="w-4 h-4 text-slate-400" />
                    <span>Ver Perfil</span>
                  </Link>
                )}
                <button
                  onClick={() => {
                    setIsOptionsOpen(false);
                    setShowSafetyModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left border-b border-slate-100/60"
                  id="btn-safety"
                >
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <span>Segurança em Encontros</span>
                </button>
                <button
                  onClick={() => {
                    setIsClearModalOpen(true);
                    setIsOptionsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left border-b border-slate-100/60"
                  id="btn-clear-messages"
                >
                  <Trash2 className="w-4 h-4 text-slate-400" />
                  <span>Apagar Mensagens</span>
                </button>
                <button
                  onClick={handleBlockUser}
                  disabled={isBlockingUser}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors text-left"
                  id="btn-block-user"
                >
                  <Ban className="w-4 h-4 text-red-500" />
                  <span>{isBlockingUser ? 'Bloqueando...' : 'Bloquear Usuário'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        <div className="text-center pb-4 flex flex-col items-center gap-1">
          <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
            🛡️ Criptografia & Armazenamento Local Ativos
          </span>
          <span className="text-[9px] text-slate-400 max-w-xs leading-relaxed">
            As conversas são guardadas exclusivamente na memória de seu dispositivo para sua privacidade.
          </span>
        </div>
        
        {messages.map((msg, index) => {
          const isMine = msg.senderId === auth.currentUser?.uid;
          
          return (
            <div key={msg.id || index} className={`flex items-center gap-2 group ${isMine ? 'justify-end' : 'justify-start'}`}>
              {/* Delete button for my messages (on the left) */}
              {isMine && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMessageToDelete(msg);
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full opacity-60 md:opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  title="Excluir mensagem"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <div 
                onClick={() => setSelectedMessage(msg)}
                className={`max-w-[80%] rounded-2xl p-3 shadow-sm text-sm cursor-pointer hover:scale-[1.01] transition-transform ${
                  isMine 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                }`}
              >
                {/* Text Message */}
                {msg.type === 'text' && (
                  <p className="whitespace-pre-wrap break-words pr-2">{msg.text}</p>
                )}

                {/* Emoticon Message */}
                {msg.type === 'emoticon' && (
                  <div className="text-4xl py-1 text-center pr-1">{msg.text}</div>
                )}

                {/* Audio Message */}
                {msg.type === 'audio' && msg.mediaData && (
                  <CustomAudioPlayer 
                    mediaData={msg.mediaData} 
                    isMine={isMine} 
                    onPlayOnce={() => handleMessageOpened(msg.id)} 
                  />
                )}

                {/* Video Message */}
                {msg.type === 'video' && msg.mediaData && (
                  <CustomVideoPlayer 
                    mediaData={msg.mediaData} 
                    onPlayOnce={() => handleMessageOpened(msg.id)} 
                  />
                )}

                {/* Photo Message */}
                {msg.type === 'photo' && msg.mediaData && (
                  <div className="rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-32 h-32 shrink-0">
                    <img 
                      src={msg.mediaData} 
                      alt="Foto enviada" 
                      className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                      style={{ aspectRatio: '1/1' }}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                {/* Location Message */}
                {msg.type === 'location' && msg.locationData && (
                  <div className="space-y-2.5 min-w-[220px] max-w-full">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl shrink-0 flex items-center justify-center ${
                        isMine ? 'bg-white/15 text-white' : 'bg-indigo-50 text-indigo-600'
                      }`}>
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <p className="font-bold leading-tight truncate">
                          {msg.locationData.name || 'Minha Localização'}
                        </p>
                        <p className={`text-[11px] leading-snug truncate ${
                          isMine ? 'text-indigo-100' : 'text-slate-500'
                        }`}>
                          {msg.locationData.address || `${msg.locationData.lat.toFixed(5)}, ${msg.locationData.lng.toFixed(5)}`}
                        </p>
                      </div>
                    </div>

                    <a 
                      href={`https://www.openstreetmap.org/?mlat=${msg.locationData.lat}&mlon=${msg.locationData.lng}#map=17/${msg.locationData.lat}/${msg.locationData.lng}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className={`w-full py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                        isMine 
                          ? 'bg-white text-indigo-600 hover:bg-indigo-50' 
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Compass className="w-4 h-4 shrink-0" />
                      <span>Abrir no Mapa</span>
                    </a>
                  </div>
                )}

                {/* Bubble Footer / Status Indicators */}
                <div className={`flex items-center justify-end gap-1 text-[9px] mt-1.5 ${isMine ? 'text-indigo-200' : 'text-slate-400'}`}>
                  <span>
                    {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  {isMine && (
                    <span className="ml-1" title={`Toque para ver detalhes do evento`}>
                      {msg.status === 'sent' && (
                        <Check className="w-3.5 h-3.5 text-slate-300" />
                      )}
                      {msg.status === 'seen' && (
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-300" />
                      )}
                      {msg.status === 'opened' && (
                        <CheckCheck className="w-3.5 h-3.5 text-sky-300 fill-sky-300/10" />
                      )}
                    </span>
                  )}
                  
                  {!isMine && (msg.type === 'audio' || msg.type === 'video') && (
                    <span className="ml-1 flex items-center gap-0.5">
                      {msg.status === 'opened' ? (
                        <span className="bg-sky-100 text-sky-800 text-[8px] font-bold px-1 py-0.5 rounded">Reproduzido</span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 text-[8px] font-bold px-1 py-0.5 rounded animate-pulse">Pressione para abrir</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Delete button for friend messages (on the right) */}
              {!isMine && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMessageToDelete(msg);
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full opacity-60 md:opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  title="Excluir mensagem"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
        {friendIsTyping && (
          <div className="flex items-center gap-2 animate-fadeIn py-1">
            <img 
              src={friendProfile?.fotoPrincipalUrl || `https://api.dicebear.com/9.x/notionists/svg?seed=${friendId}`} 
              alt={friendProfile?.nome || "Digitando"} 
              className="w-6 h-6 aspect-square rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm shrink-0" 
              style={{ aspectRatio: '1/1', borderRadius: '50%' }}
            />
            <div className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl rounded-bl-none px-4 py-2.5 shadow-sm max-w-[150px]">
              <div className="flex items-center gap-1 py-0.5">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
              </div>
              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider text-center mt-1">
                digitando...
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Target Status Warning / Quick Replies */}
      {!isBlockedByMe && !isBlockedByFriend && myProfile?.statusBolinha === 'restricoes' && !isFriend && (
        <div className="bg-amber-50 border-t border-amber-200 p-3 shrink-0 flex gap-2 overflow-x-auto whitespace-nowrap hide-scrollbar shadow-inner animate-fadeIn">
          {[
            "Obrigado, porém não estou aberto(a) a novas amizades.",
            "Obrigado, mas não tenho interesse no momento.",
            "Vamos deixar para uma próxima vez."
          ].map(msg => (
            <button
              key={msg}
              onClick={() => setNewMessage(msg)}
              className="bg-white border border-amber-200 text-amber-800 text-[10px] font-bold px-3 py-1.5 rounded-full hover:bg-amber-100 transition-colors shrink-0 shadow-sm"
            >
              {msg}
            </button>
          ))}
        </div>
      )}

      {!isBlockedByMe && !isBlockedByFriend && myProfile?.statusBolinha === 'indisponivel' && !isFriend && (
        <div className="bg-rose-50 border-t border-rose-200 p-3 shrink-0 shadow-inner animate-fadeIn">
          <p className="text-[11px] text-rose-700 font-medium leading-tight mb-2">
            <span className="font-bold uppercase tracking-wider block mb-0.5">Aviso de Regra</span> 
            Você foi contactado desrespeitando sua regra de Não Disponível (apenas amigos). O infrator pode ser bloqueado imediatamente.
          </p>
          <button 
            onClick={handleBlockUser}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2 rounded-xl transition-colors shadow-sm"
          >
            Bloquear Infrator Imediatamente
          </button>
        </div>
      )}

      {!isBlockedByMe && !isBlockedByFriend && friendProfile?.statusBolinha === 'indisponivel' && !isFriend && (
        <div className="bg-rose-50 border-t border-rose-200 p-2 shrink-0 shadow-inner">
          <p className="text-[10px] text-rose-700 font-medium leading-tight text-center">
            <span className="font-bold block uppercase tracking-wider mb-0.5">Aviso</span>
            Este usuário não deseja interações com pessoas fora de seu grupo de amigos. Interagir desrespeitando esta regra pode resultar em bloqueio imediato.
          </p>
        </div>
      )}

      {/* Emoticons Panel */}
      {showEmojiPicker && (
        <div className="bg-white border-t border-slate-200 p-3 shrink-0 grid grid-cols-7 gap-2 shadow-inner max-h-36 overflow-y-auto animate-fadeIn">
          {EMOTICONS.map((emoji) => (
            <button 
              key={emoji}
              onClick={() => sendMediaMessage('emoticon', emoji)}
              className="text-2xl p-2 hover:bg-slate-100 active:scale-95 rounded-xl transition-all"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input / Control Area */}
      <div className="bg-white border-t border-slate-200 p-3 pb-[env(safe-area-inset-bottom,12px)] shrink-0 shadow-lg">
        {isBlockedByMe || isBlockedByFriend ? (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center select-none gap-2 shrink-0">
            <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center text-rose-500 shadow-sm animate-pulse">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-800">
              {isBlockedByMe 
                ? "Você bloqueou este usuário" 
                : "Este usuário não está disponível para conversas"}
            </p>
            <p className="text-[10px] text-slate-400 max-w-xs leading-normal">
              {isBlockedByMe 
                ? "Para voltar a enviar mensagens e interagir com este perfil, você precisa desbloqueá-lo." 
                : "Novas mensagens ou interações não são permitidas."}
            </p>
            {isBlockedByMe && (
              <div className="flex flex-col items-center gap-1.5 mt-1">
                {!showUnblockConfirm ? (
                  <button 
                    onClick={() => setShowUnblockConfirm(true)}
                    className="mt-1 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-200 text-indigo-600 rounded-full text-[10px] font-extrabold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                    id="unblock-user-btn"
                  >
                    Desbloquear Usuário
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-slate-500">Tem certeza?</span>
                    <button 
                      onClick={async () => {
                        if (!auth.currentUser || !friendId) return;
                        try {
                          await deleteDoc(doc(db, 'blocks', `${auth.currentUser.uid}_${friendId}`));
                          setShowUnblockConfirm(false);
                        } catch (err) {
                          console.error("Error unblocking user:", err);
                        }
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-[10px] font-extrabold shadow-sm transition-all cursor-pointer"
                    >
                      Sim, Desbloquear
                    </button>
                    <button 
                      onClick={() => setShowUnblockConfirm(false)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full text-[10px] font-extrabold transition-all cursor-pointer"
                    >
                      Não
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : isRecording ? (
          /* Recording Panel */
          <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-2xl p-2 px-4 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping" />
              <Volume2 className="w-4 h-4 text-red-600 animate-bounce" />
              <span className="text-xs font-bold text-red-700 font-mono">
                Gravando áudio: {formatRecordingTime(recordingTime)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={() => stopRecording(true)}
                className="p-2.5 bg-white text-red-600 border border-red-200 rounded-full hover:bg-red-100 transition-colors"
                title="Cancelar gravação"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button 
                type="button" 
                onClick={() => stopRecording(false)}
                className="p-2.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all flex items-center justify-center shadow-md"
                title="Enviar áudio"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Normal Send Box */
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            {/* 2x2 Grid of 4 Action Icons */}
            <div className="grid grid-cols-2 gap-1.5 shrink-0">
              <button 
                type="button" 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${showEmojiPicker ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-slate-50 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 border border-slate-200'}`}
                title="Inserir emoticon"
              >
                <Smile className="w-5 h-5" />
              </button>
              
              <button 
                type="button" 
                onClick={triggerPhotoSelect}
                className="w-9 h-9 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-pink-500 hover:bg-pink-50 rounded-xl border border-slate-200 hover:border-pink-200 transition-all"
                title="Enviar foto"
              >
                <Camera className="w-5 h-5" />
              </button>

              <button 
                type="button" 
                onClick={triggerVideoSelect}
                className="w-9 h-9 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-xl border border-slate-200 hover:border-sky-200 transition-all"
                title="Enviar vídeo"
              >
                <Video className="w-5 h-5" />
              </button>

              <button 
                type="button" 
                onClick={startRecording}
                className="w-9 h-9 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl border border-slate-200 hover:border-red-200 transition-all"
                title="Gravar áudio"
              >
                <Mic className="w-5 h-5" />
              </button>
            </div>
            
            {/* Hidden Input Selectors */}
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleVideoSelect}
              accept="video/*" 
              className="hidden" 
            />
            <input 
              type="file" 
              ref={photoInputRef}
              onChange={handlePhotoSelect}
              accept="image/*" 
              className="hidden" 
            />

            {/* Expanded Textarea proportional to the two lines */}
            <div className="flex-1 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden flex items-stretch h-[78px]">
              <textarea 
                value={newMessage}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewMessage(val);
                  if (val.trim() === '') {
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                    setMyTypingStatus(false);
                  } else {
                    handleTyping();
                  }
                }}
                placeholder="Mensagem..."
                className="w-full h-full bg-transparent text-sm py-2 px-3 resize-none focus:outline-none text-slate-800"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e as any);
                  }
                }}
              />
            </div>
            
            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={!newMessage.trim()}
              className="w-12 h-[78px] flex items-center justify-center bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 disabled:opacity-50 disabled:bg-slate-200 transition-colors shrink-0 shadow-md cursor-pointer"
              title="Enviar mensagem"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        )}
      </div>

      {/* Message Details Sheet Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center animate-fadeIn p-4">
          <div className="bg-white rounded-t-3xl max-w-md w-full p-6 pb-8 space-y-6 animate-slideUp shadow-2xl border-t border-slate-100">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <Info className="w-5 h-5 text-indigo-500" /> Detalhes do Evento
              </h3>
              <button 
                onClick={() => setSelectedMessage(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Preview */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                Tipo: {selectedMessage.type === 'text' ? 'Texto' : selectedMessage.type === 'emoticon' ? 'Emoticon' : selectedMessage.type === 'audio' ? 'Mensagem de Áudio' : selectedMessage.type === 'video' ? 'Mensagem de Vídeo' : selectedMessage.type === 'photo' ? 'Foto' : 'Mensagem'}
              </span>
              <div className="text-slate-700 text-sm font-medium">
                {selectedMessage.type === 'text' && selectedMessage.text}
                {selectedMessage.type === 'emoticon' && <span className="text-3xl">{selectedMessage.text}</span>}
                {selectedMessage.type === 'audio' && <span className="flex items-center gap-2 text-indigo-600"><Mic className="w-4 h-4" /> Áudio gravado</span>}
                {selectedMessage.type === 'video' && <span className="flex items-center gap-2 text-sky-600"><Video className="w-4 h-4" /> Vídeo gravado/enviado</span>}
                {selectedMessage.type === 'photo' && (
                  <div className="mt-1">
                    <span className="flex items-center gap-2 text-pink-600 mb-2"><Camera className="w-4 h-4" /> Foto enviada</span>
                    <img src={selectedMessage.mediaData} alt="Miniatura detalhada" className="max-h-40 rounded-lg object-contain border border-slate-200" />
                  </div>
                )}
              </div>
            </div>

            {/* Event Timeline */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Linha do Tempo de Rastreamento</h4>
              
              <div className="relative border-l-2 border-indigo-100 pl-6 space-y-5 ml-2.5">
                {/* Event 1: Sent */}
                <div className="relative">
                  <div className="absolute -left-[31px] bg-indigo-600 text-white rounded-full p-1 border-4 border-white shadow-sm flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <h5 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      Mensagem Enviada
                    </h5>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Confirmado e entregue às {formatEventTime(selectedMessage.sentAt)}
                    </p>
                  </div>
                </div>

                {/* Event 2: Seen */}
                <div className="relative">
                  <div className={`absolute -left-[31px] rounded-full p-1 border-4 border-white shadow-sm flex items-center justify-center ${selectedMessage.seenAt ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    <CheckCheck className="w-3 h-3" />
                  </div>
                  <div>
                    <h5 className={`text-xs font-extrabold ${selectedMessage.seenAt ? 'text-slate-800' : 'text-slate-400'}`}>
                      Visualizada (Vista)
                    </h5>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {selectedMessage.seenAt ? `Aberta a janela do bate-papo em ${formatEventTime(selectedMessage.seenAt)}` : 'Aguardando que o destinatário visualize a conversa...'}
                    </p>
                  </div>
                </div>

                {/* Event 3: Opened (Audio/Video Only) */}
                {(selectedMessage.type === 'audio' || selectedMessage.type === 'video') && (
                  <div className="relative">
                    <div className={`absolute -left-[31px] rounded-full p-1 border-4 border-white shadow-sm flex items-center justify-center ${selectedMessage.openedAt ? 'bg-sky-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                      <Play className="w-3 h-3 fill-current" />
                    </div>
                    <div>
                      <h5 className={`text-xs font-extrabold ${selectedMessage.openedAt ? 'text-slate-800' : 'text-slate-400'}`}>
                        Mídia Aberta / Reproduzida
                      </h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {selectedMessage.openedAt ? `Áudio/Vídeo executado pela primeira vez às ${formatEventTime(selectedMessage.openedAt)}` : 'Aguardando reprodução pelo destinatário...'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={() => setSelectedMessage(null)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all text-center block"
            >
              Fechar Detalhes
            </button>
          </div>
        </div>
      )}

      {/* Message Delete Confirmation Modal */}
      {messageToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-5 animate-scaleIn shadow-2xl border border-slate-100">
            <div className="flex items-start gap-3.5">
              <div className="bg-red-50 p-2.5 rounded-full text-red-500 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-slate-800 text-sm leading-none">
                  Excluir Mensagem?
                </h3>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Selecione como deseja apagar esta mensagem da conversa. Esta ação é irreversível.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 text-xs text-slate-600 border border-slate-100 italic max-h-24 overflow-y-auto">
              {messageToDelete.type === 'text' && `"${messageToDelete.text}"`}
              {messageToDelete.type === 'emoticon' && `Emoticon: ${messageToDelete.text}`}
              {messageToDelete.type === 'audio' && "Mensagem de Áudio"}
              {messageToDelete.type === 'video' && "Mensagem de Vídeo"}
            </div>

            <div className="flex flex-col gap-2">
              {/* Option 1: Delete for me (Always available) */}
              <button
                onClick={() => handleDeleteMessage('me')}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all text-center"
              >
                Excluir para mim
              </button>

              {/* Option 2: Delete for everyone (Only available if the message is mine) */}
              {messageToDelete.senderId === auth.currentUser?.uid && (
                <button
                  onClick={() => handleDeleteMessage('all')}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-all text-center"
                >
                  Excluir para todos
                </button>
              )}

              {/* Option 3: Cancel */}
              <button
                onClick={() => setMessageToDelete(null)}
                className="w-full py-2.5 bg-transparent hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl text-xs font-bold transition-all text-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Modal */}
      {showSafetyModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn" id="modal-safety">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 animate-scaleIn shadow-2xl border border-slate-100">
            <div className="flex items-start gap-3.5">
              <div className="bg-emerald-50 p-2.5 rounded-full text-emerald-500 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-slate-800 text-sm leading-none">
                  Segurança em Encontros
                </h3>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Dicas para um encontro seguro e ferramentas para compartilhar sua localização.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-xs text-slate-600 leading-relaxed">
                <p>• Marque encontros sempre em <strong className="text-slate-800">locais públicos</strong> e movimentados, como cafés ou shoppings.</p>
                <p>• Avise um amigo de confiança sobre onde e com quem você estará.</p>
                <p>• Mantenha seu celular sempre carregado e com créditos/bateria.</p>
                <p>• Deixe o seu modo de viagem (como app de carona) no seu próprio celular.</p>
                <p>• Confie nos seus instintos. Se algo parecer errado, não tenha medo de ir embora.</p>
              </div>
              
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Compartilhar Localização
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`https://app.newfriends.br/track/${auth.currentUser?.uid}`}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-500 focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://app.newfriends.br/track/${auth.currentUser?.uid}`);
                      alert('Link de acompanhamento copiado!');
                    }}
                    className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors shrink-0"
                    title="Copiar Link"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Envie este link para um amigo de confiança para que ele acompanhe sua localização em tempo real durante o encontro.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowSafetyModal(false)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md transition-all text-center flex items-center justify-center cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Clear/Delete Messages Dialog */}
      {isClearModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn" id="modal-clear-messages">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-5 animate-scaleIn shadow-2xl border border-slate-100">
            <div className="flex items-start gap-3.5">
              <div className="bg-red-50 p-2.5 rounded-full text-red-500 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-slate-800 text-sm leading-none">
                  Apagar Mensagens
                </h3>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Selecione quais mensagens você gostaria de apagar desta conversa.
                </p>
              </div>
            </div>

            <div className="space-y-3.5">
              {/* Mode Selector */}
              <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-150/50">
                <button
                  type="button"
                  onClick={() => {
                    setClearMode('all');
                    setSpecificSender('');
                  }}
                  className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                    clearMode === 'all'
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Todas as mensagens
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClearMode('specific');
                    setSpecificSender(auth.currentUser?.uid || ''); // Default to me
                  }}
                  className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                    clearMode === 'specific'
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Usuário específico
                </button>
              </div>

              {/* Specific User Selection (only shown if mode is 'specific') */}
              {clearMode === 'specific' && (
                <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100 animate-slideDown">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Selecione o usuário
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSpecificSender(auth.currentUser?.uid || '')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        specificSender === auth.currentUser?.uid
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                          : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-100/50'
                      }`}
                    >
                      Minhas mensagens
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpecificSender(friendId || '')}
                      disabled={!friendId}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        specificSender === friendId
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                          : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-100/50'
                      }`}
                    >
                      {friendProfile?.nome ? `De ${friendProfile.nome.split(' ')[0]}` : 'Do outro'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  await handleClearMessages(clearMode, specificSender);
                  setIsClearModalOpen(false);
                }}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-all text-center flex items-center justify-center gap-2 cursor-pointer"
                id="btn-confirm-clear"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirmar e Apagar</span>
              </button>

              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="w-full py-2.5 bg-transparent hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl text-xs font-bold transition-all text-center cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Sharing Dialog */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn" id="modal-share-location">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-5 animate-scaleIn shadow-2xl border border-slate-100 text-slate-800">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 p-2.5 rounded-full text-emerald-600 shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base leading-none">
                    Localização em Tempo Real
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Compartilhe suas coordenadas atuais no chat.
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsLocationModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {locationLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                <span className="text-sm font-semibold text-slate-600 animate-pulse">
                  Obtendo localização...
                </span>
                <span className="text-xs text-slate-400 text-center max-w-[80%]">
                  Solicitando acesso ao GPS do seu dispositivo em tempo real...
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                {isSimulatedLocation && (
                  <div className="p-3 bg-amber-50/75 border border-amber-200/40 rounded-xl text-[11px] text-amber-800 flex gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Nota do Preview:</span> Geolocation indisponível ou recusado pelo iframe. Carregamos uma coordenada simulada em tempo real para testes!
                    </div>
                  </div>
                )}

                {currentCoords ? (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs">
                      <Navigation className="w-4 h-4 text-indigo-500 animate-pulse" />
                      <span>Coordenadas Obtidas</span>
                    </div>
                    <div className="font-mono text-xs text-slate-600 space-y-1">
                      <p><span className="font-semibold text-slate-400">Lat:</span> {currentCoords.lat.toFixed(6)}</p>
                      <p><span className="font-semibold text-slate-400">Lng:</span> {currentCoords.lng.toFixed(6)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                    {locationError || "Não foi possível obter sua localização."}
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setIsLocationModalOpen(false)}
                    className="flex-1 py-2.5 text-center text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button" 
                    onClick={handleSendLocation}
                    disabled={!currentCoords}
                    className="flex-1 py-2.5 text-center text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    Enviar Localização
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Custom Player Component Helper for Audio
function CustomAudioPlayer({ mediaData, isMine, onPlayOnce }: { mediaData: string; isMine: boolean; onPlayOnce?: () => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    const audio = new Audio(mediaData);
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [mediaData]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.error("Audio playback error:", err));
      setIsPlaying(true);
      if (!played && onPlayOnce) {
        setPlayed(true);
        onPlayOnce();
      }
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center gap-3 py-1.5 px-1 min-w-[200px] text-slate-800">
      <button 
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }} 
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${
          isMine ? 'bg-white text-indigo-600 hover:bg-indigo-50 shadow-sm' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`h-1.5 rounded-full w-full relative ${isMine ? 'bg-indigo-400' : 'bg-slate-200'}`}>
          <div 
            className={`h-full rounded-full absolute left-0 top-0 ${isMine ? 'bg-white' : 'bg-indigo-600'}`} 
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-1 text-[9px] opacity-75">
          <span className={isMine ? 'text-indigo-200' : 'text-slate-400'}>
            {audioRef.current ? formatTime(audioRef.current.currentTime) : '0:00'}
          </span>
          <span className={isMine ? 'text-indigo-200' : 'text-slate-400'}>
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Custom Player Component Helper for Video
function CustomVideoPlayer({ mediaData, onPlayOnce }: { mediaData: string; onPlayOnce?: () => void }) {
  const [played, setPlayed] = useState(false);
  
  const handlePlay = () => {
    if (!played && onPlayOnce) {
      setPlayed(true);
      onPlayOnce();
    }
  };

  return (
    <div className="rounded-xl overflow-hidden bg-black max-w-[240px] border border-slate-200/50 shadow-sm relative group mt-1" onClick={(e) => e.stopPropagation()}>
      <video 
        src={mediaData} 
        controls 
        onPlay={handlePlay}
        className="w-full h-auto max-h-[260px] object-cover"
      />
    </div>
  );
}
