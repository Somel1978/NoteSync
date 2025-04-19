import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ImageUploadProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export function ImageUpload({ value, onChange, disabled = false }: ImageUploadProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value || null);

  const handleClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onChange(null);
    setPreview(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log("Selected file:", file.name, "Size:", (file.size / 1024).toFixed(2), "KB", "Type:", file.type);

    // Validate file type (must be an image)
    if (!file.type.startsWith('image/')) {
      alert(t('errors.fileTypeInvalid') || "Please select an image file");
      return;
    }

    // 2MB limit for logo images
    if (file.size > 1024 * 1024 * 2) {
      alert(t('errors.fileTooLarge') || "File is too large (max 2MB)");
      return;
    }

    // Use smaller image sizes for logos
    if (file.size > 1024 * 500) {
      console.log("Large image detected, consider compressing before upload");
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        const base64String = reader.result as string;
        console.log("File converted to base64, length:", base64String.length);
        
        // Set the preview and update form value
        setPreview(base64String);
        onChange(base64String);
      } catch (error) {
        console.error("Error processing file:", error);
        alert(t('errors.fileProcessingError') || "Error processing the image");
      }
    };
    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      alert(t('errors.fileReadError') || "Error reading file");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileChange}
        disabled={disabled}
      />
      
      <div 
        onClick={handleClick}
        className={`
          relative
          cursor-pointer
          rounded-md
          border
          border-dashed
          p-4
          transition
          hover:opacity-70
          flex
          flex-col
          items-center
          justify-center
          gap-4
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${preview ? 'border-none p-0' : 'border-gray-300 bg-gray-50'}
        `}
      >
        {preview ? (
          <div className="relative aspect-square w-full overflow-hidden rounded-md">
            <img 
              src={preview} 
              alt="Logo uploaded" 
              className="object-contain" 
            />
            {!disabled && (
              <Button
                onClick={handleClear}
                type="button"
                size="icon"
                variant="destructive"
                className="absolute top-1 right-1 h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground p-6">
            <Upload className="h-10 w-10 mb-2" />
            <p className="text-sm font-medium">{t('settings.uploadLogo')}</p>
            <p className="text-xs">{t('settings.uploadLogoHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}