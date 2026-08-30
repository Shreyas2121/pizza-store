import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button, PasswordInput, Stack, TextInput } from "@mantine/core";
import { Lock, Mail } from "lucide-react";
import LoginForm from "./login-form";
import AuthHeader from "./auth-header";
import { useRegister } from "../api/auth.queries";
import { useUser } from "../model/auth.store";
import { registerSchema, TRegister } from "../model/auth.schema";
import { useAuthModalStore } from "@/shared/model";
import { success } from "@/shared/lib";
import type { AuthMode } from "./auth-header";

const authModalOptions = { size: 440, padding: "lg" as const, radius: "lg" as const };

interface RegisterFormProps {
  onModeChange?: (mode: AuthMode) => void;
}

export const RegisterForm = ({ onModeChange }: RegisterFormProps = {}) => {
  const registerM = useRegister();
  const { login } = useUser();
  const { closeModal, openModal } = useAuthModalStore();
  const { register, handleSubmit, formState: { errors } } = useForm<TRegister>({
    resolver: zodResolver(registerSchema),
    defaultValues: { cpassword: "", fname: "", lname: "", email: "", password: "" },
  });

  const showLogin = () => {
    if (onModeChange) {
      onModeChange("login");
      return;
    }
    openModal({ title: "", content: <LoginForm />, options: authModalOptions });
  };

  const onSubmit = (data: TRegister) => {
    registerM.mutate(data, {
      onSuccess: (response) => {
        login({ data: response.user, token: response.token });
        success("Registration successful!");
        closeModal();
      },
    });
  };

  return (
    <div>
      <AuthHeader mode="register" onChange={(mode) => mode === "login" && showLogin()} />
      <div className="mb-5 mt-6">
        <h2 className="text-page-title-scale">Create your account</h2>
        <p className="mt-2 text-supporting-scale">Save your details once and make future pizza nights effortless.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="xs">
          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            <div className="min-h-[92px]"><TextInput {...register("fname")} label="First name" withAsterisk placeholder="First name" error={errors.fname?.message} autoComplete="given-name" disabled={registerM.isPending} /></div>
            <div className="min-h-[92px]"><TextInput {...register("lname")} label="Last name" withAsterisk placeholder="Last name" error={errors.lname?.message} autoComplete="family-name" disabled={registerM.isPending} /></div>
          </div>
          <div className="min-h-[92px]">
            <TextInput label="Email address" withAsterisk {...register("email")} error={errors.email?.message} leftSection={<Mail size={17} aria-hidden="true" />} placeholder="you@example.com" autoComplete="email" disabled={registerM.isPending} />
          </div>
          <div className="min-h-[92px]">
            <PasswordInput label="Password" withAsterisk {...register("password")} error={errors.password?.message} leftSection={<Lock size={17} aria-hidden="true" />} placeholder="Create a password" autoComplete="new-password" disabled={registerM.isPending} visibilityToggleButtonProps={{ "aria-label": "Show or hide password" }} />
          </div>
          <div className="min-h-[92px]">
            <PasswordInput label="Confirm password" withAsterisk {...register("cpassword")} error={errors.cpassword?.message} leftSection={<Lock size={17} aria-hidden="true" />} placeholder="Repeat your password" autoComplete="new-password" disabled={registerM.isPending} visibilityToggleButtonProps={{ "aria-label": "Show or hide confirmation password" }} />
          </div>
          <Button loading={registerM.isPending} loaderProps={{ type: "dots" }} type="submit" fullWidth size="md">Create account</Button>
        </Stack>
      </form>

      <p className="mt-5 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <button type="button" className="min-h-11 font-semibold text-brand hover:text-brand-hover" onClick={showLogin}>Sign in</button>
      </p>
    </div>
  );
};

export default RegisterForm;
