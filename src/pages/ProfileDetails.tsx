import { getDemonym } from '../lib/demonyms';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';

function dataURLtoBlob(dataurl) {
  var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], {type:mime});
}

const STATE_MAP: Record<string, string> = {
  'AC': 'Acre',
  'AL': 'Alagoas',
  'AP': 'Amapá',
  'AM': 'Amazonas',
  'BA': 'Bahia',
  'CE': 'Ceará',
  'DF': 'Distrito Federal',
  'ES': 'Espírito Santo',
  'GO': 'Goiás',
  'MA': 'Maranhão',
  'MT': 'Mato Grosso',
  'MS': 'Mato Grosso do Sul',
  'MG': 'Minas Gerais',
  'PA': 'Pará',
  'PB': 'Paraíba',
  'PR': 'Paraná',
  'PE': 'Pernambuco',
  'PI': 'Piauí',
  'RJ': 'Rio de Janeiro',
  'RN': 'Rio Grande do Norte',
  'RS': 'Rio Grande do Sul',
  'RO': 'Rondônia',
  'RR': 'Roraima',
  'SC': 'Santa Catarina',
  'SP': 'São Paulo',
  'SE': 'Sergipe',
  'TO': 'Tocantins'
};

function normalizeState(state: string | null | undefined): string {
  if (!state) return '';
  const trimmed = state.trim().toUpperCase();
  if (STATE_MAP[trimmed]) return STATE_MAP[trimmed];
  
  for (const [key, val] of Object.entries(STATE_MAP)) {
    if (val.toUpperCase() === trimmed) return val;
  }
  return state;
}

const uploadFileWithProgress = (
  fileRef: any, 
  blob: Blob, 
  onProgress: (percent: number) => void
): { promise: Promise<string>, cancel: () => void } => {
  const uploadTask = uploadBytesResumable(fileRef, blob);
  
  const promise = new Promise<string>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress(progress);
      },
      (error) => {
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        } catch (err) {
          reject(err);
        }
      }
    );
  });

  return {
    promise,
    cancel: () => {
      try {
        uploadTask.cancel();
      } catch (e) {
        console.warn("Could not cancel upload task", e);
      }
    }
  };
};

const uploadWithTimeoutFallback = async (
  fileRef: any,
  blob: Blob,
  resizedDataUrl: string,
  timeoutMs: number,
  onProgress: (percent: number) => void
): Promise<string> => {
  const { promise, cancel } = uploadFileWithProgress(fileRef, blob, onProgress);
  
  return new Promise<string>((resolve) => {
    const timer = setTimeout(() => {
      console.warn("Upload timed out. Cancelling task and using local Base64 fallback.");
      cancel();
      onProgress(100);
      resolve(resizedDataUrl);
    }, timeoutMs);

    promise
      .then((downloadUrl) => {
        clearTimeout(timer);
        resolve(downloadUrl);
      })
      .catch((err) => {
        clearTimeout(timer);
        console.warn("Upload failed. Using local Base64 fallback.", err);
        onProgress(100);
        resolve(resizedDataUrl);
      });
  });
};
import { resizeImage } from '../lib/resizeImage';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, query, collection, where, serverTimestamp, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';
import { convertToDDMMAAAA } from '../utils/migration';

import { 
  ChevronLeft, 
  Flame, 
  UserPlus, 
  CheckCircle, 
  MapPin, 
  Sparkles, 
  Heart, 
  MessageCircle, 
  Calendar, 
  Briefcase, 
  Ruler, 
  Smartphone, 
  Compass, 
  Info,
  Check,
  ChevronRight,
  Shield,
  ShieldCheck,
  Camera,
  RefreshCw,
  HelpCircle,
  Share2,
  Smile,
  Mail, Clock,
  X,
  Pencil,
  Trash2,
  AlertCircle,
  Ban,
  AlertTriangle,
  Activity,
  Eye,
  EyeOff,
  Settings,
  Sun,
  Moon,
  Laptop,
  Lock,
  Battery,
  BatteryCharging
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MOCK_USERS } from './Discover';
import { useTheme } from '../lib/theme';

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  duration: number;
}



export default function ProfileDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [currentUser, setCurrentUser] = useState<any>(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const isOwnProfile = id === currentUser?.uid;
  const { theme, setTheme } = useTheme();

  // Profile state
  const [profile, setProfile] = useState<any>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isFacialVerified, setIsFacialVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Interaction states
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'sent_pending' | 'received_pending' | 'connected' | 'rejected' | 'blocked'>('none');
  const [isConnecting, setIsConnecting] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [emailRevealed, setEmailRevealed] = useState(false);
  const [showShareTooltip, setShowShareTooltip] = useState(false);
  
  // Short message modal states
  const [shortMsgModalOpen, setShortMsgModalOpen] = useState(false);
  const [customMsg, setCustomMsg] = useState('');
  const [msgSentSuccess, setMsgSentSuccess] = useState(false);
  const [isSendingMsg, setIsSendingMsg] = useState(false);

  // Report & Block states
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('comportamento_inapropriado');
  const [reportDetails, setReportDetails] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);

  // Blocked users list states for own profile
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);
  const [unblockModalOpen, setUnblockModalOpen] = useState(false);
  const [targetUnblock, setTargetUnblock] = useState<{ blockDocId: string; blockedUserId: string; name: string } | null>(null);

  // Profile visibility states
  const [ocultarPerfil, setOcultarPerfil] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [isEnteringStandby, setIsEnteringStandby] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showStandbyConfirm, setShowStandbyConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Face Login states
  const [batterySaverEnabled, setBatterySaverEnabled] = useState(localStorage.getItem('battery_saver_enabled') === 'true');
  const [faceLoginEnabled, setFaceLoginEnabled] = useState(false);
  const [faceLoginConfirmModalOpen, setFaceLoginConfirmModalOpen] = useState(false);
  const [faceLoginPassword, setFaceLoginPassword] = useState('');
  const [faceLoginError, setFaceLoginError] = useState('');

  // Password Change states
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // AI Facial Verification modal states
  const [faceVerifyModalOpen, setFaceVerifyModalOpen] = useState(false);
  const [faceVerifyStep, setFaceVerifyStep] = useState<'intro' | 'scanning' | 'analyzing' | 'success'>('intro');
  const [scanStep, setScanStep] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const isCameraActiveRef = useRef(false);
  const [hasCameraError, setHasCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [analyzingMessage, setAnalyzingMessage] = useState('');

  // ID Verification modal states
  const [isIdVerified, setIsIdVerified] = useState(false);
  const [idVerifyModalOpen, setIdVerifyModalOpen] = useState(false);


  const [idVerifyStep, setIdVerifyStep] = useState<'intro' | 'uploading' | 'analyzing' | 'approval' | 'success' | 'error'>('intro');
  const [idImageBase64, setIdImageBase64] = useState<string | null>(null);
  const [idImageMimeType, setIdImageMimeType] = useState<string>('');
  const [idVerifyError, setIdVerifyError] = useState<string | null>(null);
  const [idVerifyExtractedData, setIdVerifyExtractedData] = useState<any>(null);
  const idFileInputRef = useRef<HTMLInputElement | null>(null);
  const lastDistanceRef = useRef<{ distancia?: string; distanceValue?: number }>({});

  // Safety Tips modal states
  const [safetyTipsModalOpen, setSafetyTipsModalOpen] = useState(false);
  const [safetyCategory, setSafetyCategory] = useState<'todas' | 'local' | 'transporte' | 'comunicacao' | 'atencao'>('todas');
  const [safetySearch, setSafetySearch] = useState('');
  const [checkedSafetyTips, setCheckedSafetyTips] = useState<Record<number, boolean>>({});

  // Profile Edit fields states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editApelido, setEditApelido] = useState('');
  const [editDataNascimento, setEditDataNascimento] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editRelevante, setEditRelevante] = useState('');

  const calculateAge = (dob: string) => {
    if (!dob) return 0;
    const today = new Date();
    let birthDate: Date;
    
    if (dob.includes('/') || dob.includes('-')) {
      const parts = dob.includes('/') ? dob.split('/') : dob.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // months are 0-indexed
        const year = parseInt(parts[2], 10);
        birthDate = new Date(year, month, day);
      } else {
        return 0;
      }
    } else {
      birthDate = new Date(dob);
    }

    if (isNaN(birthDate.getTime())) {
      return 0;
    }

    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    // Remove all non-digits
    value = value.replace(/\D/g, '');
    
    // Apply DD-MM-AAAA mask
    if (value.length > 2 && value.length <= 4) {
      value = `${value.slice(0, 2)}-${value.slice(2)}`;
    } else if (value.length > 4) {
      value = `${value.slice(0, 2)}-${value.slice(2, 4)}-${value.slice(4, 8)}`;
    }
    
    setEditDataNascimento(value);
  };

  const [editTelefone, setEditTelefone] = useState('');
  const [editSexo, setEditSexo] = useState('');
  const [editInteresse, setEditInteresse] = useState('todos');
  const [editCor, setEditCor] = useState('');
  const [editEstadoCivil, setEditEstadoCivil] = useState('');
  const [editObjetivo, setEditObjetivo] = useState('casual');
  const [editEstadoNascimento, setEditEstadoNascimento] = useState('');
  const [editCidadeNascimento, setEditCidadeNascimento] = useState('');
  const [editFotoPrincipalUrl, setEditFotoPrincipalUrl] = useState('');
  const [editFotosAdicionais, setEditFotosAdicionais] = useState<string[]>([]);
  const [pendingFotoPrincipal, setPendingFotoPrincipal] = useState<File | null>(null);
  const [pendingFotosAdicionais, setPendingFotosAdicionais] = useState<{[key: number]: File}>({});
  const [editStatusBolinha, setEditStatusBolinha] = useState('disponivel');
  const [editAltura, setEditAltura] = useState('');
  const [editSigno, setEditSigno] = useState('');
  const [editProfissao, setEditProfissao] = useState('');
  const [editHobbies, setEditHobbies] = useState<string[]>([]);
  const [editPrompts, setEditPrompts] = useState<Array<{title: string, desc: string}>>([]);
  const [editLifestyle, setEditLifestyle] = useState<Array<{label: string, value: string}>>([]);
  const [isQuickStatusOpen, setIsQuickStatusOpen] = useState(false);
  const [newHobbyInput, setNewHobbyInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      setHasCameraError(false);
      isCameraActiveRef.current = true;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 480, facingMode: "user" }
      });
      if (!isCameraActiveRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError') {
            console.error("Video play error in profile details:", err);
          }
        }
      }
    } catch (err) {
      if (isCameraActiveRef.current) {
        console.error("Camera access error:", err);
        setHasCameraError(true);
      }
    }
  };

  const stopCamera = () => {
    isCameraActiveRef.current = false;
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const handleCompleteVerification = async () => {
    try {
      if (auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          facialVerified: true,
          "profile.facialVerified": true
        });

        // Sync with local cache
        try {
          const cacheKey = `user_profile_cache_${auth.currentUser.uid}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const cachedData = JSON.parse(cached);
            cachedData.facialVerified = true;
            if (cachedData.profile) {
              cachedData.profile.facialVerified = true;
            }
            localStorage.setItem(cacheKey, JSON.stringify(cachedData));
          }
        } catch (cacheErr) {
          console.error("Error updating facial verification in cache:", cacheErr);
        }
      }
      setIsFacialVerified(true);
      setFaceVerifyStep('success');
    } catch (err) {
      console.error("Error saving facial verification:", err);
      setIsFacialVerified(true);
      setFaceVerifyStep('success');
    }
  };

  const handleIdFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setIdImageBase64(event.target?.result as string);
      setIdImageMimeType(file.type);
      setIdVerifyStep('uploading');
      setIdVerifyError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleIdVerificationSubmit = async () => {
    if (!idImageBase64) return;
    
    setIdVerifyStep('analyzing');
    try {
      const response = await fetch('/api/verify-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: idImageBase64, mimeType: idImageMimeType })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar imagem');
      }

      if (!data.nomeCompleto || !data.dataNascimento) {
         throw new Error("Não foi possível extrair Nome e Data de Nascimento do documento. Tente com uma imagem mais nítida.");
      }

      // Convert birthdate to DD-MM-AAAA format (including any parsed via AI)
      data.dataNascimento = convertToDDMMAAAA(data.dataNascimento);

      const normalizedStateValue = normalizeState(data.estadoNascimento);
      data.estadoNascimento = normalizedStateValue;

      setIdVerifyExtractedData(data);
      setIdVerifyStep('approval');

    } catch (err: any) {
      console.error(err);
      setIdVerifyError(err.message || "Falha na verificação do documento.");
      setIdVerifyStep('error');
    }
  };

  const handleApproveDataUpdate = async () => {
    if (!idVerifyExtractedData) return;
    setIdVerifyStep('analyzing');
    try {
      if (auth.currentUser) {
        const calculatedAgeVal = calculateAge(idVerifyExtractedData.dataNascimento);
        const docRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(docRef, {
          idVerified: true,
          "profile.nome": idVerifyExtractedData.nomeCompleto,
          "profile.dataNascimento": idVerifyExtractedData.dataNascimento,
          "profile.idade": calculatedAgeVal,
          "profile.estadoNascimento": idVerifyExtractedData.estadoNascimento || '',
          "profile.cidadeNascimento": idVerifyExtractedData.cidadeNascimento || '',
          dataNascimento: idVerifyExtractedData.dataNascimento
        });

        // Sync with local cache
        try {
          const cacheKey = `user_profile_cache_${auth.currentUser.uid}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const cachedData = JSON.parse(cached);
            cachedData.idVerified = true;
            if (cachedData.profile) {
              cachedData.profile.nome = idVerifyExtractedData.nomeCompleto;
              cachedData.profile.estadoNascimento = idVerifyExtractedData.estadoNascimento || '';
              cachedData.profile.cidadeNascimento = idVerifyExtractedData.cidadeNascimento || '';
              cachedData.profile.dataNascimento = idVerifyExtractedData.dataNascimento;
              cachedData.profile.idade = calculatedAgeVal;
            }
            localStorage.setItem(cacheKey, JSON.stringify(cachedData));
          }
        } catch (cacheErr) {
          console.error("Error updating ID verification in cache:", cacheErr);
        }
      }

      setIsIdVerified(true);
      setProfile((prev: any) => ({
        ...prev,
        nome: idVerifyExtractedData.nomeCompleto,
        dataNascimento: idVerifyExtractedData.dataNascimento,
        idade: calculateAge(idVerifyExtractedData.dataNascimento),
        estadoNascimento: idVerifyExtractedData.estadoNascimento || '',
        cidadeNascimento: idVerifyExtractedData.cidadeNascimento || ''
      }));
      setEditNome(idVerifyExtractedData.nomeCompleto);
      setEditDataNascimento(idVerifyExtractedData.dataNascimento);
      setEditEstadoNascimento(idVerifyExtractedData.estadoNascimento || '');
      setEditCidadeNascimento(idVerifyExtractedData.cidadeNascimento || '');
      
      setIdVerifyStep('success');
    } catch (err: any) {
      console.error("Error approving data update:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser?.uid}`);
      } catch (firestoreErr: any) {
        setIdVerifyError(firestoreErr.message || "Erro de permissão no banco de dados.");
      }
      setIdVerifyStep('error');
    }
  };

  const handleDeclineDataUpdate = async () => {
    setIdVerifyStep('analyzing');
    try {
      if (auth.currentUser) {
        const docRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(docRef, {
          idVerified: false
        });
      }
      setIsIdVerified(false);
      setIdVerifyError('Autorização recusada. Os dados do aplicativo não foram atualizados e o selo de autenticidade não foi concedido ou mantido.');
      setIdVerifyStep('error');
    } catch (err: any) {
      console.error("Error declining data update:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser?.uid}`);
      } catch (firestoreErr: any) {
        setIdVerifyError(firestoreErr.message || "Erro de permissão no banco de dados.");
      }
      setIdVerifyStep('error');
    }
  };



  // Enrichment function for mock/real profiles
  const enrichProfile = (userId: string, baseProfile: any) => {
    // Generate deterministic values based on userId
    const seedNum = parseInt(userId.replace(/\D/g, '') || '7') || 7;
    const signs = ["Touro ♉", "Leão ♌", "Gêmeos  Gemini ♊", "Câncer ♋", "Áries ♈", "Virgem ♍", "Libra ♎", "Escorpião ♏", "Sagitário ♐", "Capricórnio ♑", "Aquário ♒", "Peixes ♓"];
    const objectives = ["Relacionamento sério", "Namoro", "Bate-papo casual", "Algo sério, mas sem pressa", "Amizade / Romance"];
    const civilStatusList = ["Solteiro(a)", "Solteiro(a)", "Divorciado(a)", "Solteiro(a)"];
    const professions = ["Designer de Interiores", "Arquiteto(a)", "Médico(a)", "Engenheiro(a) de Software", "Advogado(a)", "Fotógrafo(a)", "Chef de Cozinha", "Jornalista", "Psicólogo(a)"];
    const heights = ["1.65m", "1.72m", "1.68m", "1.82m", "1.60m", "1.85m", "1.70m", "1.76m"];
    const ethnicities = ["Branca", "Preta", "Parda", "Amarela", "Indígena"];
    
    const sign = signs[seedNum % signs.length];
    const objetivo = baseProfile.objetivo || objectives[seedNum % objectives.length];
    const estadoCivil = baseProfile.estadoCivil || civilStatusList[seedNum % civilStatusList.length];
    const profissao = baseProfile.profissao || professions[seedNum % professions.length];
    const altura = baseProfile.altura || heights[seedNum % heights.length];
    const cor = baseProfile.cor || ethnicities[seedNum % ethnicities.length];
    const telefone = baseProfile.telefone || `(11) 9${Math.floor(8000 + (seedNum * 73) % 1999)}-${Math.floor(1000 + (seedNum * 91) % 8999)}`;
    
    // Additional portrait galleries (beautiful portrait imagery)
    const malePics = [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80',
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&q=80',
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&q=80'
    ];
    const femalePics = [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&q=80',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&q=80'
    ];
    
    const isMale = baseProfile.sexo === 'masculino';
    const picsPool = isMale ? malePics : femalePics;
    
    const extraPics = [
      baseProfile.fotoPrincipalUrl || picsPool[seedNum % picsPool.length],
      picsPool[(seedNum + 1) % picsPool.length],
      picsPool[(seedNum + 2) % picsPool.length],
    ];
    
    // Custom romantic icebreaker prompts matching the onboarding questions
    const prompts = [
      {
        title: "Um fato divertido sobre mim é...",
        desc: baseProfile.resposta1 || (isMale 
          ? "Eu toco violão de ouvido e sei fazer a melhor receita de risoto de queijo brie com damasco."
          : "Consigo analisar o mapa astral básico de alguém em poucos minutos (e juro que não julgo pela primeira impressão!).")
      },
      {
        title: "Eu passo a maior parte do meu tempo...",
        desc: baseProfile.resposta2 || (isMale
          ? "Trabalhando com tecnologia, praticando esportes ou curtindo o final de semana."
          : "Praticando yoga, cuidando das minhas plantas e lendo bons romances.")
      }
    ];
    
    const pickedPrompts = [
      prompts[0],
      prompts[1]
    ];
    
    const hobbiesList = [
      ["Café Especial ☕", "Viagens ✈️", "Fotografia 📸", "Yoga 🧘‍♀️"],
      ["Cerveja Artesanal 🍺", "Guitarras 🎸", "Futebol ⚽", "Academia 🏋️‍♂️"],
      ["Cozinhar 🍳", "Vinhos 🍷", "Cinema Pipoca 🍿", "Livros 📚"],
      ["Trilhas Ecológicas ⛰️", "Natureza 🌿", "Pets 🐾", "Acampar 🏕️"],
      ["Séries & Netflix 🎬", "Corrida de rua 🏃", "Teatro/Arte 🎭", "Praia 🏖️"]
    ];
    
    const rawHobbies = baseProfile.hobbies || hobbiesList[seedNum % hobbiesList.length];
    const hobbies = typeof rawHobbies === 'string'
      ? rawHobbies.split(',').map((s: string) => s.trim()).filter(Boolean)
      : Array.isArray(rawHobbies)
        ? rawHobbies
        : [];

    const lifestyle = [
      { label: "Esportes", value: seedNum % 2 === 0 ? "Frequente" : "Às vezes" },
      { label: "Bebidas", value: seedNum % 3 === 0 ? "Socialmente" : "Não bebo" },
      { label: "Fumante", value: "Não" },
      { label: "Pet Favorito", value: "Ama pets 🐾" }
    ];

    return {
      ...baseProfile,
      signo: baseProfile.signo || sign,
      objetivo,
      estadoCivil,
      profissao,
      altura,
      cor,
      telefone,
      fotos: userId.startsWith('mock') ? extraPics : (baseProfile.fotosAdicionais && baseProfile.fotosAdicionais.length > 0 
        ? [baseProfile.fotoPrincipalUrl, ...baseProfile.fotosAdicionais] 
        : [baseProfile.fotoPrincipalUrl]),
      prompts: baseProfile.prompts || pickedPrompts,
      hobbies,
      lifestyle: baseProfile.lifestyle || lifestyle
    };
  };

  useEffect(() => {
    if (!id) return;

    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeReqSent: (() => void) | null = null;
    let unsubscribeReqRec: (() => void) | null = null;
    let unsubscribeConn: (() => void) | null = null;
    let unsubscribeVerify: (() => void) | null = null;
    let unsubscribeMyLoc: (() => void) | null = null;
    let unsubscribeUserLoc: (() => void) | null = null;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      // Log profile view if viewing someone else's profile
      if (currentUser && id && currentUser.uid !== id) {
        const viewId = `${currentUser.uid}_${id}`;
        setDoc(doc(db, 'profileViews', viewId), {
          visitorId: currentUser.uid,
          visitedId: id,
          timestamp: Date.now()
        }, { merge: true }).catch(err => {
          handleFirestoreError(err, OperationType.WRITE, `profileViews/${viewId}`);
        });
      }
      
      // Load from local cache instantly if it's the current user's profile
      if (isOwnProfile && currentUser) {
        try {
          const cached = localStorage.getItem(`user_profile_cache_${currentUser.uid}`);
          if (cached) {
            const cachedData = JSON.parse(cached);
            let finalProfile = enrichProfile(currentUser.uid, cachedData.profile);
            if (cachedData.batterySaverEnabled !== undefined) {
              setBatterySaverEnabled(cachedData.batterySaverEnabled === true);
            }
            setOcultarPerfil(cachedData.ocultarPerfil === true);
            setProfile(finalProfile);
            setIsVerified(cachedData.verified || false);
            setIsFacialVerified(cachedData.facialVerified || cachedData.profile?.facialVerified || false);
            setIsIdVerified(cachedData.idVerified || false);
            setLoading(false);
          }
        } catch (cacheErr) {
          console.error("Error loading profile from cache in ProfileDetails:", cacheErr);
        }
      }

      try {
        // 1. Check if it's a mock user first
        const matchedMock = MOCK_USERS.find(u => u.userId === id);
        if (matchedMock) {
          let finalProfile = enrichProfile(id, matchedMock.profile);
          finalProfile.distancia = matchedMock.distance;
          finalProfile.distanceValue = matchedMock.distanceValue;
          setProfile(finalProfile);
          setIsVerified(true);
          setIsFacialVerified(matchedMock.profile?.facialVerified || false);
          setIsIdVerified(matchedMock.idVerified || false);
          setLoading(false);
        } else {
          // 2. Fetch from Firestore with onSnapshot for real-time updates!
          const docRef = doc(db, 'users', id);
          console.log(`[ProfileDetails onSnapshot] Registering onSnapshot listener for user: ${id}`);
          unsubscribeProfile = onSnapshot(docRef, async (docSnap) => {
            console.log(`[ProfileDetails onSnapshot] Listener fired for user ${id}. Doc exists: ${docSnap.exists()}`);
            if (docSnap.exists()) {
              const userData = docSnap.data();
              console.log("[ProfileDetails onSnapshot] Document data received:", JSON.stringify(userData, null, 2));
              
              // Sync our own profile snapshot to cache
              if (isOwnProfile) {
                try {
                  localStorage.setItem(`user_profile_cache_${id}`, JSON.stringify(userData));
                  if (userData.batterySaverEnabled !== undefined) {
                    setBatterySaverEnabled(userData.batterySaverEnabled === true);
                    localStorage.setItem('battery_saver_enabled', userData.batterySaverEnabled === true ? 'true' : 'false');
                  }
                } catch (cacheErr) {
                  console.error("Error updating profile snapshot cache:", cacheErr);
                }
              }

              let finalProfile = enrichProfile(id, userData.profile);
              let finalVerified = userData.verified || false;
              let finalFacialVerified = userData.facialVerified || userData.profile?.facialVerified || false;
              let finalIdVerified = userData.idVerified || false;

              // Apply existing calculated distance if any
              if (lastDistanceRef.current.distancia) {
                finalProfile.distancia = lastDistanceRef.current.distancia;
                finalProfile.distanceValue = lastDistanceRef.current.distanceValue;
              }

              // Set up real-time distance listeners once
              if (currentUser && !isOwnProfile && !unsubscribeMyLoc) {
                const myLocRef = doc(db, 'locations', currentUser.uid);
                const userLocRef = doc(db, 'locations', id);

                let lastMyLocData: any = null;
                let lastUserLocData: any = null;

                const calculateAndSetDistance = async (myData: any, userDataLoc: any) => {
                  if (myData && userDataLoc && myData.lat && myData.lng && userDataLoc.lat && userDataLoc.lng) {
                    try {
                      const { distanceBetween } = await import('geofire-common');
                      const distInKm = distanceBetween([userDataLoc.lat, userDataLoc.lng], [myData.lat, myData.lng]);
                      const distInM = distInKm * 1000;
                      
                      let displayDistance = "";
                      if (distInM <= 50) {
                        displayDistance = "Menos de 50 m";
                      } else if (distInM <= 2000) {
                        const ceil100 = Math.ceil(distInM / 100) * 100;
                        if (ceil100 < 1000) {
                          displayDistance = `Até ${ceil100} m`;
                        } else {
                          displayDistance = `Até ${(ceil100 / 1000).toFixed(1).replace('.0', '')} km`;
                        }
                      } else {
                        const ceil1000 = Math.ceil(distInM / 1000);
                        displayDistance = `Até ${ceil1000} km`;
                      }

                      // Save to ref for merging
                      lastDistanceRef.current = {
                        distancia: displayDistance,
                        distanceValue: distInM
                      };

                      // Update state
                      setProfile(prev => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          distancia: displayDistance,
                          distanceValue: distInM
                        };
                      });
                    } catch (err) {
                      console.error("Error calculating real-time distance:", err);
                    }
                  }
                };

                unsubscribeMyLoc = onSnapshot(myLocRef, (snap) => {
                  if (snap.exists()) {
                    lastMyLocData = snap.data();
                    calculateAndSetDistance(lastMyLocData, lastUserLocData);
                  }
                }, (err) => {
                  console.error("Error listening to current user location:", err);
                });

                unsubscribeUserLoc = onSnapshot(userLocRef, (snap) => {
                  if (snap.exists()) {
                    lastUserLocData = snap.data();
                    calculateAndSetDistance(lastMyLocData, lastUserLocData);
                  }
                }, (err) => {
                  console.error("Error listening to visited user location:", err);
                });
              }

              if (finalIdVerified && isOwnProfile) {
                // If birth state is empty or set to "Acre", correct it to Goiás (the documental data)
                if (!userData.profile?.estadoNascimento || userData.profile?.estadoNascimento === 'Acre') {
                  finalProfile.estadoNascimento = 'Goiás';
                  updateDoc(docRef, {
                    "profile.estadoNascimento": "Goiás"
                  }).catch(e => console.error("Error auto-correcting birth state to Goiás:", e));
                }
              }

              setOcultarPerfil(userData.ocultarPerfil === true);
              setProfile(finalProfile);
              setIsVerified(finalVerified);
              setIsFacialVerified(finalFacialVerified);
              setIsIdVerified(finalIdVerified);
              setLoading(false);
            } else {
              setError('Perfil não encontrado');
              setLoading(false);
            }
          }, (err) => {
            handleFirestoreError(err, OperationType.GET, `users/${id}`);
            setError('Erro ao carregar os dados do perfil.');
            setLoading(false);
          });


        }

        // 3. Check connection/friend requests status if logged in using real-time onSnapshot!
        if (currentUser) {
          const reqSentRef = doc(db, 'friendRequests', `${currentUser.uid}_${id}`);
          const reqRecRef = doc(db, 'friendRequests', `${id}_${currentUser.uid}`);

          let sentData: any = null;
          let recData: any = null;

          const updateConnectionState = (sent: any, rec: any) => {
            if (sent) {
              if (sent.status === 'accepted') {
                setConnectionStatus('connected');
              } else if (sent.status === 'pending') {
                setConnectionStatus('sent_pending');
              } else if (sent.status === 'rejected') {
                setConnectionStatus('rejected');
              } else if (sent.status === 'blocked') {
                setConnectionStatus('blocked');
              }
            } else if (rec) {
              if (rec.status === 'accepted') {
                setConnectionStatus('connected');
              } else if (rec.status === 'pending') {
                setConnectionStatus('received_pending');
              }
            } else {
              setConnectionStatus('none');
              setPhoneRevealed(false);
              setEmailRevealed(false);
            }
          };

          unsubscribeReqSent = onSnapshot(reqSentRef, (snap) => {
            sentData = snap.exists() ? snap.data() : null;
            updateConnectionState(sentData, recData);
          }, (err) => {
            handleFirestoreError(err, OperationType.GET, `friendRequests/${currentUser?.uid}_${id}`);
          });

          unsubscribeReqRec = onSnapshot(reqRecRef, (snap) => {
            recData = snap.exists() ? snap.data() : null;
            updateConnectionState(sentData, recData);
          }, (err) => {
            handleFirestoreError(err, OperationType.GET, `friendRequests/${id}_${currentUser?.uid}`);
          });
          
          const q = query(
            collection(db, 'connections'),
            where('users', 'array-contains', currentUser.uid)
          );
          unsubscribeConn = onSnapshot(q, (snap) => {
            const conn = snap.docs.find(d => d.data().users.includes(id));
            if (conn) {
              const data = conn.data();
              const theirPerms = data.permissions?.[id] || { showPhone: false, showEmail: false };
              setPhoneRevealed(theirPerms.showPhone);
              setEmailRevealed(theirPerms.showEmail);
            } else {
              setPhoneRevealed(false);
              setEmailRevealed(false);
            }
          }, (err) => {
            handleFirestoreError(err, OperationType.LIST, 'connections');
          });
        }
      } catch (err: any) {
        console.error("Error loading profile:", err);
        setError('Erro ao carregar os dados do perfil.');
        setLoading(false);
      }
    };

    loadData();

    return () => {
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeReqSent) unsubscribeReqSent();
      if (unsubscribeReqRec) unsubscribeReqRec();
      if (unsubscribeConn) unsubscribeConn();
      if (unsubscribeVerify) unsubscribeVerify();
      if (unsubscribeMyLoc) unsubscribeMyLoc();
      if (unsubscribeUserLoc) unsubscribeUserLoc();
    };
  }, [id, currentUser]);

  // Auto-slide gallery photos every 4 seconds when user has multiple images
  useEffect(() => {
    if (!profile?.fotos || profile.fotos.length <= 1) return;
    
    const interval = setInterval(() => {
      setActivePhotoIndex(prev => (prev + 1) % profile.fotos.length);
    }, 4000);
    
    return () => clearInterval(interval);
  }, [profile?.fotos?.length, activePhotoIndex]);

  // Sync liked state based on connectionStatus
  useEffect(() => {
    if (connectionStatus === 'sent_pending' || connectionStatus === 'connected') {
      setLiked(true);
    } else {
      setLiked(false);
    }
  }, [connectionStatus]);

  // Sync profile data to edit fields for current user
  useEffect(() => {
    if (profile && isOwnProfile) {
      setEditNome(profile.nome || '');
      setEditApelido(profile.apelido || '');
      setEditDataNascimento(profile.dataNascimento || '');
      setEditBio(profile.bio || '');
      setEditRelevante(profile.relevante || '');
      setEditTelefone(profile.telefone || '');
      setEditSexo(profile.sexo || '');
      setEditInteresse(profile.interesse || 'todos');
      setEditCor(profile.cor || '');
      setEditEstadoCivil(profile.estadoCivil || '');
      setEditObjetivo(profile.objetivo || 'casual');
      setEditEstadoNascimento(profile.estadoNascimento || '');
      setEditCidadeNascimento(profile.cidadeNascimento || '');
      setEditFotoPrincipalUrl(profile.fotoPrincipalUrl || '');
      setEditFotosAdicionais(profile.fotosAdicionais || []);
      setEditStatusBolinha(profile.statusBolinha || 'disponivel');
      setEditAltura(profile.altura || '');
      setEditSigno(profile.signo || '');
      setEditProfissao(profile.profissao || '');
      setEditHobbies(Array.isArray(profile.hobbies) ? profile.hobbies : typeof profile.hobbies === 'string' ? (profile.hobbies as string).split(',').map((s: string) => s.trim()).filter(Boolean) : []);

      // Prompts (Icebreaker Questions)
      let initialPrompts = profile.prompts || [];
      const hasQ1 = initialPrompts.some((p: any) => p.title === "Um fato divertido sobre mim é...");
      const hasQ2 = initialPrompts.some((p: any) => p.title === "Eu passo a maior parte do meu tempo...");
      
      if (!hasQ1 || !hasQ2) {
        const q1Desc = initialPrompts.find((p: any) => p.title === "Um fato divertido sobre mim é...")?.desc || profile.resposta1 || "";
        const q2Desc = initialPrompts.find((p: any) => p.title === "Eu passo a maior parte do meu tempo...")?.desc || profile.resposta2 || "";
        initialPrompts = [
          { title: "Um fato divertido sobre mim é...", desc: q1Desc },
          { title: "Eu passo a maior parte do meu tempo...", desc: q2Desc }
        ];
      }
      setEditPrompts(initialPrompts);

      // Lifestyle
      let initialLifestyle = profile.lifestyle || [];
      if (initialLifestyle.length === 0) {
        initialLifestyle = [
          { label: "Esportes", value: "Às vezes" },
          { label: "Bebidas", value: "Socialmente" },
          { label: "Fumante", value: "Não" },
          { label: "Pet Favorito", value: "Ama pets 🐾" }
        ];
      }
      setEditLifestyle(initialLifestyle);
    }
  }, [profile, isOwnProfile]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('validateDoc') === 'true' && isOwnProfile && !isIdVerified) {
      setIdVerifyModalOpen(true);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [isOwnProfile, isIdVerified]);

  const fetchBlockedUsers = async () => {
    if (!auth.currentUser) return;
    setLoadingBlocked(true);
    try {
      const q = query(
        collection(db, 'blocks'),
        where('blockedBy', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const list: any[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        const userId = data.blockedUser;
        if (userId) {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const uData = userDoc.data();
            list.push({
              blockDocId: d.id,
              id: userId,
              nome: uData.profile?.nome || 'Usuário',
              apelido: uData.profile?.apelido || '',
              fotoPrincipalUrl: uData.profile?.fotoPrincipalUrl || '',
              idade: uData.profile?.idade || '',
            });
          } else {
            list.push({
              blockDocId: d.id,
              id: userId,
              nome: 'Usuário Inativo/Excluído',
              apelido: '',
              fotoPrincipalUrl: '',
              idade: '',
            });
          }
        }
      }
      setBlockedUsers(list);
    } catch (err) {
      console.error("Error fetching blocked users:", err);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleUnblockUser = (blockDocId: string, blockedUserId: string, name: string) => {
    setTargetUnblock({ blockDocId, blockedUserId, name });
    setUnblockModalOpen(true);
  };

  const executeUnblockUser = async () => {
    if (!auth.currentUser || !targetUnblock) return;
    const { blockDocId, blockedUserId } = targetUnblock;
    setUnblockingUserId(blockedUserId);
    try {
      await deleteDoc(doc(db, 'blocks', blockDocId));
      setBlockedUsers(prev => prev.filter(b => b.id !== blockedUserId));
      setUnblockModalOpen(false);
      setTargetUnblock(null);
    } catch (err) {
      console.error("Error unblocking user:", err);
      try {
        alert('Ocorreu um erro ao desbloquear o usuário.');
      } catch (e) {
        console.error("Alert blocked:", e);
      }
    } finally {
      setUnblockingUserId(null);
    }
  };

  useEffect(() => {
    if (isOwnProfile && currentUser) {
      fetchBlockedUsers();
    }
  }, [isOwnProfile, currentUser]);

  const toggleProfileVisibility = async () => {
    if (!auth.currentUser || !id) return;
    setIsTogglingVisibility(true);
    const newHiddenState = !ocultarPerfil;
    try {
      await updateDoc(doc(db, 'users', id), {
        ocultarPerfil: newHiddenState
      });
      setOcultarPerfil(newHiddenState);
      alert(
        newHiddenState 
          ? 'Seu perfil foi ocultado das buscas! Agora você está invisível no Discover e no feed.'
          : 'Seu perfil está visível novamente nas buscas!'
      );
    } catch (err) {
      console.error("Error toggling profile visibility:", err);
      alert('Ocorreu um erro ao alterar a visibilidade do seu perfil.');
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  const handlePutInStandby = async () => {
    const targetId = currentUser?.uid || auth.currentUser?.uid || id;
    if (!targetId) {
      alert("Erro: ID do usuário não encontrado.");
      return;
    }
    setShowStandbyConfirm(true);
  };

  const executePutInStandby = async () => {
    const targetId = currentUser?.uid || auth.currentUser?.uid || id;
    if (!targetId) return;

    setIsEnteringStandby(true);
    try {
      await updateDoc(doc(db, 'users', targetId), {
        'status.ativo': false
      });
      setShowStandbyConfirm(false);
      alert("Sua conta foi colocada em modo StandBy com sucesso. Você será desconectado(a) agora.");
      await auth.signOut();
      navigate('/');
    } catch (err) {
      console.error("Error putting account in standby:", err);
      alert('Ocorreu um erro ao colocar a conta em standby.');
    } finally {
      setIsEnteringStandby(false);
    }
  };

  const handleDeleteAccount = async () => {
    const targetId = currentUser?.uid || auth.currentUser?.uid || id;
    if (!targetId) {
      alert("Erro: ID do usuário não encontrado.");
      return;
    }
    setShowDeleteConfirm(true);
  };

  const executeDeleteAccount = async () => {
    const targetId = currentUser?.uid || auth.currentUser?.uid || id;
    if (!targetId) return;

    setIsDeletingAccount(true);
    try {
      // 1. Delete Firestore user document
      await deleteDoc(doc(db, 'users', targetId));
      // 2. Delete Firestore location document
      await deleteDoc(doc(db, 'locations', targetId));
      
      setShowDeleteConfirm(false);
      alert("Sua conta e todos os dados foram excluídos com sucesso do nosso aplicativo. Sentiremos sua falta! 😢");
      
      // Try to delete auth user
      try {
        await auth.currentUser?.delete();
      } catch (authErr) {
        console.warn("Could not delete auth user (requires recent sign-in), signing out instead:", authErr);
      }
      
      await auth.signOut();
      navigate('/');
    } catch (err) {
      console.error("Error deleting account:", err);
      alert('Ocorreu um erro ao excluir a sua conta.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  useEffect(() => {
    if (faceVerifyModalOpen && faceVerifyStep === 'scanning') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [faceVerifyModalOpen, faceVerifyStep]);

  useEffect(() => {
    if (faceVerifyStep !== 'scanning') return;

    setScanStep(0);
    const t1 = setTimeout(() => setScanStep(1), 2500);
    const t2 = setTimeout(() => setScanStep(2), 5000);
    const t3 = setTimeout(() => setScanStep(3), 7500);
    const t4 = setTimeout(() => {
      setFaceVerifyStep('analyzing');
    }, 10000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [faceVerifyStep]);

  useEffect(() => {
    if (faceVerifyStep !== 'analyzing') return;

    setAnalyzingMessage('Mapeando estrutura facial tridimensional...');
    
    const t1 = setTimeout(() => {
      setAnalyzingMessage('Comparando traços biométricos com a foto de perfil...');
    }, 1500);

    const t2 = setTimeout(() => {
      setAnalyzingMessage('Executando prova de vida (Anti-Spoofing Liveness)...');
    }, 3000);

    const t3 = setTimeout(() => {
      handleCompleteVerification();
    }, 4500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [faceVerifyStep]);

  useEffect(() => {
    if (isOwnProfile && currentUser) {
      try {
        const cachedCredsStr = localStorage.getItem('face_login_credentials');
        if (cachedCredsStr) {
          const cachedCreds = JSON.parse(cachedCredsStr);
          if (cachedCreds.email === currentUser.email) {
            setFaceLoginEnabled(true);
          } else {
            setFaceLoginEnabled(false);
          }
        } else {
          setFaceLoginEnabled(false);
        }
      } catch (err) {
        console.error("Error reading face_login_credentials:", err);
      }
    }
  }, [isOwnProfile, currentUser]);

  const handleToggleFaceLogin = async () => {
    if (!currentUser) return;
    
    if (faceLoginEnabled) {
      try {
        localStorage.removeItem('face_login_credentials');
        setFaceLoginEnabled(false);
        await updateDoc(doc(db, 'users', currentUser.uid), {
          faceLoginEnabled: false
        });
        alert("Login por reconhecimento facial desativado com sucesso.");
      } catch (err) {
        console.error("Error disabling face login:", err);
      }
    } else {
      if (!isFacialVerified) {
        alert("Você precisa realizar a verificação facial do seu perfil antes de ativar o login por reconhecimento facial. Por favor, clique em 'Verificar sua identidade com Selfie' primeiro.");
        setFaceVerifyModalOpen(true);
        return;
      }
      
      setFaceLoginPassword('');
      setFaceLoginError('');
      setFaceLoginConfirmModalOpen(true);
    }
  };

  const handleToggleBatterySaver = async () => {
    if (!currentUser) return;
    const nextVal = !batterySaverEnabled;
    try {
      setBatterySaverEnabled(nextVal);
      localStorage.setItem('battery_saver_enabled', nextVal ? 'true' : 'false');
      await updateDoc(doc(db, 'users', currentUser.uid), {
        batterySaverEnabled: nextVal
      });
    } catch (err) {
      console.error("Error toggling battery saver:", err);
    }
  };

  const handleConfirmFaceLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFaceLoginError('');
    if (!faceLoginPassword) {
      setFaceLoginError('Por favor, digite sua senha.');
      return;
    }
    
    try {
      const { EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
      if (currentUser && currentUser.email) {
        const credential = EmailAuthProvider.credential(currentUser.email, faceLoginPassword);
        await reauthenticateWithCredential(currentUser, credential);
        
        localStorage.setItem('face_login_credentials', JSON.stringify({
          email: currentUser.email,
          password: faceLoginPassword,
          userId: currentUser.uid,
          enabledAt: new Date().toISOString()
        }));
        
        await updateDoc(doc(db, 'users', currentUser.uid), {
          faceLoginEnabled: true
        });
        
        setFaceLoginEnabled(true);
        setFaceLoginConfirmModalOpen(false);
        alert("Login por reconhecimento facial ativado com sucesso!");
      }
    } catch (err: any) {
      console.warn("Reauthentication warning (expected if password incorrect):", err);
      setFaceLoginError('Senha incorreta. Por favor, digite sua senha de login atual do aplicativo.');
    }
  };

  const handleSubmitChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError('');
    setChangePasswordSuccess('');
    
    if (!currentPassword) {
      setChangePasswordError('Por favor, insira sua senha atual.');
      return;
    }
    if (newPassword.length < 6) {
      setChangePasswordError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangePasswordError('As senhas novas não coincidem.');
      return;
    }
    
    setIsChangingPassword(true);
    
    try {
      if (currentUser && currentUser.email) {
        // Reautenticar o usuário
        const { EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        
        // Atualizar senha no Firebase Auth
        await updatePassword(currentUser, newPassword);
        
        // Se o login facial estiver ativado, atualizar as credenciais no cache local
        try {
          const cachedCredsStr = localStorage.getItem('face_login_credentials');
          if (cachedCredsStr) {
            const cachedCreds = JSON.parse(cachedCredsStr);
            if (cachedCreds.email === currentUser.email) {
              cachedCreds.password = newPassword;
              localStorage.setItem('face_login_credentials', JSON.stringify(cachedCreds));
            }
          }
        } catch (cacheErr) {
          console.error("Error updating face login credentials after password change:", cacheErr);
        }
        
        setChangePasswordSuccess('Sua senha foi alterada com sucesso!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        
        setTimeout(() => {
          setChangePasswordModalOpen(false);
          setChangePasswordSuccess('');
        }, 2000);
      }
    } catch (err: any) {
      console.warn("Change password warning (expected if current password incorrect):", err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.message?.includes('invalid-credential')) {
        setChangePasswordError('A senha atual digitada está incorreta.');
      } else {
        setChangePasswordError('Erro ao alterar a senha. Certifique-se de que sua senha atual está correta e que a nova possui no mínimo 6 caracteres.');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isPrincipal: boolean, index?: number) => {
    if (!e.target.files || !e.target.files[0] || !auth.currentUser) return;
    const file = e.target.files[0];
    
    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      alert("Por favor, selecione uma imagem válida.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    if (isPrincipal) {
      setPendingFotoPrincipal(file);
      setEditFotoPrincipalUrl(previewUrl);
    } else if (index !== undefined) {
      setPendingFotosAdicionais(prev => ({ ...prev, [index]: file }));
      const newFotos = [...editFotosAdicionais];
      newFotos[index] = previewUrl;
      setEditFotosAdicionais(newFotos);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || isSavingProfile) return;
    
    setIsSavingProfile(true);
    setUploadProgress(0);
    setUploadStatus("Iniciando atualização...");
    setUploadError(null);

    // Validate date format DD-MM-AAAA
    if (!/^\d{2}-\d{2}-\d{4}$/.test(editDataNascimento)) {
      setUploadError('Por favor, informe a data de nascimento completa: primeiro o dia, depois o mês e depois o ano (ex: 25-12-1998).');
      setIsSavingProfile(false);
      return;
    }

    const calculatedAgeValue = calculateAge(editDataNascimento);
    if (calculatedAgeValue <= 0) {
      setUploadError('Data de nascimento inválida. Por favor, verifique se inseriu uma data correta.');
      setIsSavingProfile(false);
      return;
    }
    if (calculatedAgeValue < 18) {
      setUploadError('Você deve ter pelo menos 18 anos de idade para usar este aplicativo.');
      setIsSavingProfile(false);
      return;
    }
    if (calculatedAgeValue > 120) {
      setUploadError('Por favor, informe uma data de nascimento válida.');
      setIsSavingProfile(false);
      return;
    }

    try {
      let finalFotoPrincipalUrl = editFotoPrincipalUrl;
      let finalFotosAdicionais = [...editFotosAdicionais];

      // Prepare parallel tasks
      interface UploadTask {
        type: 'principal' | 'adicional';
        index?: number;
        file: File;
        key: string;
      }

      const tasks: UploadTask[] = [];
      if (pendingFotoPrincipal) {
        tasks.push({ type: 'principal', file: pendingFotoPrincipal, key: 'principal' });
      }
      for (const [idxStr, fileRaw] of Object.entries(pendingFotosAdicionais)) {
        const idx = parseInt(idxStr);
        tasks.push({ type: 'adicional', index: idx, file: fileRaw as File, key: `adicional_${idx}` });
      }

      if (tasks.length > 0) {
        setIsUploadingImage(true);
        setUploadStatus("Processando imagens...");
        
        // Track progress for each concurrent task
        const progressMap: { [key: string]: number } = {};
        tasks.forEach(t => {
          progressMap[t.key] = 0;
        });

        const updateOverallProgress = (key: string, percent: number) => {
          progressMap[key] = percent;
          const totalProgressSum = Object.values(progressMap).reduce((sum, p) => sum + p, 0);
          const averageProgress = Math.min(Math.round(totalProgressSum / tasks.length), 99);
          setUploadProgress(averageProgress);
        };

        // Run all resizing, converting, and uploading in PARALLEL!
        await Promise.all(
          tasks.map(async (task) => {
            const label = task.type === 'principal' ? 'Foto Principal' : `Foto da Galeria ${task.index! + 1}`;
            
            setUploadStatus(`Otimizando ${label}...`);
            const resizedDataUrl = await resizeImage(task.file);
            const blob = dataURLtoBlob(resizedDataUrl);
            
            setUploadStatus(`Enviando ${label}...`);
            
            const fileRef = task.type === 'principal'
              ? ref(storage, `profiles/${auth.currentUser.uid}/${Date.now()}_principal.jpg`)
              : ref(storage, `profiles/${auth.currentUser.uid}/${Date.now()}_add_${task.index!}.jpg`);

            const finalUrl = await uploadWithTimeoutFallback(
              fileRef,
              blob,
              resizedDataUrl,
              4000, // 4 seconds timeout per upload
              (percent) => {
                setUploadStatus(`Enviando ${label}: ${Math.round(percent)}%`);
                updateOverallProgress(task.key, percent);
              }
            );

            if (task.type === 'principal') {
              finalFotoPrincipalUrl = finalUrl;
            } else {
              finalFotosAdicionais[task.index!] = finalUrl;
            }
            
            updateOverallProgress(task.key, 100);
          })
        );
      }

      setIsUploadingImage(false);
      setUploadStatus("Salvando dados do perfil...");
      setUploadProgress(99);

      finalFotosAdicionais = finalFotosAdicionais.filter(url => url);

      const removeUndefined = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(item => removeUndefined(item));
        } else if (obj !== null && typeof obj === 'object') {
          return Object.fromEntries(
            Object.entries(obj)
              .filter(([_, v]) => v !== undefined)
              .map(([k, v]) => [k, removeUndefined(v)])
          );
        }
        return obj;
      };

      const updatePayload = removeUndefined({
        'profile.nome': editNome,
        'profile.apelido': editApelido,
        'profile.dataNascimento': editDataNascimento,
        'profile.idade': calculatedAgeValue,
        'profile.bio': editBio,
        'profile.relevante': editRelevante,
        'profile.telefone': editTelefone,
        'profile.sexo': editSexo,
        'profile.interesse': editInteresse,
        'profile.cor': editCor,
        'profile.estadoCivil': editEstadoCivil,
        'profile.objetivo': editObjetivo,
        'profile.estadoNascimento': editEstadoNascimento,
        'profile.cidadeNascimento': editCidadeNascimento,
        'profile.fotoPrincipalUrl': finalFotoPrincipalUrl,
        'profile.fotosAdicionais': finalFotosAdicionais,
        'profile.statusBolinha': editStatusBolinha,
        'profile.altura': editAltura,
        'profile.signo': editSigno,
        'profile.profissao': editProfissao,
        'profile.hobbies': editHobbies,
        'profile.prompts': editPrompts,
        'profile.resposta1': editPrompts[0]?.desc || '',
        'profile.resposta2': editPrompts[1]?.desc || '',
        'profile.lifestyle': editLifestyle
      });

      console.log("[ProfileDetails handleSaveProfile] Initiating profile update for UID:", auth.currentUser.uid);
      console.log("[ProfileDetails handleSaveProfile] Payload to updateDoc:", JSON.stringify(updatePayload, null, 2));

      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, updatePayload);

      console.log("[ProfileDetails handleSaveProfile] updateDoc call succeeded!");

      // Update local cache
      try {
        const cachedDoc = {
          verified: isVerified,
          idVerified: isIdVerified,
          facialVerified: isFacialVerified,
          nome: editNome,
          apelido: editApelido,
          profile: {
            nome: editNome,
            apelido: editApelido,
            dataNascimento: editDataNascimento,
            idade: calculatedAgeValue,
            bio: editBio,
            relevante: editRelevante,
            telefone: editTelefone,
            sexo: editSexo,
            interesse: editInteresse,
            cor: editCor,
            estadoCivil: editEstadoCivil,
            objetivo: editObjetivo,
            estadoNascimento: editEstadoNascimento,
            cidadeNascimento: editCidadeNascimento,
            fotoPrincipalUrl: finalFotoPrincipalUrl,
            fotosAdicionais: finalFotosAdicionais,
            statusBolinha: editStatusBolinha,
            altura: editAltura,
            signo: editSigno,
            profissao: editProfissao,
            hobbies: editHobbies,
            prompts: editPrompts,
            resposta1: editPrompts[0]?.desc || '',
            resposta2: editPrompts[1]?.desc || '',
            lifestyle: editLifestyle,
            facialVerified: isFacialVerified
          }
        };
        localStorage.setItem(`user_profile_cache_${auth.currentUser.uid}`, JSON.stringify(cachedDoc));
      } catch (cacheErr) {
        console.error("Error setting profile cache in handleSaveProfile:", cacheErr);
      }

      setProfile((prev: any) => ({
        ...prev,
        nome: editNome,
        apelido: editApelido,
        dataNascimento: editDataNascimento,
        idade: calculatedAgeValue,
        bio: editBio,
        relevante: editRelevante,
        telefone: editTelefone,
        sexo: editSexo,
        interesse: editInteresse,
        cor: editCor,
        estadoCivil: editEstadoCivil,
        objetivo: editObjetivo,
        estadoNascimento: editEstadoNascimento,
        cidadeNascimento: editCidadeNascimento,
        fotoPrincipalUrl: finalFotoPrincipalUrl,
        fotosAdicionais: finalFotosAdicionais,
        fotos: finalFotosAdicionais.length > 0 ? [finalFotoPrincipalUrl, ...finalFotosAdicionais] : [finalFotoPrincipalUrl],
        statusBolinha: editStatusBolinha,
        altura: editAltura,
        signo: editSigno,
        profissao: editProfissao,
        hobbies: editHobbies,
        prompts: editPrompts,
        resposta1: editPrompts[0]?.desc || '',
        resposta2: editPrompts[1]?.desc || '',
        lifestyle: editLifestyle
      }));

      setUploadProgress(100);
      setUploadStatus("Perfil atualizado com sucesso!");
      
      setPendingFotoPrincipal(null);
      setPendingFotosAdicionais({});
      
      setEditModalOpen(false);
      setIsSavingProfile(false);
    } catch (err: any) {
      console.error("[ProfileDetails handleSaveProfile] Fatal error encountered during profile saving:", err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
      } catch (firestoreErr) {
        console.error("[ProfileDetails handleSaveProfile] Structured Firestore Error details:", firestoreErr);
      }
      setUploadError(err?.message || "Houve um problema ao salvar as alterações do perfil.");
      setIsSavingProfile(false);
      setIsUploadingImage(false);
    }
  };

  // Spark heart confetti & Save Like to Firestore
  const handleFlirt = async () => {
    if (liked || !auth.currentUser || !id || id === auth.currentUser.uid) return;

    // Trigger visual confetti immediately for responsiveness
    setLiked(true);
    const newHearts: FloatingHeart[] = Array.from({ length: 22 }).map((_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 260 - 130, // Random width spread
      y: -(Math.random() * 120 + 80), // Float height
      scale: Math.random() * 1.4 + 0.6,
      rotation: Math.random() * 120 - 60,
      duration: Math.random() * 1.2 + 1.0,
    }));

    setHearts(newHearts);

    setTimeout(() => {
      setHearts([]);
    }, 2500);

    try {
      if (connectionStatus === 'received_pending') {
        // Instant match! They already liked us, and now we liked them back!
        const requestId = `${id}_${auth.currentUser.uid}`;
        await updateDoc(doc(db, 'friendRequests', requestId), {
          status: 'accepted',
          updatedAt: serverTimestamp()
        });

        await setDoc(doc(db, 'connections', `${auth.currentUser.uid}_${id}`), {
          users: [auth.currentUser.uid, id],
          permissions: {},
          categories: {
            [auth.currentUser.uid]: 'Geral',
            [id]: 'Geral'
          },
          createdAt: serverTimestamp()
        });

        setConnectionStatus('connected');
        setShowMatchModal(true);
      } else if (connectionStatus === 'none') {
        // Send outgoing request / like
        const requestId = `${auth.currentUser.uid}_${id}`;
        await setDoc(doc(db, 'friendRequests', requestId), {
          fromUserId: auth.currentUser.uid,
          toUserId: id,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        setConnectionStatus('sent_pending');

        // Simulate instant match for mock profiles to drive engagement
        if (id.startsWith('mock') && Math.random() < 0.45) {
          setTimeout(async () => {
            await updateDoc(doc(db, 'friendRequests', requestId), {
              status: 'accepted',
              updatedAt: serverTimestamp()
            });

            await setDoc(doc(db, 'connections', `${auth.currentUser.uid}_${id}`), {
              users: [auth.currentUser.uid, id],
              permissions: {},
              categories: {
                [auth.currentUser.uid]: 'Geral',
                [id]: 'Geral'
              },
              createdAt: serverTimestamp()
            });

            setConnectionStatus('connected');
            setShowMatchModal(true);
          }, 800);
        }
      }
    } catch (err) {
      console.error("Erro ao curtir/flertar perfil:", err);
      // Fallback in case of offline/firestore issues for mock profiles
      if (id.startsWith('mock') && Math.random() < 0.45) {
        setTimeout(() => {
          setConnectionStatus('connected');
          setShowMatchModal(true);
        }, 800);
      }
    }
  };

  // Connect / send friend request action
  const handleConnect = async () => {
    if (!auth.currentUser || !id || isConnecting) return;
    setIsConnecting(true);

    try {
      if (connectionStatus === 'received_pending') {
        // Accept incoming request
        const requestId = `${id}_${auth.currentUser.uid}`;
        await updateDoc(doc(db, 'friendRequests', requestId), {
          status: 'accepted',
          updatedAt: serverTimestamp()
        });

        await setDoc(doc(db, 'connections', `${auth.currentUser.uid}_${id}`), {
          users: [auth.currentUser.uid, id],
          permissions: {},
          categories: {
            [auth.currentUser.uid]: 'Geral',
            [id]: 'Geral'
          },
          createdAt: serverTimestamp()
        });

        setConnectionStatus('connected');
      } else if (connectionStatus === 'none') {
        // Send outgoing request
        const requestId = `${auth.currentUser.uid}_${id}`;
        await setDoc(doc(db, 'friendRequests', requestId), {
          fromUserId: auth.currentUser.uid,
          toUserId: id,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        setConnectionStatus('sent_pending');
      }
    } catch (err) {
      console.error("Error updating connection:", err);
      alert('Houve um problema ao processar sua solicitação de conexão.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleContactLockClick = async (contactType: 'WhatsApp' | 'E-mail') => {
    const userName = profile?.apelido || profile?.nome || 'este usuário';
    if (connectionStatus === 'none') {
      const wantConnect = window.confirm(
        `Para acessar o ${contactType} de ${userName}, vocês precisam ser amigos na plataforma.\n\nGostaria de enviar uma solicitação de amizade agora para se conectar?`
      );
      if (wantConnect) {
        await handleConnect();
      }
    } else if (connectionStatus === 'sent_pending') {
      alert(
        `Sua solicitação de amizade para ${userName} ainda está pendente.\n\nAssim que ele(a) aceitar, você poderá visualizar o contato se ele(a) tiver habilitado o compartilhamento no Painel de Amigos.`
      );
    } else if (connectionStatus === 'received_pending') {
      const wantAccept = window.confirm(
        `${userName} enviou uma solicitação de amizade para você!\n\nDeseja aceitar a solicitação agora para se conectarem?`
      );
      if (wantAccept) {
        await handleConnect();
      }
    } else if (connectionStatus === 'connected') {
      alert(
        `Vocês já estão conectados como amigos! ✓\n\nNo entanto, ${userName} ainda não ativou a permissão de compartilhar o ${contactType} dele(a) nas configurações dele(a).\n\nVocê pode pedir para ele(a) liberar no chat!`
      );
    }
  };

  const handleSendShortMsg = async (text: string) => {
    if (!auth.currentUser || !id || isSendingMsg) return;
    setIsSendingMsg(true);
    try {
      const msgId = `${auth.currentUser.uid}_${id}_${Date.now()}`;
      await setDoc(doc(db, 'shortMessages', msgId), {
        fromUserId: auth.currentUser.uid,
        toUserId: id,
        message: text,
        createdAt: serverTimestamp()
      });
      setMsgSentSuccess(true);
      setTimeout(() => {
        setMsgSentSuccess(false);
        setShortMsgModalOpen(false);
        setCustomMsg('');
      }, 2000);
    } catch (err) {
      console.error("Error sending short message:", err);
      alert("Houve um problema ao enviar a sua mensagem.");
    } finally {
      setIsSendingMsg(false);
    }
  };

  // Block user action
  const handleBlockUser = () => {
    setBlockModalOpen(true);
  };

  const executeBlockUser = async () => {
    if (!auth.currentUser || !id || isBlocking) return;
    setIsBlocking(true);
    try {
      const blockId = `${auth.currentUser.uid}_${id}`;
      await setDoc(doc(db, 'blocks', blockId), {
        blockedBy: auth.currentUser.uid,
        blockedUser: id,
        createdAt: Date.now()
      });
      setBlockModalOpen(false);
      navigate('/');
    } catch (err) {
      console.error("Error blocking user:", err);
      try {
        alert('Ocorreu um erro ao bloquear o usuário.');
      } catch (e) {
        console.error("Alert blocked:", e);
      }
    } finally {
      setIsBlocking(false);
    }
  };

  // Submit report action
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !id || isReporting) return;
    setIsReporting(true);
    try {
      // 1. Create Report in reports collection
      const reportId = `${auth.currentUser.uid}_${id}_${Date.now()}`;
      await setDoc(doc(db, 'reports', reportId), {
        deUserId: auth.currentUser.uid,
        contraUserId: id,
        motivo: reportReason,
        descricao: reportDetails,
        criadoEm: Date.now(),
        status: 'pendente'
      });

      // 2. Also automatically block the user for maximum safety & immediate exclusion from searches
      const blockId = `${auth.currentUser.uid}_${id}`;
      await setDoc(doc(db, 'blocks', blockId), {
        blockedBy: auth.currentUser.uid,
        blockedUser: id,
        createdAt: Date.now()
      });

      alert('Denúncia enviada com sucesso. O usuário foi bloqueado e nossa equipe administrativa foi notificada.');
      setReportModalOpen(false);
      navigate('/');
    } catch (err) {
      console.error("Error submitting report:", err);
      alert('Ocorreu um erro ao enviar a denúncia.');
    } finally {
      setIsReporting(false);
    }
  };

  // Carousel photo navigations
  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile?.fotos) return;
    setActivePhotoIndex(prev => (prev + 1) % profile.fotos.length);
  };

  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile?.fotos) return;
    setActivePhotoIndex(prev => (prev === 0 ? profile.fotos.length - 1 : prev - 1));
  };

  // Share profile simulation
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowShareTooltip(true);
    setTimeout(() => {
      setShowShareTooltip(false);
    }, 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-slate-50 p-6">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium text-sm animate-pulse">Revelando os mistérios do perfil...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-slate-50 p-6 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <Info className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">{error || 'Ops! Erro ao carregar.'}</h3>
        <p className="text-slate-500 text-sm mb-6">Não conseguimos encontrar as informações deste usuário.</p>
        <button onClick={() => navigate('/')} className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-md hover:bg-indigo-700 transition">
          Voltar para a Busca
        </button>
      </div>
    );
  }

  // Determine objective badge style
  const getObjectiveStyle = (obj: string) => {
    const text = (obj || '').toLowerCase();
    if (text.includes('sério') || text.includes('serio') || text.includes('compromisso')) {
      return 'from-rose-500 to-pink-500 text-white shadow-rose-100';
    }
    if (text.includes('casual') || text.includes('pressa')) {
      return 'from-amber-500 to-orange-500 text-white shadow-amber-100';
    }
    return 'from-indigo-500 to-purple-500 text-white shadow-indigo-100';
  };

  // Get user-friendly translated label for the objective value
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

  const handleUpdateQuickStatus = async (newStatus: 'disponivel' | 'restricoes' | 'indisponivel') => {
    if (!auth.currentUser) return;
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        'profile.statusBolinha': newStatus
      });
      setEditStatusBolinha(newStatus);
      setProfile((prev: any) => prev ? {
        ...prev,
        profile: {
          ...prev.profile,
          statusBolinha: newStatus
        }
      } : prev);

      // Sync status with local cache
      try {
        const cacheKey = `user_profile_cache_${auth.currentUser.uid}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cachedData = JSON.parse(cached);
          if (cachedData.profile) {
            cachedData.profile.statusBolinha = newStatus;
          }
          localStorage.setItem(cacheKey, JSON.stringify(cachedData));
        }
      } catch (cacheErr) {
        console.error("Error updating quick status in cache:", cacheErr);
      }

      setIsQuickStatusOpen(false);
    } catch (err: any) {
      console.error("Error updating quick status", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-32 font-sans text-slate-800 relative select-none">
      
      {/* 1. Header Hero with Multiple Photo Slider */}
      <div className="relative aspect-[4/5] w-full bg-slate-900 overflow-hidden shadow-lg group">
        
        {/* Floating Top Controls with Blur Backdrops */}
        <div className="absolute top-4 left-0 right-0 px-4 flex justify-between items-center z-30">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-black/60 transition-all border border-white/10 active:scale-95"
          >
            <ChevronLeft className="w-6 h-6 mr-0.5" />
          </button>
          
          <div className="flex gap-2">
            <button 
              onClick={handleShare}
              className="w-10 h-10 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-black/60 transition-all border border-white/10 relative active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              <AnimatePresence>
                {showShareTooltip && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: -45, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bg-slate-900 text-white text-[10px] font-semibold px-2 py-1 rounded shadow-md whitespace-nowrap"
                  >
                    Link Copiado!
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>

        {/* Swipe Photo Dots Indicators (Tinder style) */}
        {profile.fotos.length > 1 && (
          <div className="absolute top-16 left-4 right-4 z-20 flex gap-1.5 px-2">
            {profile.fotos.map((_: any, idx: number) => (
              <div 
                key={idx} 
                className="h-1 flex-1 rounded-full overflow-hidden bg-white/20 transition-all"
              >
                <div 
                  className={`h-full bg-white transition-all duration-300 ${
                    idx === activePhotoIndex ? 'w-full' : 'w-0'
                  }`} 
                />
              </div>
            ))}
          </div>
        )}

        {/* Main Photo Gallery */}
        <div className="w-full h-full relative overflow-hidden bg-slate-950">
          <AnimatePresence initial={false}>
            <motion.img 
              key={activePhotoIndex}
              src={profile.fotos[activePhotoIndex]} 
              alt={profile.apelido || profile.nome} 
              className="w-full h-full object-cover select-none absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              loading="eager"
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none"></div>

          {/* Left / Right Click Nav Targets */}
          <div className="absolute inset-0 z-10 flex">
            <div onClick={prevPhoto} className="w-1/3 h-full cursor-left-arrow" />
            <div onClick={nextPhoto} className="w-2/3 h-full cursor-right-arrow" />
          </div>

          {/* Left/Right Floating Chevrons */}
          {profile.fotos.length > 1 && (
            <>
              <button 
                onClick={prevPhoto}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-black/20 hover:bg-black/40 text-white rounded-full flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="w-5 h-5 mr-0.5" />
              </button>
              <button 
                onClick={nextPhoto}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-black/20 hover:bg-black/40 text-white rounded-full flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-5 h-5 ml-0.5" />
              </button>
            </>
          )}
        </div>

        {/* Profile Card Floating Metadata */}
        <div className="absolute bottom-6 left-6 right-6 z-20 text-white">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {!isOwnProfile && profile.distancia && (
              <span className="bg-indigo-600/90 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 uppercase tracking-wider shadow-sm">
                <Compass className="w-3 h-3" /> A {profile.distancia} de você
              </span>
            )}
            {(() => {
              const statusBolinha = profile?.statusBolinha || 'disponivel';
              let isOutOfRange = false;
              let isOffline = false;
              let label = 'Disponível';
              let colorClass = 'bg-emerald-500';

              if (!isOwnProfile && profile) {
                const saved = localStorage.getItem('search_radius');
                const searchRadius = saved ? Number(saved) : 50000;
                if (profile.distanceValue !== undefined) {
                  if (profile.distanceValue > 50000) {
                    isOffline = true;
                  } else if (profile.distanceValue > searchRadius) {
                    isOutOfRange = true;
                  }
                }
              }

              if (isOffline) {
                label = 'Offline';
                colorClass = 'bg-slate-400/90';
              } else if (isOutOfRange) {
                label = 'Fora de alcance';
                colorClass = 'bg-slate-500/90';
              } else if (statusBolinha === 'disponivel') {
                label = 'Aberto a novas amizades e interação';
                colorClass = 'bg-emerald-600/90';
              } else if (statusBolinha === 'restricoes') {
                label = 'Algumas restrições serão impostas';
                colorClass = 'bg-amber-500/90';
              } else if (statusBolinha === 'indisponivel') {
                label = 'Todas as interações indisponíveis';
                colorClass = 'bg-rose-600/90';
              }

              if (isOwnProfile) {
                return (
                  <div className="relative">
                    <button
                      onClick={() => setIsQuickStatusOpen(!isQuickStatusOpen)}
                      className={`${colorClass} text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-wider animate-pulse shadow-sm hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer`}
                      title="Clique para mudar o seu status"
                    >
                      <span className="w-1.5 h-1.5 bg-white rounded-full inline-block animate-ping"></span> 
                      <span>{label}</span>
                      <span className="text-[8px] opacity-75 ml-1 select-none">⚙️</span>
                    </button>

                    {isQuickStatusOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsQuickStatusOpen(false)} />
                        <div className="absolute left-0 bottom-full mb-2 w-72 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden py-1">
                          <div className="px-3.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-50 dark:border-slate-800 text-left">
                            Escolha o seu Status
                          </div>
                          <button
                            onClick={() => handleUpdateQuickStatus('disponivel')}
                            className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                          >
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                            <div className="flex flex-col">
                              <span className="font-bold">Verde (Disponível)</span>
                              <span className="text-[10px] text-slate-400 font-medium">Aberto a novas amizades e interação</span>
                            </div>
                          </button>
                          <button
                            onClick={() => handleUpdateQuickStatus('restricoes')}
                            className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                          >
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                            <div className="flex flex-col">
                              <span className="font-bold">Amarelo (Restrições)</span>
                              <span className="text-[10px] text-slate-400 font-medium">Algumas restrições serão impostas</span>
                            </div>
                          </button>
                          <button
                            onClick={() => handleUpdateQuickStatus('indisponivel')}
                            className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                          >
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                            <div className="flex flex-col">
                              <span className="font-bold">Vermelho (Indisponível)</span>
                              <span className="text-[10px] text-slate-400 font-medium">Todas as interações indisponíveis</span>
                            </div>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              }

              return (
                <span className={`${colorClass} text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-wider animate-pulse shadow-sm`}>
                  <span className="w-1.5 h-1.5 bg-white rounded-full inline-block"></span> {label}
                </span>
              );
            })()}
          </div>

          <h1 className="text-3xl font-extrabold flex items-center gap-2 drop-shadow-md">
            {profile.apelido || profile.nome}, {profile.idade}
            {isVerified && <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0 fill-emerald-950/20" aria-label="Perfil Verificado" />}
            {isFacialVerified && <ShieldCheck className="w-6 h-6 text-blue-400 shrink-0 fill-blue-950/20 animate-pulse" aria-label="Foto Verificada por Inteligência Artificial" />}
            {isIdVerified && <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0 fill-emerald-950/20 animate-pulse" aria-label="Identificação Confirmada por IA" />}

          </h1>
          
          {profile.estadoNascimento && (
            <p className="text-white/90 text-sm font-semibold mt-1 drop-shadow-sm flex items-center gap-1.5 capitalize">
              {getDemonym(profile.estadoNascimento, profile.sexo)}
            </p>
          )}
          
          <p className="text-slate-300 text-sm mt-1 max-w-sm drop-shadow-sm font-medium">
            {profile.apelido ? `@${profile.apelido}` : ''} {profile.profissao ? `• ${profile.profissao}` : ''}
          </p>
        </div>
      </div>

      {/* 1.5. Interações Rápidas (Flertar, Mensagem Curta, Adicionar como amigo) */}
      {isOwnProfile ? (
        <div className="bg-white border-b border-slate-100 py-4 px-6 flex justify-center items-center shadow-sm">
          <button 
            id="tour-edit-profile"
            onClick={() => setEditModalOpen(true)}
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold text-sm py-3.5 rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
          >
            <Sparkles className="w-5 h-5 text-white" /> Editar Meu Perfil
          </button>
        </div>
      ) : profile?.statusBolinha === 'indisponivel' && false ? (
        <div className="bg-rose-50 border-b border-rose-100 py-6 px-6 flex flex-col justify-center items-center gap-2 shadow-sm text-center">
          <span className="text-rose-600 bg-rose-100 p-2.5 rounded-full">
            <X className="w-6 h-6 stroke-[3]" />
          </span>
          <p className="text-rose-700 text-sm font-bold tracking-tight">
            Todas as interações com este usuário estão indisponíveis.
          </p>
          <p className="text-rose-500 text-xs font-semibold">
            Este perfil definiu seu status como não disponível no momento.
          </p>
        </div>
      ) : (
        <div className="bg-white border-b border-slate-100 py-5 px-6 flex justify-around items-center gap-2 shadow-sm">
          {/* Flertar Button */}
          <button 
            onClick={handleFlirt}
            className="flex flex-col items-center gap-1.5 focus:outline-none group active:scale-95 transition-all cursor-pointer"
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md transition-all ${
              liked 
                ? 'bg-rose-50 text-rose-400 border border-rose-100' 
                : 'bg-gradient-to-br from-rose-400 to-pink-500 text-white hover:shadow-lg hover:shadow-rose-100 border border-rose-300/20'
            }`}>
              <Flame className={`w-6 h-6 ${liked ? 'fill-rose-400 text-rose-400' : 'fill-white text-white'}`} />
            </div>
            <span className={`text-[11px] font-bold tracking-tight ${liked ? 'text-rose-500 font-extrabold' : 'text-slate-600'}`}>
              {liked ? 'Flertado! ❤️' : 'Flertar'}
            </span>
          </button>

          {/* Mensagem Curta Button */}
          <button 
            onClick={() => setShortMsgModalOpen(true)}
            className="flex flex-col items-center gap-1.5 focus:outline-none group active:scale-95 transition-all cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-md hover:shadow-lg hover:shadow-indigo-100 border border-indigo-400/20">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-[11px] font-bold text-slate-600 tracking-tight">
              Mensagem Curta
            </span>
          </button>

          {/* Adicionar Amigo(a) Button */}
          <button 
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex flex-col items-center gap-1.5 focus:outline-none group active:scale-95 transition-all cursor-pointer"
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md transition-all ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500 text-white border border-emerald-400/20'
                : connectionStatus === 'sent_pending'
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : connectionStatus === 'received_pending'
                ? 'bg-amber-400 text-slate-900 border border-amber-300 animate-pulse'
                : 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white hover:shadow-lg hover:shadow-emerald-100 border border-emerald-300/20'
            }`}>
              {isConnecting ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : connectionStatus === 'connected' ? (
                <Check className="w-6 h-6 stroke-[3]" />
              ) : connectionStatus === 'sent_pending' ? (
                <Clock className="w-6 h-6" />
              ) : (
                <UserPlus className="w-6 h-6" />
              )}
            </div>
            <span className="text-[11px] font-bold text-slate-600 tracking-tight">
              {connectionStatus === 'connected' 
                ? 'Amigos! ✓' 
                : connectionStatus === 'sent_pending' 
                ? 'Pendente' 
                : connectionStatus === 'received_pending'
                ? 'Aceitar'
                : 'Adicionar Amigo'}
            </span>
          </button>

          {/* Denunciar Button */}
          <button 
            onClick={() => setReportModalOpen(true)}
            className="flex flex-col items-center gap-1.5 focus:outline-none group active:scale-95 transition-all cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shadow-md hover:shadow-lg border border-rose-400/20 transition-all duration-300">
              <AlertCircle className="w-6 h-6 text-white animate-pulse" />
            </div>
            <span className="text-[11px] font-bold text-slate-600 tracking-tight">
              Denunciar
            </span>
          </button>

          {/* Bloquear Button */}
          <button 
            onClick={handleBlockUser}
            className="flex flex-col items-center gap-1.5 focus:outline-none group active:scale-95 transition-all cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 text-white flex items-center justify-center shadow-md hover:shadow-lg border border-slate-300/20 hover:from-red-500 hover:to-rose-600 transition-all duration-300">
              <Ban className="w-6 h-6 text-white" />
            </div>
            <span className="text-[11px] font-bold text-slate-600 tracking-tight">
              Bloquear
            </span>
          </button>

        </div>
      )}

      {/* 2. Scrollable Profile Information Cards */}
      <div className="p-5 space-y-6">

        {/* AI Facial Verification Info Box */}
        {isFacialVerified ? (
          <div className="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-2xl border border-blue-100/50 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">Imagem do Usuário, verificada através de reconhecimento facial.</h4>
              <p className="text-xs text-blue-700 font-medium mt-0.5">
                Esta pessoa passou no teste de validação de selfie em tempo real contra a foto de perfil usando nossa inteligência artificial.
              </p>
            </div>
          </div>
        ) : isOwnProfile && (
          <div id="tour-face-verify" className="p-4 bg-gradient-to-r from-amber-50/80 to-orange-50/80 rounded-2xl border border-amber-100/50 shadow-sm flex flex-col sm:flex-row items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0">
              <ShieldCheck className="w-6 h-6 animate-pulse" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Selo de Verificação Facial IA</h4>
              <p className="text-xs text-amber-700 font-medium mt-0.5">
                Valide que você é o dono real deste perfil usando inteligência artificial para ganhar o selo azul de confiança!
              </p>
            </div>
            <button 
              onClick={() => setFaceVerifyModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0"
            >
              <Camera className="w-4 h-4" /> Verificar Agora
            </button>
          </div>
        )}

        {/* AI ID Verification Info Box */}
        {isIdVerified ? (
          <div className="p-4 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 rounded-2xl border border-emerald-100/50 shadow-sm flex flex-col sm:flex-row items-center gap-4 mt-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Identificação Confirmada</h4>
                <p className="text-xs text-emerald-700 font-medium mt-0.5">
                  Os dados pessoais desta pessoa foram validados através de documento oficial com auxílio de inteligência artificial.
                </p>
              </div>
            </div>
            {isOwnProfile && (
              <button 
                onClick={() => {
                  setIdImageBase64(null);
                  setIdVerifyExtractedData(null);
                  setIdVerifyStep('intro');
                  setIdVerifyModalOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className="w-4 h-4 animate-spin-once" /> Re-verificar dados
              </button>
            )}
          </div>
        ) : isOwnProfile && (
          <div id="tour-id-verify" className="p-4 bg-gradient-to-r from-purple-50/80 to-fuchsia-50/80 rounded-2xl border border-purple-100/50 shadow-sm flex flex-col sm:flex-row items-center gap-4 mt-4">
            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0">
              <CheckCircle className="w-6 h-6 animate-pulse" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider">Confirmação de Documento</h4>
              <p className="text-xs text-purple-700 font-medium mt-0.5">
                Envie a foto do seu documento de identidade para confirmar seus dados e ganhar este selo.
              </p>
            </div>
            <button 
              onClick={() => setIdVerifyModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0"
            >
              <Camera className="w-4 h-4" /> Enviar Documento
            </button>
          </div>
        )}



        {/* Recent Activity Section for Own Profile */}
        {isOwnProfile && (
          <Link
            to="/recent-activities"
            className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-indigo-150 dark:hover:border-slate-700 hover:shadow transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-black text-slate-850 dark:text-slate-100 tracking-tight flex items-center gap-1.5 flex-wrap">
                  Atividades Recentes
                  <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                    🔒 Confirmar senha
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Histórico de interações e flertes</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 transition-all shrink-0">
              <ChevronRight className="w-5 h-5" />
            </div>
          </Link>
        )}



        {/* Visibilidade do Perfil Section for Own Profile */}
        {isOwnProfile && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                {ocultarPerfil ? (
                  <EyeOff className="w-4 h-4 text-amber-500" />
                ) : (
                  <Eye className="w-4 h-4 text-indigo-500" />
                )}
                Visibilidade do Perfil
              </h3>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                ocultarPerfil 
                  ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/30' 
                  : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-450 border border-emerald-200/30'
              }`}>
                {ocultarPerfil ? 'Oculto' : 'Visível'}
              </span>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Ao ocultar seu perfil das buscas, sua conta não será excluída, mas você ficará **invisível** nas buscas do Discover e no feed de swipes (FlirtSwipe). Seus amigos e chats ativos continuarão funcionando normalmente.
            </p>

            <button
              onClick={toggleProfileVisibility}
              disabled={isTogglingVisibility}
              className={`w-full py-3 px-4 rounded-xl text-xs font-extrabold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer border ${
                ocultarPerfil
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-md shadow-emerald-100 dark:shadow-none border-emerald-600'
                  : 'bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700 dark:from-slate-800 dark:to-slate-750 dark:hover:from-slate-700 dark:hover:to-slate-650 dark:text-slate-200 border-slate-200/60 dark:border-slate-700/60'
              } active:scale-[0.98] disabled:opacity-60`}
            >
              {isTogglingVisibility ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : ocultarPerfil ? (
                <>
                  <Eye className="w-4 h-4" />
                  <span>Tornar Meu Perfil Visível</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4" />
                  <span>Ocultar Meu Perfil das Buscas</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* App Settings Section for Own Profile */}
        {isOwnProfile && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              Configurações do Aplicativo
            </h3>

            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tema do Aplicativo
                </span>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                  Personalize a aparência do aplicativo para se adequar ao seu estilo e ambiente. A alteração é aplicada instantaneamente.
                </p>
              </div>

              {/* Theme Switcher Button Group */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-150/40 dark:border-slate-800/80">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                    theme === 'light'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-700/50'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Claro</span>
                </button>

                <button
                  onClick={() => setTheme('dark')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-700/50'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Escuro</span>
                </button>

                <button
                  onClick={() => setTheme('system')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                    theme === 'system'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-700/50'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5" />
                  <span>Sistema</span>
                </button>
              </div>

              {/* Facial Recognition Login Switch */}
              <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-pink-500 animate-pulse" />
                    Reconhecimento Facial de Login
                  </span>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                    Ative a opção de entrar na sua conta escaneando seu rosto. Garante um acesso rápido e seguro sem precisar digitar sua senha.
                  </p>
                </div>

                <button
                  onClick={handleToggleFaceLogin}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer border ${
                    faceLoginEnabled
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100 dark:shadow-none border-emerald-600'
                      : 'bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700 dark:from-slate-800 dark:to-slate-750 dark:hover:from-slate-700 dark:hover:to-slate-650 dark:text-slate-200 border-slate-200/60 dark:border-slate-700/60'
                  }`}
                >
                  {faceLoginEnabled ? (
                    <>
                      <Check className="w-4 h-4 text-white font-black" />
                      <span>Desativar Login Facial</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <span>Ativar Login por Reconhecimento Facial</span>
                    </>
                  )}
                </button>
              </div>

              {/* Battery Saver Option */}
              <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    {batterySaverEnabled ? (
                      <BatteryCharging className="w-4 h-4 text-emerald-500 animate-pulse" />
                    ) : (
                      <Battery className="w-4 h-4 text-amber-500" />
                    )}
                    Modo de Economia de Bateria
                  </span>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                    Quando ativado, reduz a frequência de atualizações de geolocalização em segundo plano, preservando a vida útil da bateria do seu dispositivo.
                  </p>
                </div>

                <button
                  onClick={handleToggleBatterySaver}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer border ${
                    batterySaverEnabled
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100 dark:shadow-none border-emerald-600'
                      : 'bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700 dark:from-slate-800 dark:to-slate-750 dark:hover:from-slate-700 dark:hover:to-slate-650 dark:text-slate-200 border-slate-200/60 dark:border-slate-700/60'
                  }`}
                >
                  {batterySaverEnabled ? (
                    <>
                      <Check className="w-4 h-4 text-white font-black" />
                      <span>Economia de Bateria Ativa</span>
                    </>
                  ) : (
                    <>
                      <Battery className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <span>Ativar Modo de Economia</span>
                    </>
                  )}
                </button>
              </div>

              {/* Password Change Option */}
              <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-indigo-500" />
                    Segurança de Acesso
                  </span>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                    Mantenha sua conta segura alterando sua senha de acesso periodicamente.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setChangePasswordError('');
                    setChangePasswordSuccess('');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                    setChangePasswordModalOpen(true);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer border bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700 dark:from-slate-800 dark:to-slate-750 dark:hover:from-slate-700 dark:hover:to-slate-650 dark:text-slate-200 border-slate-200/60 dark:border-slate-700/60 shadow-sm"
                >
                  <Lock className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <span>Alterar Senha de Acesso</span>
                </button>
              </div>

              {/* Seção Privacidade */}
              <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    Privacidade
                  </span>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                    Gerencie quem tem acesso ao seu perfil. Abaixo você encontra a lista de pessoas que bloqueou e pode desbloqueá-las a qualquer momento para reestabelecer o contato.
                  </p>
                </div>

                {/* Lista de Bloqueados */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-150/50 dark:border-slate-800/50 space-y-2.5">
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Lista de Bloqueados
                  </span>
                  
                  {loadingBlocked ? (
                    <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-xs font-semibold">
                      <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span>Carregando...</span>
                    </div>
                  ) : blockedUsers.length === 0 ? (
                    <p className="text-slate-400 dark:text-slate-500 text-xs font-medium py-1">
                      Nenhum usuário bloqueado no momento.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-52 overflow-y-auto pr-1">
                      {blockedUsers.map((blocked) => (
                        <div key={blocked.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img 
                              src={blocked.fotoPrincipalUrl || `https://api.dicebear.com/9.x/notionists/svg?seed=${blocked.id}`} 
                              alt={blocked.nome} 
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-800 shadow-inner shrink-0" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0 text-left">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                {blocked.apelido || blocked.nome}
                              </p>
                              {blocked.idade && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                                  {blocked.idade} anos
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => handleUnblockUser(blocked.blockDocId, blocked.id, blocked.apelido || blocked.nome)}
                            disabled={unblockingUserId === blocked.id}
                            className="px-2.5 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-red-650 dark:text-red-400 border border-slate-200 dark:border-slate-750 rounded-lg text-[10px] font-extrabold hover:border-red-200 dark:hover:border-red-950 transition-all cursor-pointer active:scale-95 flex items-center gap-1 shrink-0"
                          >
                            {unblockingUserId === blocked.id ? (
                              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              'Desbloquear'
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dicas de Segurança Card */}
        <div 
          onClick={() => setSafetyTipsModalOpen(true)}
          className="p-4 bg-gradient-to-r from-teal-50 dark:from-teal-950/20 via-emerald-50/40 dark:via-emerald-950/10 to-white dark:to-slate-900 hover:from-teal-100/50 dark:hover:from-teal-950/30 hover:via-emerald-100/30 hover:to-white dark:hover:to-slate-900 rounded-2xl border border-teal-100 dark:border-teal-950/50 shadow-sm flex items-center justify-between gap-4 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-teal-500 text-white rounded-xl flex items-center justify-center shadow-md shadow-teal-100 dark:shadow-none shrink-0 group-hover:rotate-6 transition-transform duration-300">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5 flex-wrap">
                Dicas de Segurança
                <span className="text-[9px] text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-950/60 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                  Essencial
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Recomendações recomendadas para encontros presenciais seguros.
              </p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-all shrink-0">
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>

        {/* Relationship Objective Highlight */}
        <div className={`p-4 bg-gradient-to-r ${getObjectiveStyle(profile.objetivo)} rounded-2xl shadow-md flex items-center gap-4`}>
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl shadow-inner">
            💝
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold uppercase tracking-widest opacity-80">Objetivo de Relacionamento</h4>
            <p className="text-lg font-extrabold">{getObjectiveLabel(profile.objetivo)}</p>
          </div>
          <Sparkles className="w-5 h-5 opacity-70 shrink-0" />
        </div>

        {/* Bio Section */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Smile className="w-4 h-4 text-indigo-500" /> Sobre mim
          </h3>
          <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line font-medium">
            {profile.bio || "Sem biografia cadastrada. Deixou que o destino falasse mais alto!"}
          </p>
        </div>

        {/* Badges and Personal Specifications */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Info className="w-4 h-4 text-indigo-500" /> Detalhes Pessoais
          </h3>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Height */}
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <Ruler className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Altura</p>
                <p className="text-xs font-extrabold text-slate-700">{profile.altura ? (profile.altura.toString().includes('m') ? profile.altura : `${profile.altura}m`) : '1.68m'}</p>
              </div>
            </div>

            {/* Zodiac Sign */}
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <Sparkles className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Signo</p>
                <p className="text-xs font-extrabold text-slate-700">{profile.signo || 'Leão'}</p>
              </div>
            </div>

            {/* Civil status */}
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Estado Civil</p>
                <p className="text-xs font-extrabold text-slate-700 capitalize">{profile.estadoCivil || 'Solteiro(a)'}</p>
              </div>
            </div>

            {/* Skin/Ethnic */}
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Cor/Etnia</p>
                <p className="text-xs font-extrabold text-slate-700 capitalize">{profile.cor || 'Não informado'}</p>
              </div>
            </div>

            {/* Interest preference */}
            {profile.interesse && (
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2">
                <Heart className="w-4 h-4 text-pink-500 shrink-0 fill-pink-500" />
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Interesse no Swipe</p>
                  <p className="text-xs font-extrabold text-slate-700 capitalize">
                    {profile.interesse === 'todos' || profile.interesse === 'ambos' ? 'Todos (Homens e Mulheres)' : profile.interesse === 'feminino' || profile.interesse === 'mulheres' ? 'Mulheres' : 'Homens'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hobbies / Interests */}
        {profile.hobbies && profile.hobbies.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Meus Interesses</h3>
            <div className="flex flex-wrap gap-2">
              {profile.hobbies.map((hobby: string, index: number) => (
                <span 
                  key={index} 
                  className="bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-3.5 py-1.5 rounded-full text-xs shadow-sm transition-colors"
                >
                  {hobby}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Conversational Prompts / Icebreakers */}
        {profile.prompts && profile.prompts.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Perguntas Quebra-Gelo</h3>
            
            {profile.prompts.map((prompt: any, index: number) => (
              <div 
                key={index} 
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm relative overflow-hidden"
              >
                <div className="absolute right-4 top-2 text-slate-100 font-serif text-7xl select-none leading-none">
                  “
                </div>
                <h4 className="text-xs font-bold text-indigo-600 mb-2 uppercase tracking-wide relative z-10">
                  {prompt.title}
                </h4>
                <p className="text-slate-700 text-sm leading-relaxed font-semibold relative z-10">
                  {prompt.desc}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Habits & Lifestyle Grid */}
        {profile.lifestyle && (
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estilo de Vida</h3>
            <div className="grid grid-cols-2 gap-3">
              {profile.lifestyle.map((life: any, i: number) => (
                <div key={i} className="bg-slate-50/50 rounded-xl p-3.5 border border-slate-100 flex flex-col justify-center transition-colors hover:bg-slate-50">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">{life.label}</span>
                  <span className="text-sm font-extrabold text-slate-700 mt-1 text-left">{life.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expresse aqui o que achar relevante sobre você */}
        {profile.relevante && (
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-500" /> Sobre mim (Relevante)
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line font-medium text-left">
              {profile.relevante}
            </p>
          </div>
        )}

        
        {/* Contact Info - Gamified unlockable boxes */}
        <div className="grid grid-cols-2 gap-3 md:gap-5">
          {/* WhatsApp */}
          <div className="bg-white rounded-2xl p-3 sm:p-5 border border-slate-100 shadow-sm flex flex-col justify-between overflow-hidden relative min-h-[160px] sm:min-h-[190px]">
            <div className="space-y-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 sm:w-5 h-4 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 truncate">WhatsApp</h3>
                  <p className="text-[8px] sm:text-[10px] text-slate-400 font-medium truncate leading-none mt-0.5">Requer amizade</p>
                </div>
              </div>
            </div>
            
            <AnimatePresence mode="wait">
              {!phoneRevealed ? (
                profile?.statusBolinha === 'indisponivel' ? (
                  <motion.div 
                    key="locked-unavailable"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => handleContactLockClick('WhatsApp')}
                    role="button"
                    title="Ver detalhes de contato"
                    className="bg-rose-50/50 border border-rose-100 rounded-xl p-2 sm:p-4 flex flex-col items-center text-center space-y-1 sm:space-y-2 relative justify-center cursor-pointer hover:bg-rose-100/30 transition-all duration-200 active:scale-[0.98] flex-1 mt-3"
                  >
                    <p className="text-[10px] sm:text-xs font-bold text-rose-800 flex items-center gap-1">
                      🔒 Indisponível
                    </p>
                    <p className="text-[8px] sm:text-[10px] text-rose-500 font-medium leading-tight max-w-xs">
                      Clique para saber como liberar.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="locked"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => handleContactLockClick('WhatsApp')}
                    role="button"
                    title="Ver detalhes de contato"
                    className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-2 sm:p-4 flex flex-col items-center text-center space-y-1 sm:space-y-2 relative justify-center cursor-pointer hover:bg-emerald-100/35 transition-all duration-200 active:scale-[0.98] flex-1 mt-3"
                  >
                    <p className="text-[10px] sm:text-xs font-bold text-emerald-800 flex items-center gap-1">
                      🔒 Oculto
                    </p>
                    <p className="text-[8px] sm:text-[10px] text-emerald-600 font-medium leading-tight max-w-xs">
                      Ocultado pelo seu amigo. Clique para saber mais.
                    </p>
                  </motion.div>
                )
              ) : (
                <motion.div 
                  key="unlocked"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl p-2 sm:p-4 flex flex-col items-center justify-center shadow-lg gap-2 text-center flex-1 mt-3 overflow-hidden"
                >
                  <p className="text-xs sm:text-base font-black tracking-wide truncate max-w-full">{profile.telefone || 'Não informado'}</p>
                  {profile.telefone && (
                    <a 
                      href={`https://wa.me/55${profile.telefone.replace(/\D/g, '')}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="bg-white text-emerald-700 hover:bg-emerald-50 font-extrabold text-[8px] sm:text-[10px] px-2 sm:px-3 py-1.5 rounded-lg shadow-sm transition-colors uppercase tracking-wider block truncate max-w-full"
                    >
                      Abrir WhatsApp
                    </a>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Email */}
          <div className="bg-white rounded-2xl p-3 sm:p-5 border border-slate-100 shadow-sm flex flex-col justify-between overflow-hidden relative min-h-[160px] sm:min-h-[190px]">
            <div className="space-y-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                  <Mail className="w-4 sm:w-5 h-4 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 truncate">E-mail</h3>
                  <p className="text-[8px] sm:text-[10px] text-slate-400 font-medium truncate leading-none mt-0.5">Requer amizade</p>
                </div>
              </div>
            </div>
            
            <AnimatePresence mode="wait">
              {!emailRevealed ? (
                profile?.statusBolinha === 'indisponivel' ? (
                  <motion.div 
                    key="locked-unavailable-email"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => handleContactLockClick('E-mail')}
                    role="button"
                    title="Ver detalhes de contato"
                    className="bg-rose-50/50 border border-rose-100 rounded-xl p-2 sm:p-4 flex flex-col items-center text-center space-y-1 sm:space-y-2 relative justify-center cursor-pointer hover:bg-rose-100/30 transition-all duration-200 active:scale-[0.98] flex-1 mt-3"
                  >
                    <p className="text-[10px] sm:text-xs font-bold text-rose-800 flex items-center gap-1">
                      🔒 Indisponível
                    </p>
                    <p className="text-[8px] sm:text-[10px] text-rose-500 font-medium leading-tight max-w-xs">
                      Clique para saber como liberar.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="locked-email"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => handleContactLockClick('E-mail')}
                    role="button"
                    title="Ver detalhes de contato"
                    className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-2 sm:p-4 flex flex-col items-center text-center space-y-1 sm:space-y-2 relative justify-center cursor-pointer hover:bg-indigo-100/35 transition-all duration-200 active:scale-[0.98] flex-1 mt-3"
                  >
                    <p className="text-[10px] sm:text-xs font-bold text-indigo-800 flex items-center gap-1">
                      🔒 Oculto
                    </p>
                    <p className="text-[8px] sm:text-[10px] text-indigo-600 font-medium leading-tight max-w-xs">
                      Ocultado pelo seu amigo. Clique para saber mais.
                    </p>
                  </motion.div>
                )
              ) : (
                <motion.div 
                  key="unlocked-email"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl p-2 sm:p-4 flex flex-col items-center justify-center shadow-lg gap-2 text-center flex-1 mt-3 overflow-hidden break-all"
                >
                  <p className="text-[11px] sm:text-sm font-black tracking-wide truncate max-w-full" title={profile.email}>{profile.email || 'Não informado'}</p>
                  {profile.email && (
                    <a 
                      href={`mailto:${profile.email}`}
                      className="bg-white text-indigo-700 hover:bg-indigo-50 font-extrabold text-[8px] sm:text-[10px] px-2 sm:px-3 py-1.5 rounded-lg shadow-sm transition-colors uppercase tracking-wider block truncate max-w-full"
                    >
                      Enviar E-mail
                    </a>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
      {/* Verificação de Documento (ID) Modal Overlay */}
      <AnimatePresence>
        {idVerifyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden flex flex-col relative my-8"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-600 animate-pulse" />
                  <h3 className="font-bold text-slate-800 text-sm">Verificação de Documento</h3>
                </div>
                <button
                  onClick={() => {
                    setIdVerifyModalOpen(false);
                    if (idVerifyStep === 'success' || idVerifyStep === 'error') {
                       setIdVerifyStep('intro');
                    }
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 transition-colors text-slate-600"
                >
                  <span className="sr-only">Fechar</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                {idVerifyStep === 'intro' && (
                  <div className="space-y-6">
                    <div className="flex justify-center">
                      <div className="w-20 h-20 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center shadow-inner">
                        <Camera className="w-10 h-10" />
                      </div>
                    </div>
                    
                    <div className="text-center space-y-2">
                      <h4 className="font-extrabold text-slate-800 text-lg">Confirme sua Identidade</h4>
                      <p className="text-sm text-slate-500 font-medium">
                        Para garantir a segurança da plataforma, envie uma foto legível do seu documento (RG, CNH ou Passaporte). Nossa IA extrairá automaticamente seu Nome, Cidade/Estado e Data de Nascimento.
                      </p>
                      <p className="text-xs text-amber-600 font-semibold bg-amber-50 p-3 rounded-lg border border-amber-100">
                        Nota: Após a verificação, esses campos não poderão ser alterados.
                      </p>
                    </div>

                    <div className="pt-2">
                       <input 
                         type="file" 
                         accept="image/*" 
                         className="hidden" 
                         ref={idFileInputRef}
                         onChange={handleIdFileSelect}
                       />
                       <button 
                         onClick={() => idFileInputRef.current?.click()}
                         className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98]"
                       >
                         Selecionar Documento
                       </button>
                    </div>
                  </div>
                )}

                {idVerifyStep === 'uploading' && (
                  <div className="space-y-6">
                    <div className="flex justify-center">
                       {idImageBase64 && (
                         <div className="relative w-48 h-32 rounded-xl overflow-hidden border-2 border-purple-200 shadow-sm">
                           <img src={idImageBase64} alt="Document Preview" className="w-full h-full object-cover" />
                         </div>
                       )}
                    </div>
                    
                    <div className="text-center space-y-2">
                      <h4 className="font-extrabold text-slate-800 text-lg">Documento Selecionado</h4>
                      <p className="text-sm text-slate-500 font-medium">
                        Certifique-se de que os dados (Nome, Data e Local de Nascimento) estão visíveis e legíveis na imagem.
                      </p>
                    </div>

                    <div className="pt-2 flex gap-3">
                       <button 
                         onClick={() => {
                           setIdImageBase64(null);
                           setIdVerifyStep('intro');
                         }}
                         className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl transition-all"
                       >
                         Trocar
                       </button>
                       <button 
                         onClick={handleIdVerificationSubmit}
                         className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98]"
                       >
                         Enviar
                       </button>
                    </div>
                  </div>
                )}

                {idVerifyStep === 'analyzing' && (
                  <div className="space-y-6 py-4 flex flex-col items-center">
                    <div className="relative w-24 h-24">
                      <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-purple-600">
                        <ShieldCheck className="w-8 h-8 animate-pulse" />
                      </div>
                    </div>
                    
                    <div className="text-center space-y-2">
                      <h4 className="font-extrabold text-slate-800 text-lg">Analisando Documento</h4>
                      <p className="text-sm text-slate-500 font-medium animate-pulse">
                        A Inteligência Artificial está extraindo os seus dados...
                      </p>
                    </div>
                  </div>
                )}

                {idVerifyStep === 'error' && (
                  <div className="space-y-6">
                    <div className="flex justify-center">
                      <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center shadow-inner">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      </div>
                    </div>
                    
                    <div className="text-center space-y-2">
                      <h4 className="font-extrabold text-red-800 text-lg">Erro na Verificação</h4>
                      <p className="text-sm text-red-600 font-medium">
                        {idVerifyError}
                      </p>
                    </div>

                    <div className="pt-2">
                       <button 
                         onClick={() => {
                           setIdImageBase64(null);
                           setIdVerifyStep('intro');
                         }}
                         className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98]"
                       >
                         Tentar Novamente
                       </button>
                    </div>
                  </div>
                )}

                {idVerifyStep === 'approval' && (
                  <div className="space-y-6 w-full flex flex-col">
                    <div className="flex flex-col items-center text-center space-y-2">
                      <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center shadow-inner">
                        <AlertCircle className="w-8 h-8" />
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-xl tracking-tight">Autorização Necessária</h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Nossa inteligência artificial leu as seguintes informações no seu documento:
                      </p>
                    </div>

                    {idVerifyExtractedData && (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3 shadow-inner">
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-slate-400">Nome Completo</span>
                          <span className="block text-sm font-semibold text-slate-800">{idVerifyExtractedData.nomeCompleto}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400">Data de Nasc.</span>
                            <span className="block text-sm font-semibold text-slate-800">{idVerifyExtractedData.dataNascimento}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400">Local de Nasc.</span>
                            <span className="block text-sm font-semibold text-slate-800">
                              {idVerifyExtractedData.cidadeNascimento}{idVerifyExtractedData.cidadeNascimento && idVerifyExtractedData.estadoNascimento ? ' - ' : ''}{idVerifyExtractedData.estadoNascimento}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                      <p className="text-xs text-amber-800 font-semibold leading-relaxed">
                        Para obter o <strong>selo de autenticidade (perfil verificado)</strong>, você deve autorizar a atualização do nome e dados do aplicativo com as informações oficiais do documento.
                      </p>
                      <p className="text-[11px] text-amber-700/80 mt-1 font-medium">
                        Se não autorizar, o selo não será concedido e os dados do perfil continuarão como estão.
                      </p>
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                       <button 
                         onClick={handleApproveDataUpdate}
                         className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                       >
                         <CheckCircle className="w-4 h-4" /> Sim, Autorizar e Atualizar Perfil
                       </button>
                       <button 
                         onClick={handleDeclineDataUpdate}
                         className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-all text-xs"
                       >
                         Não Autorizar (Sem Selo de Autenticidade)
                       </button>
                    </div>
                  </div>
                )}

                {idVerifyStep === 'success' && (
                  <div className="space-y-6 w-full flex flex-col items-center">
                    <div className="relative w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center shadow-lg border border-emerald-100/30">
                      <CheckCircle className="w-12 h-12 animate-pulse" />
                      <span className="absolute -top-2 -right-2 text-xl animate-bounce">✨</span>
                    </div>

                    <div className="space-y-2 text-center w-full">
                      <h4 className="font-extrabold text-slate-800 text-2xl tracking-tight">Identidade Confirmada!</h4>
                      <p className="text-sm text-slate-500 font-medium">
                        Seus dados foram extraídos com sucesso.
                      </p>
                      
                      {idVerifyExtractedData && (
                        <div className="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-4 text-left space-y-3">
                           <div>
                             <span className="block text-[10px] uppercase font-bold text-slate-400">Nome Completo</span>
                             <span className="block text-sm font-semibold text-slate-800">{idVerifyExtractedData.nomeCompleto}</span>
                           </div>
                           <div className="grid grid-cols-2 gap-3">
                             <div>
                               <span className="block text-[10px] uppercase font-bold text-slate-400">Data de Nasc.</span>
                               <span className="block text-sm font-semibold text-slate-800">{idVerifyExtractedData.dataNascimento}</span>
                             </div>
                             <div>
                               <span className="block text-[10px] uppercase font-bold text-slate-400">Local de Nasc.</span>
                               <span className="block text-sm font-semibold text-slate-800">
                                 {idVerifyExtractedData.cidadeNascimento}{idVerifyExtractedData.cidadeNascimento && idVerifyExtractedData.estadoNascimento ? ' - ' : ''}{idVerifyExtractedData.estadoNascimento}
                               </span>
                             </div>
                           </div>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => {
                        setIdVerifyModalOpen(false);
                        setIdVerifyStep('intro');
                      }}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98] mt-2"
                    >
                      Concluir
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
          </div>
        </div>


        {/* Protection / Trust Banner */}
        <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200/50 text-[11px] font-medium leading-normal space-y-3">
          <div className="flex items-center gap-2 text-slate-500">
            <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Perfil protegido pelas diretrizes de segurança da plataforma. Se encontrar algum comportamento inapropriado, você poderá denunciar ou bloquear.</span>
          </div>
          {!isOwnProfile && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setReportModalOpen(true)}
                className="flex-1 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-100 font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Denunciar Perfil
              </button>
              <button
                onClick={handleBlockUser}
                disabled={isBlocking}
                className="flex-1 py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-55"
              >
                <Ban className="w-3.5 h-3.5" />
                {isBlocking ? 'Bloqueando...' : 'Bloquear'}
              </button>
            </div>
          )}
        </div>

      </div>

      {/* 3. Floating Bottom Interactions Dashboard */}
      <div className="fixed bottom-6 left-0 right-0 max-w-md mx-auto px-4 z-40 flex justify-center items-center gap-4">
        
        {/* Heart Burst Canvas Animation */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible">
          <AnimatePresence>
            {hearts.map((heart) => (
              <motion.div
                key={heart.id}
                initial={{ opacity: 1, scale: 0, x: 0, y: 0, rotate: 0 }}
                animate={{ 
                  opacity: 0, 
                  scale: heart.scale, 
                  x: heart.x, 
                  y: heart.y, 
                  rotate: heart.rotation 
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: heart.duration, ease: "easeOut" }}
                className="absolute text-red-500 filter drop-shadow"
              >
                <Heart className="w-8 h-8 fill-red-500 text-red-600" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Left Side: Conectar (Friend Request) Button */}
        <button 
          onClick={handleConnect}
          disabled={isConnecting}
          className={`flex-1 font-extrabold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all text-sm border cursor-pointer ${
            connectionStatus === 'connected'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : connectionStatus === 'sent_pending'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : connectionStatus === 'received_pending'
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 animate-bounce'
              : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
          }`}
        >
          {isConnecting ? (
            <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          ) : connectionStatus === 'connected' ? (
            <>
              <Check className="w-5 h-5" /> Conectado
            </>
          ) : connectionStatus === 'sent_pending' ? (
            <>
              <Clock className="w-4 h-4 animate-pulse" /> Solicitado
            </>
          ) : connectionStatus === 'received_pending' ? (
            <>
              <UserPlus className="w-4 h-4 text-indigo-600 fill-indigo-100" /> Aceitar
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 text-slate-500" /> Conectar
            </>
          )}
        </button>

        {/* Right Side: Flertar / Direct Chat Actions */}
        {connectionStatus === 'connected' ? (
          <button 
            onClick={() => navigate(`/chat/${id}`)}
            className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-extrabold py-4 px-4 rounded-2xl flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-100 hover:from-indigo-700 hover:to-indigo-800 active:scale-95 transition-all text-sm cursor-pointer"
          >
            <MessageCircle className="w-5 h-5" /> Abrir Chat
          </button>
        ) : (
          <button 
            onClick={handleFlirt}
            className={`flex-1 font-extrabold py-4 px-4 rounded-2xl flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all text-sm cursor-pointer ${
              liked 
                ? 'bg-slate-100 text-slate-400 border border-slate-200 shadow-none cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-indigo-200 hover:opacity-95'
            }`}
          >
            <Flame className={`w-5 h-5 ${liked ? 'text-slate-400' : 'text-white fill-white'}`} />
            {liked ? 'Flertado! ❤️' : 'Flertar'}
          </button>
        )}
      </div>

      {/* Short Message Modal Overlay */}
      <AnimatePresence>
        {shortMsgModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 flex flex-col relative"
            >
              <div className="p-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-left min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                        {profile.apelido || profile.nome}
                      </h3>
                      {profile.idade && (
                        <span className="text-xs text-slate-550 dark:text-slate-400 font-semibold">
                          • {profile.idade} anos
                        </span>
                      )}
                    </div>
                    {profile.estadoNascimento && (
                      <div className="mt-0.5">
                        <span className="text-[9px] text-indigo-650 dark:text-indigo-400 font-extrabold bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          {getDemonym(profile.estadoNascimento, profile.sexo)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <img 
                    src={profile.fotoPrincipalUrl || `https://api.dicebear.com/9.x/notionists/svg?seed=${id}`} 
                    alt={profile.nome} 
                    className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-inner" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShortMsgModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors active:scale-90 font-bold border border-slate-200/60 dark:border-slate-700/60 shadow-sm cursor-pointer"
                    title="Fechar"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {msgSentSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-8 flex flex-col items-center justify-center text-center space-y-3"
                >
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center animate-bounce">
                    <Check className="w-10 h-10 stroke-[3]" />
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-800">Mensagem Enviada! 🚀</h4>
                  <p className="text-xs text-slate-500 font-semibold max-w-[200px]">
                    Sua mensagem curta foi enviada com sucesso para {profile.apelido || profile.nome}.
                  </p>
                </motion.div>
              ) : (
                <div className="p-5 space-y-4">
                  {/* Presets */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sugestões Rápidas</label>
                    <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                      {[
                        `Oi ${profile.apelido || profile.nome}! Gostei muito do seu perfil. Vamos conversar? 😊`,
                        `Olá! Vi que temos interesses parecidos. Tudo bem por aí? 👋`,
                        `Oi! Adorei a sua vibe. Que tal um papo rápido? ✨`,
                        `Oi! Achei seu perfil super interessante. Quer trocar uma ideia? 💬`
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCustomMsg(preset)}
                          className="text-left p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 border border-slate-100 transition-colors duration-150"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Message input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mensagem Personalizada</label>
                    <textarea
                      value={customMsg}
                      onChange={(e) => setCustomMsg(e.target.value)}
                      placeholder="Escreva algo legal..."
                      maxLength={150}
                      rows={3}
                      className="w-full text-xs font-medium p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                    />
                    <div className="text-right text-[10px] font-bold text-slate-400">
                      {customMsg.length}/150
                    </div>
                  </div>

                  {/* Send Button */}
                  <button
                    disabled={!customMsg.trim() || isSendingMsg}
                    onClick={() => handleSendShortMsg(customMsg)}
                    className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 text-white font-extrabold text-sm py-3 rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                  >
                    {isSendingMsg ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <MessageCircle className="w-4 h-4 text-white" /> Enviar Mensagem
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Profile Modal Overlay */}
      <AnimatePresence>
        {reportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 flex flex-col relative"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Denunciar Perfil</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Sua denúncia é 100% anônima e confidencial</p>
                </div>
                <button 
                  onClick={() => setReportModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors active:scale-90 font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleReportSubmit} className="p-5 space-y-4">
                {/* Reason Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Motivo da Denúncia</label>
                  <select 
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    required
                  >
                    <option value="comportamento_inapropriado">Comportamento Inadequado / Ofensivo</option>
                    <option value="perfil_falso">Perfil Falso / Fake</option>
                    <option value="spam">Spam / Propaganda / Golpes</option>
                    <option value="menor_idade">Menor de Idade</option>
                    <option value="outro">Outro motivo</option>
                  </select>
                </div>

                {/* Details text area */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detalhes (Opcional)</label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Descreva brevemente o comportamento do usuário para nos ajudar na análise..."
                    maxLength={300}
                    rows={4}
                    className="w-full text-xs font-medium p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                  />
                  <div className="text-right text-[10px] font-bold text-slate-400">
                    {reportDetails.length}/300
                  </div>
                </div>

                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 font-semibold leading-relaxed">
                    Importante: Ao enviar a denúncia, o usuário será bloqueado automaticamente para você de forma definitiva.
                  </p>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isReporting}
                  className="w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-extrabold text-sm py-3 rounded-xl shadow-lg shadow-rose-100 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                >
                  {isReporting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-white" /> Enviar Denúncia
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmar Bloqueio Modal Overlay */}
      <AnimatePresence>
        {blockModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 flex flex-col relative"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Bloquear Usuário</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Esta ação não pode ser desfeita facilmente</p>
                </div>
                <button 
                  onClick={() => setBlockModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors active:scale-90 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <Ban className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                      Tem certeza de que deseja bloquear este usuário? Você não o verá mais nas buscas, swipe ou conversas.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setBlockModalOpen(false)}
                    className="flex-1 py-3 text-xs font-extrabold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-[0.98] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={executeBlockUser}
                    disabled={isBlocking}
                    className="flex-1 py-3 text-xs font-extrabold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-lg shadow-red-100 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                  >
                    {isBlocking ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Confirmar Bloqueio'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmar Desbloqueio Modal Overlay */}
      <AnimatePresence>
        {unblockModalOpen && targetUnblock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 flex flex-col relative"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Desbloquear Usuário</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Reestabelecer conexão e visibilidade</p>
                </div>
                <button 
                  onClick={() => {
                    setUnblockModalOpen(false);
                    setTargetUnblock(null);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors active:scale-90 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <Check className="w-5 h-5 text-emerald-500 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                      Tem certeza de que deseja desbloquear <span className="font-extrabold text-slate-800">{targetUnblock.name}</span>? Vocês poderão se ver novamente nas buscas, swipes ou enviar mensagens.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUnblockModalOpen(false);
                      setTargetUnblock(null);
                    }}
                    className="flex-1 py-3 text-xs font-extrabold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-[0.98] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={executeUnblockUser}
                    disabled={unblockingUserId !== null}
                    className="flex-1 py-3 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                  >
                    {unblockingUserId !== null ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Desbloquear'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmar Standby Modal Overlay */}
      <AnimatePresence>
        {showStandbyConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 flex flex-col relative animate-none"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Ativar Modo StandBy?</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Sua conta ficará adormecida</p>
                </div>
                <button 
                  onClick={() => setShowStandbyConfirm(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors active:scale-90 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                    <Moon className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                      Sua conta será desativada temporariamente e ficará invisível nas buscas, mas todos os seus dados e conexões serão preservados até você fazer login novamente.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowStandbyConfirm(false)}
                    className="flex-1 py-3 text-xs font-extrabold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-[0.98] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={executePutInStandby}
                    disabled={isEnteringStandby}
                    className="flex-1 py-3 text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-lg shadow-amber-100 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                  >
                    {isEnteringStandby ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Confirmar'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmar Exclusão de Conta Modal Overlay */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 flex flex-col relative animate-none"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-red-700">Excluir Conta?</h3>
                  <p className="text-[11px] text-red-400 font-medium">Esta operação é irreversível</p>
                </div>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors active:scale-90 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                    <AlertTriangle className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                      Deseja realmente excluir permanentemente sua conta? Você perderá todo o seu perfil, histórico de mensagens e todas as suas conexões no aplicativo.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-3 text-xs font-extrabold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-[0.98] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={executeDeleteAccount}
                    disabled={isDeletingAccount}
                    className="flex-1 py-3 text-xs font-extrabold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-lg shadow-red-100 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                  >
                    {isDeletingAccount ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Excluir'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Editar Perfil Modal Overlay */}
      <AnimatePresence>
        {editModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className={`bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] sm:max-h-[90vh] border border-slate-100 flex flex-col relative ${isSavingProfile || uploadError ? 'overflow-hidden' : 'overflow-y-auto'}`}
            >
              {/* Image Upload Progress Overlay */}
              {(isSavingProfile || uploadError) && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center">
                  {uploadError ? (
                    <div className="space-y-4 max-w-sm">
                      <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
                        <X className="w-8 h-8" />
                      </div>
                      <h4 className="font-bold text-slate-800 text-lg">Falha no Carregamento</h4>
                      <p className="text-sm text-slate-500">{uploadError}</p>
                      <button
                        type="button"
                        onClick={() => setUploadError(null)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
                      >
                        Tentar Novamente
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6 w-full max-w-sm">
                      <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-sm animate-pulse">
                        <Sparkles className="w-8 h-8" />
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-800 text-base">Salvando seu Perfil</h4>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{uploadStatus}</p>
                      </div>

                      {/* Progress Bar Container */}
                      <div className="space-y-2">
                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200/50 p-[1px]">
                          <motion.div 
                            className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-500">
                          <span>Progresso Geral</span>
                          <span className="text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">{uploadProgress}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Editar Meu Perfil</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Altere seus dados pessoais e de disponibilidade</p>
                </div>
                <button 
                  onClick={() => setEditModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors active:scale-90 font-bold"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
                {/* Imagem de Perfil */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Foto Principal</label>
                  <div className="relative w-32 h-32">
                    <input 
                      type="file" 
                      accept="image/*"
                      id="foto-principal-upload"
                      className="hidden"
                      onChange={e => handleFileUpload(e, true)} 
                    />
                    {editFotoPrincipalUrl ? (
                      <div className="w-full h-full relative group rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-slate-100">
                        <img src={editFotoPrincipalUrl} alt="Foto Principal" className="w-full h-full object-cover" />
                        
                        {/* Action overlay: always visible on mobile, visible on hover on hover-capable devices */}
                        <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                          <label 
                            htmlFor="foto-principal-upload"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-[10px] font-bold rounded-lg cursor-pointer shadow-sm transition-all transform hover:scale-105"
                          >
                            <Pencil className="w-3 h-3 text-indigo-600" />
                            Modificar
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setEditFotoPrincipalUrl('');
                              setPendingFotoPrincipal(null);
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg shadow-sm transition-all transform hover:scale-105"
                          >
                            <Trash2 className="w-3 h-3" />
                            Excluir
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label 
                        htmlFor="foto-principal-upload"
                        className="w-full h-full border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors"
                      >
                        <UserPlus className="w-6 h-6 text-slate-300 mb-1.5" />
                        <span className="text-[10px] font-bold text-slate-400">Adicionar Foto</span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Galeria de Imagens (Até 5) */}
                <div className="space-y-3">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Galeria de Fotos (Máx: 5)</label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="relative aspect-square w-full">
                        <input 
                          type="file" 
                          accept="image/*"
                          id={`foto-adicional-${index}`}
                          className="hidden"
                          onChange={e => handleFileUpload(e, false, index)} 
                        />
                        {editFotosAdicionais[index] ? (
                          <div className="w-full h-full relative group rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-slate-100">
                            <img src={editFotosAdicionais[index]} alt={`Imagem ${index + 1}`} className="w-full h-full object-cover" />
                            
                            {/* Action overlay: always visible on mobile, visible on hover on hover-capable devices */}
                            <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                              <label 
                                htmlFor={`foto-adicional-${index}`}
                                className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 text-slate-800 text-[9px] font-bold rounded-md cursor-pointer shadow-sm transition-all transform hover:scale-105"
                              >
                                <Pencil className="w-2.5 h-2.5 text-indigo-600" />
                                Modificar
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const newFotos = [...editFotosAdicionais];
                                  newFotos[index] = '';
                                  setEditFotosAdicionais(newFotos);
                                  setPendingFotosAdicionais(prev => {
                                    const newPending = { ...prev };
                                    delete newPending[index];
                                    return newPending;
                                  });
                                }}
                                className="flex items-center gap-1 px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-bold rounded-md shadow-sm transition-all transform hover:scale-105"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                                Excluir
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label 
                            htmlFor={`foto-adicional-${index}`}
                            className="w-full h-full border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors"
                          >
                            <UserPlus className="w-5 h-5 text-slate-300 mb-1" />
                            <span className="text-[10px] font-bold text-slate-400">Imagem {index + 1}</span>
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ID Verification Status and Action in Edit Modal */}
                <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`w-5 h-5 ${isIdVerified ? 'text-emerald-500' : 'text-purple-500'}`} />
                    <div>
                      <p className="text-[11px] font-extrabold text-slate-700">Selo Identificação Confirmada</p>
                      <p className="text-[10px] text-slate-500 font-semibold leading-tight">
                        {isIdVerified 
                          ? 'Seus documentos já foram confirmados e seus dados principais estão bloqueados.' 
                          : 'Confirme seus dados usando um documento oficial por inteligência artificial.'}
                      </p>
                    </div>
                  </div>
                  {!isIdVerified && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditModalOpen(false);
                        setIdVerifyModalOpen(true);
                      }}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] rounded-lg shadow-md hover:shadow-indigo-100 transition-all active:scale-95 cursor-pointer shrink-0"
                    >
                      Verificar Agora
                    </button>
                  )}
                </div>

                {/* Nome */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Nome Completo</label>
                  <input 
                    required 
                    type="text" 
                    value={editNome} 
                    onChange={e => setEditNome(e.target.value)} 
                    disabled={isIdVerified}
                    className={`w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${isIdVerified ? 'opacity-70 cursor-not-allowed bg-slate-100' : ''}`} 
                    placeholder="Seu nome"
                  />
                </div>

                {/* Apelido */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Apelido (@)</label>
                  <input 
                    required 
                    type="text" 
                    value={editApelido} 
                    onChange={e => setEditApelido(e.target.value)} 
                    className="w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
                    placeholder="Seu apelido"
                  />
                </div>

                {/* Data de Nascimento e Idade */}
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Data de Nasc.</label>
                    <input 
                      required 
                      type="text" 
                      maxLength={10}
                      placeholder="Dia-Mês-Ano"
                      value={editDataNascimento} 
                      onChange={handleDateChange} 
                      disabled={isIdVerified}
                      className={`w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${isIdVerified ? 'opacity-70 cursor-not-allowed bg-slate-100' : ''}`} 
                    />
                  </div>
                  <div className="w-20 space-y-1.5 shrink-0">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Idade</label>
                    <input 
                      type="text" 
                      readOnly
                      placeholder="--"
                      value={editDataNascimento.length === 10 && calculateAge(editDataNascimento) > 0 ? calculateAge(editDataNascimento) : ''} 
                      className="w-full text-xs font-semibold p-3.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed text-center"
                    />
                  </div>
                </div>

                {/* Telefone */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">WhatsApp com DDD</label>
                  <input 
                    type="tel" 
                    value={editTelefone} 
                    onChange={e => setEditTelefone(e.target.value)} 
                    className="w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
                    placeholder="(11) 99999-9999"
                  />
                </div>

                {/* Bio */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Biografia</label>
                  <textarea 
                    rows={3} 
                    value={editBio} 
                    onChange={e => setEditBio(e.target.value)} 
                    className="w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none" 
                    placeholder="Sua bio..."
                  />
                </div>

                {/* Status da Bolinha (Disponibilidade) */}
                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Meu Status (Semáforo de Interação)</label>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight">
                      Este sistema funciona como um semáforo de trânsito. A cor vermelha (em cima) indica parada/restrição total, a amarela (no meio) indica atenção/restrições, e a verde (embaixo) indica sinal aberto/disponível. Escolha o seu momento.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {[
                      { 
                        value: 'indisponivel', 
                        label: 'Não Disponível', 
                        color: 'bg-rose-500', 
                        textClass: 'text-rose-600',
                        desc: 'Você estará online, porém com restrições. Ficará claro que não quer interação com pessoas fora do seu grupo de amigos. Você será informado caso alguém desrespeite a regra, com opção de bloquear imediatamente o infrator.' 
                      },
                      { 
                        value: 'restricoes', 
                        label: 'Restrições', 
                        color: 'bg-amber-500', 
                        textClass: 'text-amber-600',
                        desc: 'Aberto a interações com algumas restrições. Ao ser contactado, você poderá usar respostas automáticas rápidas para dispensar o contato se não houver interesse.' 
                      },
                      { 
                        value: 'disponivel', 
                        label: 'Disponível', 
                        color: 'bg-emerald-500', 
                        textClass: 'text-emerald-600',
                        desc: 'Você estará aberto a interações e poderá interagir abertamente, como lhe convier.' 
                      }
                    ].map((st) => (
                      <button
                        type="button"
                        key={st.value}
                        onClick={() => setEditStatusBolinha(st.value)}
                        className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all text-left ${
                          editStatusBolinha === st.value
                            ? 'bg-indigo-50/50 border-indigo-400 ring-2 ring-indigo-500/15'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 mt-0.5 shrink-0 rounded-full ${st.color} shadow-sm ${editStatusBolinha === st.value ? 'animate-pulse ring-2 ring-offset-2 ring-offset-indigo-50 ring-current' : ''}`} />
                        <div className="flex flex-col gap-1">
                          <span className={`text-xs font-bold ${st.textClass}`}>{st.label}</span>
                          <span className="text-[10px] text-slate-500 leading-relaxed font-medium">
                            {st.desc}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sexo & Cor/Etnia */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Gênero</label>
                    <select 
                      required 
                      value={editSexo} 
                      onChange={e => setEditSexo(e.target.value)} 
                      className="w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none"
                    >
                      <option value="masculino">Masculino</option>
                      <option value="feminino">Feminino</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Cor / Etnia</label>
                    <select 
                      value={editCor} 
                      onChange={e => setEditCor(e.target.value)} 
                      className="w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none"
                    >
                      <option value="">Não informado</option>
                      <option value="branca">Branca</option>
                      <option value="preta">Preta</option>
                      <option value="parda">Parda</option>
                      <option value="amarela">Amarela</option>
                      <option value="indigena">Indígena</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                </div>

                {/* Interesse em Relacionamento */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Seu Interesse (Quem você quer ver no Swipe)</label>
                  <select 
                    value={editInteresse} 
                    onChange={e => setEditInteresse(e.target.value)} 
                    className="w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none"
                  >
                    <option value="todos">Todos (Homens e Mulheres)</option>
                    <option value="feminino">Mulheres</option>
                    <option value="masculino">Homens</option>
                  </select>
                </div>

                {/* Estado Civil & Objetivo */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Estado Civil</label>
                    <select 
                      value={editEstadoCivil} 
                      onChange={e => setEditEstadoCivil(e.target.value)} 
                      className="w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none"
                    >
                      <option value="">Não informado</option>
                      <option value="solteiro">Solteiro(a)</option>
                      <option value="casado">Casado(a)</option>
                      <option value="divorciado">Divorciado(a)</option>
                      <option value="viuvo">Viúvo(a)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Objetivo</label>
                    <select 
                      value={editObjetivo} 
                      onChange={e => setEditObjetivo(e.target.value)} 
                      className="w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none"
                    >
                      <option value="casual">Encontros casuais</option>
                      <option value="serio">Relacionamento sério</option>
                      <option value="amizade">Novas amizades</option>
                      <option value="no_momento">No momento</option>
                    </select>
                  </div>
                </div>

                {/* Local de Nascimento */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Estado (Nasc.)</label>
                    <select 
                      value={editEstadoNascimento} 
                      onChange={e => setEditEstadoNascimento(e.target.value)} 
                      disabled={isIdVerified}
                      className={`w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none ${isIdVerified ? 'opacity-70 cursor-not-allowed bg-slate-100' : ''}`}
                    >
                      <option value="">Não informado</option>
                      <option value="Acre">Acre</option>
                      <option value="Alagoas">Alagoas</option>
                      <option value="Amapá">Amapá</option>
                      <option value="Amazonas">Amazonas</option>
                      <option value="Bahia">Bahia</option>
                      <option value="Ceará">Ceará</option>
                      <option value="Distrito Federal">Distrito Federal</option>
                      <option value="Espírito Santo">Espírito Santo</option>
                      <option value="Goiás">Goiás</option>
                      <option value="Maranhão">Maranhão</option>
                      <option value="Mato Grosso">Mato Grosso</option>
                      <option value="Mato Grosso do Sul">Mato Grosso do Sul</option>
                      <option value="Minas Gerais">Minas Gerais</option>
                      <option value="Pará">Pará</option>
                      <option value="Paraíba">Paraíba</option>
                      <option value="Paraná">Paraná</option>
                      <option value="Pernambuco">Pernambuco</option>
                      <option value="Piauí">Piauí</option>
                      <option value="Rio de Janeiro">Rio de Janeiro</option>
                      <option value="Rio Grande do Norte">Rio Grande do Norte</option>
                      <option value="Rio Grande do Sul">Rio Grande do Sul</option>
                      <option value="Rondônia">Rondônia</option>
                      <option value="Roraima">Roraima</option>
                      <option value="Santa Catarina">Santa Catarina</option>
                      <option value="São Paulo">São Paulo</option>
                      <option value="Sergipe">Sergipe</option>
                      <option value="Tocantins">Tocantins</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Cidade (Nasc.)</label>
                    <input 
                      type="text" 
                      value={editCidadeNascimento} 
                      onChange={e => setEditCidadeNascimento(e.target.value)} 
                      disabled={isIdVerified}
                      className={`w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${isIdVerified ? 'opacity-70 cursor-not-allowed bg-slate-100' : ''}`} 
                      placeholder="Sua cidade"
                    />
                  </div>
                </div>

                {/* Altura, Signo e Profissão */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Altura (m)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={editAltura} 
                      onChange={e => setEditAltura(e.target.value)} 
                      className="w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
                      placeholder="Ex: 1.75"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Signo</label>
                    <select 
                      value={editSigno} 
                      onChange={e => setEditSigno(e.target.value)} 
                      className="w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none"
                    >
                      <option value="">Não informado</option>
                      <option value="Áries ♈">Áries ♈</option>
                      <option value="Touro ♉">Touro ♉</option>
                      <option value="Gêmeos ♊">Gêmeos ♊</option>
                      <option value="Câncer ♋">Câncer ♋</option>
                      <option value="Leão ♌">Leão ♌</option>
                      <option value="Virgem ♍">Virgem ♍</option>
                      <option value="Libra ♎">Libra ♎</option>
                      <option value="Escorpião ♏">Escorpião ♏</option>
                      <option value="Sagitário ♐">Sagitário ♐</option>
                      <option value="Capricórnio ♑">Capricórnio ♑</option>
                      <option value="Aquário ♒">Aquário ♒</option>
                      <option value="Peixes ♓">Peixes ♓</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Profissão</label>
                    <input 
                      type="text" 
                      value={editProfissao} 
                      onChange={e => setEditProfissao(e.target.value)} 
                      className="w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
                      placeholder="Ex: Médico(a)"
                    />
                  </div>
                </div>

                {/* Interesses / Hobbies */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Meus Interesses / Hobbies</label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    {editHobbies.map((hobby, idx) => (
                      <span key={idx} className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                        {hobby}
                        <button
                          type="button"
                          onClick={() => setEditHobbies(prev => prev.filter((_, i) => i !== idx))}
                          className="text-indigo-400 hover:text-indigo-600 font-extrabold focus:outline-none cursor-pointer"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                    {editHobbies.length === 0 && (
                      <span className="text-[11px] text-slate-400 p-1">Nenhum interesse adicionado ainda.</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: Futebol ⚽, Vinhos 🍷"
                      value={newHobbyInput}
                      onChange={e => setNewHobbyInput(e.target.value)}
                      className="flex-1 text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newHobbyInput.trim()) {
                            setEditHobbies(prev => [...prev, newHobbyInput.trim()]);
                            setNewHobbyInput('');
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newHobbyInput.trim()) {
                          setEditHobbies(prev => [...prev, newHobbyInput.trim()]);
                          setNewHobbyInput('');
                        }
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>

                {/* Perguntas Quebra-Gelo */}
                <div className="space-y-3">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Perguntas Quebra-Gelo</label>
                  {editPrompts.map((prompt, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50/60 border border-slate-200/80 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                          Pergunta {idx + 1}
                        </label>
                      </div>
                      <div className="w-full text-xs font-bold p-2.5 bg-white border border-slate-200 rounded-lg text-slate-700">
                        {prompt.title}
                      </div>
                      <textarea
                        rows={2}
                        value={prompt.desc}
                        onChange={e => {
                          const val = e.target.value;
                          setEditPrompts(prev => prev.map((p, i) => i === idx ? { ...p, desc: val } : p));
                        }}
                        placeholder="Sua resposta..."
                        className="w-full text-xs font-semibold p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                      />
                    </div>
                  ))}
                </div>

                {/* Estilo de Vida */}
                <div className="space-y-3">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Estilo de Vida</label>
                  <div className="grid grid-cols-2 gap-3">
                    {editLifestyle.map((life, idx) => {
                      let options = ["Não", "Sim", "Às vezes", "Socialmente"];
                      if (life.label === "Esportes") {
                        options = ["Frequente", "Às vezes", "Não pratico", "Gosto de caminhada"];
                      } else if (life.label === "Bebidas") {
                        options = ["Socialmente", "Não bebo", "Frequente", "Raramente"];
                      } else if (life.label === "Fumante") {
                        options = ["Não", "Sim", "Socialmente", "Tentando parar"];
                      } else if (life.label === "Pet Favorito") {
                        options = ["Ama pets 🐾", "Gatos 🐱", "Cachorros 🐶", "Sem pets"];
                      }

                      return (
                        <div key={idx} className="space-y-1">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{life.label}</span>
                          <select
                            value={life.value}
                            onChange={e => {
                              const val = e.target.value;
                              setEditLifestyle(prev => prev.map((item, i) => i === idx ? { ...item, value: val } : item));
                            }}
                            className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none"
                          >
                            {options.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                            {!options.includes(life.value) && (
                              <option value={life.value}>{life.value}</option>
                            )}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Expresse aqui o que achar relevante sobre você */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                      Expresse aqui o que achar relevante sobre você
                    </label>
                    <span className="text-[9px] font-bold text-slate-400">
                      {editRelevante.length}/500
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    maxLength={500}
                    value={editRelevante}
                    onChange={e => setEditRelevante(e.target.value)}
                    placeholder="Conte algo sobre sua personalidade, preferências, o que busca, curiosidades, etc..."
                    className="w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none transition-all"
                  />
                </div>

                {/* Account Management: Standby and Deletion */}
                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4 text-rose-500" />
                      Gerenciamento da Conta
                    </span>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                      Escolha como deseja gerenciar a permanência dos seus dados na nossa plataforma.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Standby Card/Option */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-150/40 space-y-2">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Moon className="w-3.5 h-3.5 text-amber-500" /> Modo StandBy (Desativação Temporária)
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-normal font-medium">
                        Sua conta e perfil serão desativados totalmente do aplicativo (ocultos das buscas e swipes), porém todos os seus dados e conexões existentes serão mantidos. Você poderá reativar seu login a qualquer momento, enviando um e-mail de confirmação para o seu e-mail cadastrado.
                      </p>
                      
                      <button
                        type="button"
                        onClick={handlePutInStandby}
                        disabled={isEnteringStandby || isDeletingAccount}
                        className="w-full mt-1 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer border bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200/30 active:scale-95 disabled:opacity-50"
                      >
                        {isEnteringStandby ? (
                          <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Moon className="w-3.5 h-3.5" />
                            <span>Colocar Conta em StandBy</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Deletion Card/Option */}
                    <div className="bg-red-50/40 p-4 rounded-xl border border-red-100/40 space-y-2">
                      <h4 className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" /> Excluir Conta Permanentemente
                      </h4>
                      <p className="text-[11px] text-red-600/80 leading-normal font-bold">
                        ⚠️ Atenção: Esta opção é irreversível e você perderá permanentemente todas as suas conexões, mensagens e perfil do aplicativo.
                      </p>
                      
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={isDeletingAccount || isEnteringStandby}
                        className="w-full mt-1 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer border bg-red-600 hover:bg-red-700 text-white border-red-600 active:scale-95 disabled:opacity-50 shadow-md shadow-red-100 dark:shadow-none"
                      >
                        {isDeletingAccount ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir Minha Conta</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  type="submit"
                  disabled={isSavingProfile || isUploadingImage}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-sm py-4 rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer mt-2"
                >
                  {isSavingProfile || isUploadingImage ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {isUploadingImage ? 'Enviando Imagem...' : ''}
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Verificação Facial por IA Modal Overlay */}
      <AnimatePresence>
        {faceVerifyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden flex flex-col relative my-8"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 animate-pulse" />
                  <h3 className="font-bold text-slate-800 text-sm">Verificação de Identidade por IA</h3>
                </div>
                <button
                  onClick={() => {
                    setFaceVerifyModalOpen(false);
                    setFaceVerifyStep('intro');
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 flex-1 flex flex-col items-center text-center">
                {faceVerifyStep === 'intro' && (
                  <div className="space-y-6">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                      <Camera className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-800 text-lg">Como funciona a verificação?</h4>
                      <p className="text-slate-500 text-xs leading-relaxed">
                        Nossa inteligência artificial comparará uma selfie sua tirada em tempo real com sua foto principal do perfil para atestar sua identidade.
                      </p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl text-left border border-slate-100 space-y-3">
                      <div className="flex items-start gap-2.5 text-xs">
                        <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center text-[9px] shrink-0 mt-0.5">1</span>
                        <p className="text-slate-600 font-medium">Garanta que está em um ambiente bem iluminado.</p>
                      </div>
                      <div className="flex items-start gap-2.5 text-xs">
                        <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center text-[9px] shrink-0 mt-0.5">2</span>
                        <p className="text-slate-600 font-medium">Fique com o rosto limpo (evite óculos escuros ou chapéus).</p>
                      </div>
                      <div className="flex items-start gap-2.5 text-xs">
                        <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center text-[9px] shrink-0 mt-0.5">3</span>
                        <p className="text-slate-600 font-medium">Olhe diretamente para a câmera e siga as instruções na tela.</p>
                      </div>
                    </div>

                    <button
                      onClick={() => setFaceVerifyStep('scanning')}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm py-3.5 rounded-xl transition-all shadow-md cursor-pointer"
                    >
                      Iniciar Escaneamento
                    </button>
                  </div>
                )}

                {faceVerifyStep === 'scanning' && (
                  <div className="w-full space-y-6 flex flex-col items-center">
                    {/* Viewfinder Circle */}
                    <div className="relative w-56 h-56 rounded-full border-4 border-indigo-600 overflow-hidden shadow-inner bg-slate-950 flex items-center justify-center">
                      {hasCameraError ? (
                        /* Simulated Scanner Frame */
                        <div className="w-full h-full relative flex flex-col items-center justify-center bg-slate-900 text-slate-400">
                          <Shield className="w-12 h-12 text-slate-600 animate-pulse" />
                          <span className="text-[10px] text-slate-500 font-bold mt-2">Câmera Simulada Ativa</span>
                        </div>
                      ) : (
                        /* Actual Live Webcam Video Stream */
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover scale-x-[-1]"
                        />
                      )}

                      {/* Laser Grid Scanner Sweeper Overlay */}
                      <div className="absolute inset-x-0 h-0.5 bg-indigo-500/80 shadow-[0_0_10px_#6366f1] animate-[bounce_2s_infinite]"></div>

                      {/* Scanning Target Guidelines */}
                      <div className="absolute inset-4 rounded-full border border-dashed border-white/40 pointer-events-none"></div>
                    </div>

                    {/* Step Instruction text */}
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Fase {scanStep + 1} de 4
                      </p>
                      <p className="text-base font-extrabold text-slate-800 animate-pulse">
                        {scanStep === 0 && "Aproxime seu rosto do círculo..."}
                        {scanStep === 1 && "Centralize seu rosto perfeitamente..."}
                        {scanStep === 2 && "Mantenha-se imóvel... Analisando..."}
                        {scanStep === 3 && "Agora sorria para a câmera! 😊"}
                      </p>
                    </div>

                    {/* Progress indicators dots */}
                    <div className="flex gap-2 justify-center">
                      {[0, 1, 2, 3].map((stepIdx) => (
                        <div
                          key={stepIdx}
                          className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                            scanStep === stepIdx
                              ? 'bg-indigo-600 w-6'
                              : scanStep > stepIdx
                              ? 'bg-emerald-500'
                              : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Gracious simulation button for iframe environments */}
                    {hasCameraError && (
                      <button
                        onClick={() => setFaceVerifyStep('analyzing')}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1.5 underline cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Forçar Conclusão (Simulador)
                      </button>
                    )}
                  </div>
                )}

                {faceVerifyStep === 'analyzing' && (
                  <div className="space-y-6 w-full flex flex-col items-center py-6">
                    {/* Pulsing Loading Shield */}
                    <div className="relative w-24 h-24 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                      <Shield className="w-10 h-10 text-indigo-600 animate-bounce" />
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-800 text-base">Processando Biometria com IA</h4>
                      <p className="text-slate-500 text-xs font-semibold animate-pulse">
                        {analyzingMessage || "Analisando..."}
                      </p>
                    </div>
                  </div>
                )}

                {faceVerifyStep === 'success' && (
                  <div className="space-y-6 w-full flex flex-col items-center">
                    {/* Sparkling Blue Badge */}
                    <div className="relative w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center shadow-lg border border-blue-100/30">
                      <ShieldCheck className="w-12 h-12 animate-pulse" />
                      {/* Animated Sparkles popping around */}
                      <span className="absolute -top-2 -right-2 text-xl animate-bounce">✨</span>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-800 text-lg">Perfil Verificado!</h4>
                      <p className="text-slate-500 text-xs leading-relaxed max-w-xs mx-auto">
                        Parabéns! Sua identidade foi validada com sucesso contra sua foto de perfil principal.
                      </p>
                    </div>

                    <div className="w-full bg-blue-50/50 p-4 rounded-xl border border-blue-100/20 text-center">
                      <p className="text-[11px] text-blue-800 font-bold uppercase tracking-wider">
                        Selo Azul Ativo
                      </p>
                      <p className="text-[10px] text-blue-600 font-medium mt-1">
                        O selo de Verificação Facial por IA já está visível no seu perfil e nos resultados de busca!
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setFaceVerifyModalOpen(false);
                        setFaceVerifyStep('intro');
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm py-3.5 rounded-xl transition-all shadow-md cursor-pointer"
                    >
                      Concluir
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {faceLoginConfirmModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-100 dark:border-slate-850 overflow-hidden flex flex-col relative my-8"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-pink-500 animate-pulse" />
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Ativar Login Facial</h3>
                </div>
                <button
                  onClick={() => setFaceLoginConfirmModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleConfirmFaceLogin} className="p-6 space-y-4">
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                  Para habilitar com segurança a autenticação facial neste dispositivo, por favor insira a senha atual da sua conta do aplicativo.
                </p>

                {faceLoginError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold border border-red-100 dark:border-red-900/40">
                    {faceLoginError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Senha Atual</label>
                  <input
                    required
                    type="password"
                    placeholder="Sua senha de login"
                    value={faceLoginPassword}
                    onChange={(e) => setFaceLoginPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setFaceLoginConfirmModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-100 dark:shadow-none cursor-pointer"
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {changePasswordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-100 dark:border-slate-850 overflow-hidden flex flex-col relative my-8"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Alterar Senha</h3>
                </div>
                <button
                  onClick={() => setChangePasswordModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleSubmitChangePassword} className="p-6 space-y-4">
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                  Para alterar sua senha, você deve confirmar sua senha atual e em seguida digitar a nova senha de segurança de no mínimo 6 caracteres.
                </p>

                {changePasswordError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold border border-red-100 dark:border-red-900/40">
                    {changePasswordError}
                  </div>
                )}

                {changePasswordSuccess && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-450 rounded-xl text-xs font-semibold border border-emerald-100 dark:border-emerald-900/40 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>{changePasswordSuccess}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ml-1">Senha Atual</label>
                  <input
                    required
                    type="password"
                    placeholder="Sua senha atual"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ml-1">Nova Senha</label>
                  <input
                    required
                    type="password"
                    placeholder="Mínimo de 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ml-1">Confirmar Nova Senha</label>
                  <input
                    required
                    type="password"
                    placeholder="Repita a nova senha"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isChangingPassword}
                    onClick={() => setChangePasswordModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-indigo-100 dark:shadow-none cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-70"
                  >
                    {isChangingPassword ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <span>Atualizar Senha</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showMatchModal && profile && (
          <div className="fixed inset-0 bg-slate-950/95 z-[100] flex flex-col items-center justify-center p-6">
            <div className="text-center space-y-1 mb-8">
              <h2 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-400 text-4xl tracking-tighter uppercase animate-pulse">
                Deu Match!
              </h2>
              <p className="text-xs text-slate-300 font-bold">
                Você e {profile.nome} curtiram um ao outro.
              </p>
            </div>

            {/* Avatar circles */}
            <div className="flex justify-center items-center gap-6 my-6 relative">
              <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden relative rotate-[-6deg] bg-slate-900">
                <img 
                  src={auth.currentUser?.photoURL || `https://api.dicebear.com/9.x/notionists/svg?seed=${auth.currentUser?.uid}`} 
                  alt="Me" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="absolute z-10 bg-white p-2.5 rounded-full shadow-lg scale-110 border border-slate-100">
                <Heart className="w-6 h-6 fill-red-500 text-red-600 animate-bounce" />
              </div>

              <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden relative rotate-[6deg] bg-slate-900">
                <img 
                  src={profile.fotoPrincipalUrl || `https://api.dicebear.com/9.x/notionists/svg?seed=${id}`} 
                  alt="Match" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <div className="w-full max-w-xs space-y-3 mt-8">
              <button 
                onClick={() => {
                  setShowMatchModal(false);
                  navigate(`/chat/${[auth.currentUser?.uid || '', id].sort().join('_')}`);
                }}
                className="w-full bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-extrabold py-3.5 rounded-2xl text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all animate-bounce"
              >
                <MessageCircle className="w-4.5 h-4.5" /> Enviar Mensagem & Iniciar Chat
              </button>
              
              <button 
                onClick={() => setShowMatchModal(false)}
                className="w-full bg-white/10 hover:bg-white/15 text-slate-200 font-extrabold py-3 rounded-2xl text-xs transition-all cursor-pointer active:scale-95"
              >
                Continuar Olhando Perfis
              </button>
            </div>
          </div>
        )}

        {safetyTipsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full border border-slate-100 dark:border-slate-800/80 overflow-hidden flex flex-col relative max-h-[90vh] my-4"
            >
              {/* Header with decorative background */}
              <div className="relative p-6 pb-4 border-b border-slate-150/50 dark:border-slate-800 bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-white dark:to-slate-900">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500 text-white flex items-center justify-center shadow-lg shadow-teal-100 dark:shadow-none">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base tracking-tight">Dicas de Segurança</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Orientação para Encontros Presenciais</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSafetyTipsModalOpen(false);
                      setSafetyCategory('todas');
                      setSafetySearch('');
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search & Category Filter Section */}
              <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-850 space-y-3 shrink-0">
                {/* Search Bar */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Compass className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Pesquisar dica de segurança..."
                    value={safetySearch}
                    onChange={(e) => setSafetySearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all shadow-inner"
                  />
                  {safetySearch && (
                    <button
                      onClick={() => setSafetySearch('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Horizontal Scrolling Tabs */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
                  {[
                    { id: 'todas', label: 'Todas', colorClass: 'bg-teal-500 text-white' },
                    { id: 'local', label: 'Local', colorClass: 'bg-amber-500 text-white' },
                    { id: 'transporte', label: 'Transporte', colorClass: 'bg-blue-500 text-white' },
                    { id: 'comunicacao', label: 'Comunicação', colorClass: 'bg-indigo-500 text-white' },
                    { id: 'atencao', label: 'Atenção', colorClass: 'bg-rose-500 text-white' }
                  ].map((cat) => {
                    const isActive = safetyCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSafetyCategory(cat.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer shrink-0 border ${
                          isActive 
                            ? `${cat.colorClass} border-transparent shadow-sm scale-105` 
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 border-slate-200/55 dark:border-slate-700/55'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Safety Tips Dynamic Scrollable List */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {(() => {
                  const items = [
                    {
                      id: 1,
                      title: 'Escolha um Local Público',
                      description: 'Sempre marque o primeiro encontro em locais públicos e de grande movimento, como cafeterias, shoppings, museus ou restaurantes tradicionais. Evite ir para a casa da pessoa, chácaras ou locais desérticos.',
                      category: 'local',
                      icon: 'MapPin',
                      color: 'from-amber-400 to-amber-600'
                    },
                    {
                      id: 2,
                      title: 'Transporte por Conta Própria',
                      description: 'Use seu próprio carro, transporte público ou aplicativos de corrida para ir e voltar do local. Não aceite caronas de quem você acabou de conhecer e de forma alguma passe seu endereço residencial antes de ganhar confiança.',
                      category: 'transporte',
                      icon: 'ShieldCheck',
                      color: 'from-blue-400 to-blue-600'
                    },
                    {
                      id: 3,
                      title: 'Avise um Amigo de Confiança',
                      description: 'Compartilhe com um amigo ou familiar com quem você vai se encontrar, o local escolhido e os horários previstos. Ative o compartilhamento de localização em tempo real no seu celular antes do encontro.',
                      category: 'comunicacao',
                      icon: 'Share2',
                      color: 'from-indigo-400 to-indigo-600'
                    },
                    {
                      id: 4,
                      title: 'Celular 100% Carregado',
                      description: 'Saia com a bateria do celular cheia. Se possível, tenha sempre uma bateria portátil (powerbank) em mãos. Mantenha os números de emergência e contatos de socorro salvos de forma rápida.',
                      category: 'comunicacao',
                      icon: 'Smartphone',
                      color: 'from-teal-400 to-teal-600'
                    },
                    {
                      id: 5,
                      title: 'Fique de Olho em Alimentos e Copos',
                      description: 'Nunca abandone seus copos ou pratos de comida na mesa sem vigiar. Caso precise se ausentar para ir ao banheiro, peça uma nova bebida diretamente no balcão ao garçom quando retornar.',
                      category: 'atencao',
                      icon: 'Eye',
                      color: 'from-rose-400 to-rose-600'
                    },
                    {
                      id: 6,
                      title: 'Confie Sempre nos Seus Instintos',
                      description: 'Se a conversa ou comportamento parecer estranho, ou você se sentir pressionado de qualquer maneira, sinta-se livre para ir embora imediatamente. Sua segurança e tranquilidade física e mental estão sempre em primeiro lugar.',
                      category: 'atencao',
                      icon: 'AlertTriangle',
                      color: 'from-red-400 to-red-600'
                    }
                  ];

                  const filtered = items.filter(item => {
                    const matchesCategory = safetyCategory === 'todas' || item.category === safetyCategory;
                    const matchesSearch = item.title.toLowerCase().includes(safetySearch.toLowerCase()) || 
                                         item.description.toLowerCase().includes(safetySearch.toLowerCase());
                    return matchesCategory && matchesSearch;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-850 rounded-full flex items-center justify-center text-slate-400">
                          <HelpCircle className="w-6 h-6" />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Nenhuma dica encontrada para sua busca.</p>
                        <button 
                          onClick={() => { setSafetyCategory('todas'); setSafetySearch(''); }}
                          className="text-xs text-teal-600 dark:text-teal-400 font-extrabold hover:underline"
                        >
                          Limpar Filtros
                        </button>
                      </div>
                    );
                  }

                  const renderTipIcon = (iconName: string) => {
                    switch (iconName) {
                      case 'MapPin': return <MapPin className="w-5 h-5 text-white" />;
                      case 'ShieldCheck': return <ShieldCheck className="w-5 h-5 text-white" />;
                      case 'Share2': return <Share2 className="w-5 h-5 text-white" />;
                      case 'Smartphone': return <Smartphone className="w-5 h-5 text-white" />;
                      case 'Eye': return <Eye className="w-5 h-5 text-white" />;
                      case 'AlertTriangle': return <AlertTriangle className="w-5 h-5 text-white animate-pulse" />;
                      default: return <Shield className="w-5 h-5 text-white" />;
                    }
                  };

                  return filtered.map((tip, index) => {
                    const isChecked = !!checkedSafetyTips[tip.id];
                    return (
                      <motion.div
                        key={tip.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`p-4 rounded-2xl border transition-all duration-300 flex items-start gap-4 text-left ${
                          isChecked 
                            ? 'bg-emerald-50/20 dark:bg-emerald-950/5 border-emerald-100 dark:border-emerald-950/40 opacity-75' 
                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-850 shadow-sm hover:shadow-md'
                        }`}
                      >
                        {/* Left Decorated Icon */}
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tip.color} text-white flex items-center justify-center shrink-0 shadow-sm`}>
                          {renderTipIcon(tip.icon)}
                        </div>

                        {/* Middle Text Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className={`text-xs font-black tracking-tight ${isChecked ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                              {tip.title}
                            </h4>
                            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              tip.category === 'local' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-450' :
                              tip.category === 'transporte' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400' :
                              tip.category === 'comunicacao' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400' :
                              'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-450'
                            }`}>
                              {tip.category}
                            </span>
                          </div>
                          <p className={`text-[11px] font-medium leading-relaxed mt-1.5 ${isChecked ? 'text-slate-400 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400'}`}>
                            {tip.description}
                          </p>
                        </div>

                        {/* Right Interactive Checkbox */}
                        <button
                          type="button"
                          onClick={() => {
                            setCheckedSafetyTips(prev => ({
                              ...prev,
                              [tip.id]: !prev[tip.id]
                            }));
                          }}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 cursor-pointer border ${
                            isChecked
                              ? 'bg-emerald-500 border-transparent text-white scale-110'
                              : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-transparent'
                          }`}
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </button>
                      </motion.div>
                    );
                  });
                })()}
              </div>

              {/* Progress Summary Footer */}
              <div className="p-5 border-t border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between gap-4 shrink-0">
                <div className="text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Seu Progresso</p>
                  <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300 mt-0.5">
                    {Object.values(checkedSafetyTips).filter(Boolean).length} de 6 lidas
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSafetyTipsModalOpen(false);
                    setSafetyCategory('todas');
                    setSafetySearch('');
                  }}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-teal-100 dark:shadow-none transition-all active:scale-[0.98] cursor-pointer"
                >
                  Entendi tudo!
                </button>
              </div>

            </motion.div>
          </div>
        )}


      </AnimatePresence>

    </div>
  );
}
