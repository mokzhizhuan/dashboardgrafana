import React from "react";
import { isLoggedIn, isAdmin } from "./auth";

type Props = {
  children: React.ReactNode;
  onExpired?: () => void;
  onForbidden?: () => void;
};

export default function AdminRoute({ children, onExpired, onForbidden }: Props) {
  if (!isLoggedIn()) {
    onExpired?.();
    return null;
  }

  if (!isAdmin()) {
    onForbidden?.();
    return null;
  }

  return <>{children}</>;
}