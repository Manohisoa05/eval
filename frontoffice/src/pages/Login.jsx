import { useState } from "react";
import { useNavigate } from "react-router-dom";
import handleLogin from "../services/auth";

const initialForm = {
  email: "",
  password: "",
  remember: false,
};

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  form.email = "rakoto@yopmail.com";
  form.password = "XvzsX5O0!GBD0uXQ";

  const onChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.email) nextErrors.email = "Email requis";
    if (!form.password) nextErrors.password = "Mot de passe requis";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitError("");
    setSubmitting(true);
    try {
      const result = await handleLogin(form.email, form.password, form.remember)
      if (!result || !result.ok) {
        setSubmitError(result?.message || "Connexion echouee.")
        return
      }

      navigate("/product", { replace: true })
    } catch (e) {
      setSubmitError("Connexion echouee.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="login-page">
      <div className="login-card card shadow-lg border-0">
        <div className="card-body p-4 p-md-5">
          <div className="mb-4 text-center">
            <span className="badge text-bg-primary px-3 py-2">Boutique</span>
            <h1 className="mt-3 mb-2">Connexion</h1>
            <p className="text-muted mb-0">Acces client a votre boutique.</p>
          </div>

          <form onSubmit={onSubmit} noValidate>
            {submitError ? (
              <div className="alert alert-danger" role="alert">
                {submitError}
              </div>
            ) : null}
            <div className="mb-3">
              <label className="form-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className={`form-control ${errors.email ? "is-invalid" : ""}`}
                placeholder="nom@entreprise.com"
                value={form.email}
                onChange={onChange}
                required
              />
              {errors.email ? (
                <div className="invalid-feedback">{errors.email}</div>
              ) : null}
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="password">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className={`form-control ${errors.password ? "is-invalid" : ""}`}
                placeholder="Entrez votre mot de passe"
                value={form.password}
                onChange={onChange}
                required
              />
              {errors.password ? (
                <div className="invalid-feedback">{errors.password}</div>
              ) : null}
            </div>

            <div className="d-flex justify-content-between align-items-center mb-4">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="remember"
                  name="remember"
                  checked={form.remember}
                  onChange={onChange}
                />
                <label className="form-check-label" htmlFor="remember">
                  Se souvenir de moi
                </label>
              </div>
              <button type="button" className="btn btn-link p-0">
                Mot de passe oublie ?
              </button>
            </div>

            <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
              {submitting ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
