let pending = false;

/** Set when Auth fires PASSWORD_RECOVERY so routing can land on set-password. */
export function markPasswordRecoveryPending(): void {
  pending = true;
}

export function clearPasswordRecoveryPending(): void {
  pending = false;
}

export function isPasswordRecoveryPending(): boolean {
  return pending;
}
