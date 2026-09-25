import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, User, Heart, Share2, Compass, CheckCircle2 } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface ConnectionAnimationProps {
  onComplete: () => void;
}

const STEPS = [
  { id: 1, text: 'Inicializando conexões de rede...', icon: Compass },
  { id: 2, text: 'Mapeando preferências e interesses...', icon: Sparkles },
  { id: 3, text: 'Calculando filtros de proximidade...', icon: Share2 },
  { id: 4, text: 'Conectando com pessoas ao seu redor...', icon: Heart },
  { id: 5, text: 'Tudo pronto! Entrando no New Friends...', icon: CheckCircle2 },
];

// Mock avatars for the graphic network nodes
const AVATARS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&q=80',
];

export default function ConnectionAnimation({ onComplete }: ConnectionAnimationProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLightTheme, setIsLightTheme] = useState(false);

  useEffect(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    // 06:01 is 361 minutes, 17:59 is 1079 minutes
    const light = timeInMinutes >= 361 && timeInMinutes <= 1079;
    setIsLightTheme(light);
  }, []);

  // Fetch the current user's profile photo dynamically
  useEffect(() => {
    const fetchUserPhoto = async () => {
      if (!auth.currentUser) return;
      
      // Try local cache first for instant rendering
      try {
        const cached = localStorage.getItem(`user_profile_cache_${auth.currentUser.uid}`);
        if (cached) {
          const cachedData = JSON.parse(cached);
          if (cachedData?.profile?.fotoPrincipalUrl) {
            setPhotoUrl(cachedData.profile.fotoPrincipalUrl);
          }
        }
      } catch (cacheErr) {
        console.error("Error reading cached user profile in ConnectionAnimation:", cacheErr);
      }

      // Fetch from Firestore
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const uData = userDoc.data();
          if (uData?.profile?.fotoPrincipalUrl) {
            setPhotoUrl(uData.profile.fotoPrincipalUrl);
          }
        } else if (auth.currentUser.photoURL) {
          setPhotoUrl(auth.currentUser.photoURL);
        } else {
          setPhotoUrl(`https://api.dicebear.com/9.x/notionists/svg?seed=${auth.currentUser.uid}`);
        }
      } catch (err) {
        console.error("Error fetching user photo in ConnectionAnimation:", err);
      }
    };

    fetchUserPhoto();
  }, []);

  // Cycle steps in sequence
  useEffect(() => {
    const stepDuration = 800; // 800ms per step
    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < STEPS.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          return prev;
        }
      });
    }, stepDuration);

    return () => clearInterval(interval);
  }, []);

  // Smoothly increment the progress bar to 100% over 4.2 seconds
  useEffect(() => {
    const totalDuration = 4000; // 4 seconds total
    const intervalTime = 40;
    const increment = 100 / (totalDuration / intervalTime);

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(timer);
          // Brief extra delay for a satisfying finish animation before firing completion
          setTimeout(() => {
            onComplete();
          }, 300);
          return 100;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [onComplete]);

  const CurrentIcon = STEPS[currentStepIndex].icon;
  const lineStroke = isLightTheme ? "rgba(99, 102, 241, 0.08)" : "rgba(99, 102, 241, 0.15)";

  return (
    <div className={`fixed inset-0 z-[10000] flex flex-col items-center justify-center px-6 font-sans select-none overflow-hidden transition-colors duration-500 ${isLightTheme ? 'bg-white text-slate-800' : 'bg-slate-950 text-white'}`}>
      {/* Dynamic Network Connection Graphics Background */}
      <div className="absolute inset-0 opacity-45">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Animated Glowing Connection Lines */}
          <motion.line
            x1="20%" y1="20%" x2="50%" y2="50%"
            stroke="url(#lineGlow)" strokeWidth="2"
            initial={{ strokeDasharray: "10 100", strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: -200 }}
            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
          />
          <motion.line
            x1="80%" y1="25%" x2="50%" y2="50%"
            stroke="url(#lineGlow)" strokeWidth="2"
            initial={{ strokeDasharray: "20 80", strokeDashoffset: 100 }}
            animate={{ strokeDashoffset: -200 }}
            transition={{ repeat: Infinity, duration: 3.5, ease: "linear" }}
          />
          <motion.line
            x1="15%" y1="75%" x2="50%" y2="50%"
            stroke="url(#lineGlow)" strokeWidth="2"
            initial={{ strokeDasharray: "15 90", strokeDashoffset: 50 }}
            animate={{ strokeDashoffset: 200 }}
            transition={{ repeat: Infinity, duration: 4.5, ease: "linear" }}
          />
          <motion.line
            x1="85%" y1="80%" x2="50%" y2="50%"
            stroke="url(#lineGlow)" strokeWidth="2"
            initial={{ strokeDasharray: "30 70", strokeDashoffset: 150 }}
            animate={{ strokeDashoffset: -200 }}
            transition={{ repeat: Infinity, duration: 3.8, ease: "linear" }}
          />
          <motion.line
            x1="20%" y1="20%" x2="80%" y2="25%"
            stroke={lineStroke} strokeWidth="1"
          />
          <motion.line
            x1="15%" y1="75%" x2="85%" y2="80%"
            stroke={lineStroke} strokeWidth="1"
          />
          <motion.line
            x1="20%" y1="20%" x2="15%" y2="75%"
            stroke={lineStroke} strokeWidth="1"
          />
          <motion.line
            x1="80%" y1="25%" x2="85%" y2="80%"
            stroke={lineStroke} strokeWidth="1"
          />

          <defs>
            <linearGradient id="lineGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#818cf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
            </linearGradient>
            <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={isLightTheme ? "#e0e7ff" : "#312e81"} stopOpacity={isLightTheme ? "0.65" : "0.35"} />
              <stop offset="100%" stopColor={isLightTheme ? "#ffffff" : "#020617"} stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#bgGlow)" />
        </svg>
      </div>

      {/* Floating Animated Connection Nodes (Avatars) */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Node 1 - Top Left */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, x: -30, y: -30 }}
          animate={{ scale: 1, opacity: 0.85, x: 0, y: 0 }}
          transition={{ duration: 1 }}
          style={{ left: '16%', top: '16%' }}
          className={`absolute w-12 h-12 rounded-full border p-1 shadow-lg flex items-center justify-center overflow-hidden transition-all duration-500 ${isLightTheme ? 'border-indigo-100 bg-white shadow-indigo-100/50' : 'border-indigo-500/50 bg-slate-900/90 shadow-indigo-500/10'}`}
        >
          <img src={AVATARS[0]} className={`w-full h-full rounded-full object-cover transition-all ${isLightTheme ? 'grayscale-[20%] opacity-90' : 'grayscale opacity-80'}`} alt="" />
        </motion.div>

        {/* Node 2 - Top Right */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, x: 30, y: -30 }}
          animate={{ scale: 1, opacity: 0.85, x: 0, y: 0 }}
          transition={{ duration: 1.2 }}
          style={{ right: '16%', top: '21%' }}
          className={`absolute w-14 h-14 rounded-full border p-1 shadow-lg flex items-center justify-center overflow-hidden transition-all duration-500 ${isLightTheme ? 'border-indigo-100 bg-white shadow-indigo-100/50' : 'border-indigo-500/50 bg-slate-900/90 shadow-indigo-500/10'}`}
        >
          <img src={AVATARS[1]} className={`w-full h-full rounded-full object-cover transition-all ${isLightTheme ? 'grayscale-[20%] opacity-90' : 'grayscale opacity-80'}`} alt="" />
        </motion.div>

        {/* Node 3 - Left Middle */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, x: -40, y: 10 }}
          animate={{ scale: 1, opacity: 0.75, x: 0, y: 0 }}
          transition={{ duration: 1.4 }}
          style={{ left: '10%', top: '48%' }}
          className={`absolute w-10 h-10 rounded-full border p-1 shadow-lg flex items-center justify-center overflow-hidden transition-all duration-500 ${isLightTheme ? 'border-indigo-100 bg-white shadow-indigo-100/50' : 'border-indigo-500/40 bg-slate-900/90 shadow-indigo-500/10'}`}
        >
          <img src={AVATARS[2]} className={`w-full h-full rounded-full object-cover transition-all ${isLightTheme ? 'grayscale-[20%] opacity-90' : 'grayscale opacity-80'}`} alt="" />
        </motion.div>

        {/* Node 4 - Right Middle */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, x: 40, y: 10 }}
          animate={{ scale: 1, opacity: 0.75, x: 0, y: 0 }}
          transition={{ duration: 1.5 }}
          style={{ right: '8%', top: '55%' }}
          className={`absolute w-11 h-11 rounded-full border p-1 shadow-lg flex items-center justify-center overflow-hidden transition-all duration-500 ${isLightTheme ? 'border-indigo-100 bg-white shadow-indigo-100/50' : 'border-indigo-500/40 bg-slate-900/90 shadow-indigo-500/10'}`}
        >
          <img src={AVATARS[3]} className={`w-full h-full rounded-full object-cover transition-all ${isLightTheme ? 'grayscale-[20%] opacity-90' : 'grayscale opacity-80'}`} alt="" />
        </motion.div>

        {/* Node 5 - Bottom Left */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, x: -30, y: 30 }}
          animate={{ scale: 1, opacity: 0.85, x: 0, y: 0 }}
          transition={{ duration: 1.1 }}
          style={{ left: '12%', top: '71%' }}
          className={`absolute w-13 h-13 rounded-full border p-1 shadow-lg flex items-center justify-center overflow-hidden transition-all duration-500 ${isLightTheme ? 'border-indigo-100 bg-white shadow-indigo-100/50' : 'border-indigo-500/50 bg-slate-900/90 shadow-indigo-500/10'}`}
        >
          <img src={AVATARS[4]} className={`w-full h-full rounded-full object-cover transition-all ${isLightTheme ? 'grayscale-[20%] opacity-90' : 'grayscale opacity-80'}`} alt="" />
        </motion.div>

        {/* Node 6 - Bottom Right */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, x: 30, y: 30 }}
          animate={{ scale: 1, opacity: 0.85, x: 0, y: 0 }}
          transition={{ duration: 1.3 }}
          style={{ right: '14%', top: '76%' }}
          className={`absolute w-12 h-12 rounded-full border p-1 shadow-lg flex items-center justify-center overflow-hidden transition-all duration-500 ${isLightTheme ? 'border-indigo-100 bg-white shadow-indigo-100/50' : 'border-indigo-500/50 bg-slate-900/90 shadow-indigo-500/10'}`}
        >
          <img src={AVATARS[5]} className={`w-full h-full rounded-full object-cover transition-all ${isLightTheme ? 'grayscale-[20%] opacity-90' : 'grayscale opacity-80'}`} alt="" />
        </motion.div>
      </div>

      {/* Main Center Node - Current Connecting User */}
      <div className="relative z-10 flex flex-col items-center max-w-sm w-full text-center">
        <div className="relative mb-8">
          {/* Pulsing ring animation */}
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
            className={`absolute inset-[-12px] rounded-full border transition-colors duration-500 ${isLightTheme ? 'border-indigo-400/20' : 'border-indigo-500/40'}`}
          />
          <motion.div
            animate={{ scale: [1.1, 1.6, 1.1], opacity: [0.4, 0, 0.4] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", delay: 0.8 }}
            className={`absolute inset-[-12px] rounded-full border transition-colors duration-500 ${isLightTheme ? 'border-indigo-300/10' : 'border-indigo-400/20'}`}
          />

          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
            className={`w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center border-4 shadow-[0_0_40px_rgba(79,70,229,0.5)] relative z-20 overflow-hidden transition-all duration-500 ${isLightTheme ? 'border-white' : 'border-slate-950'}`}
          >
            {photoUrl ? (
              <img 
                src={photoUrl} 
                alt="Me" 
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="w-9 h-9 text-white animate-pulse" />
            )}
          </motion.div>

          {/* Connected mini indicator dots floating out */}
          <motion.div
            animate={{ y: [-10, -45, -10], opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 2.2, delay: 0.2 }}
            className="absolute top-2 left-2 w-2.5 h-2.5 bg-indigo-400 rounded-full shadow-lg"
          />
          <motion.div
            animate={{ x: [10, 45, 10], opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 2.4, delay: 0.6 }}
            className="absolute top-8 right-2 w-2 h-2 bg-pink-400 rounded-full shadow-lg"
          />
          <motion.div
            animate={{ y: [10, 40, 10], opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 2.6, delay: 1 }}
            className="absolute bottom-2 right-4 w-3 h-3 bg-emerald-400 rounded-full shadow-lg"
          />
        </div>

        {/* Step Messages */}
        <div className="h-16 flex items-center justify-center mb-6 px-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepIndex}
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -15, opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className={`flex items-center gap-2.5 transition-colors duration-500 ${isLightTheme ? 'text-slate-700' : 'text-indigo-200'}`}
            >
              <CurrentIcon className={`w-5 h-5 shrink-0 animate-spin-slow transition-colors duration-500 ${isLightTheme ? 'text-indigo-500' : 'text-indigo-400'}`} />
              <span className={`text-[13px] font-bold tracking-wide transition-colors duration-500 ${isLightTheme ? 'text-indigo-950' : 'text-indigo-200'}`}>
                {STEPS[currentStepIndex].text}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress Bar Container */}
        <div className={`w-48 rounded-full h-2.5 p-[2px] overflow-hidden transition-all duration-500 border ${isLightTheme ? 'bg-slate-50 border-slate-200/60' : 'bg-slate-900/80 border-slate-800'}`}>
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <span className={`text-[10px] font-bold uppercase tracking-widest mt-2.5 select-none transition-colors duration-500 ${isLightTheme ? 'text-slate-400' : 'text-slate-500'}`}>
          {Math.round(progress)}% Concluído
        </span>
      </div>
    </div>
  );
}
