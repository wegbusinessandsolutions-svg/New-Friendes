const fs = require('fs');

let code = fs.readFileSync('src/pages/ProfileDetails.tsx', 'utf8');

const replacement = `
        {/* Contact Info - Gamified unlockable boxes */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* WhatsApp */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4 overflow-hidden relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">WhatsApp</h3>
                <p className="text-[10px] text-slate-400 font-medium">Requer permissão do amigo</p>
              </div>
            </div>
            
            <AnimatePresence mode="wait">
              {!phoneRevealed ? (
                profile?.statusBolinha === 'indisponivel' ? (
                  <motion.div 
                    key="locked-unavailable"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-rose-50/50 border border-rose-100 rounded-xl p-4 flex flex-col items-center text-center space-y-2 relative h-full justify-center"
                  >
                    <p className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                      🔒 Indisponível
                    </p>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="locked"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex flex-col items-center text-center space-y-2 relative h-full justify-center"
                  >
                    <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      🔒 Oculto
                    </p>
                    <p className="text-[10px] text-emerald-600 font-medium max-w-xs">
                      O usuário precisa liberar o número no Painel de Amigos.
                    </p>
                  </motion.div>
                )
              ) : (
                <motion.div 
                  key="unlocked"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl p-4 flex flex-col items-center justify-center shadow-lg gap-2 text-center"
                >
                  <p className="text-lg font-black tracking-wide">{profile.telefone || 'Não informado'}</p>
                  {profile.telefone && (
                    <a 
                      href={\`https://wa.me/55\${profile.telefone.replace(/\\D/g, '')}\`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="bg-white text-emerald-700 hover:bg-emerald-50 font-extrabold text-[10px] px-3 py-1.5 rounded-lg shadow-sm transition-colors uppercase tracking-wider"
                    >
                      Abrir WhatsApp
                    </a>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Email */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4 overflow-hidden relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">E-mail</h3>
                <p className="text-[10px] text-slate-400 font-medium">Requer permissão do amigo</p>
              </div>
            </div>
            
            <AnimatePresence mode="wait">
              {!emailRevealed ? (
                profile?.statusBolinha === 'indisponivel' ? (
                  <motion.div 
                    key="locked-unavailable-email"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-rose-50/50 border border-rose-100 rounded-xl p-4 flex flex-col items-center text-center space-y-2 relative h-full justify-center"
                  >
                    <p className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                      🔒 Indisponível
                    </p>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="locked-email"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex flex-col items-center text-center space-y-2 relative h-full justify-center"
                  >
                    <p className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                      🔒 Oculto
                    </p>
                    <p className="text-[10px] text-indigo-600 font-medium max-w-xs">
                      O usuário precisa liberar o e-mail no Painel de Amigos.
                    </p>
                  </motion.div>
                )
              ) : (
                <motion.div 
                  key="unlocked-email"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl p-4 flex flex-col items-center justify-center shadow-lg gap-2 text-center break-all"
                >
                  <p className="text-sm font-black tracking-wide">{profile.email || 'Não informado'}</p>
                  {profile.email && (
                    <a 
                      href={\`mailto:\${profile.email}\`}
                      className="bg-white text-indigo-700 hover:bg-indigo-50 font-extrabold text-[10px] px-3 py-1.5 rounded-lg shadow-sm transition-colors uppercase tracking-wider"
                    >
                      Enviar E-mail
                    </a>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
`;

// Replace the old WhatsApp section
code = code.replace(
  /\{\/\* Contact WhatsApp - Gamified unlockable box \*\/\}[\s\S]*?<\/div>(\s*\{\/\* Protection \/ Trust Banner \*\/)/,
  replacement + "$1"
);

fs.writeFileSync('src/pages/ProfileDetails.tsx', code);
console.log('Patched ProfileDetails.tsx UI');
