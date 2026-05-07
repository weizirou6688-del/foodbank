type ClassNameValue = string | false | null | undefined;
export function cn(...classNames: ClassNameValue[]) {
  return classNames
    .filter((value): value is string => Boolean(value))
    .join(" ");
}
