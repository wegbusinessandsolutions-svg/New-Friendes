const fs = require('fs');
let code = fs.readFileSync('src/pages/Onboarding.tsx', 'utf8');

const importTarget = `  const [loading, setLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');`;

const importReplace = `  const [loading, setLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [pendingFotoPrincipal, setPendingFotoPrincipal] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState('');`;

code = code.replace(importTarget, importReplace);

const targetStr = `  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !auth.currentUser) return;
    const file = e.target.files[0];
    
    if (!file.type.startsWith('image/')) {
      alert("Por favor, selecione uma imagem válida.");
      return;
    }

    try {
      setIsUploadingImage(true);
      const fileRef = ref(storage, \`profiles/\${auth.currentUser.uid}/\${Date.now()}_\${file.name}\`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setFormData({ ...formData, fotoPrincipalUrl: url });
    } catch (err) {
      console.error("Erro ao fazer upload da imagem:", err);
      alert("Erro ao fazer upload da imagem. Tente novamente.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || loading || isUploadingImage) return;
    
    setLoading(true);
    setErrorMsg('');

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, {
        profile: {
          nome: formData.nome,
          apelido: formData.apelido,
          dataNascimento: formData.dataNascimento,
          idade: calculateAge(formData.dataNascimento),
          sexo: formData.sexo,
          cor: formData.cor,
          estadoCivil: formData.estadoCivil,
          telefone: formData.telefone,
          bio: formData.bio,
          objetivo: formData.objetivo,
          estadoNascimento: formData.estadoNascimento,
          cidadeNascimento: formData.cidadeNascimento,
          fotoPrincipalUrl: formData.fotoPrincipalUrl,
          fotosAdicionais: []
        },
        status: {
          ativo: true,
          banido: false,
          verificadoIdade: true, // simplified for MVP
        },
        createdAt: serverTimestamp(),
      });
      onComplete();
    } catch (err: any) {
      console.error('Error during onboarding:', err);
      setErrorMsg(handleFirestoreError(err));
    } finally {
      setLoading(false);
    }
  };`;

const replaceStr = `  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    try {
      let finalFotoPrincipalUrl = formData.fotoPrincipalUrl;

      if (pendingFotoPrincipal) {
        setIsUploadingImage(true);
        const fileRef = ref(storage, \`profiles/\${auth.currentUser.uid}/\${Date.now()}_\${pendingFotoPrincipal.name}\`);
        await uploadBytes(fileRef, pendingFotoPrincipal);
        finalFotoPrincipalUrl = await getDownloadURL(fileRef);
      }

      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, {
        profile: {
          nome: formData.nome,
          apelido: formData.apelido,
          dataNascimento: formData.dataNascimento,
          idade: calculateAge(formData.dataNascimento),
          sexo: formData.sexo,
          cor: formData.cor,
          estadoCivil: formData.estadoCivil,
          telefone: formData.telefone,
          bio: formData.bio,
          objetivo: formData.objetivo,
          estadoNascimento: formData.estadoNascimento,
          cidadeNascimento: formData.cidadeNascimento,
          fotoPrincipalUrl: finalFotoPrincipalUrl,
          fotosAdicionais: []
        },
        status: {
          ativo: true,
          banido: false,
          verificadoIdade: true, // simplified for MVP
        },
        createdAt: serverTimestamp(),
      });
      onComplete();
    } catch (err: any) {
      console.error('Error during onboarding:', err);
      setErrorMsg(handleFirestoreError(err));
    } finally {
      setIsUploadingImage(false);
      setLoading(false);
    }
  };`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/pages/Onboarding.tsx', code);
console.log('onboarding done');
