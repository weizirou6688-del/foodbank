import { useState } from 'react'
import { useAuthStore } from '@/app/store/authStore'
import {
  clearFormErrors,
  createEmptyRegisterForm,
  type FormErrors,
  validateRegisterForm,
} from './LoginModalState.helpers'
import type { LoginModalProps, RegisterFormState } from './LoginModal.types'

type UseLoginModalRegisterFlowOptions = Pick<LoginModalProps, 'onClose'>

export function useLoginModalRegisterFlow({ onClose }: UseLoginModalRegisterFlowOptions) {
  const { register } = useAuthStore()

  const [regForm, setRegForm] = useState<RegisterFormState>(createEmptyRegisterForm)
  const [regErrors, setRegErrors] = useState<FormErrors>({})
  const [regLoading, setRegLoading] = useState(false)

  const updateRegisterField = (key: keyof RegisterFormState, value: string) => {
    setRegForm((form) => ({ ...form, [key]: value }))
    setRegErrors((current) =>
      clearFormErrors(current, String(key), key === 'password' || key === 'confirm' ? ['confirm'] : []),
    )
  }

  const handleRegister = async () => {
    const errors = validateRegisterForm(regForm)

    setRegErrors(errors)
    if (Object.keys(errors).length > 0) return

    setRegLoading(true)
    const result = await register(regForm.name, regForm.email, regForm.password)
    setRegLoading(false)

    if (result.success) onClose()
    else setRegErrors({ email: result.message ?? 'Registration failed.' })
  }

  return {
    regForm,
    regErrors,
    regLoading,
    updateRegisterField,
    handleRegister,
  }
}
