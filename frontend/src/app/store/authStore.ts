import type { User } from "@/shared/types/auth";
import {
  apiClient,
  registerUnauthorizedSessionHandler,
} from "@/shared/lib/apiClient";
import { createStore } from "@/shared/lib/store";
type AuthActionResult = { success: boolean; message?: string };
type AuthSessionPayload = { access_token: string; user: User };
type MessageResponse = { message?: string };
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  refreshSession: () => Promise<void>;
  logout: () => void;
  signOut: () => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<AuthActionResult>;
  forgotPassword: (email: string) => Promise<AuthActionResult>;
  resetPassword: (
    email: string,
    verificationCode: string,
    newPassword: string,
  ) => Promise<AuthActionResult>;
}
function normalizeUser(user: User | null | undefined): User | null {
  if (!user) {
    return null;
  }
  return {
    ...user,
    food_bank_id: user.food_bank_id ?? null,
    food_bank_name: user.food_bank_name ?? null,
  };
}
const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;
const clearedAuthState = {
  user: null,
  isAuthenticated: false,
  accessToken: null,
};
function buildAuthenticatedState(payload: AuthSessionPayload) {
  return {
    user: normalizeUser(payload.user),
    isAuthenticated: true,
    accessToken: payload.access_token,
  };
}
const registerAuth = (data: {
  name: string;
  email: string;
  password: string;
}) => apiClient.post<User>("/api/v1/auth/register", data);
const loginAuth = (data: { email: string; password: string }) =>
  apiClient.post<AuthSessionPayload>("/api/v1/auth/login", data);
const getCurrentUser = (token: string) =>
  apiClient.get<User>("/api/v1/auth/me", token);
const forgotPasswordAuth = (data: { email: string }) =>
  apiClient.post<MessageResponse>("/api/v1/auth/forgot-password", data);
const resetPasswordAuth = (data: {
  email: string;
  verification_code: string;
  new_password: string;
}) => apiClient.post<MessageResponse>("/api/v1/auth/reset-password", data);
const logoutAuth = (token: string) =>
  apiClient.postNoContent("/api/v1/auth/logout", {}, token);
export const useAuthStore = createStore<AuthState>(
  (set) => ({
    ...clearedAuthState,
    login: async (email, password) => {
      try {
        const session = await loginAuth({ email, password });
        set(buildAuthenticatedState(session));
        return { success: true };
      } catch (error) {
        return {
          success: false,
          message: getErrorMessage(error, "Login failed"),
        };
      }
    },
    refreshSession: async () => {
      const accessToken = useAuthStore.getState().accessToken;
      if (!accessToken) {
        return;
      }
      try {
        const user = await getCurrentUser(accessToken);
        set({ user: normalizeUser(user), isAuthenticated: true, accessToken });
      } catch (error) {
        const message = getErrorMessage(error, "");
        if (message === "User not found") {
          set(clearedAuthState);
        }
      }
    },
    logout: () => {
      set(clearedAuthState);
    },
    signOut: async () => {
      const accessToken = useAuthStore.getState().accessToken;
      set(clearedAuthState);
      if (!accessToken) {
        return;
      }
      try {
        await logoutAuth(accessToken);
      } catch {
        void 0;
      }
    },
    register: async (name, email, password) => {
      try {
        await registerAuth({ name, email, password });
        try {
          const session = await loginAuth({ email, password });
          set(buildAuthenticatedState(session));
        } catch {
          void 0;
        }
        return { success: true };
      } catch (error) {
        return {
          success: false,
          message: getErrorMessage(error, "Registration failed"),
        };
      }
    },
    forgotPassword: async (email) => {
      try {
        const data = await forgotPasswordAuth({ email });
        return { success: true, message: data.message };
      } catch (error) {
        return {
          success: false,
          message: getErrorMessage(error, "Unable to start password reset"),
        };
      }
    },
    resetPassword: async (email, verificationCode, newPassword) => {
      try {
        const data = await resetPasswordAuth({
          email,
          verification_code: verificationCode,
          new_password: newPassword,
        });
        return {
          success: true,
          message: data.message ?? "Password reset successful.",
        };
      } catch (error) {
        return {
          success: false,
          message: getErrorMessage(error, "Password reset failed"),
        };
      }
    },
  }),
  {
    key: "fba-auth-storage",
    partialize: (state) => ({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
      accessToken: state.accessToken,
    }),
  },
);
// 让共享的 API 客户端在一处统一将过期会话重置为已清除状态,避免在各页面散落 401 处理逻辑
registerUnauthorizedSessionHandler(() => {
  useAuthStore.getState().logout();
});
