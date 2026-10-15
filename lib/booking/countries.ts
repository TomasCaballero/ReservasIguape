// Países para el prefijo telefónico (RF-20). Lista acotada; ampliable.
export const COUNTRIES = [
  { code: "AR", name: "Argentina", prefix: "+54" },
  { code: "BR", name: "Brasil", prefix: "+55" },
  { code: "UY", name: "Uruguay", prefix: "+598" },
  { code: "CL", name: "Chile", prefix: "+56" },
  { code: "PY", name: "Paraguay", prefix: "+595" },
  { code: "BO", name: "Bolivia", prefix: "+591" },
  { code: "PE", name: "Perú", prefix: "+51" },
  { code: "CO", name: "Colombia", prefix: "+57" },
  { code: "VE", name: "Venezuela", prefix: "+58" },
  { code: "EC", name: "Ecuador", prefix: "+593" },
  { code: "MX", name: "México", prefix: "+52" },
  { code: "US", name: "Estados Unidos", prefix: "+1" },
  { code: "ES", name: "España", prefix: "+34" },
  { code: "IT", name: "Italia", prefix: "+39" },
  { code: "FR", name: "Francia", prefix: "+33" },
  { code: "DE", name: "Alemania", prefix: "+49" },
  { code: "GB", name: "Reino Unido", prefix: "+44" },
] as const;

export const DEFAULT_COUNTRY = COUNTRIES[0];

export const isKnownPrefix = (prefix: string) => COUNTRIES.some((c) => c.prefix === prefix);
