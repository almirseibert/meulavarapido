// Envelope padrão de resposta { success, message, data } — igual ao app mobile espera.
function ok(res, data = null, message = 'OK', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function fail(res, message = 'Erro', status = 400, data = null) {
  return res.status(status).json({ success: false, message, data });
}

// Wrapper para rotas async — encaminha erros ao middleware central.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { ok, fail, wrap };
