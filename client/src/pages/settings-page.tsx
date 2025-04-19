import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useTranslation } from "react-i18next";
import { UserCircle, ShieldCheck, Palette, UserCog, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import {
  ProfileForm,
  ChangePasswordForm,
  AppearanceSettingsForm,
  EmailSettingsForm,
  UserManagement,
  LocationRoomManagement
} from "@/components/settings";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("account");
  
  const isAdmin = user?.role === 'admin';
  
  return (
    <AppLayout>
      <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">{t('navigation.settings')}</h1>
          </div>
          
          <div className="bg-card rounded-lg shadow">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="account">
                  <UserCircle className="h-4 w-4 mr-2" />
                  {t('settings.myAccount')}
                </TabsTrigger>
                
                {isAdmin && (
                  <>
                    <TabsTrigger value="appearance">
                      <Palette className="h-4 w-4 mr-2" />
                      {t('settings.appearance')}
                    </TabsTrigger>
                    
                    <TabsTrigger value="email">
                      <Settings className="h-4 w-4 mr-2" />
                      {t('settings.email')}
                    </TabsTrigger>
                    
                    <TabsTrigger value="users">
                      <UserCog className="h-4 w-4 mr-2" />
                      {t('settings.users')}
                    </TabsTrigger>
                    
                    <TabsTrigger value="locations">
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      {t('locations.title')}
                    </TabsTrigger>
                  </>
                )}
              </TabsList>
              
              <TabsContent value="account" className="p-6 space-y-6">
                <ProfileForm />
                <ChangePasswordForm />
              </TabsContent>
              
              {isAdmin && (
                <>
                  <TabsContent value="appearance" className="p-6">
                    <AppearanceSettingsForm />
                  </TabsContent>
                  
                  <TabsContent value="email" className="p-6">
                    <EmailSettingsForm />
                  </TabsContent>
                  
                  <TabsContent value="users" className="p-6">
                    <UserManagement />
                  </TabsContent>
                  
                  <TabsContent value="locations" className="p-6">
                    <LocationRoomManagement />
                  </TabsContent>
                </>
              )}
            </Tabs>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}