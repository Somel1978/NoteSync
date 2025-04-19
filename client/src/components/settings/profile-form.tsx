import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ProfileFormValues, profileSchema } from "./schema";
import { UserCircle, Loader2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
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

export const ProfileForm = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      username: user?.username || "",
      email: user?.email || "",
    },
  });
  
  // Update form when user data changes
  useEffect(() => {
    if (user) {
      profileForm.reset({
        name: user.name,
        username: user.username,
        email: user.email,
      });
    }
  }, [user, profileForm]);
  
  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const res = await apiRequest("PATCH", `/api/users/${user?.id}`, data);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: t('settings.profileUpdated'),
        description: t('settings.profileUpdatedSuccess'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('settings.profileUpdateError'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Form submission handler
  const onSubmit = (data: ProfileFormValues) => {
    updateProfileMutation.mutate(data);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.personalInfo')}</CardTitle>
        <CardDescription>
          {t('settings.updateAccountDetails')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex justify-center mb-6">
              <div className="bg-primary/10 p-4 rounded-full">
                <UserCircle className="h-24 w-24 text-primary" />
              </div>
            </div>
            
            <FormField
              control={profileForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.fullName')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('settings.yourName')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={profileForm.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.username')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={profileForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.email')}</FormLabel>
                  <FormControl>
                    <Input 
                      type="email"
                      placeholder={t('settings.emailAddress')}
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
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.saving')}
                </>
              ) : (
                t('common.save')
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};