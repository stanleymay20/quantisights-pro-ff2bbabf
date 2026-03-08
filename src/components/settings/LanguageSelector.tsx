import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Globe } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
];

export const LanguageSelector = () => {
  const { i18n } = useTranslation();

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Globe className="w-4 h-4" />
        Language
      </Label>
      <Select value={i18n.language?.split("-")[0] || "en"} onValueChange={(v) => i18n.changeLanguage(v)}>
        <SelectTrigger className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((l) => (
            <SelectItem key={l.code} value={l.code}>
              {l.flag} {l.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
