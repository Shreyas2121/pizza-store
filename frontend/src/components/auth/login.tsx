import { zodResolver } from "@hookform/resolvers/zod";

import { useForm } from "react-hook-form";
import { TLogin, loginSchema } from "../../lib/zodSchema";
import { Stack, TextInput, PasswordInput, Button, Card } from "@mantine/core";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useLogin } from "../../hooks/user";
import { success } from "../../lib/utils";
import { useAuthModalStore } from "../../store/modal";
import Register from "./register";
import { useUser } from "../../store/user";

const Login = () => {
  const loginM = useLogin();

  const { openModal, closeModal } = useAuthModalStore();
  const { login } = useUser();

  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TLogin>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: TLogin) => {
    loginM.mutate(data, {
      onSuccess: (res) => {
        login({
          data: res.user,
          token: res.token,
        });
        success("Logged in successfully!");
        closeModal();
      },
    });
  };

  return (
    <Card shadow="md">
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack>
          <TextInput
            label="Email"
            {...register("email")}
            error={errors.email?.message}
            leftSection={<Mail size={16} />}
            placeholder="Enter your email address"
          />
          <PasswordInput
            label="Password"
            {...register("password")}
            error={errors.password?.message}
            leftSection={<Lock size={16} />}
            placeholder="Enter password"
            rightSection={
              showPassword ? (
                <Eye size={16} onClick={() => setShowPassword(false)} />
              ) : (
                <EyeOff size={16} onClick={() => setShowPassword(true)} />
              )
            }
            visible={showPassword}
          />
          <Button type="submit" fullWidth mt="md">
            Login
          </Button>

          <div>
            Already have an account?{" "}
            <Button
              type="button"
              className="text-red-500"
              unstyled
              onClick={() =>
                openModal({
                  content: <Register />,
                  title: "Register",
                })
              }
            >
              Register
            </Button>
          </div>
        </Stack>
      </form>
    </Card>
  );
};

export default Login;
