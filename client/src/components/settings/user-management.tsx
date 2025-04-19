import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { User } from "@shared/schema";
import { NewUserFormValues, newUserSchema } from "./schema";
import { UserFormModal } from "@/components/user/user-form-modal";
import { UserProfileCard } from "./user-profile-card";
import { UserPlus, ShieldCheck, UserCircle, UserCog } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const UserManagement = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  
  // Fetch users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: true,
  });
  
  // Initialize new user form
  const newUserForm = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "",
      role: "guest"
    }
  });
  
  // Add user mutation
  const addUserMutation = useMutation({
    mutationFn: async (data: NewUserFormValues) => {
      const res = await apiRequest("POST", "/api/register", data);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setAddUserDialogOpen(false);
      newUserForm.reset();
      toast({
        title: t('settings.userAdded'),
        description: t('settings.userAddedSuccess'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('settings.userAddError'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("DELETE", `/api/users/${userId}`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: t('settings.userDeleted'),
        description: t('settings.userDeletedSuccess'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('settings.userDeleteError'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Approve deletion request mutation
  const approveDeleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/users/${userId}/approve-deletion`);
      if (!res.ok) throw new Error(await res.text());
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      
      // Update local users array to reflect the deletion
      const currentUsers = queryClient.getQueryData<User[]>(['/api/users']) || [];
      const updatedUsers = currentUsers.filter(u => !u.deletionRequested);
      queryClient.setQueryData(['/api/users'], updatedUsers);
      
      toast({
        title: t('settings.deletionApproved'),
        description: t('settings.deletionApprovedSuccess'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('settings.deletionApprovalError'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Form submission
  const onAddUserSubmit = (data: NewUserFormValues) => {
    addUserMutation.mutate(data);
  };
  
  // Filter and group users by role for the admin view - use state to ensure UI updates
  // when users array changes (especially after role changes)
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [directorUsers, setDirectorUsers] = useState<User[]>([]);
  const [guestUsers, setGuestUsers] = useState<User[]>([]);
  
  // Update filtered lists when users array changes
  useEffect(() => {
    setAdminUsers(users.filter((u: User) => u.role === 'admin'));
    setDirectorUsers(users.filter((u: User) => u.role === 'director'));
    setGuestUsers(users.filter((u: User) => u.role === 'guest'));
  }, [users]);
  
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{t('settings.users')}</h2>
          <p className="text-muted-foreground">{t('settings.manageUsers')}</p>
        </div>
        
        <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              {t('settings.addUser')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('settings.addUser')}</DialogTitle>
              <DialogDescription>
                {t('settings.addUserDesc')}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...newUserForm}>
              <form onSubmit={newUserForm.handleSubmit(onAddUserSubmit)} className="space-y-4 py-4">
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
                        <Input 
                          type="email"
                          placeholder={t('settings.emailPlaceholder')}
                          {...field} 
                        />
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
                        <Input 
                          type="password"
                          placeholder={t('settings.passwordPlaceholder')}
                          {...field} 
                        />
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
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('settings.selectRole')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">
                            <div className="flex items-center">
                              <ShieldCheck className="h-4 w-4 mr-2 text-red-500" />
                              {t('roles.admin')}
                            </div>
                          </SelectItem>
                          <SelectItem value="director">
                            <div className="flex items-center">
                              <UserCog className="h-4 w-4 mr-2 text-blue-500" />
                              {t('roles.director')}
                            </div>
                          </SelectItem>
                          <SelectItem value="guest">
                            <div className="flex items-center">
                              <UserCircle className="h-4 w-4 mr-2" />
                              {t('roles.guest')}
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter className="mt-6">
                  <Button 
                    type="submit" 
                    disabled={addUserMutation.isPending}
                  >
                    {t('settings.addUser')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* User list */}
      <div className="space-y-8">
        {/* Admins */}
        {adminUsers.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-3 flex items-center">
              <ShieldCheck className="h-5 w-5 mr-2 text-red-500" />
              {t('roles.admins')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminUsers.map((user: User) => (
                <UserProfileCard
                  key={user.id}
                  user={user}
                  setSelectedUser={setSelectedUser}
                  setUserModalOpen={setUserModalOpen}
                  deleteUserMutation={deleteUserMutation}
                  approveDeleteMutation={approveDeleteMutation}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Directors */}
        {directorUsers.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-3 flex items-center">
              <UserCog className="h-5 w-5 mr-2 text-blue-500" />
              {t('roles.directors')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {directorUsers.map((user: User) => (
                <UserProfileCard
                  key={user.id}
                  user={user}
                  setSelectedUser={setSelectedUser}
                  setUserModalOpen={setUserModalOpen}
                  deleteUserMutation={deleteUserMutation}
                  approveDeleteMutation={approveDeleteMutation}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Guests */}
        {guestUsers.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-3 flex items-center">
              <UserCircle className="h-5 w-5 mr-2" />
              {t('roles.guests')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {guestUsers.map((user: User) => (
                <UserProfileCard
                  key={user.id}
                  user={user}
                  setSelectedUser={setSelectedUser}
                  setUserModalOpen={setUserModalOpen}
                  deleteUserMutation={deleteUserMutation}
                  approveDeleteMutation={approveDeleteMutation}
                />
              ))}
            </div>
          </div>
        )}
        
        {users.length === 0 && (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <p className="text-muted-foreground">
                  {t('settings.noUsers')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Edit user modal */}
      {selectedUser && (
        <UserFormModal
          user={selectedUser}
          open={userModalOpen}
          onOpenChange={setUserModalOpen}
        />
      )}
    </>
  );
};