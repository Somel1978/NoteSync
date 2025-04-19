import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChangePasswordFormValues, changePasswordSchema } from "./schema";
import { KeyRound, Loader2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const ChangePasswordForm = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });
  
  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordFormValues) => {
      const res = await apiRequest("POST", `/api/users/${user?.id}/change-password`, {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return await res.json();
    },
    onSuccess: () => {
      passwordForm.reset();
      toast({
        title: t('settings.passwordChanged'),
        description: t('settings.passwordChangedSuccess'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('settings.passwordChangeError'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Form submission handler
  const onSubmit = (data: ChangePasswordFormValues) => {
    changePasswordMutation.mutate(data);
  };
  
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{t('settings.passwordSecurity')}</CardTitle>
        <CardDescription>
          {t('settings.updatePasswordSecurity')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex justify-center mb-6">
              <div className="bg-yellow-100 text-yellow-600 p-4 rounded-full">
                <KeyRound className="h-16 w-16" />
              </div>
            </div>
            
            <FormField
              control={passwordForm.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.currentPassword')}</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder={t('settings.currentPasswordPlaceholder')} 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={passwordForm.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.newPassword')}</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder={t('settings.newPasswordPlaceholder')} 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={passwordForm.control}
              name="confirmNewPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.confirmNewPassword')}</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder={t('settings.confirmNewPasswordPlaceholder')} 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              className="w-full mt-4"
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.saving')}
                </>
              ) : (
                t('settings.changePassword')
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};