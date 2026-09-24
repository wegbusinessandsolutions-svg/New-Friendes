import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import config from './firebase-applet-config.json';
import { getZodiacSignFromDate } from './src/utils/zodiac';

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

interface MockUserDef {
  uid: string;
  codigoUsuario: string;
  nome: string;
  apelido: string;
  dataNascimento: string;
  idade: number;
  genero: 'mulher_cis' | 'homem_cis' | 'mulher_trans' | 'homem_trans' | 'nao_binario';
  sexo: 'feminino' | 'masculino' | 'outro';
  interesse: 'homens' | 'mulheres' | 'todos';
  cidadeNascimento: string;
  estadoNascimento: string;
  profissao: string;
  altura: string;
  cor: 'branca' | 'preta' | 'parda' | 'amarela' | 'indigena';
  bio: string;
  objetivo: 'namoro' | 'amizade' | 'casual' | 'algo_serio';
  estadoCivil: 'solteiro' | 'divorciado' | 'separado';
  hobbies: string[];
  esportes: 'frequente' | 'as_vezes' | 'nao';
  bebidas: 'socialmente' | 'nunca' | 'frequente';
  fumante: 'nao' | 'socialmente' | 'sim';
  pet: 'cachorro' | 'gato' | 'ambos' | 'nenhum';
  statusBolinha: 'disponivel' | 'ocupado';
  fotoPrincipalUrl: string;
  fotosAdicionais: string[];
  pergunta1: string;
  resposta1: string;
  pergunta2: string;
  resposta2: string;
  lat: number;
  lng: number;
  onlineStatus: 'online' | 'ocupado';
  verified: boolean;
  idVerified: boolean;
}

const FICTIONAL_USERS: MockUserDef[] = [
  // 1. MULHER - JOVEM (21 anos - Leão)
  {
    uid: 'mock_user_camila_rocha',
    codigoUsuario: '240926010001',
    nome: 'Camila Beatriz Rocha',
    apelido: 'Cami',
    dataNascimento: '05-08-2005',
    idade: 21,
    genero: 'mulher_cis',
    sexo: 'feminino',
    interesse: 'todos',
    cidadeNascimento: 'Goiânia',
    estadoNascimento: 'Goiás',
    profissao: 'Estudante de Psicologia & Fotógrafa',
    altura: '1.63',
    cor: 'parda',
    bio: 'Estudante de psicologia com a câmera sempre na mão 📸. Amo cafés acolhedores, noites de música ao vivo e conversas profundas sobre tudo e nada.',
    objetivo: 'algo_serio',
    estadoCivil: 'solteiro',
    hobbies: ['Fotografia', 'Música', 'Café', 'Livros'],
    esportes: 'as_vezes',
    bebidas: 'socialmente',
    fumante: 'nao',
    pet: 'gato',
    statusBolinha: 'disponivel',
    fotoPrincipalUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80',
    fotosAdicionais: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80'
    ],
    pergunta1: 'Um fato divertido sobre mim é...',
    resposta1: 'Consigo identificar a maioria das trilhas sonoras de filmes em menos de 5 segundos.',
    pergunta2: 'O encontro perfeito para mim seria...',
    resposta2: 'Uma livraria com café e depois sentar em um parque para ver o pôr do sol.',
    lat: -16.6872,
    lng: -49.2635,
    onlineStatus: 'online',
    verified: true,
    idVerified: true
  },

  // 2. MULHER - JOVEM (24 anos - Touro)
  {
    uid: 'mock_user_juliana_mendes',
    codigoUsuario: '240926010002',
    nome: 'Juliana Mendes Fagundes',
    apelido: 'Ju Mendes',
    dataNascimento: '12-05-2002',
    idade: 24,
    genero: 'mulher_cis',
    sexo: 'feminino',
    interesse: 'homens',
    cidadeNascimento: 'Brasília',
    estadoNascimento: 'Distrito Federal',
    profissao: 'Arquiteta e Urbanista',
    altura: '1.68',
    cor: 'branca',
    bio: 'Apaixonada por arquitetura modernista, plantas pela casa toda e boas massas. Se você sabe cozinhar, já tem metade dos meus pontos garantidos 🍝🍷.',
    objetivo: 'namoro',
    estadoCivil: 'solteiro',
    hobbies: ['Gastronomia', 'Design', 'Viagem', 'Museus'],
    esportes: 'frequente',
    bebidas: 'socialmente',
    fumante: 'nao',
    pet: 'cachorro',
    statusBolinha: 'disponivel',
    fotoPrincipalUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
    fotosAdicionais: [
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop&q=80'
    ],
    pergunta1: 'Eu não resisto a...',
    resposta1: 'Um convite surpresa para comer uma pizza artesanal ou viajar no fim de semana.',
    pergunta2: 'Eu passo a maior parte do meu tempo...',
    resposta2: 'Projetando espaços confortáveis e cuidando das minhas 20 plantas na varanda.',
    lat: -16.6830,
    lng: -49.2600,
    onlineStatus: 'online',
    verified: true,
    idVerified: true
  },

  // 3. MULHER (28 anos - Virgem)
  {
    uid: 'mock_user_larissa_prado',
    codigoUsuario: '240926010003',
    nome: 'Larissa Prado Albuquerque',
    apelido: 'Lari',
    dataNascimento: '15-09-1998',
    idade: 28,
    genero: 'mulher_cis',
    sexo: 'feminino',
    interesse: 'homens',
    cidadeNascimento: 'São Paulo',
    estadoNascimento: 'São Paulo',
    profissao: 'Médica Veterinária',
    altura: '1.70',
    cor: 'branca',
    bio: 'Cuido de bichos de dia e tento cuidar de mim à noite! Adoro fazer trilhas, surfar quando desço para o litoral e maratonar séries nas folgas.',
    objetivo: 'algo_serio',
    estadoCivil: 'solteiro',
    hobbies: ['Trilhas', 'Natureza', 'Praia', 'Séries'],
    esportes: 'frequente',
    bebidas: 'socialmente',
    fumante: 'nao',
    pet: 'ambos',
    statusBolinha: 'disponivel',
    fotoPrincipalUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
    fotosAdicionais: [
      'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800&auto=format&fit=crop&q=80'
    ],
    pergunta1: 'Minha maior paixão é...',
    resposta1: 'Salvar e reabilitar animais resgatados.',
    pergunta2: 'Você deve me mandar uma mensagem se...',
    resposta2: 'Gostar de cachorros e topar um passeio ao ar livre com açaí!',
    lat: -16.6780,
    lng: -49.2550,
    onlineStatus: 'ocupado',
    verified: true,
    idVerified: true
  },

  // 4. MULHER (32 anos - Sagitário)
  {
    uid: 'mock_user_beatriz_vasconcelos',
    codigoUsuario: '240926010004',
    nome: 'Beatriz Vasconcelos de Moraes',
    apelido: 'Bia',
    dataNascimento: '08-12-1994',
    idade: 32,
    genero: 'mulher_cis',
    sexo: 'feminino',
    interesse: 'todos',
    cidadeNascimento: 'Rio de Janeiro',
    estadoNascimento: 'Rio de Janeiro',
    profissao: 'Produtora Cultural & Curadora',
    altura: '1.65',
    cor: 'preta',
    bio: 'Carioca de alma e coração. Adoro roda de samba, cerveja bem gelada, teatro e festivais de cinema. Leveza, bom humor e boas risadas são essenciais.',
    objetivo: 'casual',
    estadoCivil: 'solteiro',
    hobbies: ['Samba', 'Cinema', 'Festivais', 'Cerveja Artesanal'],
    esportes: 'as_vezes',
    bebidas: 'socialmente',
    fumante: 'socialmente',
    pet: 'cachorro',
    statusBolinha: 'disponivel',
    fotoPrincipalUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&auto=format&fit=crop&q=80',
    fotosAdicionais: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80'
    ],
    pergunta1: 'O que não pode faltar no meu dia a dia...',
    resposta1: 'Música boa tocando desde o café da manhã.',
    pergunta2: 'Um domingo ideal tem...',
    resposta2: 'Sol, amigos reunidos e uma risada daquelas que doem a barriga.',
    lat: -16.7200,
    lng: -49.2300,
    onlineStatus: 'online',
    verified: true,
    idVerified: false
  },

  // 5. MULHER (39 anos - Capricórnio)
  {
    uid: 'mock_user_renata_silveira',
    codigoUsuario: '240926010005',
    nome: 'Dra. Renata Silveira Fontes',
    apelido: 'Renata',
    dataNascimento: '10-01-1987',
    idade: 39,
    genero: 'mulher_cis',
    sexo: 'feminino',
    interesse: 'homens',
    cidadeNascimento: 'Belo Horizonte',
    estadoNascimento: 'Minas Gerais',
    profissao: 'Advogada Tributarista',
    altura: '1.67',
    cor: 'branca',
    bio: 'Mineira apreciadora de queijos especiais, vinhos encorpados e conversas inteligentes. Gosto de quem é decidido, tem planos e sabe valorizar o presente.',
    objetivo: 'algo_serio',
    estadoCivil: 'divorciado',
    hobbies: ['Vinhos', 'Literatura', 'Gastronomia', 'Teatro'],
    esportes: 'frequente',
    bebidas: 'socialmente',
    fumante: 'nao',
    pet: 'gato',
    statusBolinha: 'disponivel',
    fotoPrincipalUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=80',
    fotosAdicionais: [],
    pergunta1: 'O segredo de um bom relacionamento é...',
    resposta1: 'Companheirismo sincero e liberdade para sermos nós mesmos.',
    pergunta2: 'Minha viagem dos sonhos é...',
    resposta2: 'Um tour pelas vinícolas da Toscana e da Serra Gaúcha.',
    lat: -16.6600,
    lng: -49.2900,
    onlineStatus: 'online',
    verified: true,
    idVerified: true
  },

  // 6. MULHER (47 anos - Câncer)
  {
    uid: 'mock_user_monica_antunes',
    codigoUsuario: '240926010006',
    nome: 'Mônica Antunes Peixoto',
    apelido: 'Mônica',
    dataNascimento: '04-07-1979',
    idade: 47,
    genero: 'mulher_cis',
    sexo: 'feminino',
    interesse: 'homens',
    cidadeNascimento: 'Curitiba',
    estadoNascimento: 'Paraná',
    profissao: 'Designer de Interiores & Paisagista',
    altura: '1.65',
    cor: 'branca',
    bio: 'Mãe orgulhosa de dois jovens, apaixonada por decoração orgânica, café colonial e manhãs ensolaradas. Busco conexão autêntica e boas amizades.',
    objetivo: 'namoro',
    estadoCivil: 'divorciado',
    hobbies: ['Paisagismo', 'Yoga', 'Culinária', 'Artes'],
    esportes: 'as_vezes',
    bebidas: 'socialmente',
    fumante: 'nao',
    pet: 'cachorro',
    statusBolinha: 'disponivel',
    fotoPrincipalUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop&q=80',
    fotosAdicionais: [],
    pergunta1: 'A melhor fase da vida é...',
    resposta1: 'Aquela em que nos importamos menos com a opinião alheia e mais com o que nos faz sorrir.',
    pergunta2: 'Gosto de pessoas que...',
    resposta2: 'Sabem ouvir com carinho e têm brilho nos olhos.',
    lat: -16.6100,
    lng: -49.3500,
    onlineStatus: 'online',
    verified: false,
    idVerified: true
  },

  // 7. MULHER (58 anos - Peixes)
  {
    uid: 'mock_user_tereza_cristina',
    codigoUsuario: '240926010007',
    nome: 'Tereza Cristina de Oliveira',
    apelido: 'Tetê',
    dataNascimento: '28-02-1968',
    idade: 58,
    genero: 'mulher_cis',
    sexo: 'feminino',
    interesse: 'homens',
    cidadeNascimento: 'Florianópolis',
    estadoNascimento: 'Santa Catarina',
    profissao: 'Professora de História Aposentada',
    altura: '1.60',
    cor: 'branca',
    bio: 'A vida começa todo dia! Gosto de caminhadas na orla, clube do livro, dança de salão e viagens sem pressa. Busco um companheiro bem-humorado.',
    objetivo: 'algo_serio',
    estadoCivil: 'separado',
    hobbies: ['Dança', 'História', 'Praia', 'Caminhadas'],
    esportes: 'frequente',
    bebidas: 'socialmente',
    fumante: 'nao',
    pet: 'nenhum',
    statusBolinha: 'disponivel',
    fotoPrincipalUrl: 'https://images.unsplash.com/photo-1566616213894-2d4e1baee5d8?w=800&auto=format&fit=crop&q=80',
    fotosAdicionais: [],
    pergunta1: 'Minha maior conquista é...',
    resposta1: 'Ter ensinado mais de 3 mil alunos e continuar curiosa sobre o mundo.',
    pergunta2: 'Um bom domingo inclui...',
    resposta2: 'Um café da tarde em família ou passeio à beira-mar.',
    lat: -16.5200,
    lng: -49.4200,
    onlineStatus: 'online',
    verified: true,
    idVerified: false
  },

  // 8. MULHER TRANS (23 anos - Áries)
  {
    uid: 'mock_user_yasmin_mata',
    codigoUsuario: '240926010008',
    nome: 'Yasmin Ribeiro da Mata',
    apelido: 'Yaz',
    dataNascimento: '14-04-2003',
    idade: 23,
    genero: 'mulher_trans',
    sexo: 'feminino',
    interesse: 'todos',
    cidadeNascimento: 'Salvador',
    estadoNascimento: 'Bahia',
    profissao: 'Cantora & Social Media',
    altura: '1.74',
    cor: 'preta',
    bio: 'Música, astrologia e energia solar da Bahia ☀️. Amo cantar, compor e conhecer lugares com arte e vida pulsante. Respeito e afeto acima de tudo!',
    objetivo: 'amizade',
    estadoCivil: 'solteiro',
    hobbies: ['Canto', 'Astrologia', 'Moda', 'Festivais'],
    esportes: 'as_vezes',
    bebidas: 'socialmente',
    fumante: 'nao',
    pet: 'gato',
    statusBolinha: 'disponivel',
    fotoPrincipalUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
    fotosAdicionais: [],
    pergunta1: 'Meu lema de vida é...',
    resposta1: 'Viver com autenticidade e cantar a minha própria história.',
    pergunta2: 'Quem quiser me conquistar precisa...',
    resposta2: 'Ter bom gosto musical e compartilhar boas gargalhadas!',
    lat: -16.7600,
    lng: -49.2000,
    onlineStatus: 'online',
    verified: true,
    idVerified: true
  },

  // 9. HOMEM - JOVEM (20 anos - Gêmeos)
  {
    uid: 'mock_user_lucas_fontenele',
    codigoUsuario: '240926010009',
    nome: 'Lucas Daniel Fontenele',
    apelido: 'Lukão',
    dataNascimento: '02-06-2006',
    idade: 20,
    genero: 'homem_cis',
    sexo: 'masculino',
    interesse: 'mulheres',
    cidadeNascimento: 'Goiânia',
    estadoNascimento: 'Goiás',
    profissao: 'Estudante de Ciência da Computação',
    altura: '1.78',
    cor: 'parda',
    bio: 'Programador de dia, skatista de noite e gamer nas horas vagas 🎮🛹. Curto sertanejo, rock indie e bater papo sobre tecnologia e o futuro.',
    objetivo: 'amizade',
    estadoCivil: 'solteiro',
    hobbies: ['Skate', 'Videogame', 'Tecnologia', 'Churrasco'],
    esportes: 'frequente',
    bebidas: 'socialmente',
    fumante: 'nao',
    pet: 'cachorro',
    statusBolinha: 'disponivel',
    fotoPrincipalUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&auto=format&fit=crop&q=80',
    fotosAdicionais: [],
    pergunta1: 'Um talento oculto meu é...',
    resposta1: 'Faço a melhor receita de hambúrguer artesanal caseiro.',
    pergunta2: 'Estou aqui para...',
    resposta2: 'Conhecer pessoas novas, trocar ideias e ver onde o destino leva!',
    lat: -16.6890,
    lng: -49.2590,
    onlineStatus: 'online',
    verified: true,
    idVerified: false
  },

  // 10. HOMEM (26 anos - Escorpião)
  {
    uid: 'mock_user_thiago_nogueira',
    codigoUsuario: '240926010010',
    nome: 'Thiago Henrique Nogueira',
    apelido: 'Thiago',
    dataNascimento: '05-11-2000',
    idade: 26,
    genero: 'homem_cis',
    sexo: 'masculino',
    interesse: 'mulheres',
    cidadeNascimento: 'Anápolis',
    estadoNascimento: 'Goiás',
    profissao: 'Personal Trainer & Nutricionista',
    altura: '1.83',
    cor: 'branca',
    bio: 'Movimento é saúde! Adoro acordar cedo, correr ao ar livre e preparar receitas saudáveis. Mas também não nego um bom vinho no sábado à noite 🏃‍♂️🍷.',
    objetivo: 'namoro',
    estadoCivil: 'solteiro',
    hobbies: ['Musculação', 'Corrida', 'Trilhas', 'Nutrição'],
    esportes: 'frequente',
    bebidas: 'socialmente',
    fumante: 'nao',
    pet: 'cachorro',
    statusBolinha: 'disponivel',
    fotoPrincipalUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
    fotosAdicionais: [],
    pergunta1: 'O que mais valorizo em alguém é...',
    resposta1: 'Energia positiva e disciplina para correr atrás dos sonhos.',
    pergunta2: 'Bora treinar ou...',
    resposta2: 'Pegar a estrada para cachoeira no sábado de manhã!',
    lat: -16.6920,
    lng: -49.2700,
    onlineStatus: 'online',
    verified: true,
    idVerified: true
  },

  // 11. HOMEM (33 anos - Libra)
  {
    uid: 'mock_user_felipe_castanho',
    codigoUsuario: '240926010011',
    nome: 'Felipe Augusto Castanho',
    apelido: 'Lipe',
    dataNascimento: '01-10-1993',
    idade: 33,
    genero: 'homem_cis',
    sexo: 'masculino',
    interesse: 'mulheres',
    cidadeNascimento: 'São Paulo',
    estadoNascimento: 'São Paulo',
    profissao: 'Engenheiro de Software Sênior',
    altura: '1.80',
    cor: 'branca',
    bio: 'Paulistano morando em Goiânia. Gosto de café coado de grão especial, gastronomia oriental e pedalar na ciclofaixa aos domingos.',
    objetivo: 'algo_serio',
    estadoCivil: 'solteiro',
    hobbies: ['Ciclismo', 'Cafés Especiais', 'Culinária Japonesa', 'Cinema'],
    esportes: 'frequente',
    bebidas: 'socialmente',
    fumante: 'nao',
    pet: 'gato',
    statusBolinha: 'disponivel',
    fotoPrincipalUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80',
    fotosAdicionais: [],
    pergunta1: 'Minha bebida favorita é...',
    resposta1: 'Café arábica moído na hora pela manhã e Negroni à noite.',
    pergunta2: 'Procuro alguém que...',
    resposta2: 'Goste de conversas com conteúdo e tenha senso de humor inteligente.',
    lat: -16.7000,
    lng: -49.2650,
    onlineStatus: 'online',
    verified: true,
    idVerified: true
  },

  // 12. HOMEM (41 anos - Aquário)
  {
    uid: 'mock_user_rodrigo_meireles',
    codigoUsuario: '240926010012',
    nome: 'Rodrigo Meireles Pinto',
    apelido: 'Rodrigo',
    dataNascimento: '03-02-1985',
    idade: 41,
    genero: 'homem_cis',
    sexo: 'masculino',
    interesse: 'mulheres',
    cidadeNascimento: 'Goiânia',
    estadoNascimento: 'Goiás',
    profissao: 'Engenheiro Civil & Mestre Cervejeiro',
    altura: '1.85',
    cor: 'branca',
    bio: 'Construo prédios de dia e produzo cerveja artesanal aos finais de semana 🍺. Gosto de rock anos 80, acampamentos na Chapada dos Veadeiros e churrasco de chão.',
    objetivo: 'namoro',
    estadoCivil: 'separado',
    hobbies: ['Cerveja Artesanal', 'Camping', 'Rock', 'Churrasco'],
    esportes: 'as_vezes',
    bebidas: 'socialmente',
    fumante: 'nao',
    pet: 'cachorro',
    statusBolinha: 'disponivel',
    fotoPrincipalUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop&q=80',
    fotosAdicionais: [],
    pergunta1: 'Minha melhor história de viagem...',
    resposta1: 'Passei 10 dias acampando no Jalapão e vi o céu mais estrelado da minha vida.',
    pergunta2: 'Bons companheiros de vida são aqueles que...',
    resposta2: 'Sabem rir dos próprios tropeços e apoiam os projetos um do outro.',
    lat: -16.7100,
    lng: -49.2450,
    onlineStatus: 'online',
    verified: true,
    idVerified: true
  },

  // 13. HOMEM (49 anos - Touro)
  {
    uid: 'mock_user_carlos_eduardo',
    codigoUsuario: '240926010013',
    nome: 'Carlos Eduardo Siqueira',
    apelido: 'Kadu',
    dataNascimento: '30-04-1977',
    idade: 49,
    genero: 'homem_cis',
    sexo: 'masculino',
    interesse: 'mulheres',
    cidadeNascimento: 'Rio de Janeiro',
    estadoNascimento: 'Rio de Janeiro',
    profissao: 'Empresário Gastronômico & Sommelier',
    altura: '1.77',
    cor: 'branca',
    bio: 'Dono de bistrô, amante da boa mesa e dos vinhos de guarda. Gosto de noites tranquilas de jazz, viagens gastronômicas e boas histórias compartilhadas.',
    objetivo: 'algo_serio',
    estadoCivil: 'divorciado',
    hobbies: ['Vinho', 'Jazz', 'Culinária', 'Viagens Internacionais'],
    esportes: 'as_vezes',
    bebidas: 'socialmente',
    fumante: 'nao',
    pet: 'ambos',
    statusBolinha: 'disponivel',
    fotoPrincipalUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80',
    fotosAdicionais: [],
    pergunta1: 'A melhor refeição é aquela...',
    resposta1: 'Preparada com afeto e saboreada com uma companhia especial.',
    pergunta2: 'Um domingo perfeito para mim...',
    resposta2: 'Cozinhar um risoto ouvindo Miles Davis sem pressa de acabar.',
    lat: -16.6400,
    lng: -49.3200,
    onlineStatus: 'online',
    verified: true,
    idVerified: true
  },

  // 14. HOMEM (62 anos - Capricórnio)
  {
    uid: 'mock_user_roberto_neves',
    codigoUsuario: '240926010014',
    nome: 'Dr. Roberto Alencar Neves',
    apelido: 'Beto',
    dataNascimento: '18-01-1964',
    idade: 62,
    genero: 'homem_cis',
    sexo: 'masculino',
    interesse: 'mulheres',
    cidadeNascimento: 'Brasília',
    estadoNascimento: 'Distrito Federal',
    profissao: 'Médico Cardiologista Aposentado',
    altura: '1.81',
    cor: 'branca',
    bio: 'Cardiologista aposentado, velejador nas horas vagas e pai de 3 filhos maravilhosos já criados. Busco companheirismo leve para passeios, viagens e bons jantares.',
    objetivo: 'algo_serio',
    estadoCivil: 'divorciado',
    hobbies: ['Vela', 'Música Clássica', 'Leitura', 'Viagens'],
    esportes: 'frequente',
    bebidas: 'socialmente',
    fumante: 'nao',
    pet: 'cachorro',
    statusBolinha: 'disponivel',
    fotoPrincipalUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&auto=format&fit=crop&q=80',
    fotosAdicionais: [],
    pergunta1: 'O que aprendi com o tempo é...',
    resposta1: 'Que a presença verdadeira vale mais que qualquer palavra.',
    pergunta2: 'Gosto de viajar para...',
    resposta2: 'Cidades históricas e lugares onde se possa contemplar a água.',
    lat: -16.5800,
    lng: -49.3800,
    onlineStatus: 'online',
    verified: true,
    idVerified: true
  },

  // 15. GÊNERO NÃO-BINÁRIO (25 anos - Leão)
  {
    uid: 'mock_user_alex_dourado',
    codigoUsuario: '240926010015',
    nome: 'Alex Dourado Lima',
    apelido: 'Alex',
    dataNascimento: '12-08-2001',
    idade: 25,
    genero: 'nao_binario',
    sexo: 'outro',
    interesse: 'todos',
    cidadeNascimento: 'Goiânia',
    estadoNascimento: 'Goiás',
    profissao: 'Ilustrador Digital & Tatuador',
    altura: '1.71',
    cor: 'parda',
    bio: 'Artista visual, apaixonade por ilustração botânica, filmes independentes e café gelado 🌿🎨. Aberte a conexões sinceras, amizades criativas e novas histórias.',
    objetivo: 'amizade',
    estadoCivil: 'solteiro',
    hobbies: ['Ilustração', 'Tatuagem', 'Cinema Independente', 'Plantas'],
    esportes: 'as_vezes',
    bebidas: 'socialmente',
    fumante: 'socialmente',
    pet: 'gato',
    statusBolinha: 'disponivel',
    fotoPrincipalUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
    fotosAdicionais: [],
    pergunta1: 'Minha forma favorita de criar arte é...',
    resposta1: 'Ouvindo discos de MPB dos anos 70 enquanto pinto no tablet.',
    pergunta2: 'Bora trocar ideias sobre...',
    resposta2: 'Filmes alternativos, séries cult e cafés diferentões da cidade!',
    lat: -16.6840,
    lng: -49.2800,
    onlineStatus: 'online',
    verified: true,
    idVerified: false
  },

  // 16. HOMEM TRANS (29 anos - Sagitário)
  {
    uid: 'mock_user_gabriel_prado',
    codigoUsuario: '240926010016',
    nome: 'Gabriel Santos Prado',
    apelido: 'Biel',
    dataNascimento: '19-12-1996',
    idade: 29,
    genero: 'homem_trans',
    sexo: 'masculino',
    interesse: 'todos',
    cidadeNascimento: 'Belo Horizonte',
    estadoNascimento: 'Minas Gerais',
    profissao: 'Chef Confeiteiro & Barista',
    altura: '1.72',
    cor: 'branca',
    bio: 'Faço sobremesas que abraçam a alma e cafés que despertam os sentidos ☕🍰. Apaixonado por escalada indoor, feiras de rua e dias chuvosos.',
    objetivo: 'namoro',
    estadoCivil: 'solteiro',
    hobbies: ['Confeitaria', 'Escalada', 'Café', 'Fotografia'],
    esportes: 'frequente',
    bebidas: 'socialmente',
    fumante: 'nao',
    pet: 'cachorro',
    statusBolinha: 'disponivel',
    fotoPrincipalUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&auto=format&fit=crop&q=80',
    fotosAdicionais: [],
    pergunta1: 'Meu doce favorito de preparar é...',
    resposta1: 'Torta de chocolate com flor de sal e caramelo toffee.',
    pergunta2: 'O que mais admiro em alguém...',
    resposta2: 'Coragem para viver sua própria verdade com afeto e determinação.',
    lat: -16.7400,
    lng: -49.2100,
    onlineStatus: 'online',
    verified: true,
    idVerified: true
  }
];

async function seedFictionalUsers() {
  console.log(`Iniciando criação de ${FICTIONAL_USERS.length} usuários fictícios...`);

  for (const user of FICTIONAL_USERS) {
    const zodiac = getZodiacSignFromDate(user.dataNascimento);
    const signo = zodiac ? zodiac.id : 'aries';

    const lifestyle = [
      { label: 'Esportes', value: user.esportes === 'frequente' ? 'Frequente' : user.esportes === 'as_vezes' ? 'Às vezes' : 'Raramente' },
      { label: 'Bebidas', value: user.bebidas === 'socialmente' ? 'Socialmente' : user.bebidas === 'frequente' ? 'Frequente' : 'Não bebe' },
      { label: 'Fumante', value: user.fumante === 'nao' ? 'Não' : user.fumante === 'socialmente' ? 'Socialmente' : 'Sim' },
      { label: 'Pet Favorito', value: user.pet === 'cachorro' ? 'Cachorro 🐶' : user.pet === 'gato' ? 'Gato 🐱' : user.pet === 'ambos' ? 'Ama pets 🐾' : 'Nenhum' },
    ];

    const prompts = [
      { title: user.pergunta1, desc: user.resposta1 },
      { title: user.pergunta2, desc: user.resposta2 },
    ];

    const userDocData = {
      codigoUsuario: user.codigoUsuario,
      idNumerico: user.codigoUsuario,
      email: `${user.apelido.toLowerCase().replace(/[^a-z0-9]/g, '')}_ficticio@teste.com`,
      emailVerified: true,
      verified: user.verified,
      idVerified: user.idVerified,
      ocultarPerfil: false,
      criadoEm: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
      createdAt: serverTimestamp(),
      status: {
        ativo: true,
        banido: false,
        verificadoIdade: true
      },
      profile: {
        nome: user.nome,
        apelido: user.apelido,
        idade: user.idade,
        dataNascimento: user.dataNascimento,
        signo: signo,
        genero: user.genero,
        sexo: user.sexo,
        interesse: user.interesse,
        cidadeNascimento: user.cidadeNascimento,
        estadoNascimento: user.estadoNascimento,
        profissao: user.profissao,
        altura: user.altura,
        cor: user.cor,
        bio: user.bio,
        objetivo: user.objetivo,
        estadoCivil: user.estadoCivil,
        hobbies: user.hobbies,
        esportes: user.esportes,
        bebidas: user.bebidas,
        fumante: user.fumante,
        pet: user.pet,
        statusBolinha: user.statusBolinha,
        fotoPrincipalUrl: user.fotoPrincipalUrl,
        fotos: [user.fotoPrincipalUrl, ...user.fotosAdicionais],
        fotosAdicionais: user.fotosAdicionais,
        pergunta1: user.pergunta1,
        resposta1: user.resposta1,
        pergunta2: user.pergunta2,
        resposta2: user.resposta2,
        lifestyle: lifestyle,
        prompts: prompts,
        verified: user.verified
      }
    };

    // 1. Salvar no Firestore: coleção 'users'
    await setDoc(doc(db, 'users', user.uid), userDocData, { merge: true });

    // 2. Salvar no Firestore: coleção 'locations'
    const hash = geohashForLocation([user.lat, user.lng]);
    await setDoc(doc(db, 'locations', user.uid), {
      lat: user.lat,
      lng: user.lng,
      geohash: hash,
      status: user.onlineStatus,
      visivel: true,
      atualizadoEm: Date.now()
    }, { merge: true });

    console.log(`✓ Usuário inserido: ${user.nome} (${user.idade} anos, ${user.genero}, ${user.sexo}, signo: ${signo})`);
  }

  console.log('\nTodos os 16 usuários fictícios foram criados com sucesso!');
  process.exit(0);
}

seedFictionalUsers().catch(err => {
  console.error('Erro ao semear usuários fictícios:', err);
  process.exit(1);
});
