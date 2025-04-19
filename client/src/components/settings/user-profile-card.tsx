import { UseMutationResult } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { UserCircle, ShieldCheck, UserCog, CheckCircle, Pencil, Trash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

interface UserProfileCardProps {
  user: User;
  setSelectedUser: (user: User) => void;
  setUserModalOpen: (open: boolean) => void;
  deleteUserMutation: UseMutationResult<any, Error, number>;
  approveDeleteMutation: UseMutationResult<any, Error, number>;
}

export const UserProfileCard = ({ 
  user, 
  setSelectedUser, 
  setUserModalOpen,
  deleteUserMutation,
  approveDeleteMutation
}: UserProfileCardProps) => {
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