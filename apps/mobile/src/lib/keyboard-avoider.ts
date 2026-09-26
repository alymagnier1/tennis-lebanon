/**
 * `padding` only while the keyboard is open; see `KeyboardAvoider`. In padding
 * mode React Native overwrites the caller's bottom padding with the keyboard's
 * height, which is 0 with the keyboard closed -- throwing away the padding that
 * clears the system navigation bar.
 */
export function keyboardAvoiderBehavior(
  keyboardVisible: boolean,
): "padding" | undefined {
  return keyboardVisible ? "padding" : undefined;
}
