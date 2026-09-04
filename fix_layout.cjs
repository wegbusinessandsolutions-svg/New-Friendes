const fs = require('fs');

let code = fs.readFileSync('src/pages/Discover.tsx', 'utf8');

const target = `<div key={u.userId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:border-indigo-300 transition-colors">
                   <Link to={\`/profile/\${u.userId}\`} className="block relative aspect-[4/5] group">
                     <img src={u.profile?.fotoPrincipalUrl || \`https://api.dicebear.com/9.x/notionists/svg?seed=\${u.userId}\`} alt={u.profile?.nome} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-90"></div>
                     <div className="absolute top-2 left-2 flex items-center justify-center">
                        <div className={\`w-2.5 h-2.5 \${getCardStatusColor(u)} rounded-full border border-white shadow-sm animate-pulse\`}></div>
                     </div>
                     <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                        <div className="flex flex-col text-white w-full">
                           <span className="font-bold text-[15px] leading-tight drop-shadow-md truncate flex items-center gap-1">
                             {u.profile?.apelido || u.profile?.nome}, {u.profile?.idade}
                             {u.profile?.verified && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                           </span>
                           {u.profile?.estadoNascimento && (
                             <span className="text-[11px] font-medium text-white/90 drop-shadow-sm mt-0.5 truncate">
                               {getDemonym(u.profile.estadoNascimento, u.profile.sexo)}
                             </span>
                           )}
                        </div>
                     </div>
                     <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                       <MapPin className="w-3 h-3 text-indigo-300" /> {u.distance}
                     </div>
                   </Link>
                   
                   <div className="p-2.5 flex-1 flex flex-col bg-white">`;

const replacement = `<div key={u.userId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:border-indigo-300 transition-colors group">
                   <Link to={\`/profile/\${u.userId}\`} className="block relative aspect-[4/5] overflow-hidden">
                     <img src={u.profile?.fotoPrincipalUrl || \`https://api.dicebear.com/9.x/notionists/svg?seed=\${u.userId}\`} alt={u.profile?.nome} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
                     <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/50 to-transparent opacity-90"></div>
                     <div className="absolute top-2 left-2 flex items-center justify-center">
                        <div className={\`w-2.5 h-2.5 \${getCardStatusColor(u)} rounded-full border border-white shadow-sm animate-pulse\`}></div>
                     </div>
                     <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                       <MapPin className="w-3 h-3 text-indigo-300" /> {u.distance}
                     </div>
                   </Link>
                   
                   <div className="p-2.5 flex-1 flex flex-col bg-white">
                     <Link to={\`/profile/\${u.userId}\`} className="mb-2.5 flex flex-col group-hover:text-indigo-600 transition-colors">
                        <div className="font-bold text-[14px] leading-tight text-slate-800 flex items-center gap-1 truncate">
                          {u.profile?.apelido || u.profile?.nome}, {u.profile?.idade}
                          {u.profile?.verified && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                        </div>
                        <div className="flex justify-between items-center text-[11px] mt-0.5">
                          {u.profile?.estadoNascimento ? (
                            <span className="font-medium text-slate-500 truncate">
                              {getDemonym(u.profile.estadoNascimento, u.profile.sexo)}
                            </span>
                          ) : <span className="font-medium text-slate-400">---</span>}
                          {u.profile?.profissao && (
                            <span className="font-medium text-slate-500 truncate ml-2 text-right">
                              {u.profile.profissao}
                            </span>
                          )}
                        </div>
                     </Link>`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/pages/Discover.tsx', code);
  console.log('Success');
} else {
  console.log('Target not found in Discover.tsx');
}
