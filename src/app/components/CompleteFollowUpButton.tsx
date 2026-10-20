"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CompleteFollowUpButtonProps = {
  eventId: number | string;
};

export default function CompleteFollowUpButton({
  eventId,
}: CompleteFollowUpButtonProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleComplete() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/application-events/${eventId}`, {
        method: "PATCH",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo completar el seguimiento");
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ocurrió un error inesperado",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={handleComplete}
        disabled={saving}
      >
        {saving ? "Guardando..." : "Marcar como completado"}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}
