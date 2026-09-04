const fs = require('fs');
let code = fs.readFileSync('src/pages/Onboarding.tsx', 'utf8');

const regex = /const handleFileUpload = async[\s\S]*?setLoading\(false\);\n    \}\n  \};/m;

const replacement = `const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        finalFotoPrincipalUrl = await resizeImage(pendingFotoPrincipal);
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
      setErrorMsg(handleFirestoreError(err, OperationType.CREATE, 'users'));
    } finally {
      setIsUploadingImage(false);
      setLoading(false);
    }
  };`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/pages/Onboarding.tsx', code);
console.log('done fixing onboarding');
