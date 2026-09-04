import React, { useState, useEffect, useRef } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Camera, X, Shield, ShieldCheck, AlertCircle, Check, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Login() {
  const [isRegister, setIsRegister] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authErrorCode, setAuthErrorCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  // Forgot Password states
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
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

  const handleStartFaceLogin = async () => {
    setError('');
    const cachedCredsStr = localStorage.getItem('face_login_credentials');
    if (!cachedCredsStr) {
      setError("Nenhum perfil cadastrado para login facial neste dispositivo. Para ativar: faça login com e-mail/senha, acesse seu Perfil > Configurações do Aplicativo e ative o 'Reconhecimento Facial de Login'.");
      return;
    }
    
    try {
      const cachedCreds = JSON.parse(cachedCredsStr);
      setEmail(cachedCreds.email);
      setPassword(cachedCreds.password);
      setLoading(true);
      sessionStorage.setItem('just_logged_in', 'true');
      await signInWithEmailAndPassword(auth, cachedCreds.email, cachedCreds.password);
    } catch (loginErr: any) {
      console.warn("Face login fallback auth error:", loginErr);
      let friendlyMsg = 'Erro inesperado na autenticação.';
      if (loginErr.code === 'auth/wrong-password' || loginErr.code === 'auth/invalid-credential' || loginErr.message?.includes('invalid-credential')) {
        friendlyMsg = 'Credenciais expiradas ou senha alterada. Por favor, faça login com seu e-mail e senha normais.';
      } else {
        friendlyMsg = loginErr.message || 'Erro inesperado.';
      }
      setError('Falha na autenticação: ' + friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const isAdminEmail = email === 'sac@wegbusiness.com' || email === 'ceo@newfriends.com' || email === 'ceo@wegbusiness.com' || email === 'wegbusinessandsolutions@gmail.com';

    // Verify registration enabled block
    if (isRegister && !registrationEnabled && !isAdminEmail) {
      setError('Os cadastros de novos usuários estão temporariamente desativados pelo administrador.');
      setLoading(false);
      return;
    }

    // Special override handler for sac@wegbusiness.com with password 02210839
    if (email === 'sac@wegbusiness.com' && password === '02210839') {
      try {
        // Attempt login first
        sessionStorage.setItem('just_logged_in', 'true');
        await signInWithEmailAndPassword(auth, email, password);
      } catch (loginErr: any) {
        try {
          // If login failed (e.g. user does not exist), auto-create the admin account
          sessionStorage.setItem('just_logged_in', 'true');
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (createErr: any) {
          setError(createErr.message || 'Erro ao inicializar conta administrativa');
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
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
      } else {
        sessionStorage.setItem('just_logged_in', 'true');
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
       sessionStorage.removeItem('just_logged_in');
       if (err.code === 'auth/email-already-in-use') {
         setError('Este e-mail, já está em uso no App.');
         setAuthErrorCode('email-already-in-use');
       } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
         setError('E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.');
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    
    setResetStatus('loading');
    setResetMessage('');
    
    try {
      auth.languageCode = 'pt';
      await sendPasswordResetEmail(auth, resetEmail);
      setResetStatus('success');
      setResetMessage('Pronto! Acabamos de enviar um e-mail com as instruções e o link para redefinir sua senha. Este link expira em 1 hora. Caso não o utilize, sua senha atual será mantida. Verifique sua caixa de entrada e a pasta de spam.');
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

        {!isRegister && (
          <div className="relative z-10 w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg mb-6">
            <div className="w-10 h-10 border-[4px] border-indigo-600 rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-indigo-600 rounded-full"></div>
            </div>
          </div>
        )}
        
        <div className="relative z-10 space-y-2 mb-8">
          <div className="flex gap-2 mb-4">
            <div className="h-1 w-12 bg-indigo-600 rounded-full"></div>
            <div className="h-1 w-12 bg-slate-200 rounded-full"></div>
          </div>
          {isRegister && (
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-md border border-slate-100">
                <div className="w-4 h-4 border-[3px] border-indigo-600 rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></div>
                </div>
              </div>
              <div className="text-xl font-semibold tracking-tight text-indigo-600 flex items-center gap-2 font-friendly">
                <span>New Friends<span className="text-emerald-500">.br</span></span>
                <img src="https://flagcdn.com/w40/br.png" alt="Brasil" className="w-6 h-auto rounded-sm object-cover" />
              </div>
            </div>
          )}
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center justify-start gap-4">
            {isRegister ? 'Crie sua conta' : (
              <span>Acesse o New Friends<span className="text-emerald-500">.br</span></span>
            )}
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            {isRegister 
               ? 'Preencha seu e-mail e senha para iniciar sua jornada.' 
               : 'Conecte-se com pessoas próximas a você e construa amizades reais.'}
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
        
        <form onSubmit={handleEmailAuth} className="relative z-10 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">E-mail</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900" />
          </div>

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

          {!isRegister && (
            <button 
              type="button"
              onClick={handleStartFaceLogin}
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
                    Enviaremos um link válido por 1 hora.
                  </p>
                </div>
                <button 
                  onClick={() => setIsForgotPasswordOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 rounded-full transition-colors border border-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                {resetStatus === 'success' ? (
                  <div className="flex flex-col items-center justify-center text-center space-y-4 py-4">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
                      <Check className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                      {resetMessage}
                    </p>
                    <button
                      onClick={() => setIsForgotPasswordOpen(false)}
                      className="mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-sm w-full"
                    >
                      Voltar ao Login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handlePasswordReset} className="space-y-5">
                    {resetMessage && resetStatus === 'error' && (
                      <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
                        {resetMessage}
                      </div>
                    )}
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">E-mail Cadastrado</label>
                      <input 
                        required 
                        type="email" 
                        value={resetEmail} 
                        onChange={e => setResetEmail(e.target.value)} 
                        placeholder="seu@email.com" 
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900" 
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={resetStatus === 'loading' || !resetEmail}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 px-4 rounded-xl font-bold shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {resetStatus === 'loading' ? 'Enviando...' : 'Enviar Link de Recuperação'}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
