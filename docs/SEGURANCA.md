# Segurança — Karolla Pet

Auditoria feita em 13/10/2026. Legenda:
- **OK**: verificado (no código, em testes automáticos ou direto no Supabase/Netlify).
- **Parcial**: protegido, mas com melhoria recomendada.
- **Pendente**: depende de configuração externa ou de uma decisão.

Itens marcados com *(publicar)* estão no código e entram no ar na próxima publicação do Netlify.

## 1. Estrutura e exposição
| # | Item | Situação | Detalhe |
|---|---|---|---|
| 1 | HTTPS ativo | OK | Certificado automático do Netlify em `karollapet.com.br`. |
| 2 | Redirecionamento seguro | OK | `http` → `https` e `.netlify.app` → domínio principal (Netlify), mais HSTS. *(publicar: HSTS com `includeSubDomains`)* |
| 3 | Arquivos públicos | OK | Só o site compilado é publicado: sem mapas de código-fonte, sem `.env`; `/admin` e `/api` ficam fora das buscas. |
| 4 | Código-fonte | **Parcial** | O repositório no GitHub é **público**. Não há segredos no código nem no histórico (verificado), mas o recomendado é torná-lo **privado**. |
| 5 | Painéis expostos | OK | `/admin` e `/api/admin/*` exigem login e permissão em cada requisição; as rotas de demonstração não existem em produção. Painéis do Supabase, Netlify, GitHub e Registro.br: ative **verificação em duas etapas** nas contas. |

## 2. Hospedagem e configuração
| # | Item | Situação | Detalhe |
|---|---|---|---|
| 6 | Configurações da hospedagem | OK | Versões de teste exigem login da equipe Netlify; o build ignora mudanças só de documentação. |
| 7 | Segredos e chaves | OK | Chaves só nas variáveis do Netlify (servidor); a chave `service_role` nunca vai ao navegador. A verificação de segredos do Netlify e a busca no histórico do git não encontraram nada. |
| 8 | Configuração de produção | OK | Em produção o servidor se recusa a iniciar com banco em memória ou login de demonstração. |
| 9 | Domínio e DNS | **Parcial** | Domínio registrado e apontado. Falta: verificação em duas etapas no Registro.br, DNSSEC e registros de e-mail (SPF/DKIM do Resend). |
| 10 | Cabeçalhos de segurança | OK | API: `helmet`. Site: HSTS, nosniff, anti-iframe, Referrer e Permissions-Policy. *(publicar: CSP básica e COOP)* Uma CSP restritiva de scripts não foi aplicada, para não quebrar os pixels de anúncio. |

## 3. Código e dependências
| # | Item | Situação | Detalhe |
|---|---|---|---|
| 11 | Bibliotecas atualizadas | **Parcial** | React Router atualizado para 6.30.6, o que corrige uma falha de nível alto *(publicar)*. Restam 2 alertas médios, sem uso possível neste site: ele não navega para endereços vindos do visitante. A correção completa exige migrar para o React Router 7. Os alertas de vite, vitest e tailwind afetam só as ferramentas de desenvolvimento, não o site publicado. |
| 12 | Pacotes confiáveis | OK | Pacotes conhecidos do npm, com versões travadas (`package-lock.json`). |
| 13 | Repositório Git | **Parcial** | `.env` ignorado e histórico limpo. Recomendado: repositório privado, verificação em duas etapas no GitHub e proteção da branch. |
| 14 | Integrações externas | OK | Supabase só pelo servidor. WhatsApp por link (nada é enviado sozinho). Google Sheets com segredo. Pixels só com o consentimento do visitante (LGPD). |
| 15 | Separação de ambientes | **Parcial** | Demonstração e testes usam banco em memória; produção usa o Supabase. Não existe um banco de homologação separado. |

## 4. Login e senhas
| # | Item | Situação | Detalhe |
|---|---|---|---|
| 16 | Login protegido | OK | Supabase Auth sobre HTTPS e mensagem genérica ("e-mail ou senha incorretos"). |
| 17 | Senhas fortes | **Parcial** | Pelo menos 8 caracteres, com letras e números. A verificação de senhas vazadas do Supabase exige plano pago. |
| 18 | Tentativas de login | OK | Limite por IP e **bloqueio do e-mail após 5 senhas erradas em 15 minutos**, gravado no banco (vale para todos os servidores). As tentativas ficam no registro de auditoria. *(publicar)* |
| 19 | Recuperação de senha | **Pendente** | Já implementada (link de uso único, com limite de pedidos). Depende do SMTP (Resend) para os e-mails saírem. |
| 20 | Autenticação multifator | **Pendente** | Não implementada. Recomendada para as contas dona e administradora (o Supabase suporta códigos de aplicativo, TOTP). |

## 5. Sessões e permissões
| # | Item | Situação | Detalhe |
|---|---|---|---|
| 21 | Sessões protegidas | OK | O token é conferido no servidor a cada requisição. Conta desativada perde o acesso na hora (testado). |
| 22 | Cookies seguros | OK (não se aplica) | O login não usa cookies, e sim um token no cabeçalho `Authorization`. Por isso não há risco de CSRF. |
| 23 | Logout real | OK | Sair encerra a sessão também no Supabase. |
| 24 | Expiração da sessão | OK | O token de acesso vence em 1 hora e é renovado. O **painel sai sozinho após 8 horas sem uso** *(publicar)*. |
| 25 | Permissões por perfil | OK | Dona, administrador, gerente, freelance e profissional, com permissões por área e ação. Valores e contatos são ocultados no servidor. Coberto por testes. |

## 6. Proteção de dados
| # | Item | Situação | Detalhe |
|---|---|---|---|
| 26 | Isolamento de clientes | OK | Cada cliente só vê o próprio cadastro, pets, fotos e agendamentos (testado). |
| 27 | Proteção do banco | OK | RLS ligada em todas as tabelas. O visitante anônimo lê 0 linhas (verificado no Supabase). A **0012** remove também as permissões padrão (aplicar no SQL Editor). |
| 28 | Regras de acesso | OK | 8 arquivos de teste SQL das regras de linha, mais os testes do servidor. |
| 29 | Criptografia | OK | HTTPS em tudo. O Supabase criptografa o banco e os arquivos (AES-256). Senhas guardadas com hash (bcrypt). Fotos privadas só por link temporário de 10 minutos. |
| 30 | Minimização de dados | **Parcial** | O site público não expõe IDs nem contatos; o comentário mostra só o primeiro nome. Falta uma regra de **prazo para apagar** dados antigos (LGPD). |

## 7. Formulários e ataques
| # | Item | Situação | Detalhe |
|---|---|---|---|
| 31 | Validação no servidor | OK | Toda entrada é validada no servidor (Zod), independentemente do navegador. |
| 32 | Injeção SQL | OK | Sem SQL montado com texto. Consultas parametrizadas (Supabase) e funções SQL com parâmetros. |
| 33 | XSS | OK | O React escapa todo texto. Comentários perdem o HTML e não aceitam links. Não há upload de SVG. |
| 34 | CSRF | OK | Não se aplica, porque não há cookies de sessão. CORS restrito e `form-action 'self'` *(publicar)*. |
| 35 | Uploads de arquivos | OK | Tipo (JPG, PNG, WebP) e tamanho conferidos no servidor e no armazenamento. Nomes aleatórios. Fotos de clientes em armazenamento privado. Limite de envios por hora. |

## 8. Agendamento e regras de negócio
| # | Item | Situação | Detalhe |
|---|---|---|---|
| 36 | Integridade dos agendamentos | OK | Preço e duração calculados no servidor; o valor enviado pelo navegador é ignorado. |
| 37 | Conflito de horários | OK | Trava atômica no banco, testada com agendamentos simultâneos. |
| 38 | Preços e planos | OK | Pagamento só registrado manualmente pela equipe. Valores ocultos para quem não tem acesso ao financeiro. |
| 39 | Notificações | **Parcial** | WhatsApp nunca envia sozinho. E-mails dependem do SMTP (pendente). |
| 40 | APIs protegidas | OK | Login, permissão e limite de requisições (geral e por rota sensível). |

## 9. Monitoramento e recuperação
| # | Item | Situação | Detalhe |
|---|---|---|---|
| 41 | Logs de segurança | OK | Registro de auditoria (quem fez o quê e quando), logins e tentativas erradas, além dos logs do Netlify e do Supabase. |
| 42 | Alertas | **Pendente** | Ative os e-mails de alerta do Netlify (deploy falhou, uso de créditos) e do Supabase (uso e saúde do projeto). |
| 43 | Backup | **Pendente** | Ver "Backup" abaixo. |
| 44 | Teste de restauração | **Pendente** | Fazer depois do primeiro backup. A estrutura do banco já é recriada do zero pelas migrações (testado). |
| 45 | Plano de incidente | OK | Ver abaixo. |

## 10. Verificação final
| # | Item | Situação | Detalhe |
|---|---|---|---|
| 46 | Varredura de vulnerabilidades | OK | `npm audit`, alertas de segurança do Supabase, verificação de segredos do Netlify e busca no histórico do git. |
| 47 | Teste de autorização | OK | Testes automáticos de perfis, acesso indevido e conta desativada. |
| 48 | Teste de privacidade | OK | Testes de isolamento entre clientes e de valores e contatos ocultos. |
| 49 | Teste de carga controlado | **Pendente** | Não feito em produção: consumiria os créditos do Netlify. Fazer depois de 7/11 ou com plano pago. |
| 50 | Revisão após correções | **Parcial** | Testes rodados de novo após as correções (servidor 112, banco, navegador). Conferir no ar depois da próxima publicação. |

## Backup
O plano gratuito do Supabase não oferece backups para baixar; os planos pagos guardam backups diários.
Enquanto não houver plano pago, faça uma cópia manual **uma vez por mês e antes de mudanças grandes**:

1. Supabase → *Project Settings → Database → Connection string* (URI). Copie e troque `[YOUR-PASSWORD]` pela senha do banco.
2. Em um computador com PostgreSQL instalado:
   `pg_dump "COLE_A_URI_AQUI" --no-owner --format=custom --file=karolla-AAAA-MM-DD.dump`
3. Guarde o arquivo em local **privado** (ex.: Google Drive pessoal). Ele contém dados de clientes.
   **Nunca** coloque no GitHub (o repositório é público).
4. **Teste de restauração** (item 44): em um projeto Supabase de teste,
   `pg_restore --no-owner --dbname "URI_DO_PROJETO_DE_TESTE" karolla-AAAA-MM-DD.dump`
   e confira se clientes e agendamentos aparecem.

As fotos (buckets `karolla-media` e `karolla-private`) podem ser baixadas em *Storage* no painel do Supabase.

## Plano de incidente
1. **Conter**
   - Senha vazada ou suspeita: troque a senha em *Esqueci minha senha* e desative contas suspeitas em *Equipe e acessos*.
   - Chave exposta: no Supabase, *Project Settings → API Keys*, gere uma nova `service_role` e atualize no Netlify (*Environment variables*); depois publique.
   - Ataque em andamento: no Netlify, *Deploys → Lock to stop auto publishing*; se preciso, desligue o site em *Project configuration → General → Pause project*.
2. **Investigar**: registro de auditoria do painel (*Equipe e acessos*), logs do Supabase (*Logs → Auth* e *API*) e do Netlify (*Logs → Functions*). Anote data, hora e o que foi afetado.
3. **Corrigir**: aplique a correção, rode os testes e publique. Se dados foram alterados, restaure o backup mais recente.
4. **Comunicar (LGPD)**: se dados pessoais de clientes foram expostos, avise os clientes afetados e avalie comunicar a **ANPD** em até 3 dias úteis (Resolução CD/ANPD nº 15/2024). Registre o ocorrido.
5. **Revisar**: o que permitiu o incidente e o que muda para não se repetir.

## Próximas melhorias recomendadas (por prioridade)
1. Tornar o repositório do GitHub **privado** e ativar a verificação em duas etapas em GitHub, Netlify, Supabase, Registro.br e Resend.
2. Aplicar a migração **0012** no SQL Editor do Supabase.
3. Configurar o SMTP (Resend) para os e-mails de confirmação e de nova senha.
4. Fazer o primeiro backup e o teste de restauração.
5. Autenticação em duas etapas no painel (contas dona e administradora).
6. Regra de retenção de dados (LGPD) e migração para o React Router 7.
