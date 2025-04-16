import { useState, useEffect } from "react";
import { useQuery, useMutation, UseMutationResult } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/app-layout";
import { RoomFormModal } from "@/components/room/room-form-modal";
import { LocationFormModal } from "@/components/location/location-form-modal";
import { UserFormModal } from "@/components/user/user-form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Pencil, 
  Trash, 
  UserCircle, 
  ShieldCheck, 
  CheckCircle,
  UserCog, 
  Settings,
  KeyRound, 
  UserMinus,
  UserPlus,
  AlertCircle,
  PlusCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Room, User, Location } from "@shared/schema";

// Form schemas
const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please enter a valid email address"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6, "Password must be at least 6 characters"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: "Passwords do not match",
  path: ["confirmNewPassword"],
});

const newUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "director", "guest"])
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
type NewUserFormValues = z.infer<typeof newUserSchema>;

// UserProfileCard component
const UserProfileCard = ({ 
  user, 
  setSelectedUser, 
  setUserModalOpen,
  deleteUserMutation,
  approveDeleteMutation
}: { 
  user: User;
  setSelectedUser: (user: User) => void;
  setUserModalOpen: (open: boolean) => void;
  deleteUserMutation: UseMutationResult<any, Error, number>;
  approveDeleteMutation: UseMutationResult<any, Error, number>;
}) => {
  const { t } = useTranslation();
  
  return (
    <Card key={user.id} className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center">
            <div className="bg-primary/10 p-2 rounded-full">
              <UserCircle className="h-10 w-10 text-primary" />
            </div>
            <div className="ml-4">
              <h3 className="font-medium">{user.name}</h3>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {user.role === 'admin' && (
              <Badge variant="default" className="ml-2 bg-red-500">
                <ShieldCheck className="h-3 w-3 mr-1" /> {t('roles.admin')}
              </Badge>
            )}
            {user.role === 'director' && (
              <Badge variant="default" className="ml-2 bg-blue-500">
                <UserCog className="h-3 w-3 mr-1" /> {t('roles.director')}
              </Badge>
            )}
            {user.role === 'guest' && (
              <Badge variant="outline" className="ml-2">
                <UserCircle className="h-3 w-3 mr-1" /> {t('roles.guest')}
              </Badge>
            )}
            
            {user.deletionRequested && (
              <Badge variant="outline" className="ml-2 text-red-500 border-red-200 bg-red-50">
                {t('settings.deletionRequested')}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="mt-4 flex justify-end space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs"
            onClick={() => {
              setSelectedUser(user);
              setUserModalOpen(true);
            }}
          >
            <Pencil className="h-3 w-3 mr-1" />
            {t('common.edit')}
          </Button>
          
          {user.deletionRequested ? (
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs text-green-600"
              onClick={() => {
                if (confirm(t('settings.confirmDeletionApproval'))) {
                  approveDeleteMutation.mutate(user.id);
                }
              }}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              {t('settings.approveDeleteRequest')}
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs text-red-600"
              onClick={() => {
                if (confirm(`${t('common.delete')} ${user.name}?`)) {
                  deleteUserMutation.mutate(user.id);
                }
              }}
            >
              <Trash className="h-3 w-3 mr-1" />
              {t('common.delete')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("account");
  
  // Initialize forms
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      username: user?.username || "",
      email: user?.email || "",
    }
  });
  
  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    }
  });
  
  const newUserForm = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "",
      role: "guest",
    }
  });
  
  // Update form when user data changes
  useEffect(() => {
    if (user) {
      profileForm.reset({
        name: user.name || "",
        username: user.username || "",
        email: user.email || "",
      });
    }
  }, [user, profileForm]);
  
  // Fetch data
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: user?.role === 'admin'
  });
  
  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ['/api/rooms'],
    enabled: user?.role === 'admin' || user?.role === 'director'
  });
  
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['/api/locations'],
    enabled: user?.role === 'admin' || user?.role === 'director'
  });
  
  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const res = await apiRequest("PATCH", `/api/users/${user?.id}`, data);
      if (!res.ok) throw new Error("Failed to update profile");
      return await res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['/api/user'], updatedUser);
      toast({
        title: t('settings.profileUpdated'),
        description: t('settings.profileUpdateSuccess'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('settings.profileUpdateFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordFormValues) => {
      const res = await apiRequest("POST", `/api/users/${user?.id}/change-password`, {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      if (!res.ok) throw new Error("Failed to update password");
      return await res.json();
    },
    onSuccess: () => {
      passwordForm.reset();
      toast({
        title: t('settings.passwordChanged'),
        description: t('settings.passwordChangeSuccess'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('settings.passwordChangeFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const addUserMutation = useMutation({
    mutationFn: async (data: NewUserFormValues) => {
      const res = await apiRequest("POST", "/api/register", data);
      if (!res.ok) throw new Error("Failed to create user");
      return await res.json();
    },
    onSuccess: () => {
      newUserForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: t('settings.userCreated'),
        description: t('settings.userCreateSuccess'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('settings.userCreateFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("DELETE", `/api/users/${userId}`);
      if (!res.ok) throw new Error("Failed to delete user");
      return userId;
    },
    onSuccess: (userId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: t('settings.userDeleted'),
        description: t('settings.userDeleteSuccess'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('settings.userDeleteFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const requestDeletionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/users/${user?.id}/request-deletion`);
      if (!res.ok) throw new Error("Failed to request account deletion");
      return await res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['/api/user'], updatedUser);
      toast({
        title: t('settings.deletionRequested'),
        description: t('settings.deletionRequestSuccess'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('settings.deletionRequestFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const approveDeleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/users/${userId}/approve-deletion`);
      if (!res.ok) throw new Error("Failed to approve deletion");
      return userId;
    },
    onSuccess: (userId) => {
      // Update local state immediately to remove the user from the UI
      const currentUsers = queryClient.getQueryData<User[]>(['/api/users']) || [];
      queryClient.setQueryData(
        ['/api/users'],
        currentUsers.filter(u => u.id !== userId)
      );
      // Also invalidate the query to ensure we get fresh data from the server
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: t('settings.deletionApproved'),
        description: t('settings.deletionApproveSuccess'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('settings.deletionApproveFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Location mutations
  const deleteLocationMutation = useMutation({
    mutationFn: async (locationId: number) => {
      const res = await apiRequest("DELETE", `/api/locations/${locationId}`);
      if (!res.ok) throw new Error("Failed to delete location");
      return locationId;
    },
    onSuccess: (locationId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/locations'] });
      toast({
        title: t('locations.deleteSuccess'),
        description: t('locations.deleteSuccessDetail'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('locations.deleteError'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Form submission handlers
  const onProfileSubmit = (data: ProfileFormValues) => {
    updateProfileMutation.mutate(data);
  };
  
  const onPasswordSubmit = (data: ChangePasswordFormValues) => {
    changePasswordMutation.mutate(data);
  };
  
  const onAddUserSubmit = (data: NewUserFormValues) => {
    addUserMutation.mutate(data);
  };
  
  // Room handlers
  const handleEditRoom = (room: Room) => {
    setSelectedRoom(room);
    setRoomModalOpen(true);
  };
  
  // Filter and group users by role for the admin view
  const adminUsers = users.filter((u: User) => u.role === 'admin');
  const directorUsers = users.filter((u: User) => u.role === 'director');
  const guestUsers = users.filter((u: User) => u.role === 'guest');
  
  return (
    <AppLayout>
      <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">{t('navigation.settings')}</h1>
          </div>
          
          <div className="bg-card rounded-lg shadow">
            <Card>
              <CardContent className="p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-6">
                    <TabsTrigger value="account">
                      <UserCircle className="h-4 w-4 mr-2" />
                      {t('settings.myAccount')}
                    </TabsTrigger>

                    {/* Show Users tab only for Admin */}
                    {user?.role === 'admin' && (
                      <TabsTrigger value="users">
                        <UserPlus className="h-4 w-4 mr-2" />
                        {t('settings.users')}
                      </TabsTrigger>
                    )}
                    
                    {/* Show Locations tab for Admin and Director */}
                    {(user?.role === 'admin' || user?.role === 'director') && (
                      <TabsTrigger value="locations">
                        <Settings className="h-4 w-4 mr-2" />
                        {t('settings.locations')}
                      </TabsTrigger>
                    )}
                  </TabsList>
                  
                  {/* My Account Tab - For All Users */}
                  <TabsContent value="account">
                    <div className="space-y-6">
                      <h2 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                        {t('settings.myAccount')}
                      </h2>
                      
                      {user?.deletionRequested && (
                        <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 mb-4">
                          {t('settings.deletionRequested')}
                        </Badge>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Personal Information */}
                        <Card>
                          <CardHeader>
                            <CardTitle>{t('settings.personalInfo')}</CardTitle>
                            <CardDescription>{t('settings.updateAccountDetails')}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <Form {...profileForm}>
                              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
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
                                        <Input placeholder={t('settings.username')} {...field} />
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
                                        <Input placeholder={t('settings.emailAddress')} {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                
                                <div className="pt-2">
                                  <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={updateProfileMutation.isPending}
                                  >
                                    {updateProfileMutation.isPending 
                                      ? t('common.saving') 
                                      : t('common.saveChanges')}
                                  </Button>
                                </div>
                              </form>
                            </Form>
                          </CardContent>
                        </Card>
                        
                        {/* Change Password */}
                        <Card>
                          <CardHeader>
                            <CardTitle>{t('settings.passwordSecurity')}</CardTitle>
                            <CardDescription>{t('settings.updatePasswordSecurity')}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                              <AccordionItem value="password">
                                <AccordionTrigger className="flex items-center gap-2">
                                  <KeyRound className="h-5 w-5 text-gray-500" />
                                  <span>{t('settings.changePassword')}</span>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <Form {...passwordForm}>
                                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4 mt-4">
                                      <FormField
                                        control={passwordForm.control}
                                        name="currentPassword"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>{t('settings.currentPassword')}</FormLabel>
                                            <FormControl>
                                              <Input type="password" placeholder={t('settings.currentPasswordPlaceholder')} {...field} />
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
                                              <Input type="password" placeholder={t('settings.newPasswordPlaceholder')} {...field} />
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
                                              <Input type="password" placeholder={t('settings.confirmPasswordPlaceholder')} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      
                                      <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={changePasswordMutation.isPending}
                                      >
                                        {changePasswordMutation.isPending 
                                          ? t('common.updating') 
                                          : t('settings.updatePassword')}
                                      </Button>
                                    </form>
                                  </Form>
                                </AccordionContent>
                              </AccordionItem>
                              
                              <AccordionItem value="account-deletion">
                                <AccordionTrigger className="flex items-center gap-2">
                                  <UserMinus className="h-5 w-5 text-red-500" />
                                  <span className="text-red-500">
                                    {user?.deletionRequested 
                                      ? t('settings.deletionRequested') 
                                      : t('settings.requestAccountDeletion')}
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="bg-red-50 p-4 rounded-md mt-4">
                                    {user?.deletionRequested ? (
                                      <>
                                        <div className="flex items-center gap-3">
                                          <AlertCircle className="h-6 w-6 text-orange-500" />
                                          <h4 className="font-medium text-orange-700">{t('settings.deletionRequestPending')}</h4>
                                        </div>
                                        <p className="mt-2 text-sm text-orange-600">
                                          {t('settings.deletionRequestPendingDesc')}
                                        </p>
                                      </>
                                    ) : (
                                      <>
                                        <div className="flex items-center gap-3">
                                          <AlertCircle className="h-6 w-6 text-red-500" />
                                          <h4 className="font-medium text-red-700">{t('settings.deletionWarning')}</h4>
                                        </div>
                                        <p className="mt-2 text-sm text-red-600">
                                          {t('settings.deletionWarningDesc')}
                                        </p>
                                        <div className="mt-4 flex justify-end">
                                          <Button 
                                            variant="destructive"
                                            onClick={() => {
                                              if (confirm(t('settings.confirmDeletionRequest'))) {
                                                requestDeletionMutation.mutate();
                                              }
                                            }}
                                            disabled={requestDeletionMutation.isPending}
                                          >
                                            {requestDeletionMutation.isPending 
                                              ? t('common.requesting') 
                                              : t('settings.requestAccountDeletion')}
                                          </Button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Users tab - Admin only */}
                  {user?.role === 'admin' && (
                    <TabsContent value="users">
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <h2 className="text-lg leading-6 font-medium text-gray-900">
                            {t('settings.manageUsers')}
                          </h2>
                          
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button>
                                <UserPlus className="h-4 w-4 mr-2" />
                                {t('settings.addUser')}
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{t('settings.addNewUser')}</DialogTitle>
                                <DialogDescription>
                                  {t('settings.addNewUserDesc')}
                                </DialogDescription>
                              </DialogHeader>
                              
                              <Form {...newUserForm}>
                                <form onSubmit={newUserForm.handleSubmit(onAddUserSubmit)} className="space-y-4">
                                  <FormField
                                    control={newUserForm.control}
                                    name="name"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>{t('settings.fullName')}</FormLabel>
                                        <FormControl>
                                          <Input placeholder={t('settings.fullNamePlaceholder')} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  
                                  <FormField
                                    control={newUserForm.control}
                                    name="username"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>{t('settings.username')}</FormLabel>
                                        <FormControl>
                                          <Input placeholder={t('settings.usernamePlaceholder')} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  
                                  <FormField
                                    control={newUserForm.control}
                                    name="email"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>{t('settings.email')}</FormLabel>
                                        <FormControl>
                                          <Input placeholder={t('settings.emailPlaceholder')} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  
                                  <FormField
                                    control={newUserForm.control}
                                    name="password"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>{t('settings.password')}</FormLabel>
                                        <FormControl>
                                          <Input type="password" placeholder={t('settings.passwordPlaceholder')} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  
                                  <FormField
                                    control={newUserForm.control}
                                    name="role"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>{t('settings.role')}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                          <FormControl>
                                            <SelectTrigger>
                                              <SelectValue placeholder={t('settings.selectRole')} />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            <SelectItem value="admin">{t('roles.admin')}</SelectItem>
                                            <SelectItem value="director">{t('roles.director')}</SelectItem>
                                            <SelectItem value="guest">{t('roles.guest')}</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  
                                  <DialogFooter>
                                    <Button 
                                      type="submit" 
                                      className="w-full"
                                      disabled={addUserMutation.isPending}
                                    >
                                      {addUserMutation.isPending 
                                        ? t('common.creating') 
                                        : t('settings.createUser')}
                                    </Button>
                                  </DialogFooter>
                                </form>
                              </Form>
                            </DialogContent>
                          </Dialog>
                        </div>
                        
                        <div className="space-y-6">
                          {/* Admin Users */}
                          {adminUsers.length > 0 && (
                            <div>
                              <h3 className="text-md font-medium mb-4 flex items-center text-red-700">
                                <ShieldCheck className="h-5 w-5 mr-2" />
                                {t('roles.adminPlural')}
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {adminUsers.map((adminUser: User) => (
                                  <UserProfileCard 
                                    key={adminUser.id} 
                                    user={adminUser} 
                                    setSelectedUser={setSelectedUser}
                                    setUserModalOpen={setUserModalOpen}
                                    deleteUserMutation={deleteUserMutation}
                                    approveDeleteMutation={approveDeleteMutation}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Director Users */}
                          {directorUsers.length > 0 && (
                            <div className="mt-8">
                              <h3 className="text-md font-medium mb-4 flex items-center text-blue-700">
                                <UserCog className="h-5 w-5 mr-2" />
                                {t('roles.directorPlural')}
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {directorUsers.map((directorUser: User) => (
                                  <UserProfileCard 
                                    key={directorUser.id} 
                                    user={directorUser} 
                                    setSelectedUser={setSelectedUser}
                                    setUserModalOpen={setUserModalOpen}
                                    deleteUserMutation={deleteUserMutation}
                                    approveDeleteMutation={approveDeleteMutation}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Guest Users */}
                          {guestUsers.length > 0 && (
                            <div className="mt-8">
                              <h3 className="text-md font-medium mb-4 flex items-center text-gray-700">
                                <UserCircle className="h-5 w-5 mr-2" />
                                {t('roles.guestPlural')}
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {guestUsers.map((guestUser: User) => (
                                  <UserProfileCard 
                                    key={guestUser.id} 
                                    user={guestUser} 
                                    setSelectedUser={setSelectedUser}
                                    setUserModalOpen={setUserModalOpen}
                                    deleteUserMutation={deleteUserMutation}
                                    approveDeleteMutation={approveDeleteMutation}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </TabsContent>
                  )}
                  
                  {/* Locations tab - Admin and Director */}
                  {(user?.role === 'admin' || user?.role === 'director') && (
                    <TabsContent value="locations">
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <h2 className="text-lg leading-6 font-medium text-gray-900">
                            {t('settings.manageLocations')}
                          </h2>
                          
                          <Button onClick={() => {
                            setSelectedLocation(null);
                            setLocationModalOpen(true);
                          }}>
                            <PlusCircle className="h-4 w-4 mr-2" />
                            {t('common.add')} {t('settings.locations')}
                          </Button>
                        </div>
                        
                        {/* Locations List */}
                        <div className="grid gap-4">
                          {locations.map((location) => (
                            <Card key={location.id} className="overflow-hidden">
                              <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h3 className="font-medium text-lg">{location.name}</h3>
                                    <p className="text-gray-500 mt-1">{location.description || t('common.notAvailable')}</p>
                                    
                                    <div className="mt-2">
                                      <p className="text-sm">
                                        <span className="font-medium">{t('rooms.rooms')}:</span> {
                                          rooms.filter(room => room.locationId === location.id).length
                                        }
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex space-x-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-xs"
                                      onClick={() => {
                                        setSelectedLocation(location);
                                        setLocationModalOpen(true);
                                      }}
                                    >
                                      <Pencil className="h-3 w-3 mr-1" />
                                      {t('common.edit')}
                                    </Button>
                                    
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-xs text-red-600"
                                      onClick={() => {
                                        if (confirm(`${t('common.delete')} ${location.name}?`)) {
                                          deleteLocationMutation.mutate(location.id);
                                        }
                                      }}
                                    >
                                      <Trash className="h-3 w-3 mr-1" />
                                      {t('common.delete')}
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                          
                          {locations.length === 0 && (
                            <div className="text-center py-12 bg-gray-50 rounded-md">
                              <div className="mx-auto h-12 w-12 text-gray-400">
                                <Settings className="h-10 w-10" />
                              </div>
                              <h3 className="mt-2 text-sm font-medium text-gray-900">
                                {t('locations.noLocations')}
                              </h3>
                              <p className="mt-1 text-sm text-gray-500">
                                Get started by creating a new location.
                              </p>
                              <div className="mt-6">
                                <Button onClick={() => {
                                  setSelectedLocation(null);
                                  setLocationModalOpen(true);
                                }}>
                                  <PlusCircle className="h-4 w-4 mr-2" />
                                  {t('common.add')} {t('settings.locations')}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </TabsContent>
                  )}
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      <RoomFormModal
        room={selectedRoom || undefined}
        open={roomModalOpen}
        onOpenChange={setRoomModalOpen}
      />
      
      <LocationFormModal
        location={selectedLocation || undefined}
        open={locationModalOpen}
        onOpenChange={setLocationModalOpen}
      />
      {/* User form modal */}
      {selectedUser && (
        <UserFormModal
          user={selectedUser}
          open={userModalOpen}
          onOpenChange={setUserModalOpen}
        />
      )}
    </AppLayout>
  );
}