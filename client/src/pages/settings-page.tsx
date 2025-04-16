import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/app-layout";
import { RoomFormModal } from "@/components/room/room-form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Trash, UserCircle, ShieldCheck, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Room, Location, User, InsertUser } from "@shared/schema";

// Form for creating new users
const newUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "director", "guest"]),
});

// Form for changing password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmNewPassword: z.string().min(6, "Password confirmation is required"),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Passwords do not match",
  path: ["confirmNewPassword"],
});

type NewUserFormValues = z.infer<typeof newUserSchema>;

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("rooms");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const { toast } = useToast();

  const { data: rooms, isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
  });

  const { data: locations, isLoading: locationsLoading } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/rooms/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Room deleted",
        description: "The room has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete room",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "The user has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: NewUserFormValues) => {
      const res = await apiRequest("POST", "/api/register", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "User created",
        description: "The user has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      form.reset({
        name: "",
        username: "",
        email: "",
        password: "",
        role: "user",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "",
      role: "guest",
    },
  });

  const onSubmit = (data: NewUserFormValues) => {
    createUserMutation.mutate(data);
  };

  const handleEditRoom = (room: Room) => {
    setSelectedRoom(room);
    setRoomModalOpen(true);
  };

  const handleDeleteRoom = (roomId: number) => {
    if (confirm("Are you sure you want to delete this room? This action cannot be undone.")) {
      deleteRoomMutation.mutate(roomId);
    }
  };

  const handleDeleteUser = (userId: number) => {
    if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      deleteUserMutation.mutate(userId);
    }
  };

  const getLocationName = (locationId: number) => {
    if (!locations) return `Location #${locationId}`;
    const location = locations.find(loc => loc.id === locationId);
    return location ? location.name : `Location #${locationId}`;
  };

  return (
    <AppLayout>
      <div className="p-8">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-800">Settings</h1>
          <p className="text-gray-600 text-sm">Manage application settings and preferences</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Settings Navigation */}
          <div className="md:col-span-1">
            <nav className="space-y-1">
              <a
                href="#general-settings"
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  activeTab === "general" ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
                onClick={() => setActiveTab("general")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="text-gray-500 mr-3 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                General Settings
              </a>

              <a
                href="#localization"
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  activeTab === "localization" ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
                onClick={() => setActiveTab("localization")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="text-gray-400 group-hover:text-gray-500 mr-3 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                Localization
              </a>

              <a
                href="#rooms"
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  activeTab === "rooms" ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
                onClick={() => setActiveTab("rooms")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="text-gray-400 group-hover:text-gray-500 mr-3 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Rooms
              </a>

              <a
                href="#users"
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  activeTab === "users" ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
                onClick={() => setActiveTab("users")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="text-gray-400 group-hover:text-gray-500 mr-3 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Users
              </a>
            </nav>
          </div>

          {/* Settings Content */}
          <div className="md:col-span-3">
            <Card>
              <CardContent className="p-6">
                <Tabs defaultValue="rooms" value={activeTab} onValueChange={setActiveTab}>
                  <TabsContent value="general">
                    <h2 className="text-lg leading-6 font-medium text-gray-900 mb-4">General Settings</h2>
                    <p className="text-gray-500">General application settings will appear here.</p>
                  </TabsContent>
                  
                  <TabsContent value="localization">
                    <h2 className="text-lg leading-6 font-medium text-gray-900 mb-4">Localization</h2>
                    <p className="text-gray-500">Language and localization settings will appear here.</p>
                  </TabsContent>
                  
                  <TabsContent value="rooms">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg leading-6 font-medium text-gray-900">Rooms</h2>
                      <Button
                        onClick={() => {
                          setSelectedRoom(null);
                          setRoomModalOpen(true);
                        }}
                      >
                        Add Room
                      </Button>
                    </div>

                    {roomsLoading ? (
                      <div className="flex justify-center items-center h-24">
                        <p className="text-gray-500">Loading rooms...</p>
                      </div>
                    ) : rooms && rooms.length > 0 ? (
                      <div className="space-y-6">
                        {rooms.map((room) => (
                          <div key={room.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="text-lg font-medium text-gray-900">{room.name}</h3>
                                <p className="text-sm text-gray-500">{getLocationName(room.locationId)}</p>
                              </div>
                              <div className="flex space-x-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditRoom(room)}
                                >
                                  <Pencil className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteRoom(room.id)}
                                >
                                  <Trash className="h-5 w-5 text-gray-400 hover:text-red-500" />
                                </Button>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span className="text-sm text-gray-700">Capacity: {room.capacity}</span>
                              </div>
                              <div className="flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm text-gray-700">
                                  Flat Rate: {room.flatRate ? `€${(room.flatRate / 100).toFixed(2)}` : "N/A"}
                                </span>
                              </div>
                              <div className="flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm text-gray-700">
                                  Hourly Rate: {room.hourlyRate ? `€${(room.hourlyRate / 100).toFixed(2)}` : "N/A"}
                                </span>
                              </div>
                            </div>

                            {room.description && (
                              <div className="mt-4">
                                <p className="text-sm text-gray-700">{room.description}</p>
                              </div>
                            )}

                            {room.facilities && Array.isArray(room.facilities) && (room.facilities as any).length > 0 && (
                              <div className="mt-4">
                                <h4 className="text-sm font-medium text-gray-700">Facilities</h4>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {(room.facilities as any).map((facility: any) => (
                                    <Badge key={facility.id} variant="secondary">
                                      {facility.name}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="mt-4 flex items-center">
                              <div className="flex h-5 items-center">
                                <div className={`h-2.5 w-2.5 rounded-full mr-2 ${room.active ? "bg-green-500" : "bg-gray-400"}`}></div>
                              </div>
                              <div className="text-sm">
                                <p className="font-medium text-gray-700">{room.active ? "Active" : "Inactive"}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <p className="text-gray-500 mb-4">No rooms found</p>
                        <Button
                          onClick={() => {
                            setSelectedRoom(null);
                            setRoomModalOpen(true);
                          }}
                        >
                          Add Your First Room
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="users">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div>
                        <h2 className="text-lg leading-6 font-medium text-gray-900 mb-4">Users</h2>
                        
                        {usersLoading ? (
                          <div className="flex justify-center items-center h-24">
                            <p className="text-gray-500">Loading users...</p>
                          </div>
                        ) : users && users.length > 0 ? (
                          <div className="space-y-4">
                            {users.map((user) => (
                              <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex items-center">
                                  <div className="mr-3">
                                    {user.role === "admin" ? (
                                      <ShieldCheck className="h-8 w-8 text-purple-500" />
                                    ) : user.role === "approver" ? (
                                      <CheckCircle className="h-8 w-8 text-green-500" />
                                    ) : (
                                      <UserCircle className="h-8 w-8 text-blue-500" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium">{user.name}</p>
                                    <p className="text-sm text-gray-500">{user.email}</p>
                                    <div className="flex gap-2 mt-1">
                                      <Badge variant={
                                        user.role === "admin" ? "destructive" :
                                        user.role === "approver" ? "success" :
                                        "secondary"
                                      }>
                                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteUser(user.id)}
                                >
                                  <Trash className="h-5 w-5 text-gray-400 hover:text-red-500" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            <p className="text-gray-500">No users found</p>
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <h2 className="text-lg leading-6 font-medium text-gray-900 mb-4">Add New User</h2>
                        
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                              control={form.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Email address" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Full Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Full name" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="username"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Username</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Username" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="password"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Password</FormLabel>
                                  <FormControl>
                                    <Input type="password" placeholder="Password" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="role"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Role</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select a role" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="user">User</SelectItem>
                                      <SelectItem value="approver">Approver</SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <div className="pt-2">
                              <Button
                                type="submit"
                                className="w-full"
                                disabled={createUserMutation.isPending}
                              >
                                {createUserMutation.isPending ? "Creating..." : "Create User"}
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </div>
                    </div>
                  </TabsContent>
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
    </AppLayout>
  );
}
