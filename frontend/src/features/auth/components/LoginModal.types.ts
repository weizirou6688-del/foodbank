import type { AllowedRole } from '../auth.helpers'

export type AuthTab = 'signin' | 'register'
export type SignInView = 'signin' | 'forgot' | 'reset'
export type Feedback = { tone: 'success' | 'error'; message: string }
export type SubmitHandler = () => Promise<void> | void
export type FormValues = Record<string, string>

export interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: AuthTab
  redirectTo?: string | null
  requiredRole?: AllowedRole
}

export type SignInFormState = {
  email: string
  password: string
}

export type ResetFormState = {
  email: string
  verificationCode: string
  newPassword: string
  confirm: string
}

export type RegisterFormState = {
  name: string
  email: string
  password: string
  confirm: string
}

export type FieldConfig<FormState extends FormValues> = readonly [
  label: string,
  key: keyof FormState,
  type: 'text' | 'email' | 'password',
  placeholder: string,
]

export type FieldErrors<FormState extends FormValues> = Partial<Record<keyof FormState, string>>
export type VisibilityState<FormState extends FormValues> = Partial<Record<keyof FormState, boolean>>

type PanelProps = {
  onSubmit: SubmitHandler
}

export type SignInPanelProps = PanelProps & {
  signInForm: SignInFormState
  signInError: string
  signInNotice: string
  signInLoading: boolean
  showSignInPassword: boolean
  onFieldChange: (key: keyof SignInFormState, value: string) => void
  onTogglePassword: () => void
  onOpenForgotPassword: () => void
}

export type ForgotPasswordPanelProps = PanelProps & {
  forgotEmail: string
  forgotFeedback: Feedback | null
  forgotLoading: boolean
  onEmailChange: (value: string) => void
  onBackToSignIn: () => void
}

export type ResetPasswordPanelProps = PanelProps & {
  resetForm: ResetFormState
  resetErrors: Record<string, string>
  resetFeedback: Feedback | null
  resetLoading: boolean
  showResetPassword: boolean
  showResetConfirm: boolean
  onFieldChange: (key: keyof ResetFormState, value: string) => void
  onToggleResetPassword: () => void
  onToggleResetConfirm: () => void
  onUseAnotherEmail: () => void
  onBackToSignIn: () => void
}

export type RegisterPanelProps = PanelProps & {
  regForm: RegisterFormState
  regErrors: Record<string, string>
  regLoading: boolean
  showRegisterPassword: boolean
  showRegisterConfirm: boolean
  onFieldChange: (key: keyof RegisterFormState, value: string) => void
  onToggleRegisterPassword: () => void
  onToggleRegisterConfirm: () => void
}
