"use client";

import React from "react";
import ChatWidget from "@/components/ChatWidget";

export default function ChatPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = React.use(params);
  return <ChatWidget tenantId={tenantId} />;
}
