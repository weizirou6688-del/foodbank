import { isStrongPassword, isValidEmail } from '@/shared/lib/validation'
import type {
  AuthTab,
  RegisterFormState,
  ResetFormState,
  SignInFormState,
  SignInView,
} from './LoginModal.types'

const PASSWORD_RULE_MESSAGE = 'Password must include letters, numbers, and special characters (no spaces).'

const EMPTY_PASSWORD_VISIBILITY = {
  signIn: false,
  reset: false,
  resetConfirm: false,
  register: false,
  registerConfirm: false,
}

export type PasswordVisibilityKey = keyof typeof EMPTY_PASSWORD_VISIBILITY
export type FormErrors = Record<string, string>

export function createEmptySignInForm(): SignInFormState {
  return {
    email: '',
    password: '',
  }
}

export function createEmptyRegisterForm(): RegisterFormState {
  return {
    name: '',
    email: '',
    password: '',
    confirm: '',
  }
}

export function createEmptyResetForm(): ResetFormState {
  return {
    email: '',
    verificationCode: '',
    newPassword: '',
    confirm: '',
  }
}

export function createPasswordVisibilityState() {
  return { ...EMPTY_PASSWORD_VISIBILITY }
}

export function clearFormErrors(current: FormErrors, key: string, relatedKeys: string[] = []) {
  const next = { ...current }

  ;[key, ...relatedKeys].forEach((entry) => {
    delete next[entry]
  })

  return next
}

export function validateResetForm(resetForm: ResetFormState): FormErrors {
  const errors: FormErrors = {}
  const passwordIsStrong = isStrongPassword(resetForm.newPassword)

  if (!isValidEmail(resetForm.email)) errors.email = 'Please enter a valid email.'
  if (!resetForm.verificationCode.trim()) errors.verificationCode = 'Verification code is required.'
  else if (!/^\d{6}$/.test(resetForm.verificationCode.trim())) {
    errors.verificationCode = 'Verification code must contain exactly 6 digits.'
  }
  if (!passwordIsStrong) errors.newPassword = PASSWORD_RULE_MESSAGE
  if (!resetForm.confirm) errors.confirm = 'Please confirm password.'
  else if (passwordIsStrong && resetForm.newPassword !== resetForm.confirm) {
    errors.confirm = 'Passwords do not match.'
  }

  return errors
}

export function validateRegisterForm(regForm: RegisterFormState): FormErrors {
  const errors: FormErrors = {}
  const passwordIsStrong = isStrongPassword(regForm.password)

  if (!regForm.name.trim()) errors.name = 'Name is required.'
  if (!isValidEmail(regForm.email)) errors.email = 'Please enter a valid email.'
  if (!passwordIsStrong) errors.password = PASSWORD_RULE_MESSAGE
  if (!regForm.confirm) errors.confirm = 'Please confirm password.'
  else if (passwordIsStrong && regForm.password !== regForm.confirm) {
    errors.confirm = 'Passwords do not match.'
  }

  return errors
}

export function modalTitleFor(tab: AuthTab, signInView: SignInView) {
  if (tab === 'register') return 'Create Account'
  if (signInView === 'forgot') return 'Forgot Password'
  if (signInView === 'reset') return 'Reset Password'
  return 'Welcome Back'
}
