const { getLocalityByMunicipalityId, validateLocality } = require("./localities");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CNPJ_PATTERN = /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/;
const VALID_TYPES = new Set(["claim", "correction", "removal"]);

function sanitize(text) {
  if (typeof text !== "string") return "";
  return text.replace(/[<>]/g, "").trim();
}

function validateAndProcessClaim(payload) {
  if (!payload || typeof payload !== "object") {
    throw new TypeError("Payload da reivindicação deve ser um objeto");
  }

  const companyId = sanitize(payload.companyId);
  if (!companyId) {
    throw new Error("companyId é obrigatório");
  }

  const companyName = sanitize(payload.companyName);
  if (!companyName) {
    throw new Error("companyName é obrigatório");
  }

  const claimantName = sanitize(payload.claimantName);
  if (!claimantName || claimantName.length < 2) {
    throw new Error("claimantName deve ter pelo menos 2 caracteres");
  }

  const claimantEmail = sanitize(payload.claimantEmail).toLowerCase();
  if (!claimantEmail || !EMAIL_PATTERN.test(claimantEmail)) {
    throw new Error("claimantEmail deve ser um e-mail válido");
  }

  const claimType = sanitize(payload.claimType);
  if (!VALID_TYPES.has(claimType)) {
    throw new Error("claimType deve ser 'claim', 'correction' ou 'removal'");
  }

  const details = sanitize(payload.details);
  if (!details || details.length < 10) {
    throw new Error("details deve ter pelo menos 10 caracteres");
  }

  const municipalityId = sanitize(payload.municipalityId);
  const locality = getLocalityByMunicipalityId(municipalityId);
  if (!locality) {
    throw new Error(`Município IBGE inválido ou não cadastrado: ${municipalityId}`);
  }

  let sanitizedCnpj = null;
  if (payload.cnpj) {
    const rawCnpj = sanitize(payload.cnpj);
    if (rawCnpj && !CNPJ_PATTERN.test(rawCnpj)) {
      throw new Error("CNPJ inválido (formato esperado: 00.000.000/0000-00 ou 14 dígitos)");
    }
    sanitizedCnpj = rawCnpj ? rawCnpj.replace(/\D/g, "") : null;
  }

  const claimantPhone = payload.claimantPhone ? sanitize(payload.claimantPhone) : null;

  const claimId = `claim-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  return {
    id: claimId,
    status: "pending_verification",
    submittedAt: new Date().toISOString(),
    locality: {
      municipalityId: locality.municipalityId,
      municipalityName: locality.municipalityName,
      stateCode: locality.stateCode,
      stateSlug: locality.stateSlug,
      municipalitySlug: locality.municipalitySlug,
    },
    company: {
      id: companyId,
      name: companyName,
      cnpj: sanitizedCnpj,
    },
    claimant: {
      name: claimantName,
      email: claimantEmail,
      phone: claimantPhone,
    },
    claimType,
    details,
  };
}

module.exports = {
  validateAndProcessClaim,
  VALID_TYPES,
};
