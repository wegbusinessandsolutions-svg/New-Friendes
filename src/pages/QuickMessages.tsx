import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Link } from 'react-router-dom';
import { Zap, MessageSquare } from 'lucide-react';

interface QuickMessage {
  id: string;
  fromUserId: string;
  message: string;
  createdAt: any;
  profile: any;
}

export default function QuickMessages() {
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(
        collection(db, 'shortMessages'),
        where('toUserId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      const msgs: QuickMessage[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        const userDoc = await getDoc(doc(db, 'users', data.fromUserId));
        if (userDoc.exists()) {
          msgs.push({
            id: d.id,
            fromUserId: data.fromUserId,
            message: data.message,
            createdAt: data.createdAt,
            profile: userDoc.data().profile || {}
          });
        }
      }
      setMessages(msgs);
    } catch (error) {
      console.error("Error fetching quick messages:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col font-sans p-4 pb-20">
      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Zap className="w-5 h-5 text-amber-500" /> Mensagens Rápidas
      </h2>
      
      {loading ? (
        <div className="text-center py-8 text-slate-400">Carregando mensagens...</div>
      ) : messages.length === 0 ? (
        <div className="text-center py-12 text-slate-400 flex flex-col items-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
             <MessageSquare className="w-8 h-8 text-amber-300" />
          </div>
          <p>Nenhuma mensagem rápida recebida.</p>
          <p className="text-xs mt-2 text-slate-400">Essas mensagens são enviadas antes de vocês serem amigos.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-3">
                <Link to={`/profile/${msg.fromUserId}`} className="shrink-0">
                  <img src={msg.profile.fotoPrincipalUrl || `https://api.dicebear.com/9.x/notionists/svg?seed=${msg.fromUserId}`} alt={msg.profile.nome} className="w-12 h-12 rounded-full object-cover border border-slate-100 shadow-sm" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/profile/${msg.fromUserId}`} className="block">
                    <h3 className="font-bold text-slate-900 text-sm truncate">{msg.profile.apelido || msg.profile.nome}, {msg.profile.idade}</h3>
                  </Link>
                  <span className="text-[10px] text-slate-400">
                    {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleDateString() : 'Recente'}
                  </span>
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl rounded-tl-none border border-slate-100 relative">
                <p className="text-sm text-slate-700 italic">"{msg.message}"</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
