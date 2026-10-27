import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { IssuerPanel } from "../components/issuer/IssuerPanel";
import { routes } from "../utils/navigation";

export function IssuerPage() {
  return (
    <div className="page-container">
      <div className="page-heading"><span>MODULE 01</span><h1>Issuer</h1><p>Inji Certify · OpenID4VCI</p></div>
      <div className="banner info">
        <Building2 size={18} />
        <span>The Inji Certify adapter below needs a configured deployment. For the working issuance demo, use the local reference issuer in the Playground.</span>
        <Link className="secondary-btn" to={routes.playground}>Open playground</Link>
      </div>
      <IssuerPanel />
    </div>
  );
}