function Login({ form, errors, onChange, onSubmit }) {

  form.email = "mramiarinarivo@gmail.com";
  form.password = "tsytadidiko";

  return (
    <div className="login-page">
      <div className="login-card card shadow-lg border-0">
        <div className="card-body p-4 p-md-5">
          <div className="mb-4 text-center">
            <span className="badge text-bg-primary px-3 py-2">ERP Suite</span>
            <h1 className="mt-3 mb-2">Connexion</h1>
            <p className="text-muted mb-0">
              Controle frontend avant l&apos;acces aux modules.
            </p>
          </div>

          <form onSubmit={onSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                placeholder="nom@entreprise.com"
                value={form.email}
                onChange={onChange}
                tabIndex={1}
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
                className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                placeholder="Entrez votre mot de passe"
                value={form.password}
                onChange={onChange}
                tabIndex={2}
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

            <button type="submit" className="btn btn-primary w-100" tabIndex={3}>
              Se connecter
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login
