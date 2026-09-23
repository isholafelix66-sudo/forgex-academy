import { useNavigate } from "react-router";
import { Navigate } from "react-router";
import { useEffect } from "react";

/**
 * /portfolio/signin — legacy password screen.
 *
 * The password sign-in was removed: it opened the admin portal, which a
 * normal Portfolio user must never reach. This route now forwards visitors
 * to the Portfolio auth flow (email → OTP → dashboard). The admin portal
 * is reached only by typing /adminbrand and signing in with its credential.
 */
export default function PortfolioSignIn() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/portfolio/auth", { replace: true });
  }, [navigate]);

  return <Navigate to="/portfolio/auth" replace />;
}
