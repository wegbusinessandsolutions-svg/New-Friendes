import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function dataURLtoBlob(dataurl) {
  var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], {type:mime});
}
import { resizeImage } from '../lib/resizeImage';
import React, { useState } from 'react';
import { auth, db, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, collection, addDoc } from 'firebase/firestore';
import { generateUserRegistrationId } from '../utils/userId';
import { getZodiacSignFromDate } from '../utils/zodiac';
import { formatBrazilianPhone } from '../utils/phone';


export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [formData, setFormData] = useState({
    nome: auth.currentUser?.displayName || '',
    apelido: '',
    dataNascimento: '',
    sexo: '',
    genero: '',
    interesse: '',
    receberContatosDe: 'todos',
    altura: '',
    signo: '',
    profissao: '',
    hobbies: '',
    pergunta1: '',
    resposta1: '',
    pergunta2: '',
    resposta2: '',
    esportes: '',
    bebidas: '',
    fumante: '',
    pet: '',
    cor: '',
    estadoCivil: '',
    telefone: '',
    bio: '',
    objetivo: 'casual',
    estadoNascimento: '',
    cidadeNascimento: '',
    fotoPrincipalUrl: auth.currentUser?.photoURL || `https://api.dicebear.com/9.x/notionists/svg?seed=${auth.currentUser?.uid}`
  });
  const [loading, setLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [pendingFotoPrincipal, setPendingFotoPrincipal] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);

  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn("Geolocation error in onboarding:", error);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
      );
    }
  }, []);

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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatBrazilianPhone(e.target.value);
    setFormData({...formData, telefone: formatted});
  };

  const currentZodiac = getZodiacSignFromDate(formData.dataNascimento);

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
    
    const autoZodiac = getZodiacSignFromDate(value);
    setFormData(prev => ({
      ...prev,
      dataNascimento: value,
      signo: autoZodiac ? `${autoZodiac.name} ${autoZodiac.symbol}` : prev.signo
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !auth.currentUser) return;
    const file = e.target.files[0];
    
    if (!file.type.startsWith('image/')) {
      alert("Por favor, selecione uma imagem válida.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPendingFotoPrincipal(file);
    setFormData({ ...formData, fotoPrincipalUrl: previewUrl });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || loading || isUploadingImage) return;
    
    setLoading(true);
    setErrorMsg('');

    // Validate date format DD-MM-AAAA
    if (!/^\d{2}-\d{2}-\d{4}$/.test(formData.dataNascimento)) {
      setErrorMsg('Por favor, informe a data de nascimento completa: primeiro o dia, depois o mês e depois o ano (ex: 25-12-1998).');
      setLoading(false);
      return;
    }

    const age = calculateAge(formData.dataNascimento);
    if (age <= 0) {
      setErrorMsg('Data de nascimento inválida. Por favor, verifique se inseriu uma data correta.');
      setLoading(false);
      return;
    }
    if (age < 18) {
      setErrorMsg('Você deve ter pelo menos 18 anos de idade para usar este aplicativo.');
      setLoading(false);
      return;
    }
    if (age > 120) {
      setErrorMsg('Por favor, informe uma data de nascimento válida.');
      setLoading(false);
      return;
    }

    try {
      let finalFotoPrincipalUrl = formData.fotoPrincipalUrl;

      if (pendingFotoPrincipal) {
        setIsUploadingImage(true);
        const resizedDataUrl = await resizeImage(pendingFotoPrincipal);
        try {
          const blob = dataURLtoBlob(resizedDataUrl);
          const fileRef = ref(storage, `profiles/${auth.currentUser.uid}/${Date.now()}_principal.jpg`);
          await Promise.race([uploadBytes(fileRef, blob), new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_UPLOAD")), 8000))]);
          finalFotoPrincipalUrl = (await Promise.race([getDownloadURL(fileRef), new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_UPLOAD")), 5000))])) as string;
        } catch (uploadErr) {
          console.warn("Storage upload failed, falling back to base64 data URL", uploadErr);
          finalFotoPrincipalUrl = resizedDataUrl;
        }
      }

      let shouldVerify = false;
      try {
        const configDoc = await Promise.race([getDoc(doc(db, "settings", "app_config")), new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 3000))]) as any;
        if (configDoc.exists() && configDoc.data().autoVerifyNewUsers) {
          shouldVerify = true;
        }
      } catch (e) {
        console.error("Error reading autoVerifyNewUsers setting:", e);
      }

      const userRef = doc(db, 'users', auth.currentUser.uid);
      let userRegistrationId = sessionStorage.getItem('temp_user_reg_id');
      try {
        const existingDocSnap = await getDoc(userRef);
        if (existingDocSnap.exists()) {
          const docData = existingDocSnap.data();
          if (docData.codigoUsuario || docData.idNumerico) {
            userRegistrationId = docData.codigoUsuario || docData.idNumerico;
          }
        }
      } catch (errSnap) {
        console.error("Error reading existing user ID in Onboarding:", errSnap);
      }
      if (!userRegistrationId) {
        userRegistrationId = generateUserRegistrationId();
      }

      const initialProfile = {
        codigoUsuario: userRegistrationId,
        idNumerico: userRegistrationId,
        profile: {
          codigoUsuario: userRegistrationId,
          idNumerico: userRegistrationId,
          nome: formData.nome,
          apelido: formData.apelido,
          dataNascimento: formData.dataNascimento,
          idade: calculateAge(formData.dataNascimento),
          sexo: formData.sexo,
          genero: formData.genero,
          interesse: formData.interesse,
          receberContatosDe: formData.receberContatosDe || 'todos',
          altura: formData.altura,
          signo: formData.signo,
          profissao: formData.profissao,
          hobbies: formData.hobbies
            ? formData.hobbies.split(',').map((s: string) => s.trim()).filter(Boolean)
            : [],
          pergunta1: formData.pergunta1 || "Um fato divertido sobre mim é...",
          resposta1: formData.resposta1,
          pergunta2: formData.pergunta2 || "Eu passo a maior parte do meu tempo...",
          resposta2: formData.resposta2,
          prompts: [
            { title: formData.pergunta1 || "Um fato divertido sobre mim é...", desc: formData.resposta1 || "" },
            { title: formData.pergunta2 || "Eu passo a maior parte do meu tempo...", desc: formData.resposta2 || "" }
          ],
          esportes: formData.esportes,
          bebidas: formData.bebidas,
          fumante: formData.fumante,
          pet: formData.pet,
          cor: formData.cor,
          estadoCivil: formData.estadoCivil,
          telefone: formData.telefone,
          bio: formData.bio,
          objetivo: formData.objetivo,
          estadoNascimento: formData.estadoNascimento,
          cidadeNascimento: formData.cidadeNascimento,
          fotoPrincipalUrl: finalFotoPrincipalUrl,
          email: auth.currentUser.email,
          fotosAdicionais: [],
          verified: shouldVerify
        },
        status: {
          ativo: true,
          banido: false,
          verificadoIdade: true, // simplified for MVP
        },
        createdAt: serverTimestamp(),
      };
      
      const setDocPromise = setDoc(userRef, initialProfile, { merge: true }); await Promise.race([setDocPromise, new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_SAVING")), 5000))]);
      
      // Initialize a location record so they show up on search results/discover/matches instantly
      try {
        const { geohashForLocation } = await import('geofire-common');
        const finalLat = coords ? coords.lat : -23.55052;
        const finalLng = coords ? coords.lng : -46.633308;
        const hash = geohashForLocation([finalLat, finalLng]);

        await setDoc(doc(db, 'locations', auth.currentUser.uid), {
          geohash: hash,
          lat: finalLat,
          lng: finalLng,
          atualizadoEm: Date.now(),
          status: 'online',
          visivel: true
        }, { merge: true });

        // Record coordinates update to history subcollection
        await addDoc(collection(db, 'locations', auth.currentUser.uid, 'history'), {
          tipo: 'onboarding_coordenadas',
          lat: finalLat,
          lng: finalLng,
          timestamp: Date.now()
        }).catch(err => console.error("Error creating location history: ", err));
      } catch (locErr) {
        console.error("Error initializing onboarding location document:", locErr);
      }

      try {
        localStorage.setItem(`user_profile_cache_${auth.currentUser.uid}`, JSON.stringify({
          ...initialProfile,
          nome: formData.nome,
          apelido: formData.apelido,
          idVerified: false,
          verified: shouldVerify
        }));
      } catch (cacheErr) {
        console.error("Error setting onboarding cache:", cacheErr);
      }
      setShowSuccess(true);
    } catch (err: any) {
      console.error('Error during onboarding:', err);
      if (err.message === 'TIMEOUT_SAVING' || err.message === 'TIMEOUT_UPLOAD') {
        setErrorMsg('Conexão fraca com o servidor. Tente novamente em alguns instantes.');
      } else {
        try {
          handleFirestoreError(err, OperationType.CREATE, 'users');
        } catch (wrappedErr: any) {
          setErrorMsg(wrappedErr.message || 'Erro ao realizar o onboarding');
        }
      }
    } finally {
      setIsUploadingImage(false);
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 p-6 font-sans text-slate-800 items-center justify-center text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-sm border border-green-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4 leading-tight">Cadastro Concluído!</h2>
        <p className="text-slate-600 text-sm font-medium leading-relaxed max-w-sm mb-8">
          Você terminou o seu cadastro, e para habilitar o uso do aplicativo, confirme o seu endereço de e-mail, clicando no link que foi enviado ao e-mail informado no início do cadastramento do usuário.
        </p>
        <button 
          onClick={onComplete}
          className="w-full max-w-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl py-4 shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all"
        >
          Ir para o Aplicativo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="mb-8">
        <div className="flex gap-2 mb-6">
          <div className="h-1 w-12 bg-indigo-600 rounded-full"></div>
          <div className="h-1 w-12 bg-slate-200 rounded-full"></div>
          <div className="h-1 w-12 bg-slate-200 rounded-full"></div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2 leading-tight">Complete seu Perfil</h2>
        <p className="text-slate-600 text-sm font-medium leading-relaxed bg-indigo-50 border border-indigo-100 rounded-xl p-3 shadow-sm">
          Complete as informações do seu perfil para usufruir de todas os benefícios do nosso aplicativo.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col space-y-5 flex-1">
        
        <div className="space-y-1.5 flex flex-col items-center">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Foto Principal</label>
          <div className="relative">
            <img src={formData.fotoPrincipalUrl} alt="Sua Foto" className="w-24 h-24 rounded-full object-cover border-4 border-indigo-100 shadow-sm" />
            {currentZodiac && (
              <div 
                className="absolute -top-1.5 -right-3 bg-slate-900/90 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-400/40 shadow-md flex items-center gap-1 animate-scale-in select-none backdrop-blur-xs z-10"
                title={`Signo: ${currentZodiac.name}`}
              >
                <span className="text-xs">{currentZodiac.symbol}</span>
                <span className="text-white font-bold">{currentZodiac.name}</span>
              </div>
            )}
            <label className="absolute bottom-0 right-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-2 cursor-pointer shadow-md transition-colors z-10">
              {isUploadingImage ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Nome Completo</label>
          <input required type="text" placeholder="Seu nome completo" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Data de Nascimento</label>
                <input 
                  required 
                  type="text" 
                  maxLength={10}
                  placeholder="Dia-Mês-Ano" 
                  value={formData.dataNascimento} 
                  onChange={handleDateChange} 
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900" 
                />
              </div>
              <div className="w-20 space-y-1.5 shrink-0">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Idade</label>
                <input 
                  type="text" 
                  readOnly
                  placeholder="--"
                  value={formData.dataNascimento.length === 10 && calculateAge(formData.dataNascimento) > 0 ? calculateAge(formData.dataNascimento) : ''} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed font-medium text-center"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Apelido</label>
            <input required type="text" placeholder="@apelido" value={formData.apelido} onChange={e => setFormData({...formData, apelido: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Identidade de Gênero</label>
            <select required value={formData.genero} onChange={e => setFormData({...formData, genero: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 appearance-none">
              <option value="" disabled>Selecione</option>
              <option value="mulher_cis">Mulher Cisgênero</option>
              <option value="homem_cis">Homem Cisgênero</option>
              <option value="mulher_trans">Mulher Transgênero</option>
              <option value="homem_trans">Homem Transgênero</option>
              <option value="nao_binario">Não-binário</option>
              <option value="outro">Outro / Prefiro não dizer</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Seu Interesse</label>
            <select required value={formData.interesse} onChange={e => setFormData({...formData, interesse: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 appearance-none">
              <option value="" disabled>Selecione</option>
              <option value="masculino">Homens</option>
              <option value="feminino">Mulheres</option>
              <option value="todos">Todos (Homens e Mulheres)</option>
            </select>
          </div>
        </div>

        {/* Quero receber contatos, apenas de */}
        <div className="space-y-2 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100">
          <label className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Quero receber contatos, apenas de:
          </label>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
            Defina de quem você aceita receber interações e mensagens. Esta opção poderá ser alterada a qualquer momento no seu perfil.
          </p>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { id: 'mulheres', label: 'Mulheres' },
              { id: 'homens', label: 'Homens' },
              { id: 'todos', label: 'Não Faço Distinção' }
            ].map((opt) => (
              <button
                type="button"
                key={opt.id}
                onClick={() => setFormData({ ...formData, receberContatosDe: opt.id })}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all text-center border cursor-pointer ${
                  formData.receberContatosDe === opt.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100 ring-2 ring-indigo-200'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Sexo Biológico</label>
            <select required value={formData.sexo} onChange={e => setFormData({...formData, sexo: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 appearance-none">
              <option value="" disabled>Selecione</option>
              <option value="masculino">Masculino</option>
              <option value="feminino">Feminino</option>
              <option value="outro">Outro / Prefiro não dizer</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Cor</label>
            <select required value={formData.cor} onChange={e => setFormData({...formData, cor: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 appearance-none">
              <option value="" disabled>Selecione</option>
              <option value="branca">Branca</option>
              <option value="preta">Preta</option>
              <option value="parda">Parda</option>
              <option value="amarela">Amarela</option>
              <option value="indigena">Indígena</option>
              <option value="outro">Prefiro não dizer</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Estado Civil</label>
            <select required value={formData.estadoCivil} onChange={e => setFormData({...formData, estadoCivil: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 appearance-none">
              <option value="" disabled>Selecione</option>
              <option value="solteiro">Solteiro(a)</option>
              <option value="casado">Casado(a)</option>
              <option value="divorciado">Divorciado(a)</option>
              <option value="viuvo">Viúvo(a)</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">N. Telefone com DDD</label>
            <input required type="tel" placeholder="(11) 99999-9999" value={formData.telefone} onChange={handlePhoneChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Estado (Nasc.)</label>
            <select required value={formData.estadoNascimento} onChange={e => setFormData({...formData, estadoNascimento: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 appearance-none">
              <option value="" disabled>Selecione</option>
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
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Cidade (Nasc.)</label>
            <input required type="text" placeholder="Sua cidade" value={formData.cidadeNascimento} onChange={e => setFormData({...formData, cidadeNascimento: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Altura (m)</label>
            <input required type="number" step="0.01" placeholder="Ex: 1.75" value={formData.altura} onChange={e => setFormData({...formData, altura: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Signo</label>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                Automático
              </span>
            </div>
            {currentZodiac ? (
              <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-slate-900 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none text-amber-500 font-black">{currentZodiac.symbol}</span>
                  <div>
                    <span className="text-xs font-extrabold text-slate-800 block leading-tight">{currentZodiac.name}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-xl px-3.5 py-3 text-xs text-slate-400 italic">
                Definido pela data de nascimento
              </div>
            )}
            <input type="hidden" name="signo" value={formData.signo || (currentZodiac ? `${currentZodiac.name} ${currentZodiac.symbol}` : '')} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Profissão</label>
          <input required type="text" placeholder="Ex: Engenheiro(a) de Software" value={formData.profissao} onChange={e => setFormData({...formData, profissao: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Meus Interesses / Hobbies</label>
          <input required type="text" placeholder="Ex: Música, Viagens, Cinema..." value={formData.hobbies} onChange={e => setFormData({...formData, hobbies: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Pergunta 1: Um fato divertido sobre mim é...</label>
          <input type="text" placeholder="Sua resposta" value={formData.resposta1} onChange={e => setFormData({...formData, resposta1: e.target.value, pergunta1: 'Um fato divertido sobre mim é...'})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Pergunta 2: Eu passo a maior parte do meu tempo...</label>
          <input type="text" placeholder="Sua resposta" value={formData.resposta2} onChange={e => setFormData({...formData, resposta2: e.target.value, pergunta2: 'Eu passo a maior parte do meu tempo...'})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900" />
        </div>

        <h3 className="text-sm font-bold text-slate-900 mt-4 mb-2">Estilo de Vida</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Esportes</label>
            <select required value={formData.esportes} onChange={e => setFormData({...formData, esportes: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 appearance-none">
              <option value="" disabled>Selecione</option>
              <option value="frequente">Pratico frequentemente</option>
              <option value="ocasional">Ocasionalmente</option>
              <option value="raramente">Raramente</option>
              <option value="nunca">Não pratico</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Bebidas</label>
            <select required value={formData.bebidas} onChange={e => setFormData({...formData, bebidas: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 appearance-none">
              <option value="" disabled>Selecione</option>
              <option value="socialmente">Socialmente</option>
              <option value="frequentemente">Frequentemente</option>
              <option value="raramente">Raramente</option>
              <option value="nunca">Não bebo</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Fumante</label>
            <select required value={formData.fumante} onChange={e => setFormData({...formData, fumante: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 appearance-none">
              <option value="" disabled>Selecione</option>
              <option value="sim">Sim</option>
              <option value="socialmente">Socialmente</option>
              <option value="nao">Não</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Pet Favorito</label>
            <select required value={formData.pet} onChange={e => setFormData({...formData, pet: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 appearance-none">
              <option value="" disabled>Selecione</option>
              <option value="cachorro">Cachorro</option>
              <option value="gato">Gato</option>
              <option value="outros">Outros</option>
              <option value="nenhum">Nenhum</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">E-mail</label>
          <input type="email" value={auth.currentUser?.email || ''} readOnly className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none text-slate-500 cursor-not-allowed" />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Bio</label>
          <textarea required rows={3} value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all text-slate-900" placeholder="Conte um pouco sobre você..."></textarea>
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Objetivo no app</label>
          <select value={formData.objetivo} onChange={e => setFormData({...formData, objetivo: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 appearance-none">
            <option value="casual">Encontros casuais</option>
            <option value="serio">Relacionamento sério</option>
            <option value="amizade">Novas amizades</option>
            <option value="no_momento">No momento</option>
          </select>
        </div>
        
        <div className="mt-auto pt-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 break-words">
              {errorMsg}
            </div>
          )}
          <button disabled={loading} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl py-4 shadow-lg shadow-indigo-200 active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading ? 'Salvando...' : 'Cadastrar Agora'}
            {!loading && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
