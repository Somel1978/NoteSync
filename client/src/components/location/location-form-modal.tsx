import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { InsertLocation, Location } from "@shared/schema";

// Form schema
const locationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
});

type LocationFormValues = z.infer<typeof locationSchema>;

interface LocationFormModalProps {
  location?: Location;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationFormModal({
  location,
  open,
  onOpenChange,
}: LocationFormModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(open);

  // Update local state when prop changes
  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  // Initialize form
  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: location?.name || "",
      description: location?.description || "",
    },
  });

  // Reset form when modal opens/closes or location changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: location?.name || "",
        description: location?.description || "",
      });
    }
  }, [open, location, form]);

  // Create location mutation
  const createLocationMutation = useMutation({
    mutationFn: async (data: InsertLocation) => {
      const res = await apiRequest("POST", "/api/locations", data);
      if (!res.ok) throw new Error("Failed to create location");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/locations'] });
      toast({
        title: t('locations.addLocation'),
        description: t('common.success'),
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: t('locations.addLocation'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update location mutation
  const updateLocationMutation = useMutation({
    mutationFn: async (data: Partial<Location>) => {
      const res = await apiRequest("PATCH", `/api/locations/${location?.id}`, data);
      if (!res.ok) throw new Error("Failed to update location");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/locations'] });
      toast({
        title: t('locations.editLocation'),
        description: t('common.success'),
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: t('locations.editLocation'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission
  const onSubmit = (data: LocationFormValues) => {
    if (location) {
      updateLocationMutation.mutate(data);
    } else {
      createLocationMutation.mutate(data);
    }
  };

  // Close modal
  const handleClose = () => {
    setIsOpen(false);
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(value) => {
      setIsOpen(value);
      if (!value) handleClose();
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {location 
              ? t('locations.editLocation')
              : t('locations.addLocation')
            }
          </DialogTitle>
          <DialogDescription>
            {location
              ? t('settings.editLocationDesc', { name: location.name })
              : t('settings.addLocationDesc')
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('locations.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('locations.name')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('locations.description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('locations.description')}
                      className="resize-none"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={
                  createLocationMutation.isPending ||
                  updateLocationMutation.isPending
                }
              >
                {createLocationMutation.isPending || updateLocationMutation.isPending
                  ? t('common.saving')
                  : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}