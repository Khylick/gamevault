"use client";

import Image from "next/image";
import { useState } from "react";

export function CoverImage({ source }: { source: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <Image src={source} alt="" fill unoptimized referrerPolicy="no-referrer"
      className="object-cover" onError={() => setFailed(true)} />
  );
}
