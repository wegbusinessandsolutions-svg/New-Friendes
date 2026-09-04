const fs = require('fs');

let content = fs.readFileSync('src/pages/ChatList.tsx', 'utf8');

// Add recent interactions state
content = content.replace(
  "const [searchQuery, setSearchQuery] = useState('');",
  "const [searchQuery, setSearchQuery] = useState('');\n  const [recentInteractions, setRecentInteractions] = useState<Record<string, boolean>>({});"
);

// Add useEffect for chats
const chatEffect = `
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'chats'),
      where('participantes', 'array-contains', auth.currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recent: Record<string, boolean> = {};
      const now = Date.now();
      snapshot.forEach(doc => {
        const d = doc.data();
        const friendId = d.participantes.find((p: string) => p !== auth.currentUser!.uid);
        if (friendId) {
          // Check if last message was within the last 15 minutes (900000 ms)
          // or if connection was just made
          if (d.ultimaMensagemEm && (now - d.ultimaMensagemEm < 900000)) {
            recent[friendId] = true;
          }
        }
      });
      setRecentInteractions(recent);
    }, (err) => {
      console.error("Error fetching chats for recent interactions:", err);
    });
    return () => unsubscribe();
  }, [auth.currentUser]);
`;

content = content.replace(
  "  // Real-time listener for current user's profile/categories",
  chatEffect + "\n  // Real-time listener for current user's profile/categories"
);

// Apply pulse animation to avatar
// We'll replace the CachedLazyImage wrapper with a div that has a dynamic class
content = content.replace(
  /className="shrink-0 relative"/,
  "className={`shrink-0 relative rounded-full ${recentInteractions[conn.id] ? 'ring-4 ring-indigo-500/50 animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.6)]' : ''}`}"
);

fs.writeFileSync('src/pages/ChatList.tsx', content);
