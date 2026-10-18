import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  ShieldAlert,
  MapPin,
  Clock,
  Phone,
  User,
  ExternalLink,
  Camera,
  AlertTriangle,
  Download,
  Share2,
  Copy,
  Check,
  Navigation,
  ZoomIn,
  X,
  Radio,
  Users
} from 'lucide-react';

interface EmergencyPhoto {
  id: string;
  dataUrl: string;
  label?: string;
  note?: string;
  timestamp?: string;
}

export default function EmergencyAlertView() {
  const { id } = useParams<{ id: string }>();
  const [alertData, setAlertData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<EmergencyPhoto | null>(null);
  const [copied, setCopied] = useState(false);
  const [liveLocation, setLiveLocation] = useState<{ lat: number; lng: number; atualizadoEm?: number } | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Identificador de alerta inválido.');
      setLoading(false);
      return;
    }

    const unsubAlert = onSnapshot(doc(db, 'emergency_alerts', id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAlertData({ id: snap.id, ...data });
        if (data.coordinates) {
          setLiveLocation(data.coordinates);
        }

        // If victim user ID exists, listen to their live coordinates
        if (data.userId) {
          getDoc(doc(db, 'locations', data.userId)).then((locSnap) => {
            if (locSnap.exists()) {
              const locData = locSnap.data();
              if (locData.lat && locData.lng) {
                setLiveLocation({ lat: locData.lat, lng: locData.lng, atualizadoEm: locData.atualizadoEm });
              }
            }
          });
        }
      } else {
        setError('Alerta de emergência não encontrado ou já finalizado.');
      }
      setLoading(false);
    }, (err) => {
      console.error('Erro ao escutar alerta de emergência:', err);
      setError('Erro ao carregar os dados da emergência.');
      setLoading(false);
    });

    return () => unsubAlert();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-14 h-14 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-black tracking-wide uppercase text-red-400 animate-pulse">
          Carregando Alerta de Emergência...
        </h2>
        <p className="text-xs text-slate-400 mt-1">Conectando aos servidores do New Friends.br</p>
      </div>
    );
  }

  if (error || !alertData) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 bg-red-950/80 border border-red-600 rounded-3xl flex items-center justify-center mb-4 text-red-500">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-white mb-2">Alerta Inacessível</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">
          {error || 'Não foi possível encontrar este registro de emergência.'}
        </p>
        <Link
          to="/"
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all"
        >
          Acessar Página Inicial
        </Link>
      </div>
    );
  }

  const coords = liveLocation || alertData.coordinates;
  const mapsUrl = coords ? `https://maps.google.com/?q=${coords.lat},${coords.lng}` : null;
  const wazeUrl = coords ? `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes` : null;

  const photos: EmergencyPhoto[] = alertData.photos || [];
  const victim = alertData.victimProfile || {};

  const handleCopySummary = () => {
    const compText = alertData.companionUser
      ? `\nAcompanhante do App: ${alertData.companionUser.nome}${alertData.companionUser.telefone ? ` (Tel: ${alertData.companionUser.telefone})` : ''}`
      : '';

    const textToCopy = `🚨 ALERTA DE EMERGÊNCIA - PEDIDO DE SOCORRO POLICIAL (190)
Vítima: ${victim.nome || alertData.userName || 'Não informado'}
Telefone: ${victim.telefone || alertData.emergencyContact?.telefone || 'Não informado'}
Idade: ${victim.idade || 'Não informada'} | Sexo: ${victim.sexo || 'Não informado'}
Altura: ${victim.altura || 'Não informada'} | Cor: ${victim.cor || 'Não informada'}${compText}
Localização: ${mapsUrl || 'Coordenadas não disponíveis'}
Fotos Anexadas: ${photos.length} fotos registradas da ocorrência (placa/veículo/local).
Ver Fotos e Rastreamento ao Vivo: ${window.location.href}`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Top Emergency Flasher Header */}
      <header className="sticky top-0 z-40 bg-red-650 text-white px-4 py-3 shadow-2xl border-b-2 border-red-500 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white text-red-650 flex items-center justify-center font-black animate-pulse shadow-md">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Radio className="w-3 h-3 animate-ping" /> OCORRÊNCIA ATIVA
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-black tracking-tight leading-tight">
              SOS Emergência • New Friends.br
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-all"
            title="Copiar dados para a polícia"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copiado!' : 'Copiar Resumo'}</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
        {/* Urgent Advice Alert */}
        <div className="bg-red-950/60 border-2 border-red-500/80 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-black text-sm uppercase tracking-wider">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>Instrução de Socorro Imediato</span>
          </div>
          <p className="text-xs sm:text-sm text-red-200 leading-relaxed font-medium">
            Esta pessoa acionou o <strong className="text-white">Botão de Emergência</strong> e solicitou auxílio urgente.
            Por favor, <strong className="text-white underline">acione a Polícia Militar (190)</strong> imediatamente informando os dados e fotos abaixo.
            <span className="block mt-1 text-red-300 font-bold">
              ⚠️ NÃO LIGUE para o celular da vítima caso ela esteja em situação de rendição ou risco para não comprometer sua integridade.
            </span>
          </p>
        </div>

        {/* Quick Emergency Action Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <a
            href="tel:190"
            className="flex items-center justify-center gap-2 py-3 px-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-red-600/30 transition-transform active:scale-95"
          >
            <Phone className="w-4 h-4 fill-current" />
            <span>Ligar 190 (Polícia)</span>
          </a>
          <a
            href="tel:192"
            className="flex items-center justify-center gap-2 py-3 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-amber-600/30 transition-transform active:scale-95"
          >
            <Phone className="w-4 h-4" />
            <span>Ligar 192 (SAMU)</span>
          </a>
          <a
            href="tel:193"
            className="flex items-center justify-center gap-2 py-3 px-3 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-orange-600/30 transition-transform active:scale-95"
          >
            <Phone className="w-4 h-4" />
            <span>Ligar 193 (Bombeiros)</span>
          </a>
          {victim.telefone ? (
            <a
              href={`https://api.whatsapp.com/send?phone=55${victim.telefone.replace(/\D/g, '')}&text=${encodeURIComponent('Oi, recebi seu alerta de emergência do New Friends.br e estou acionando a polícia!')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-600/30 transition-transform active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              <span>WhatsApp Vítima</span>
            </a>
          ) : (
            <button
              onClick={handleCopySummary}
              className="flex items-center justify-center gap-2 py-3 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-xs transition-transform active:scale-95"
            >
              <Copy className="w-4 h-4" />
              <span>Copiar Dados</span>
            </button>
          )}
        </div>

        {/* SECTION: PESSOA DO APLICATIVO COM QUEM A VÍTIMA ESTÁ/SAIU */}
        {alertData.companionUser && (
          <section className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                    <span>Acompanhante / Contato do App</span>
                    <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Informado pela Vítima
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    A vítima indicou estar acompanhada deste usuário do New Friends.br no momento do alerta.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 bg-slate-950/80 rounded-2xl border border-amber-500/25">
              {alertData.companionUser.fotoUrl ? (
                <img
                  src={alertData.companionUser.fotoUrl}
                  alt={alertData.companionUser.nome}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-amber-500/50 shadow-md shrink-0"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                  <User className="w-10 h-10" />
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 w-full text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Nome / Apelido
                  </span>
                  <span className="font-extrabold text-white text-sm">
                    {alertData.companionUser.nome || 'Não informado'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Telefone Cadastrado
                  </span>
                  <span className="font-bold text-slate-200">
                    {alertData.companionUser.telefone || 'Não informado'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Idade / Status
                  </span>
                  <span className="font-bold text-slate-200">
                    {alertData.companionUser.idade ? `${alertData.companionUser.idade} anos` : 'Usuário do App'}
                  </span>
                </div>

                {alertData.companionUser.id && (
                  <div className="col-span-2 sm:col-span-3 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      ID de Registro no App
                    </span>
                    <span className="font-mono text-[11px] text-amber-300">
                      {alertData.companionUser.id}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[11px] text-amber-300/90 font-medium px-2 leading-relaxed">
              ⚠️ <strong>Informação para a Polícia:</strong> Esta pessoa estava com a vítima. Se a vítima não responder, as autoridades devem averiguar o paradeiro deste usuário.
            </p>
          </section>
        )}

        {/* SECTION: FOTOS E EVIDÊNCIAS ANEXADAS (Placa de veículo, local, etc) */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white">
                  Fotos e Evidências da Ocorrência
                </h3>
                <p className="text-[11px] text-slate-400">
                  {photos.length > 0
                    ? `${photos.length} foto(s) anexada(s) para auxiliar na identificação e resgate.`
                    : 'Nenhuma foto anexada no momento do disparo do alerta.'}
                </p>
              </div>
            </div>

            {photos.length > 0 && (
              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                {photos.length} Anexos
              </span>
            )}
          </div>

          {photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              {photos.map((photo, index) => (
                <div
                  key={photo.id || index}
                  onClick={() => setSelectedPhoto(photo)}
                  className="group relative bg-slate-950 border border-slate-800 hover:border-amber-500/60 rounded-2xl overflow-hidden cursor-pointer transition-all shadow-md hover:shadow-amber-500/10 flex flex-col"
                >
                  <div className="relative aspect-video sm:aspect-square bg-slate-900 overflow-hidden flex items-center justify-center">
                    <img
                      src={photo.dataUrl}
                      alt={photo.label || `Evidência ${index + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="px-2.5 py-1 bg-black/70 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm">
                        <ZoomIn className="w-3.5 h-3.5" /> Ampliar
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 space-y-0.5 bg-slate-900/90">
                    <span className="inline-block text-[9px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      {photo.label || 'Evidência Fotográfica'}
                    </span>
                    {photo.note && (
                      <p className="text-[11px] text-slate-200 font-medium truncate" title={photo.note}>
                        {photo.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 text-center space-y-1">
              <Camera className="w-7 h-7 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 font-medium">
                Nenhuma foto foi registrada antes do acionamento.
              </p>
              <p className="text-[10px] text-slate-500">
                Utilize as coordenadas de localização e as características físicas da vítima abaixo.
              </p>
            </div>
          )}
        </section>

        {/* SECTION: LOCALIZAÇÃO EM TEMPO REAL & MAPA */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white">
                  Localização da Vítima
                </h3>
                <p className="text-[11px] text-slate-400">
                  Coordenadas GPS de alta precisão capturadas pelo dispositivo.
                </p>
              </div>
            </div>

            {coords && (
              <span className="text-[10px] font-mono bg-slate-800 text-emerald-400 px-2.5 py-1 rounded-lg border border-slate-700">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </span>
            )}
          </div>

          {coords ? (
            <div className="space-y-3">
              {/* Embedded Google Maps iFrame */}
              <div className="w-full h-64 sm:h-80 rounded-2xl overflow-hidden border border-slate-800 shadow-inner bg-slate-950 relative">
                <iframe
                  title="Localização em tempo real da vítima"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight={0}
                  marginWidth={0}
                  src={`https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=16&output=embed`}
                  className="filter contrast-[1.05]"
                />
              </div>

              {/* Navigation Route Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <Navigation className="w-4 h-4" /> Abrir Rota no Google Maps
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {wazeUrl && (
                  <a
                    href={wazeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 px-4 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <Navigation className="w-4 h-4" /> Navegar no Waze
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-950/60 rounded-2xl border border-slate-800 text-center">
              <p className="text-xs text-slate-400">
                Coordenadas GPS não puderam ser obtidas no momento do acionamento.
              </p>
            </div>
          )}
        </section>

        {/* SECTION: DADOS E CARACTERÍSTICAS DA VÍTIMA */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                Ficha e Características da Vítima
              </h3>
              <p className="text-[11px] text-slate-400">
                Dados oficiais cadastrados no perfil do aplicativo New Friends.br.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 bg-slate-950/70 rounded-2xl border border-slate-800">
            {victim.fotoPrincipalUrl ? (
              <img
                src={victim.fotoPrincipalUrl}
                alt={victim.nome || 'Foto da Vítima'}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-indigo-500/40 shadow-md shrink-0"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                <User className="w-10 h-10" />
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 w-full text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Nome Completo
                </span>
                <span className="font-extrabold text-white text-sm">
                  {victim.nome || alertData.userName || 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Telefone da Vítima
                </span>
                <span className="font-bold text-slate-200">
                  {victim.telefone || 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Idade / Sexo
                </span>
                <span className="font-bold text-slate-200">
                  {victim.idade ? `${victim.idade} anos` : 'Não informada'} • {victim.sexo || 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Altura Estimada
                </span>
                <span className="font-bold text-slate-200">
                  {victim.altura || 'Não informada'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Cor / Etnia
                </span>
                <span className="font-bold text-slate-200">
                  {victim.cor || 'Não informada'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Disparo do Alerta
                </span>
                <span className="font-bold text-slate-200 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {alertData.timestamp?.toDate
                    ? alertData.timestamp.toDate().toLocaleString('pt-BR')
                    : 'Hoje'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Contact info box */}
        <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 text-center text-xs text-slate-400">
          <span>Este alerta foi gerado pelo sistema de proteção pessoal do </span>
          <strong className="text-white font-bold">New Friends.br</strong>.
        </div>
      </main>

      {/* Lightbox Photo Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Camera className="w-4 h-4" />
                {selectedPhoto.label || 'Foto Anexada da Ocorrência'}
              </span>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="p-1 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[70vh] bg-black flex items-center justify-center overflow-auto p-2">
              <img
                src={selectedPhoto.dataUrl}
                alt={selectedPhoto.label || 'Foto da Evidência'}
                className="max-h-[68vh] max-w-full object-contain rounded-xl"
              />
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <p className="text-xs text-slate-300 font-medium">
                {selectedPhoto.note || 'Sem observações adicionais.'}
              </p>
              <a
                href={selectedPhoto.dataUrl}
                download={`evidencia_sos_${selectedPhoto.label || 'foto'}.jpg`}
                className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Baixar Foto
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
