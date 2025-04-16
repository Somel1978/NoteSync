import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/use-language";

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
  const [activeTab, setActiveTab] = useState<string>("login");
  const { user, loginMutation, registerMutation } = useAuth();
  const { t } = useTranslation();
  const { language, changeLanguage, languages } = useLanguage();

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
      name: "",
      role: "user",
    },
  });

  const onLoginSubmit = (data: LoginValues) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegisterValues) => {
    const { confirmPassword, ...registerData } = data;
    registerMutation.mutate(registerData);
  };

  // Redirect if already logged in
  if (user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Language Selector */}
      <div className="absolute top-4 right-4 z-10">
        <div className="flex items-center space-x-2 bg-white shadow-sm rounded-md px-3 py-2">
          <Globe className="h-4 w-4 text-gray-500" />
          <select 
            value={language}
            onChange={(e) => changeLanguage(e.target.value as 'en' | 'es' | 'pt')}
            className="text-sm bg-transparent border-none focus:ring-0 text-gray-700 cursor-pointer"
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <Card className="w-full">
            <Tabs
              defaultValue="login"
              value={activeTab}
              onValueChange={setActiveTab}
            >
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-center">
                  ACRDSC Reservas
                </CardTitle>
                <CardDescription className="text-center">
                  {t('common.roomBookingSystem', 'Room Booking & Management System')}
                </CardDescription>
                <TabsList className="grid w-full grid-cols-2 mt-4">
                  <TabsTrigger value="login">{t('auth.login', 'Login')}</TabsTrigger>
                  <TabsTrigger value="register">{t('auth.register', 'Register')}</TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent>
                <TabsContent value="login">
                  <Form {...loginForm}>
                    <form
                      onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                      className="space-y-4"
                    >
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('auth.username', 'Username')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('auth.enterUsername', 'Enter your username')} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('auth.password', 'Password')}</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder={t('auth.enterPassword', 'Enter your password')}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('common.loggingIn', 'Logging in...')}
                          </>
                        ) : (
                          t('auth.login', 'Login')
                        )}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="register">
                  <Form {...registerForm}>
                    <form
                      onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
                      className="space-y-4"
                    >
                      <FormField
                        control={registerForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('auth.fullName', 'Full Name')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('auth.enterFullName', 'Enter your full name')} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('auth.email', 'Email')}</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder={t('auth.enterEmail', 'Enter your email')}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('auth.username', 'Username')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('auth.chooseUsername', 'Choose a username')} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('auth.password', 'Password')}</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder={t('auth.createPassword', 'Create a password')}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('auth.confirmPassword', 'Confirm Password')}</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder={t('auth.confirmYourPassword', 'Confirm your password')}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('auth.creatingAccount', 'Creating account...')}
                          </>
                        ) : (
                          t('auth.createAccount', 'Create Account')
                        )}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>

          <div className="hidden md:block">
            <div className="space-y-6">
              <h1 className="text-4xl font-bold text-gray-900">
                {t('auth.systemTitle', 'ACRDSC Room Booking System')}
              </h1>
              <p className="text-lg text-gray-600">
                {t('auth.systemDescription', 'A comprehensive solution for managing room bookings, appointments, and facilities.')}
              </p>
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="bg-primary/10 p-2 rounded-full mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold">{t('auth.featureBooking', 'Easy Booking Management')}</h3>
                    <p className="text-sm text-gray-600">{t('auth.featureBookingDesc', 'Approve, reject, and track appointments with ease')}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="bg-primary/10 p-2 rounded-full mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold">{t('auth.featureRoom', 'Room Configuration')}</h3>
                    <p className="text-sm text-gray-600">{t('auth.featureRoomDesc', 'Manage rooms, facilities, and pricing')}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="bg-primary/10 p-2 rounded-full mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold">{t('auth.featureAnalytics', 'Analytics Dashboard')}</h3>
                    <p className="text-sm text-gray-600">{t('auth.featureAnalyticsDesc', 'Track utilization and performance metrics')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}