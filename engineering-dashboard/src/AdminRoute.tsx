import React from "react";
import { isAdmin } from "./auth";

type Props = {
  children: React.ReactNode;
  onExpired?: () => void;
};

export default function AdminRoute({ children }: Props) {
  if (!isAdmin()) {
    return null;
  }

  return <>{children}</>;
}