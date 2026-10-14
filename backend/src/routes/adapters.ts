import { Router } from "express";
import { CREDENTIAL_FORMATS } from "@playground/shared";
import { catalogue } from "../adapters";

export const adapterRoutes = Router();

// What the three selector columns and the format dropdown are built from.
adapterRoutes.get("/adapters", (_req, res) => {
  res.json({ ...catalogue(), formats: CREDENTIAL_FORMATS });
});
