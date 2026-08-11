import React from "react";
import { useLang } from "../LangContext";

export default function LoadingIndicator({ full = false }) {
  const { t } = useLang();
  return (
    <div className={full ? "flex flex-col items-center justify-center py-24" : "flex flex-col items-center justify-center py-10"}>
      <div className="w-10 h-10 rounded-full border-4 border-everest-200 border-t-everest-600 animate-spin" style={{ animationDuration: "0.8s" }} />
      <p className="mt-4 text-sm text-gray-500 animate-pulse">{t("جارٍ التحميل...", "Loading...")}</p>
    </div>
  );
}
