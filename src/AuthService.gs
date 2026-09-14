/**
 * Autenticação e controle de acesso (seções 22 e 23).
 *
 * O sistema usa a identidade do Google Workspace da organização: nenhuma senha
 * é armazenada. O e-mail autenticado é usado para localizar o perfil do
 * usuário na aba USUARIOS. Isso só funciona de fato (Session.getActiveUser())
 * quando o Web App é implantado com executeAs=USER_ACCESSING e access=DOMAIN
 * (ver appsscript.json) — configuração necessária para autenticação no domínio.
 */

var USUARIO_ATUAL_CACHE_ = null;

function getUsuarioAtual_() {
  if (USUARIO_ATUAL_CACHE_) return USUARIO_ATUAL_CACHE_;

  var email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  if (!email) {
    throw new Error(
      'Não foi possível identificar o usuário autenticado. Verifique se o aplicativo ' +
      'está implantado para o domínio da organização (Google Workspace).'
    );
  }

  var usuarios = getAllRecords_(SHEET_NAMES.USUARIOS);

  // Bootstrap: se ainda não há nenhum usuário cadastrado, o primeiro a abrir o
  // sistema vira ADMINISTRADOR automaticamente — é a única forma de existir
  // alguém com permissão para cadastrar os demais usuários.
  if (usuarios.length === 0) {
    var novoAdmin = criarRegistroComId_(SHEET_NAMES.USUARIOS, 'USR', 4, {
      email: email,
      nome: email.split('@')[0],
      perfil: PERFIS.ADMINISTRADOR,
      ativo: true
    });
    USUARIO_ATUAL_CACHE_ = novoAdmin;
    return novoAdmin;
  }

  var encontrado = usuarios.filter(function (u) {
    return String(u.email).toLowerCase() === email.toLowerCase();
  })[0];

  if (!encontrado || encontrado.ativo === false) {
    // Usuário autenticado no domínio mas não cadastrado (ou desativado):
    // acesso mínimo, somente consulta, até um ADMINISTRADOR liberar o perfil.
    encontrado = { id: '', email: email, nome: email.split('@')[0], perfil: PERFIS.CONSULTA, ativo: true };
  }

  USUARIO_ATUAL_CACHE_ = encontrado;
  return encontrado;
}

function requirePerfil_(perfisPermitidos) {
  var usuario = getUsuarioAtual_();
  if (perfisPermitidos.indexOf(usuario.perfil) === -1) {
    throw new Error('Permissão negada para o perfil "' + usuario.perfil + '".');
  }
  return usuario;
}
