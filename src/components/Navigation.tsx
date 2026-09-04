import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Home, MessageCircle, Users, Zap, Shield, Heart } from 'lucide-react';

export default function Navigation() {
  const location = useLocation();
  const [requestCount, setRequestCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    // Listen for pending friend requests
    const qRequests = query(
      collection(db, 'friendRequests'),
      where('toUserId', '==', auth.currentUser.uid),
      where('status', '==', 'pending')
    );
    const unsubscribeRequests = onSnapshot(qRequests, (snapshot) => {
      setRequestCount(snapshot.docs.length);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'friendRequests');
    });

    // Listen for unread chats
    const qChats = query(
      collection(db, 'chats'),
      where('participantes', 'array-contains', auth.currentUser.uid)
    );
    const unsubscribeChats = onSnapshot(qChats, (snapshot) => {
      let totalUnreadChats = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        const unreadForMe = data[`unreadCount_${auth.currentUser!.uid}`] || 0;
        if (unreadForMe > 0) {
          totalUnreadChats += 1;
        }
      });
      setUnreadChatCount(totalUnreadChats);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    return () => {
      unsubscribeRequests();
      unsubscribeChats();
    };
  }, []);

  const isAdmin = auth.currentUser?.email === 'ceo@newfriends.com' || auth.currentUser?.email === 'sac@wegbusiness.com' || auth.currentUser?.email === 'ceo@wegbusiness.com' || auth.currentUser?.email === 'wegbusinessandsolutions@gmail.com';

  return (
    <nav className="absolute bottom-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col z-50 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
      <div className="flex justify-around items-center pt-3 px-3 pb-[18px]">
        <Link id="tour-home" to="/" className={`transition-colors flex flex-col items-center gap-1 ${location.pathname === '/' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-500'}`}>
          <Home className="w-6 h-6" />
        </Link>

        <Link id="tour-flirt" to="/flirt" className={`transition-colors flex flex-col items-center gap-1 ${location.pathname === '/flirt' ? 'text-pink-500' : 'text-slate-400 dark:text-slate-500 hover:text-pink-500'}`}>
          <Heart className="w-6 h-6" />
        </Link>
        
        <Link id="tour-quick" to="/quick-messages" className={`transition-colors flex flex-col items-center gap-1 ${location.pathname === '/quick-messages' ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500 hover:text-amber-500'}`}>
          <Zap className="w-6 h-6" />
        </Link>
        
        <Link id="tour-friends" to="/friend-requests" className={`relative transition-colors flex flex-col items-center gap-1 ${location.pathname === '/friend-requests' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-500'}`}>
          <div className="relative">
            <Users className="w-6 h-6" />
            {requestCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border border-white dark:border-slate-900">
                +{requestCount}
              </span>
            )}
          </div>
        </Link>
        
        <Link id="tour-chats" to="/chats" className={`relative transition-colors flex flex-col items-center gap-1 ${location.pathname.startsWith('/chat') ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-500'}`}>
          <div className="relative">
            <MessageCircle className="w-6 h-6" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border border-white dark:border-slate-900">
                {unreadChatCount}
              </span>
            )}
          </div>
        </Link>

        {isAdmin && (
          <Link to="/admin" className={`transition-colors flex flex-col items-center gap-1 ${location.pathname === '/admin' ? 'text-rose-600' : 'text-slate-400 dark:text-slate-500 hover:text-rose-500'}`}>
            <Shield className="w-6 h-6" />
          </Link>
        )}
      </div>
      <div className="bg-slate-50 dark:bg-slate-950 py-1 text-center w-full border-t border-slate-100 dark:border-slate-900">
        <p className="text-[11px] text-black dark:text-slate-300 font-semibold mt-1">
          Desenvolvido por: W.E.G. Business and Solutions - BR
        </p>
      </div>
    </nav>
  );
}
