import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";
import { Button, PasswordInput, Stack, TextInput } from "@mantine/core";
import { Lock, Mail } from "lucide-react";
import RegisterForm from "./register-form";
import AuthHeader from "./auth-header";
import { useLogin } from "../api/auth.queries";
import { useUser } from "../model/auth.store";
import { loginSchema, TLogin } from "../model/auth.schema";
import { useAuthModalStore } from "@/shared/model";
import { success } from "@/shared/lib";
import type { AuthMode } from "./auth-header";

const authModalOptions = { size: 440, padding: "lg" as const, radius: "lg" as const };

interface LoginFormProps {
  onModeChange?: (mode: AuthMode) => void;
}

export const LoginForm = ({ onModeChange }: LoginFormProps = {}) => {
  const loginM = useLogin();
  const { openModal, closeModal } = useAuthModalStore();
  const { login } = useUser();
  const { register, handleSubmit, formState: { errors } } = useForm<TLogin>({
    resolver: standardSchemaResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const showRegister = () => {
    if (onModeChange) {
      onModeChange("register");
      return;
    }
    openModal({ title: "", content: <RegisterForm />, options: authModalOptions });
  };

  const onSubmit = (data: TLogin) => {
    loginM.mutate(data, {
      onSuccess: (response) => {
        login({ data: response.user, token: response.token });
        success("Logged in successfully!");
        closeModal();
      },
    });
  };

  return (
    <div>
      <AuthHeader mode="login" onChange={(mode) => mode === "register" && showRegister()} />
      <div className="mb-5 mt-6">
        <h2 className="text-page-title-scale">Welcome back</h2>
        <p className="mt-2 text-supporting-scale">Sign in to save addresses, customize favorites, and track every order.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="xs">
          <div className="min-h-[92px]">
            <TextInput
              label="Email address"
              withAsterisk
              {...register("email")}
              error={errors.email?.message}
              leftSection={<Mail size={17} aria-hidden="true" />}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loginM.isPending}
            />
          </div>
          <div className="min-h-[92px]">
            <PasswordInput
              label="Password"
              withAsterisk
              {...register("password")}
              error={errors.password?.message}
              leftSection={<Lock size={17} aria-hidden="true" />}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loginM.isPending}
              visibilityToggleButtonProps={{ "aria-label": "Show or hide password" }}
            />
          </div>
          <Button type="submit" fullWidth size="md" loading={loginM.isPending} loaderProps={{ type: "dots" }}>Sign in</Button>
        </Stack>
      </form>

      <p className="mt-5 text-center text-sm text-ink-muted">
        New to PizzaStore?{" "}
        <button type="button" className="min-h-11 font-semibold text-brand hover:text-brand-hover" onClick={showRegister}>Create an account</button>
      </p>
    </div>
  );
};

export default LoginForm;
