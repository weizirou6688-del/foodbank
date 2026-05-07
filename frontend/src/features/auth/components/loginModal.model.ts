import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/app/store/authStore";
import { isStrongPassword, isValidEmail } from "@/shared/lib/validation";
import { getPostLoginRedirect, type AllowedRole } from "../auth.helpers";

export type AuthTab = "signin" | "register";
export type SignInView = "signin" | "forgot" | "reset";
export type Feedback = { tone: "success" | "error"; message: string };
export type SubmitHandler = () => Promise<void> | void;
export type FormValues = Record<string, string>;

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: AuthTab;
  redirectTo?: string | null;
  requiredRole?: AllowedRole;
}

export type SignInFormState = { email: string; password: string };
export type ResetFormState = {
  email: string;
  verificationCode: string;
  newPassword: string;
  confirm: string;
};
export type RegisterFormState = {
  name: string;
  email: string;
  password: string;
  confirm: string;
};
export type FieldConfig<FormState extends FormValues> = readonly [
  label: string,
  key: keyof FormState,
  type: "text" | "email" | "password",
  placeholder: string,
];
export type FieldErrors<FormState extends FormValues> = Partial<
  Record<keyof FormState, string>
>;
export type VisibilityState<FormState extends FormValues> = Partial<
  Record<keyof FormState, boolean>
>;

export const AUTH_TABS = [
  "signin",
  "register",
] as const satisfies readonly AuthTab[];

export const DEMO_SIGNIN_ACCOUNTS = [
  "Platform Admin: admin@foodbank.com / admin123",
  "Local Admin (Jubilee Storehouse): localadmin@foodbank.com / localadmin123",
  "Local Admin (Westside Food Support Centre): local1admin@foodbank.com / local1admin123",
  "Supermarket: supermarket@foodbank.com / supermarket123",
  "Public User: user@example.com / user12345",
] as const;

export const SIGNIN_FIELDS: FieldConfig<SignInFormState>[] = [
  ["Email Address", "email", "email", "you@example.com"],
  ["Password", "password", "password", "Enter password"],
];

export const FORGOT_FIELDS: FieldConfig<Pick<SignInFormState, "email">>[] = [
  ["Email Address", "email", "email", "you@example.com"],
];

export const REGISTER_FIELDS: FieldConfig<RegisterFormState>[] = [
  ["Full Name", "name", "text", "Your name"],
  ["Email Address", "email", "email", "you@example.com"],
  [
    "Password",
    "password",
    "password",
    "At least 8 chars with letters, numbers, and symbols",
  ],
  ["Confirm Password", "confirm", "password", "Repeat password"],
];

export const RESET_FIELDS: FieldConfig<ResetFormState>[] = [
  ["Email Address", "email", "email", "you@example.com"],
  [
    "Verification Code",
    "verificationCode",
    "text",
    "Enter the 6-digit code from your email",
  ],
  [
    "New Password",
    "newPassword",
    "password",
    "At least 8 chars with letters, numbers, and symbols",
  ],
  ["Confirm Password", "confirm", "password", "Repeat new password"],
];

const EMPTY_PASSWORD_VISIBILITY = {
  signIn: false,
  reset: false,
  resetConfirm: false,
  register: false,
  registerConfirm: false,
};

export type PasswordVisibilityKey =
  | "signIn"
  | "reset"
  | "resetConfirm"
  | "register"
  | "registerConfirm";

export type FormErrors = Record<string, string>;

const PASSWORD_RULE_MESSAGE =
  "Password must include letters, numbers, and special characters (no spaces).";

export function createEmptySignInForm(): SignInFormState {
  return { email: "", password: "" };
}

export function createEmptyRegisterForm(): RegisterFormState {
  return { name: "", email: "", password: "", confirm: "" };
}

export function createEmptyResetForm(): ResetFormState {
  return { email: "", verificationCode: "", newPassword: "", confirm: "" };
}

export function createPasswordVisibilityState() {
  return { ...EMPTY_PASSWORD_VISIBILITY };
}

export function clearFormErrors(
  current: FormErrors,
  key: string,
  relatedKeys: string[] = [],
) {
  const next = { ...current };
  [key, ...relatedKeys].forEach((entry) => {
    delete next[entry];
  });
  return next;
}

export function validateResetForm(resetForm: ResetFormState): FormErrors {
  const errors: FormErrors = {};
  const passwordIsStrong = isStrongPassword(resetForm.newPassword);

  if (!isValidEmail(resetForm.email)) {
    errors.email = "Please enter a valid email.";
  }
  if (!resetForm.verificationCode.trim()) {
    errors.verificationCode = "Verification code is required.";
  } else if (!/^\d{6}$/.test(resetForm.verificationCode.trim())) {
    errors.verificationCode =
      "Verification code must contain exactly 6 digits.";
  }
  if (!passwordIsStrong) {
    errors.newPassword = PASSWORD_RULE_MESSAGE;
  }
  if (!resetForm.confirm) {
    errors.confirm = "Please confirm password.";
  } else if (passwordIsStrong && resetForm.newPassword !== resetForm.confirm) {
    errors.confirm = "Passwords do not match.";
  }

  return errors;
}

export function validateRegisterForm(regForm: RegisterFormState): FormErrors {
  const errors: FormErrors = {};
  const passwordIsStrong = isStrongPassword(regForm.password);

  if (!regForm.name.trim()) {
    errors.name = "Name is required.";
  }
  if (!isValidEmail(regForm.email)) {
    errors.email = "Please enter a valid email.";
  }
  if (!passwordIsStrong) {
    errors.password = PASSWORD_RULE_MESSAGE;
  }
  if (!regForm.confirm) {
    errors.confirm = "Please confirm password.";
  } else if (passwordIsStrong && regForm.password !== regForm.confirm) {
    errors.confirm = "Passwords do not match.";
  }

  return errors;
}

export function modalTitleFor(tab: AuthTab, signInView: SignInView) {
  if (tab === "register") {
    return "Create Account";
  }
  if (signInView === "forgot") {
    return "Forgot Password";
  }
  if (signInView === "reset") {
    return "Reset Password";
  }
  return "Welcome Back";
}

export type LoginModalControllerOptions = {
  initialTab?: AuthTab;
  redirectTo?: string | null;
  requiredRole?: AllowedRole;
};
type LoginModalControllerState = {
  open: boolean;
  initialTab: AuthTab;
  redirectTo: string | null;
  requiredRole: AllowedRole;
};
type OpenLoginModalOptions = Partial<LoginModalControllerOptions>;
const createControllerState = ({
  initialTab = "signin",
  redirectTo = null,
  requiredRole,
}: LoginModalControllerOptions = {}): LoginModalControllerState => ({
  open: false,
  initialTab,
  redirectTo,
  requiredRole,
});
export function useLoginModalController(
  defaults: LoginModalControllerOptions = {},
) {
  // 路由和页面外壳都会打开此弹窗,因此控制器在开关状态旁边一并保存触发意图
  const [state, setState] = useState<LoginModalControllerState>(() =>
    createControllerState(defaults),
  );
  const close = useCallback(() => {
    setState((current) => ({ ...current, open: false }));
  }, []);
  const open = useCallback(
    (options: OpenLoginModalOptions = {}) => {
      setState({
        open: true,
        initialTab: options.initialTab ?? defaults.initialTab ?? "signin",
        redirectTo: options.redirectTo ?? defaults.redirectTo ?? null,
        requiredRole: options.requiredRole ?? defaults.requiredRole,
      });
    },
    [defaults.initialTab, defaults.redirectTo, defaults.requiredRole],
  );
  const openSignIn = useCallback(
    (options: Omit<OpenLoginModalOptions, "initialTab"> = {}) => {
      open({ ...options, initialTab: "signin" });
    },
    [open],
  );
  const openRegister = useCallback(
    (options: Omit<OpenLoginModalOptions, "initialTab"> = {}) => {
      open({ ...options, initialTab: "register" });
    },
    [open],
  );
  const modalProps: LoginModalProps = useMemo(
    () => ({
      isOpen: state.open,
      onClose: close,
      initialTab: state.initialTab,
      redirectTo: state.redirectTo,
      requiredRole: state.requiredRole,
    }),
    [close, state.initialTab, state.open, state.redirectTo, state.requiredRole],
  );
  return useMemo(
    () => ({
      isOpen: state.open,
      open,
      openSignIn,
      openRegister,
      close,
      modalProps,
    }),
    [close, modalProps, open, openRegister, openSignIn, state.open],
  );
}

type UseLoginModalModelOptions = Pick<
  LoginModalProps,
  "initialTab" | "isOpen" | "onClose" | "redirectTo" | "requiredRole"
>;
export function useLoginModalModel({
  initialTab = "signin",
  isOpen,
  onClose,
  redirectTo,
  requiredRole,
}: UseLoginModalModelOptions) {
  // 将登录、注册、忘记密码和重置密码流程都放在一个 model 里,使弹窗切换视图时不丢失共享上下文
  const { login, register } = useAuthStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [signInForm, setSignInForm] = useState(createEmptySignInForm);
  const [signInError, setSignInError] = useState("");
  const [signInNotice, setSignInNotice] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);
  const [regForm, setRegForm] = useState(createEmptyRegisterForm);
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});
  const [regLoading, setRegLoading] = useState(false);
  const [signInView, setSignInView] = useState<SignInView>("signin");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotFeedback, setForgotFeedback] = useState<Feedback | null>(null);
  const [resetForm, setResetForm] =
    useState<ResetFormState>(createEmptyResetForm);
  const [resetErrors, setResetErrors] = useState<FormErrors>({});
  const [resetLoading, setResetLoading] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<Feedback | null>(null);
  const [passwordVisibility, setPasswordVisibility] = useState(
    createPasswordVisibilityState,
  );
  const clearSignInStatus = useCallback(() => {
    setSignInError("");
    setSignInNotice("");
  }, []);
  const updateSignInField = (key: keyof typeof signInForm, value: string) => {
    setSignInForm((form) => ({ ...form, [key]: value }));
  };
  const syncSignInEmail = useCallback((email: string) => {
    setSignInForm((form) => ({ ...form, email }));
  }, []);
  const completePasswordReset = useCallback((email: string, notice: string) => {
    setSignInForm((form) => ({ ...form, email, password: "" }));
    setSignInError("");
    setSignInNotice(notice);
  }, []);
  const handleSignIn = async () => {
    clearSignInStatus();
    if (!signInForm.email || !signInForm.password) {
      setSignInError("Please fill in all fields.");
      return;
    }
    if (!isValidEmail(signInForm.email)) {
      setSignInError("Please enter a valid email.");
      return;
    }
    setSignInLoading(true);
    const result = await login(signInForm.email, signInForm.password);
    setSignInLoading(false);
    if (!result.success) {
      setSignInError(result.message ?? "Login failed.");
      return;
    }
    onClose();
    const { user } = useAuthStore.getState();
    const destination = getPostLoginRedirect(user, redirectTo, requiredRole);
    if (destination) {
      navigate(
        destination,
        destination.startsWith("/admin") || destination.startsWith("/workspace")
          ? { replace: true }
          : undefined,
      );
    }
  };
  const updateRegisterField = (key: keyof typeof regForm, value: string) => {
    setRegForm((form) => ({ ...form, [key]: value }));
    setRegErrors((current) =>
      clearFormErrors(
        current,
        String(key),
        key === "password" || key === "confirm" ? ["confirm"] : [],
      ),
    );
  };
  const handleRegister = async () => {
    const errors = validateRegisterForm(regForm);
    setRegErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setRegLoading(true);
    const result = await register(
      regForm.name,
      regForm.email,
      regForm.password,
    );
    setRegLoading(false);
    if (result.success) onClose();
    else setRegErrors({ email: result.message ?? "Registration failed." });
  };
  const resetState = useCallback(() => {
    setSignInView("signin");
    clearSignInStatus();
    setForgotEmail("");
    setForgotFeedback(null);
    setResetForm(createEmptyResetForm());
    setResetErrors({});
    setResetFeedback(null);
  }, [clearSignInStatus]);
  const openForgotPassword = () => {
    setSignInView("forgot");
    clearSignInStatus();
    setForgotFeedback(null);
    setResetFeedback(null);
    setForgotEmail((current) => current || signInForm.email);
  };
  const handleForgotPassword = async () => {
    if (!isValidEmail(forgotEmail)) {
      setForgotFeedback({
        tone: "error",
        message: "Please enter a valid email.",
      });
      return;
    }
    setForgotLoading(true);
    setForgotFeedback(null);
    const result = await useAuthStore.getState().forgotPassword(forgotEmail);
    setForgotLoading(false);
    if (!result.success) {
      setForgotFeedback({
        tone: "error",
        message: result.message ?? "Unable to start password reset.",
      });
      return;
    }
    syncSignInEmail(forgotEmail);
    setResetForm({
      email: forgotEmail,
      verificationCode: "",
      newPassword: "",
      confirm: "",
    });
    setResetErrors({});
    setSignInView("reset");
    setResetFeedback({
      tone: "success",
      message:
        result.message ??
        "If this email exists, a verification code has been sent. Enter it below with your new password.",
    });
  };
  const changeForgotEmail = (value: string) => {
    setForgotEmail(value);
    setForgotFeedback(null);
  };
  const backToSignInFromForgot = () => {
    setSignInView("signin");
    setForgotFeedback(null);
  };
  const updateResetField = (key: keyof ResetFormState, value: string) => {
    setResetForm((form) => ({ ...form, [key]: value }));
    setResetErrors((current) =>
      clearFormErrors(
        current,
        String(key),
        key === "newPassword" || key === "confirm" ? ["confirm"] : [],
      ),
    );
    setResetFeedback((current) => (current?.tone === "error" ? null : current));
  };
  const handleResetPassword = async () => {
    const errors = validateResetForm(resetForm);
    setResetErrors(errors);
    setResetFeedback(null);
    if (Object.keys(errors).length > 0) return;
    const email = resetForm.email.trim();
    setResetLoading(true);
    const result = await useAuthStore
      .getState()
      .resetPassword(
        email,
        resetForm.verificationCode.trim(),
        resetForm.newPassword,
      );
    setResetLoading(false);
    if (!result.success) {
      setResetFeedback({
        tone: "error",
        message: result.message ?? "Password reset failed.",
      });
      return;
    }
    setResetForm(createEmptyResetForm());
    setResetErrors({});
    setResetFeedback(null);
    setSignInView("signin");
    completePasswordReset(
      email,
      result.message ??
        "Password reset successful. Please sign in with your new password.",
    );
  };
  const useAnotherEmail = () => {
    setForgotEmail(resetForm.email);
    setSignInView("forgot");
    setResetFeedback(null);
  };
  const backToSignInFromReset = () => {
    setSignInView("signin");
    setResetFeedback(null);
    setResetErrors({});
  };
  const togglePasswordVisibility = (key: PasswordVisibilityKey) => {
    setPasswordVisibility((state) => ({ ...state, [key]: !state[key] }));
  };
  const resetAuthViews = (nextTab: AuthTab) => {
    setTab(nextTab);
    resetState();
    setPasswordVisibility(createPasswordVisibilityState());
  };
  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab);
    resetState();
    setPasswordVisibility(createPasswordVisibilityState());
  }, [initialTab, isOpen, resetState]);
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);
  return {
    isOpen,
    onClose,
    tab,
    signInView,
    modalTitle: modalTitleFor(tab, signInView),
    signInForm,
    signInError,
    signInNotice,
    signInLoading,
    forgotEmail,
    forgotLoading,
    forgotFeedback,
    resetForm,
    resetErrors,
    resetLoading,
    resetFeedback,
    regForm,
    regErrors,
    regLoading,
    passwordVisibility,
    resetAuthViews,
    togglePasswordVisibility,
    updateSignInField,
    handleSignIn,
    openForgotPassword,
    handleForgotPassword,
    changeForgotEmail,
    backToSignInFromForgot,
    updateResetField,
    handleResetPassword,
    useAnotherEmail,
    backToSignInFromReset,
    updateRegisterField,
    handleRegister,
  };
}
export type LoginModalModel = ReturnType<typeof useLoginModalModel>;
