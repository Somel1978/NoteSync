import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { EmailSettingsFormValues, emailSettingsSchema } from "./schema";
import { Loader2, Mail } from "lucide-react";
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const EmailSettingsForm = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  // Initialize and fetch email settings
  const { data: emailSettingsData, isLoading } = useQuery<EmailSettingsFormValues>({
    queryKey: ['/api/settings/email'],
    enabled: true,
  });
  
  const emailSettingsForm = useForm<EmailSettingsFormValues>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      enabled: false,
      mailjetApiKey: "",
      mailjetSecretKey: "",
      systemEmail: "",
      systemName: "",
      notifyOnCreate: true,
      notifyOnUpdate: true,
      notifyOnStatusChange: true,
      emailTemplateBookingCreated: "",
      emailTemplateBookingUpdated: "",
      emailTemplateBookingStatusChanged: ""
    },
  });
  
  // Update form when data is fetched
  useEffect(() => {
    if (emailSettingsData) {
      emailSettingsForm.reset(emailSettingsData);
    }
  }, [emailSettingsData, emailSettingsForm]);
  
  // Save email settings mutation
  const saveEmailSettingsMutation = useMutation({
    mutationFn: async (data: EmailSettingsFormValues) => {
      // If email is not enabled, don't require API keys
      let modifiedSchema = emailSettingsSchema;
      
      // Check if any fields have values to determine if we need the validation
      const hasValidData = Object.values(data).some(val => 
        typeof val === "string" && val.trim().length > 0
      );
      
      if (!data.enabled && !hasValidData) {
        // Do nothing, as there's nothing to save
        return null;
      }
      
      // Make API request
      const res = await apiRequest("POST", "/api/settings/email", data);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to save email settings: ${errorText}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/email'] });
      toast({
        title: t('settings.emailSettingsSaved'),
        description: t('settings.emailSettingsSaveSuccess'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('settings.emailSettingsSaveError'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/email/test", {});
      if (!res.ok) {
        throw new Error("Failed to send test email");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t('settings.testEmailSent'),
        description: t('settings.testEmailSentSuccess'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('settings.testEmailError'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Form submission
  const onSubmit = (data: EmailSettingsFormValues) => {
    // If email is not enabled, reset API keys and ensure proper validation
    if (!data.enabled) {
      const cleanData = {
        ...data,
        mailjetApiKey: data.mailjetApiKey || "",
        mailjetSecretKey: data.mailjetSecretKey || "",
        systemEmail: data.systemEmail || "",
        systemName: data.systemName || ""
      };
      
      saveEmailSettingsMutation.mutate(cleanData);
    } else {
      saveEmailSettingsMutation.mutate(data);
    }
  };
  
  // Handle test email button click
  const handleTestEmail = () => {
    testEmailMutation.mutate();
  };
  
  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  return (
    <div className="grid grid-cols-1 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.emailSettings')}</CardTitle>
          <CardDescription>
            {t('settings.manageEmailSettings')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...emailSettingsForm}>
            <form onSubmit={emailSettingsForm.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={emailSettingsForm.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 mb-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        {t('settings.enableEmailNotifications')}
                      </FormLabel>
                      <FormDescription>
                        {t('settings.enableEmailNotificationsDescription')}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {emailSettingsForm.watch("enabled") && (
                <>
                  {/* Email Provider Settings */}
                  <div className="bg-card rounded-lg shadow p-4 border-l-4 border-blue-500 mt-4 mb-6">
                    <h3 className="text-md font-semibold mb-2">{t('settings.mailjetSettings')}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('settings.mailjetSettingsDescription')}
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={emailSettingsForm.control}
                        name="mailjetApiKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('settings.mailjetApiKey')}</FormLabel>
                            <FormControl>
                              <Input 
                                type="password" 
                                placeholder="API Key" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={emailSettingsForm.control}
                        name="mailjetSecretKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('settings.mailjetSecretKey')}</FormLabel>
                            <FormControl>
                              <Input 
                                type="password" 
                                placeholder="Secret Key" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  {/* System Email Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={emailSettingsForm.control}
                      name="systemEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('settings.systemEmail')}</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="noreply@example.com" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            {t('settings.systemEmailDescription')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={emailSettingsForm.control}
                      name="systemName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('settings.systemName')}</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="ACRDSC Reservas" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            {t('settings.systemNameDescription')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Notification Settings */}
                  <div className="bg-gray-50 rounded-lg p-4 border mt-6">
                    <h3 className="text-md font-semibold mb-2">{t('settings.notificationSettings')}</h3>
                    
                    <div className="space-y-2">
                      <FormField
                        control={emailSettingsForm.control}
                        name="notifyOnCreate"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div>
                              <FormLabel>{t('settings.notifyOnCreate')}</FormLabel>
                              <FormDescription>
                                {t('settings.notifyOnCreateDescription')}
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={emailSettingsForm.control}
                        name="notifyOnUpdate"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div>
                              <FormLabel>{t('settings.notifyOnUpdate')}</FormLabel>
                              <FormDescription>
                                {t('settings.notifyOnUpdateDescription')}
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={emailSettingsForm.control}
                        name="notifyOnStatusChange"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div>
                              <FormLabel>{t('settings.notifyOnStatusChange')}</FormLabel>
                              <FormDescription>
                                {t('settings.notifyOnStatusChangeDescription')}
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  {/* Email Templates */}
                  <div className="bg-gray-50 rounded-lg p-4 border mt-6">
                    <h3 className="text-md font-semibold mb-2">{t('settings.emailTemplates')}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('settings.emailTemplatesDescription')}
                    </p>
                    
                    <div className="space-y-4">
                      <FormField
                        control={emailSettingsForm.control}
                        name="emailTemplateBookingCreated"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('settings.emailTemplateBookingCreated')}</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder={t('settings.emailTemplateBookingCreatedPlaceholder')}
                                className="min-h-24"
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>
                              {t('settings.emailTemplateDescription')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={emailSettingsForm.control}
                        name="emailTemplateBookingUpdated"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('settings.emailTemplateBookingUpdated')}</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder={t('settings.emailTemplateBookingUpdatedPlaceholder')}
                                className="min-h-24"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={emailSettingsForm.control}
                        name="emailTemplateBookingStatusChanged"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('settings.emailTemplateBookingStatusChanged')}</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder={t('settings.emailTemplateBookingStatusChangedPlaceholder')}
                                className="min-h-24"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </>
              )}
              
              <div className="flex items-center justify-between pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleTestEmail}
                  disabled={!emailSettingsForm.watch("enabled") || testEmailMutation.isPending}
                >
                  {testEmailMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('settings.sendingTest')}
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      {t('settings.sendTestEmail')}
                    </>
                  )}
                </Button>
                
                <Button 
                  type="submit" 
                  disabled={saveEmailSettingsMutation.isPending}
                >
                  {saveEmailSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('common.saving')}
                    </>
                  ) : (
                    t('common.save')
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};