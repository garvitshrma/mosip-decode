import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Logo } from "./Logo";
import { routes } from "../../utils/navigation";
import { api } from "../../api/client";

export function AppHeader() {
  // The pill used to always read "Simulated engine". It now reports the real
  // backend, so the UI never claims more than it has.
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .health()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
  }, []);

  const text = online === null ? "Checking backend" : online ? "Backend connected" : "Backend offline";

  return (
    <header className="app-header">
      <Link to={routes.home} className="brand-link">
        <Logo />
      </Link>
      <nav>
        <NavLink to={routes.issuer}>Issuer</NavLink>
        <NavLink to={routes.wallet}>Wallet</NavLink>
        <NavLink to={routes.verifier}>Verifier</NavLink>
        <NavLink to={routes.playground}>Playground</NavLink>
      </nav>
      <span className={`engine-pill ${online === false ? "offline" : online ? "online" : ""}`}>● {text}</span>
    </header>
  );
}
