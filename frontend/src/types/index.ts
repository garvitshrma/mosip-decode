export type CredentialStatus = "issued" | "held" | "presented" | "verified" | "invalid";

export interface Credential {
  id: string;
  type: string;
  holder: string;
  issuer: string;
  issuedAt: string;
  status: CredentialStatus;
}
