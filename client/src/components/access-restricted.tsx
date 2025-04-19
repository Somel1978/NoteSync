import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

type AccessRestrictedType = "admin" | "adminOrDirector" | "login";

interface AccessRestrictedProps {
  type?: AccessRestrictedType;
}

export function AccessRestricted({ type = "login" }: AccessRestrictedProps) {
  const { t } = useTranslation();

  // Fetch appearance settings to get logo
  const { data: appearance } = useQuery({
    queryKey: ['/api/settings/appearance'],
    // Retry false to avoid infinite retries on 401 responses
    retry: false,
  });

  const getMessage = () => {
    switch (type) {
      case "admin":
        return t('accessRestricted.adminRequired');
      case "adminOrDirector":
        return t('accessRestricted.adminOrDirectorRequired');
      case "login":
      default:
        return t('accessRestricted.loginRequired');
    }
  };

  const logoStyle = {
    opacity: 0.03,
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)', 
    width: '70%',
    height: '70%',
    backgroundImage: appearance?.logoUrl ? `url(${appearance.logoUrl})` : 'none',
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    zIndex: -1,
  } as React.CSSProperties;

  const logoTextStyle = {
    display: appearance?.logoUrl ? 'none' : 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.05,
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '100%',
    height: '100%',
    fontSize: '20rem',
    fontWeight: 'bold',
    zIndex: -1,
  } as React.CSSProperties;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 relative">
      {/* Watermark logo */}
      {appearance?.useLogoImage !== false && 
        <div style={logoStyle}></div>
      }
      {(!appearance?.useLogoImage || !appearance?.logoUrl) && 
        <div style={logoTextStyle}>
          {appearance?.logoText || 'AC'}
        </div>
      }

      <div className="text-center z-10 bg-background/80 p-8 rounded-lg shadow-lg backdrop-blur-sm">
        <h1 className="text-3xl font-bold mb-2">{t('accessRestricted.title')}</h1>
        <p className="text-lg text-muted-foreground mb-8">{getMessage()}</p>

        <Button asChild size="lg">
          <Link href="/">
            {t('accessRestricted.backToHome')}
          </Link>
        </Button>
      </div>
    </div>
  );
}