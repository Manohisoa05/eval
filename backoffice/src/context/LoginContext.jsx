import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Login from '../components/Login.jsx'
import { useAuth } from './AuthContext.jsx'

const initialForm = {
  email: '',
  password: '',
  remember: false,
}

function LoginContext() {
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const { login, loading, setError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/accueil'

  const dashboardErrors = useMemo(() => errors, [errors])

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = {}

    if (!form.email.trim()) {
      nextErrors.email = 'Email requis.'
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      nextErrors.email = 'Format email invalide.'
    }

    if (!form.password.trim()) {
      nextErrors.password = 'Mot de passe requis.'
    } else if (form.password.length < 6) {
      nextErrors.password = 'Au moins 6 caracteres.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length !== 0) return

    const res = await login(form.email, form.password)
    if (res.ok) {
      navigate(from, { replace: true })
      return
    }

    setErrors({ ...nextErrors, password: res.error || 'Authentification echouee' })
    setError(res.error || 'Authentification echouee')
  }

  return (
    <Login
      form={form}
      errors={dashboardErrors}
      onChange={handleChange}
      onSubmit={handleSubmit}
      loading={loading}
    />
  )
}

export default LoginContext
