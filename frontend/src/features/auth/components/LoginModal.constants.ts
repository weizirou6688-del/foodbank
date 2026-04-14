import type {
  AuthTab,
  FieldConfig,
  RegisterFormState,
  ResetFormState,
  SignInFormState,
} from './LoginModal.types'

// ts-prune-ignore-next
export const AUTH_TABS = ['signin', 'register'] as const satisfies readonly AuthTab[]

export const DEMO_SIGNIN_ACCOUNTS = [
  'Platform Admin: admin@foodbank.com / admin123',
  'Local Admin (Downtown Community Food Bank): localadmin@foodbank.com / localadmin123',
  'Local Admin (Westside Food Support Centre): local1admin@foodbank.com / local1admin123',
  'Supermarket: supermarket@foodbank.com / supermarket123',
  'Public User: user@example.com / user12345',
] as const

export const SIGNIN_FIELDS: FieldConfig<SignInFormState>[] = [
  ['Email Address', 'email', 'email', 'you@example.com'],
  ['Password', 'password', 'password', 'Enter password'],
]

export const FORGOT_FIELDS: FieldConfig<Pick<SignInFormState, 'email'>>[] = [
  ['Email Address', 'email', 'email', 'you@example.com'],
]

export const REGISTER_FIELDS: FieldConfig<RegisterFormState>[] = [
  ['Full Name', 'name', 'text', 'Your name'],
  ['Email Address', 'email', 'email', 'you@example.com'],
  ['Password', 'password', 'password', 'At least 8 chars with letters, numbers, and symbols'],
  ['Confirm Password', 'confirm', 'password', 'Repeat password'],
]

export const RESET_FIELDS: FieldConfig<ResetFormState>[] = [
  ['Email Address', 'email', 'email', 'you@example.com'],
  ['Verification Code', 'verificationCode', 'text', 'Enter the 6-digit code from your email'],
  ['New Password', 'newPassword', 'password', 'At least 8 chars with letters, numbers, and symbols'],
  ['Confirm Password', 'confirm', 'password', 'Repeat new password'],
]

export const getPasswordEmoji = (visible: boolean) => (visible ? '\u{1F441}\uFE0F' : '\u{1F648}')
