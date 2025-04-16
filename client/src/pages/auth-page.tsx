import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PublicLayout } from "@/components/layout/public-layout";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = insertUserSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const { user, loginMutation } = useAuth();
  const { t } = useTranslation();

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onLoginSubmit = (data: LoginValues) => {
    loginMutation.mutate(data);
  };

  // Redirect if already logged in
  if (user) {
    return <Redirect to="/dashboard" />;
  }

  const content = (
    <div className="flex items-center justify-center h-full">
      <div className="max-w-md w-full mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2">
          {t('auth.adminLogin', 'Admin Login')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-center text-sm mb-6">
          {t('auth.signInToAccess', 'Sign in to access the admin panel')}
        </p>
        
        <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder={t('auth.emailAddress', 'Email address')}
              {...loginForm.register("username")}
              className="w-full"
            />
            {loginForm.formState.errors.username && (
              <p className="text-red-500 text-xs">
                {loginForm.formState.errors.username.message}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Input
              type="password"
              placeholder={t('auth.password', 'Password')}
              {...loginForm.register("password")}
              className="w-full"
            />
            {loginForm.formState.errors.password && (
              <p className="text-red-500 text-xs">
                {loginForm.formState.errors.password.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-black text-white hover:bg-gray-800"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('common.loggingIn', 'Logging in...')}
              </>
            ) : (
              <>
                <span className="mr-2">⟶</span>
                {t('auth.signIn', 'Sign in')}
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );

  return <PublicLayout>{content}</PublicLayout>;
}