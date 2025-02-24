import { zodResolver } from "@hookform/resolvers/zod";

import { useForm } from "react-hook-form";
import { TRegister, registerSchema } from "../../lib/zodSchema";
import { Stack, TextInput, PasswordInput, Button } from "@mantine/core";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useRegister } from "../../hooks/user";
import { success } from "../../lib/utils";
import { useUser } from "../../store/user";
import { useAuthModalStore } from "../../store/modal";
import Login from "./login";

const Register = () => {
  const registerM = useRegister();
  const { login } = useUser();
  const { closeModal, openModal } = useAuthModalStore();

  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TRegister>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      cpassword: "",
      fname: "",
      lname: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: TRegister) => {
    registerM.mutate(data, {
      onSuccess: (res) => {
        login({
          data: res.user,
          token: res.token,
        });
        success("Registration successful!");
        closeModal();
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack gap={2}>
        <div className="grid grid-cols-2 gap-2">
          <TextInput
            {...register("fname")}
            label="First Name"
            placeholder="Enter your first name."
            error={errors.fname?.message}
            disabled={registerM.isPending}
          />
          <TextInput
            {...register("lname")}
            label="Last Name"
            placeholder="Enter your last name."
            error={errors.lname?.message}
            disabled={registerM.isPending}
          />
        </div>
        <TextInput
          label="Email"
          disabled={registerM.isPending}
          {...register("email")}
          error={errors.email?.message}
          leftSection={<Mail size={16} />}
          placeholder="Enter your email address"
        />
        <PasswordInput
          label="Password"
          {...register("password")}
          disabled={registerM.isPending}
          error={errors.password?.message}
          leftSection={<Lock size={16} />}
          placeholder="Enter "
          rightSection={
            showPassword ? (
              <Eye size={16} onClick={() => setShowPassword(false)} />
            ) : (
              <EyeOff size={16} onClick={() => setShowPassword(true)} />
            )
          }
          visible={showPassword}
        />
        <PasswordInput
          label="Confirm Password"
          {...register("cpassword")}
          disabled={registerM.isPending}
          error={errors.cpassword?.message}
          leftSection={<Lock size={16} />}
          placeholder="Confirm your password"
        />
        <Button disabled={registerM.isPending} type="submit" fullWidth mt="md">
          Register
        </Button>
        <div>
          Already have an account?{" "}
          <Button
            type="button"
            className="text-red-500"
            unstyled
            onClick={() => openModal(<Login />)}
          >
            Login
          </Button>
        </div>
      </Stack>
    </form>
  );
};

export default Register;
