import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const PublicPageNav = () => {
  const navigate = useNavigate();
  return (
    <div style={{
      position: "sticky",
      top: 0,
      zIndex: 50,
      borderBottom: "0.5px solid hsl(var(--border) / 0.3)",
      background: "hsl(var(--background))",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      height: 48,
    }}>
      <Link to="/" style={{
        fontSize: 14,
        fontWeight: 600,
        color: "hsl(var(--foreground))",
        textDecoration: "none",
        letterSpacing: "-0.01em",
      }}>
        Quantivis
      </Link>
      <button
        onClick={() => navigate(-1)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "hsl(var(--muted-foreground))",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "4px 0",
        }}
      >
        <ArrowLeft size={14} />
        Back
      </button>
    </div>
  );
};

export default PublicPageNav;
