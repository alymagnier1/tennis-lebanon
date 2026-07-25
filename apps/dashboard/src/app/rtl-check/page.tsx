import { I18nProvider } from "@/components/I18nProvider";
import { RtlCheckPanel } from "./RtlCheckPanel";

export default function RtlCheckPage() {
  return (
    <I18nProvider>
      <RtlCheckPanel />
    </I18nProvider>
  );
}
