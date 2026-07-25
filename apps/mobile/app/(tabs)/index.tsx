import { useTranslation } from "react-i18next";
import { Screen } from "../../src/components/FormUi";
import { useAuth } from "../../src/providers/AuthProvider";

export default function HomeScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  return (
    <Screen
      title={t("home.title", { name: profile?.display_name ?? "" })}
      description={t("home.m1Description")}
    />
  );
}
