"use client";

import { Input } from "@patriothacks/ui";
import { useState, type ChangeEvent } from "react";
import { mimeTypeForFileName, mimeTypeMatches } from "../../issues";
import { parseQuestionConfig } from "../../parse";
import type { QuestionFieldProps } from "../field-props";
import {
  FieldShell,
  fieldControlId,
  fieldDescribedBy,
} from "../field-shell";

/**
 * Where a picked file claims to live until a later batch wires object storage.
 * Nothing is uploaded here — the answer carries the metadata the applicant can
 * see, and the real path replaces this once the upload exists.
 */
export const PENDING_UPLOAD_PATH_PREFIX = "pending/";

const BYTE_UNITS = ["bytes", "KB", "MB", "GB"] as const;

export function formatFileSize(bytes: number): string {
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < BYTE_UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? size : Math.round(size * 10) / 10;
  return `${rounded} ${BYTE_UNITS[unit]}`;
}

export function FileUploadField({
  question,
  value,
  onChange,
  error,
  disabled,
}: QuestionFieldProps<"file_upload">) {
  const controlId = fieldControlId(question.id);
  const rejectionId = `${controlId}-rejected`;
  const [rejection, setRejection] = useState<string | null>(null);
  const config = parseQuestionConfig("file_upload", question.config);

  // Without readable limits there is nothing to enforce, and accepting a file
  // the server would reject is worse than declining to offer the control.
  // `validateAnswer` reports the same blob as `invalid_config`.
  if (!config.success) {
    return <FieldShell question={question} error={error} />;
  }

  const { allowedMimeTypes, maxBytes } = config.data;

  function reject(input: HTMLInputElement, message: string): void {
    input.value = "";
    setRejection(message);
    onChange(null);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) {
      setRejection(null);
      onChange(null);
      return;
    }
    if (file.size > maxBytes) {
      reject(
        event.target,
        `That file is ${formatFileSize(file.size)}. The limit is ${formatFileSize(maxBytes)}.`,
      );
      return;
    }
    // Resolved from the file name, exactly as `checkFile` does on the server,
    // so the client and the server never disagree about a file's type.
    const mimeType = mimeTypeForFileName(file.name);
    const allowed =
      mimeType !== null &&
      allowedMimeTypes.some((pattern) => mimeTypeMatches(mimeType, pattern));
    if (!allowed) {
      reject(
        event.target,
        `That file type is not accepted. Allowed file types: ${allowedMimeTypes.join(", ")}.`,
      );
      return;
    }
    setRejection(null);
    onChange({
      path: `${PENDING_UPLOAD_PATH_PREFIX}${file.name}`,
      name: file.name,
      size: file.size,
    });
  }

  return (
    <FieldShell question={question} error={error} labelFor={controlId}>
      <Input
        id={controlId}
        type="file"
        accept={allowedMimeTypes.join(",")}
        disabled={disabled}
        aria-required={question.required}
        aria-invalid={error || rejection ? true : undefined}
        aria-describedby={fieldDescribedBy(
          question,
          error,
          rejection ? rejectionId : null,
        )}
        onChange={handleChange}
      />
      {value ? (
        <p className="text-sm text-muted-foreground">
          {value.name} ({formatFileSize(value.size)})
        </p>
      ) : null}
      {rejection ? (
        <p id={rejectionId} role="alert" className="text-sm text-destructive">
          {rejection}
        </p>
      ) : null}
    </FieldShell>
  );
}
