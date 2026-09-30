const { validateAndProcessClaim } = require("../lib/claim_submission");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", ["POST"]);
    return response.status(405).json({
      error: "Method Not Allowed",
      message: "Utilize o método POST para enviar reivindicação ou correção.",
    });
  }

  try {
    const payload = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    const result = validateAndProcessClaim(payload);
    return response.status(201).json({
      success: true,
      message: "Solicitação registrada com sucesso e aguardando verificação.",
      claim: result,
    });
  } catch (err) {
    if (err instanceof TypeError || err.message.includes("obrigatório") || err.message.includes("inválido") || err.message.includes("caracteres")) {
      return response.status(400).json({
        success: false,
        error: "Bad Request",
        message: err.message,
      });
    }
    return response.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "Ocorreu um erro ao processar a solicitação.",
    });
  }
};
