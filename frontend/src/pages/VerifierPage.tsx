import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { VerifierPanel } from "../components/verifier/VerifierPanel";
import { routes } from "../utils/navigation";

export function VerifierPage() {
  return (
    <div className="page-container">
      <div className="page-heading">
        <span>MODULE 03</span>
        <h1>Verifier</h1>
        <p>Inji Verify · OpenID4VP</p>
      </div>
      <div className="banner info">
        <ShieldCheck size={18} />
        <span>The configured Inji Verify SDK is shown below. For the working end-to-end verification, use the local reference verifier in the Playground.</span>
        <Link className="secondary-btn" to={routes.playground}>Open playground</Link>
      </div>
      <VerifierPanel />
    </div>
  );
}