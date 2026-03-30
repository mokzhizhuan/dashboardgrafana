import React from "react";
import { Navigate } from "react-router-dom";
import { isAdmin } from "./auth";

type Props = {
  children: React.ReactNode;
};

export default function AdminRoute({ children }: Props) {
  if (!isAdmin()) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

