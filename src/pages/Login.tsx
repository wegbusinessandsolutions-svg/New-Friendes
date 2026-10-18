import React, { useState, useEffect, useRef } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { Camera, X, Shield, ShieldCheck, AlertCircle, Check, KeyRound, Sparkles, Smartphone, Mail, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateUserRegistrationId } from '../utils/userId';
import { openWhatsApp } from '../utils/whatsapp';
import FaceLoginModal from '../components/FaceLoginModal';

export default function Login() {
  const [isRegister, setIsRegister] = useState(true);
  const [authMethod, setAuthMode] = useState<'password' | 'facial'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authErrorCode, setAuthErrorCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Facial Recognition Login States
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [foundUserData, setFoundUserData] = useState<any>(null);
  const [foundStoredFace, setFoundStoredFace] = useState<string>('');
  
  // Forgot Password states
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetMethod, setResetMethod] = useState<'email' | 'phone'>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetPhone, setResetPhone] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resetMessage, setResetMessage] = useState('');

  useEffect(() => {
    const fetchRegSettings = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        const configDoc = await getDoc(doc(db, 'settings', 'app_config'));
        if (configDoc.exists() && configDoc.data().registrationEnabled !== undefined) {
          setRegistrationEnabled(configDoc.data().registrationEnabled);
        }
      } catch (err) {
        console.error("Error reading registration setting:", err);
      }
    };
    fetchRegSettings();
  }, []);

  const handleRequestFaceLogin = async () => {
    setError('');
    if (!email.trim()) {
      setError('Por favor, informe seu e-mail cadastrado para solicitar o login com reconhecimento facial.');
      return;
    }

    setLoading(true);
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');

      const trimmedEmail = email.trim().toLowerCase();
      const q = query(collection(db, 'users'), where('email', '==', trimmedEmail));
      let snap = await getDocs(q);

      if (snap.empty && trimmedEmail !== email.trim()) {
        const qOriginal = query(collection(db, 'users'), where('email', '==', email.trim()));
        snap = await getDocs(qOriginal);
      }

      if (snap.empty) {
        setError('Nenhum usuário encontrado com este e-mail no New Friends.br. Verifique o endereço digitado ou crie uma conta.');
        setLoading(false);
        return;
      }

      const userDoc = snap.docs[0];
      const uData = userDoc.data();

      const storedFace =
        uData.facialVerificationData?.imageUrl ||
        uData.profile?.fotoPrincipalUrl ||
        uData.fotoPrincipalUrl;

      if (!storedFace) {
        setError('Este usuário ainda não possui fotos ou características faciais salvas no banco de dados. Entre com sua senha para realizar a verificação facial com selfie no seu perfil.');
        setLoading(false);
        return;
      }

      setFoundUserData(uData);
      setFoundStoredFace(storedFace);
      setIsFaceModalOpen(true);
    } catch (err: any) {
      console.error('Erro ao consultar cadastro para login facial:', err);
      setError('Erro ao consultar o banco de dados. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleFaceLoginSuccess = async (linkedPassword?: string) => {
    if (!linkedPassword) {
      throw new Error('Senha não fornecida.');
    }
    sessionStorage.setItem('just_logged_in', 'true');
    await signInWithEmailAndPassword(auth, email.trim(), linkedPassword);
    setIsFaceModalOpen(false);
  };

  const handleStartFaceLogin = async () => {
    setAuthMode('facial');
    if (email.trim()) {
      handleRequestFaceLogin();
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const rawInput = email.trim().toLowerCase();
    const resolvedEmail = (rawInput === 'admin') ? 'ceo@wegbusiness.com' : email.trim();
    const isAdminEmail = resolvedEmail === 'ceo@wegbusiness.com' || resolvedEmail === 'wegbusinessandsolutions@gmail.com' || resolvedEmail === 'sac@wegbusiness.com' || resolvedEmail === 'ceo@newfriends.com';

    // Verify registration enabled block
    if (isRegister && !registrationEnabled && !isAdminEmail) {
      setError('Os cadastros de novos usuários estão temporariamente desativados pelo administrador.');
      setLoading(false);
      return;
    }

    // Special handler for Admin (admin or ceo@wegbusiness.com)
    if (isAdminEmail && (rawInput === 'admin' || password === '02210839')) {
      try {
        sessionStorage.setItem('just_logged_in', 'true');
        await signInWithEmailAndPassword(auth, resolvedEmail, password);
      } catch (loginErr: any) {
        try {
          sessionStorage.setItem('just_logged_in', 'true');
          const adminCred = await createUserWithEmailAndPassword(auth, resolvedEmail, password);
          const adminRegId = generateUserRegistrationId();
          const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
          await setDoc(doc(db, 'users', adminCred.user.uid), {
            codigoUsuario: adminRegId,
            idNumerico: adminRegId,
            email: resolvedEmail,
            role: 'Admin',
            nome: 'Administrador (Admin)',
            apelido: 'admin',
            telefone: '(62) 998160501',
            criadoEm: Date.now(),
            createdAt: serverTimestamp(),
            verified: true,
            profile: {
              codigoUsuario: adminRegId,
              idNumerico: adminRegId,
              nome: 'Administrador (Admin)',
              apelido: 'admin',
              telefone: '(62) 998160501',
              email: resolvedEmail,
              statusBolinha: 'disponivel',
              verified: true
            }
          }, { merge: true });
        } catch (createErr: any) {
          setError('Erro de autenticação para o usuário administrador. Verifique suas credenciais.');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      if (isRegister) {
        if (!acceptedTerms) {
          setError('Você deve aceitar os Termos de Uso para se cadastrar.');
          setLoading(false);
          return;
        }
        auth.languageCode = 'pt';
        sessionStorage.setItem('just_logged_in', 'true');
        const userCredential = await createUserWithEmailAndPassword(auth, resolvedEmail, password);
        
        // Regra do ID do Usuário: Data(DDMMAA) + Hora(HHMMSS)
        const userRegId = generateUserRegistrationId();
        sessionStorage.setItem('temp_user_reg_id', userRegId);
        try {
          const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
          // Classificar todos os cadastros normais estritamente como 'Usuário'
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            codigoUsuario: userRegId,
            idNumerico: userRegId,
            email: resolvedEmail,
            role: 'Usuário',
            criadoEm: Date.now(),
            createdAt: serverTimestamp()
          }, { merge: true });
        } catch (dbErr) {
          console.error("Erro ao salvar ID de registro do usuário:", dbErr);
        }

        try {
          await sendEmailVerification(userCredential.user);
        } catch (emailErr) {
          console.warn("Aviso ao disparar e-mail de confirmação pelo Firebase:", emailErr);
        }
      } else {
        sessionStorage.setItem('just_logged_in', 'true');
        await signInWithEmailAndPassword(auth, resolvedEmail, password);
      }
    } catch (err: any) {
       sessionStorage.removeItem('just_logged_in');
       if (err.code === 'auth/email-already-in-use') {
         setError('Este e-mail já está cadastrado no App.');
         setAuthErrorCode('email-already-in-use');
       } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
         setError('E-mail, usuário ou senha incorretos. Verifique suas credenciais e tente novamente.');
         setAuthErrorCode(err.code || 'invalid-credential');
       } else if (err.code === 'auth/invalid-email') {
         setError('O formato do e-mail inserido é inválido.');
         setAuthErrorCode('invalid-email');
       } else if (err.code === 'auth/weak-password') {
         setError('A senha deve conter no mínimo 6 caracteres.');
         setAuthErrorCode('weak-password');
       } else {
         setError(err.message || 'Erro de autenticação');
         setAuthErrorCode(err.code || 'unknown');
       }
    } finally {
       setLoading(false);
    }
  };

  const handlePasswordReset = async (e?: React.FormEvent, forceMethod?: 'email' | 'phone') => {
    if (e) e.preventDefault();
    
    const activeMethod = forceMethod || resetMethod;
    let target = resetEmail.trim().toLowerCase();
    if (target === 'admin') {
      target = 'ceo@wegbusiness.com';
    }

    const cleanPhone = resetPhone.replace(/\D/g, '');
    const isAdminTarget = target === 'ceo@wegbusiness.com' || cleanPhone === '62998160501' || resetEmail.trim().toLowerCase() === 'admin';

    if (activeMethod === 'phone' || isAdminTarget && forceMethod === 'phone') {
      setResetStatus('loading');
      setResetMessage('');
      
      // Admin phone recovery
      if (isAdminTarget) {
        try {
          auth.languageCode = 'pt';
          await sendPasswordResetEmail(auth, 'ceo@wegbusiness.com');
        } catch (err) {
          console.warn("Notice sending email:", err);
        }
        
        openWhatsApp(
          '5562998160501',
          'Olá! Sou o Administrador do Novos Amigos (admin / ceo@wegbusiness.com) e estou solicitando a redefinição de senha para o meu acesso administrativo.'
        );
        setResetStatus('success');
        setResetMessage('Pronto! O link oficial de recuperação foi enviado para o e-mail ceo@wegbusiness.com e o canal do WhatsApp no celular (62) 99816-0501 foi aberto para confirmação imediata.');
        return;
      }

      // Regular user phone recovery
      if (!cleanPhone) {
        setResetStatus('error');
        setResetMessage('Por favor, informe seu número de celular com DDD.');
        return;
      }

      openWhatsApp(
        '5562998160501',
        `Olá! Preciso de ajuda para recuperar minha senha no www.novosamigos.com.br. Meu telefone é ${resetPhone}.`
      );
      setResetStatus('success');
      setResetMessage('Abrimos o canal de suporte via WhatsApp oficial no celular (62) 99816-0501 para ajudar na recuperação da sua conta.');
      return;
    }

    if (!target) {
      setResetStatus('error');
      setResetMessage('Por favor, preencha o e-mail ou o usuário.');
      return;
    }
    
    setResetStatus('loading');
    setResetMessage('');
    
    try {
      auth.languageCode = 'pt';
      await sendPasswordResetEmail(auth, target);
      setResetStatus('success');
      setResetMessage(
        target === 'ceo@wegbusiness.com'
          ? 'Link de recuperação enviado com sucesso para ceo@wegbusiness.com! Verifique sua caixa de entrada e pasta de spam. Você também pode confirmar via celular no número (62) 998160501.'
          : 'Pronto! Acabamos de enviar um e-mail com as instruções e o link para redefinir sua senha. Este link expira em 1 hora. Caso não o utilize, sua senha atual será mantida. Verifique sua caixa de entrada e a pasta de spam.'
      );
    } catch (err: any) {
      console.error(err);
      setResetStatus('error');
      setResetMessage(err.message || 'Erro ao enviar e-mail de recuperação. Tente novamente mais tarde.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-6 font-sans text-slate-800">
      <div className="flex flex-col max-w-sm w-full bg-white p-8 sm:p-10 rounded-2xl shadow-xl border border-slate-100 relative overflow-hidden">
        
        {/* Background elements to match theme vibe */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-50 rounded-full opacity-50"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-50 rounded-full opacity-50"></div>

        {/* App Logomarca & Identity */}
        <div className="relative z-10 flex items-center gap-3.5 mb-6">
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-slate-100 p-1 shrink-0 overflow-hidden">
            <img 
              src="/nfriends.png" 
              alt="Logomarca Novos Amigos" 
              className="w-full h-full object-contain rounded-xl"
            />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-indigo-600 flex items-center font-friendly">
              <span><span className="text-emerald-500 font-medium">www.</span><span className="font-medium">novosamigos</span><span className="text-emerald-500 font-medium">.com.br</span></span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Conexões por Proximidade
            </p>
          </div>
        </div>
        
        <div className="relative z-10 space-y-2 mb-8">
          <div className="flex gap-2 mb-4">
            <div className="h-1 w-12 bg-indigo-600 rounded-full"></div>
            <div className="h-1 w-12 bg-slate-200 rounded-full"></div>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center justify-start gap-1">
            {isRegister ? 'Crie sua conta' : (
              <span>Acesse o <span className="text-emerald-500 font-medium">www.</span>novosamigos<span className="text-emerald-500 font-medium">.com.br</span></span>
            )}
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            {isRegister 
               ? 'Preencha seu e-mail e senha para iniciar sua jornada.' 
               : 'Conecte-se com pessoas próximas a você e construa conexões reais.'}
          </p>
        </div>

        {error && (
          <div className="relative z-10 mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 break-words flex flex-col gap-2">
            <span>{error}</span>
            {authErrorCode === 'email-already-in-use' && (
              <button 
                type="button" 
                onClick={() => {
                  setResetEmail(email);
                  setIsForgotPasswordOpen(true);
                  setError('');
                }}
                className="text-indigo-600 font-bold self-start hover:underline inline-flex items-center gap-1 mt-1"
              >
                <KeyRound className="w-3.5 h-3.5" /> Recuperar senha desta conta
              </button>
            )}
          </div>
        )}
        
        {/* Toggle Login Mode (Senha vs Reconhecimento Facial) */}
        {!isRegister && (
          <div className="relative z-10 flex bg-slate-100 p-1 rounded-xl mb-5 text-xs font-extrabold border border-slate-200/60">
            <button
              type="button"
              onClick={() => { setAuthMode('password'); setError(''); }}
              className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                authMethod === 'password'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Login com Senha</span>
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('facial'); setError(''); }}
              className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                authMethod === 'facial'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-emerald-600" />
              <span>Login Facial</span>
            </button>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="relative z-10 space-y-5">
          {/* E-mail field (always available in both modes) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1 flex items-center justify-between">
              <span>E-mail</span>
              {!isRegister && authMethod === 'facial' && (
                <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Biometria
                </span>
              )}
            </label>
            <input 
              required 
              type={isRegister ? "email" : "text"} 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder={isRegister ? "seu@email.com" : "seu@email.com ou admin"} 
              className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all text-slate-900 ${
                !isRegister && authMethod === 'facial' ? 'focus:ring-emerald-500' : 'focus:ring-indigo-500'
              }`} 
            />
            {!isRegister && authMethod === 'facial' && (
              <p className="text-[11px] text-slate-400 leading-tight">
                Digite o e-mail da sua conta. Ao solicitar o login, apresente seu rosto na câmera para certificação biométrica contra o banco de dados.
              </p>
            )}
          </div>

          {/* Senha field (only in registration or password login mode) */}
          {(isRegister || authMethod === 'password') && (
            <div className="space-y-1.5 flex flex-col">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Senha</label>
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={6} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900" />
              {!isRegister && (
                <button 
                  type="button" 
                  onClick={() => {
                    setResetEmail(email);
                    setIsForgotPasswordOpen(true);
                    setError('');
                  }}
                  className="text-indigo-600 text-[11px] font-bold self-end mt-1.5 hover:underline"
                >
                  Esqueceu a senha?
                </button>
              )}
            </div>
          )}

          {isRegister && (
            <div className="flex items-start gap-3 py-2">
              <input 
                required 
                type="checkbox" 
                checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)}
                className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
              />
              <label className="text-xs text-slate-500 leading-tight">
                Eu concordo com os <span onClick={() => setIsTermsOpen(true)} className="text-indigo-600 font-semibold cursor-pointer hover:underline">Termos de Uso</span> e confirmo que receberei um link de ativação por e-mail.
              </label>
            </div>
          )}

          {/* Action buttons based on current mode */}
          {!isRegister && authMethod === 'facial' ? (
            <button 
              type="button"
              disabled={loading}
              onClick={handleRequestFaceLogin}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3.5 px-4 rounded-xl font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-white" />
              <span>{loading ? 'Consultando Cadastro...' : 'Solicitar Login (Apresentar Rosto)'}</span>
            </button>
          ) : (
            <button 
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 px-4 rounded-xl font-bold shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Carregando...' : (isRegister ? 'Cadastrar Agora' : 'Entrar')}
              {!loading && isRegister && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              )}
            </button>
          )}

          {!isRegister && authMethod === 'password' && (
            <button 
              type="button"
              onClick={() => { setAuthMode('facial'); setError(''); }}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white py-3.5 px-4 rounded-xl font-bold shadow-md active:scale-[0.98] transition-all mt-3 border border-emerald-600 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-white" />
              <span>Entrar com Reconhecimento Facial</span>
            </button>
          )}
        </form>

        <div className="relative z-10 mt-8 text-center">
          <p className="text-sm text-slate-500">
            {isRegister ? 'Já possui uma conta?' : 'Não possui conta?'} 
            <button 
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-indigo-600 font-bold ml-1 hover:underline"
            >
              {isRegister ? 'Entrar' : 'Cadastrar'}
            </button>
          </p>
        </div>
      </div>

      {/* Face Scanning Modal Overlay */}
      <AnimatePresence>
        {isTermsOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-100 overflow-hidden flex flex-col relative my-8 max-h-[80vh]"
            >
              {/* Header */}
              <div className="bg-slate-50 border-b border-slate-100 p-4 sm:p-6 flex items-start justify-between shrink-0">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800">Termos e Condições de Uso</h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">Última atualização: Julho de 2026</p>
                </div>
                <button 
                  onClick={() => setIsTermsOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 rounded-full transition-colors border border-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-sm text-slate-600 space-y-6">
                <section>
                  <p className="leading-relaxed">
                    Estes Termos de Uso regulam o relacionamento entre você (Usuário) e o aplicativo de 
                    relacionamentos <strong>New Friends.Br</strong>, desenvolvido, operado e de propriedade da 
                    <strong> W.E.G. Business and Solutions - Br</strong>, pessoa jurídica de direito privado, inscrita 
                    nos órgãos competentes sob os números oficiais.
                  </p>
                </section>

                <section>
                  <h3 className="text-base font-bold text-slate-800 mb-2">1. Aceitação dos Termos</h3>
                  <p className="leading-relaxed">
                    Ao baixar, instalar ou utilizar o aplicativo New Friends.Br, você concorda expressamente com todas as 
                    disposições destes Termos de Uso e com a nossa Política de Privacidade. Se você não concordar com alguma 
                    destas condições, não deve utilizar os nossos serviços.
                  </p>
                </section>

                <section>
                  <h3 className="text-base font-bold text-slate-800 mb-2">2. Elegibilidade</h3>
                  <p className="leading-relaxed">
                    O uso do New Friends.Br é restrito a pessoas maiores de 18 (dezoito) anos, civilmente capazes. Ao utilizar 
                    o aplicativo, você declara e garante que possui a idade mínima exigida.
                  </p>
                </section>

                <section>
                  <h3 className="text-base font-bold text-slate-800 mb-2">3. Conduta do Usuário</h3>
                  <p className="leading-relaxed mb-2">
                    O New Friends.Br é uma plataforma destinada exclusivamente para interação pessoal, amizade e relacionamentos. 
                    O usuário compromete-se a:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 marker:text-indigo-600">
                    <li>Não utilizar o aplicativo para fins ilícitos, fraudulentos ou maliciosos.</li>
                    <li>Não enviar conteúdos ofensivos, de ódio, difamatórios, de cunho sexual não consensual ou que violem direitos de terceiros.</li>
                    <li>Não se passar por outra pessoa ou fornecer informações falsas.</li>
                    <li>Não utilizar o aplicativo para enviar spam ou propagandas não solicitadas.</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-base font-bold text-slate-800 mb-2">4. Isenção de Responsabilidade da W.E.G. Business and Solutions - Br</h3>
                  <p className="leading-relaxed mb-2">
                    O uso do New Friends.Br é feito por conta e risco do usuário. A W.E.G. Business and Solutions - Br 
                    <strong> isenta-se de qualquer responsabilidade</strong>, na máxima extensão permitida pela legislação aplicável, sobre:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 marker:text-indigo-600">
                    <li><strong>Conduta dos Usuários:</strong> A empresa não realiza verificações de antecedentes criminais dos usuários. Portanto, não se responsabiliza por atos, condutas, danos, fraudes, assédio, encontros presenciais ou quaisquer crimes ocorridos entre os usuários, seja no ambiente virtual ou no mundo físico.</li>
                    <li><strong>Exatidão de Informações:</strong> A empresa não garante a veracidade, exatidão ou precisão dos perfis, fotos e dados fornecidos pelos próprios usuários.</li>
                    <li><strong>Disponibilidade do Sistema:</strong> O aplicativo é fornecido "no estado em que se encontra". A empresa não garante que o serviço será ininterrupto, seguro ou livre de erros, vírus ou falhas técnicas.</li>
                    <li><strong>Perda de Dados e Danos Indiretos:</strong> A empresa não será responsável por quaisquer danos diretos, indiretos, emergentes, punitivos ou lucros cessantes decorrentes do uso ou da impossibilidade de uso do aplicativo.</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-base font-bold text-slate-800 mb-2">5. Links e Serviços de Terceiros</h3>
                  <p className="leading-relaxed">
                    O aplicativo pode conter links para sites ou serviços de terceiros. A W.E.G. Business and Solutions - Br 
                    não possui controle sobre o conteúdo, políticas de privacidade ou práticas desses terceiros, eximindo-se de 
                    qualquer responsabilidade sobre eles.
                  </p>
                </section>

                <section>
                  <h3 className="text-base font-bold text-slate-800 mb-2">6. Propriedade Intelectual</h3>
                  <p className="leading-relaxed">
                    Todo o design, interface, código-fonte, marcas, logotipos e conteúdos originais do New Friends.Br são de 
                    propriedade exclusiva da W.E.G. Business and Solutions - Br. É estritamente proibido copiar, modificar ou 
                    distribuir o material do aplicativo sem autorização prévia.
                  </p>
                </section>

                <section>
                  <h3 className="text-base font-bold text-slate-800 mb-2">7. Rescisão e Exclusão de Conta</h3>
                  <p className="leading-relaxed">
                    A W.E.G. Business and Solutions - Br reserva-se o direito de, a qualquer momento e sem aviso prévio, 
                    suspender ou cancelar a conta de qualquer usuário que viole estes Termos de Uso, ou por qualquer outro motivo 
                    que julgar necessário para a segurança e integridade do aplicativo.
                  </p>
                </section>

                <section>
                  <h3 className="text-base font-bold text-slate-800 mb-2">8. Alterações nos Termos</h3>
                  <p className="leading-relaxed">
                    Estes Termos de Uso podem ser atualizados periodicamente. Recomendamos que você revise este documento 
                    regularmente. O uso continuado do aplicativo após a publicação de alterações constitui sua aceitação integral 
                    aos novos termos.
                  </p>
                </section>

                <section>
                  <h3 className="text-base font-bold text-slate-800 mb-2">9. Legislação Aplicável e Foro</h3>
                  <p className="leading-relaxed">
                    Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Para a solução de eventuais 
                    controvérsias decorrentes deste contrato, fica eleito o foro da comarca da sede da W.E.G. Business and Solutions - Br, 
                    com exclusão de qualquer outro, por mais privilegiado que seja.
                  </p>
                </section>
              </div>

              {/* Footer */}
              <div className="bg-slate-50 border-t border-slate-100 p-4 shrink-0 flex justify-end">
                <button
                  onClick={() => setIsTermsOpen(false)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-sm cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isForgotPasswordOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-100 overflow-hidden flex flex-col relative my-8"
            >
              <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-indigo-600" /> Recuperar Senha
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Redefina seu acesso com segurança por e-mail ou celular.
                  </p>
                </div>
                <button 
                  onClick={() => setIsForgotPasswordOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 rounded-full transition-colors border border-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Recovery Method Tabs */}
              <div className="flex border-b border-slate-100 bg-slate-50/50 p-1">
                <button
                  type="button"
                  onClick={() => { setResetMethod('email'); setResetMessage(''); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    resetMethod === 'email'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Por E-mail
                </button>
                <button
                  type="button"
                  onClick={() => { 
                    setResetMethod('phone'); 
                    setResetMessage(''); 
                    if (!resetPhone) setResetPhone('(62) 998160501');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    resetMethod === 'phone'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Por Celular / WhatsApp
                </button>
              </div>

              <div className="p-6">
                {resetStatus === 'success' ? (
                  <div className="flex flex-col items-center justify-center text-center space-y-4 py-3">
                    <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-1">
                      <Check className="w-7 h-7" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                      {resetMessage}
                    </p>
                    <button
                      onClick={() => {
                        setIsForgotPasswordOpen(false);
                        setResetStatus('idle');
                      }}
                      className="mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-sm w-full cursor-pointer text-xs"
                    >
                      Voltar ao Login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={(e) => handlePasswordReset(e)} className="space-y-4">
                    {resetMessage && resetStatus === 'error' && (
                      <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium border border-red-100">
                        {resetMessage}
                      </div>
                    )}

                    {/* Admin Detection Card */}
                    {(resetEmail.trim().toLowerCase() === 'admin' || 
                      resetEmail.trim().toLowerCase() === 'ceo@wegbusiness.com' || 
                      resetPhone.replace(/\D/g, '') === '62998160501') && (
                      <div className="p-3 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200/80 rounded-xl space-y-1.5 text-xs text-indigo-950">
                        <div className="font-black flex items-center gap-1.5 text-indigo-700">
                          <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>Conta Administradora Identificada (admin)</span>
                        </div>
                        <div className="text-[11px] text-slate-600 flex justify-between">
                          <span>E-mail:</span>
                          <span className="font-bold text-slate-900">ceo@wegbusiness.com</span>
                        </div>
                        <div className="text-[11px] text-slate-600 flex justify-between">
                          <span>Celular / WhatsApp:</span>
                          <span className="font-bold text-slate-900">(62) 998160501</span>
                        </div>
                      </div>
                    )}

                    {resetMethod === 'email' ? (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
                          E-mail ou Usuário
                        </label>
                        <input 
                          required 
                          type="text" 
                          value={resetEmail} 
                          onChange={e => setResetEmail(e.target.value)} 
                          placeholder="ceo@wegbusiness.com ou admin" 
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 text-sm" 
                        />
                        <p className="text-[11px] text-slate-400 leading-tight">
                          Para a conta administrativa, você pode digitar <b>admin</b> ou <b>ceo@wegbusiness.com</b>.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
                          Número de Celular com DDD
                        </label>
                        <input 
                          required 
                          type="tel" 
                          value={resetPhone} 
                          onChange={e => setResetPhone(e.target.value)} 
                          placeholder="(62) 998160501" 
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 text-sm font-mono" 
                        />
                        <p className="text-[11px] text-slate-400 leading-tight">
                          O administrador pode solicitar o link de recuperação diretamente pelo celular <b>(62) 998160501</b>.
                        </p>
                      </div>
                    )}

                    <div className="space-y-2 pt-1">
                      <button 
                        type="submit"
                        disabled={resetStatus === 'loading'}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl font-bold shadow-md shadow-indigo-100 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer text-xs"
                      >
                        {resetMethod === 'email' ? (
                          <>
                            <Mail className="w-4 h-4" />
                            <span>{resetStatus === 'loading' ? 'Enviando...' : 'Enviar Link para o E-mail'}</span>
                          </>
                        ) : (
                          <>
                            <MessageCircle className="w-4 h-4 text-emerald-300" />
                            <span>{resetStatus === 'loading' ? 'Conectando...' : 'Solicitar via Celular / WhatsApp'}</span>
                          </>
                        )}
                      </button>

                      {/* Direct phone shortcut for administrator */}
                      <button
                        type="button"
                        onClick={() => handlePasswordReset(undefined, 'phone')}
                        disabled={resetStatus === 'loading'}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 py-2.5 px-4 rounded-xl font-bold transition-all text-xs cursor-pointer"
                      >
                        <Smartphone className="w-4 h-4 text-emerald-600" />
                        <span>Recuperar via Celular Admin: (62) 998160501</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Face Presentation & Biometric Database Verification Modal */}
      {isFaceModalOpen && (
        <FaceLoginModal
          isOpen={isFaceModalOpen}
          email={email}
          storedFaceUrl={foundStoredFace}
          userData={foundUserData}
          onClose={() => setIsFaceModalOpen(false)}
          onSuccess={handleFaceLoginSuccess}
          onError={(msg) => setError(msg)}
        />
      )}
    </div>
  );
}
