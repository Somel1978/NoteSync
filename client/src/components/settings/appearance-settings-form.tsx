import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { AppearanceSettingsFormValues, appearanceSettingsSchema } from "./schema";
import { ImageUpload } from '@/components/ui/file-upload/image-upload';
import { Loader2 } from "lucide-react";
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

export const AppearanceSettingsForm = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  // Initialize and fetch appearance settings
  const { data: appearanceSettingsData, isLoading } = useQuery<AppearanceSettingsFormValues>({
    queryKey: ['/api/settings/appearance'],
    enabled: true,
  });
  
  const appearanceSettingsForm = useForm<AppearanceSettingsFormValues>({
    resolver: zodResolver(appearanceSettingsSchema),
    defaultValues: {
      logoText: "AC",
      logoUrl: null,
      useLogoImage: false,
      title: "ACRDSC",
      subtitle: "Reservas"
    },
  });
  
  // Update form when data is fetched
  useEffect(() => {
    if (appearanceSettingsData) {
      appearanceSettingsForm.reset(appearanceSettingsData);
    }
  }, [appearanceSettingsData, appearanceSettingsForm]);
  
  // Save appearance settings mutation
  const saveAppearanceSettingsMutation = useMutation({
    mutationFn: async (data: AppearanceSettingsFormValues) => {
      const res = await apiRequest("POST", "/api/settings/appearance", data);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to save appearance settings: ${errorText}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/appearance'] });
      toast({
        title: t('settings.appearanceSettingsSaved'),
        description: t('settings.appearanceSettingsSaveSuccess'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('settings.appearanceSettingsSaveError'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Form submission
  const onSubmit = (data: AppearanceSettingsFormValues) => {
    saveAppearanceSettingsMutation.mutate(data);
  };
  
  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  return (
    <div className="grid grid-cols-1 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.appearanceSettings')}</CardTitle>
          <CardDescription>
            {t('settings.manageAppearanceSettings')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...appearanceSettingsForm}>
            <form onSubmit={appearanceSettingsForm.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={appearanceSettingsForm.control}
                name="useLogoImage"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 mb-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        {t('settings.useLogoImage')}
                      </FormLabel>
                      <FormDescription>
                        {t('settings.useLogoImageDescription') || "Use an image instead of text for the logo"}
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
              
              {!appearanceSettingsForm.watch("useLogoImage") ? (
                <FormField
                  control={appearanceSettingsForm.control}
                  name="logoText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('settings.logoText')}</FormLabel>
                      <FormControl>
                        <Input placeholder="AC" {...field} maxLength={2} />
                      </FormControl>
                      <FormDescription>
                        {t('settings.logoTextDescription') || "Short text to display as logo (max 2 characters)"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={appearanceSettingsForm.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('settings.logoImage')}</FormLabel>
                      <FormControl>
                        <ImageUpload 
                          value={field.value} 
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('settings.logoImageDescription') || "Upload an image to use as logo (max 2MB)"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <FormField
                control={appearanceSettingsForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.title')}</FormLabel>
                    <FormControl>
                      <Input placeholder="ACRDSC" {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('settings.titleDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={appearanceSettingsForm.control}
                name="subtitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.subtitle')}</FormLabel>
                    <FormControl>
                      <Input placeholder="Reservas" {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('settings.subtitleDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex items-center justify-between pt-4">
                <div className="bg-gray-100 p-4 rounded-md border">
                  <div className="flex items-center">
                    {appearanceSettingsForm.watch("useLogoImage") && appearanceSettingsForm.watch("logoUrl") ? (
                      <div className="w-10 h-10 flex items-center justify-center overflow-hidden rounded-md">
                        <img 
                          src={appearanceSettingsForm.watch("logoUrl") || ""} 
                          alt="Logo preview" 
                          className="object-contain max-w-full max-h-full"
                        />
                      </div>
                    ) : (
                      <div className="bg-primary text-white p-2 rounded-md w-10 h-10 flex items-center justify-center">
                        <div className="text-sm font-bold">{appearanceSettingsForm.watch("logoText")}</div>
                      </div>
                    )}
                    <div className="ml-3">
                      <div className="font-semibold text-sm">{appearanceSettingsForm.watch("title")}</div>
                      <div className="text-xs">{appearanceSettingsForm.watch("subtitle")}</div>
                    </div>
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  disabled={saveAppearanceSettingsMutation.isPending}
                  className="ml-auto"
                >
                  {saveAppearanceSettingsMutation.isPending ? (
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