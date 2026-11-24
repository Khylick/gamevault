import { Gamepad2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { CoverImage } from "./cover-image";
import type { LibraryEntry } from "./model";

const steamCdn = "cdn.cloudflare.steamstatic.com";
const coverHosts = new Set([steamCdn, "cdn.akamai.steamstatic.com", "shared.fastly.steamstatic.com", "shared.cloudflare.steamstatic.com"]);

function getCoverUrl(game: Pick<LibraryEntry, "cover_url" | "platform" | "external_id">) {
  if (game.cover_url && URL.canParse(game.cover_url)) {
    const url = new URL(game.cover_url);
    if (url.protocol === "https:" && !url.username && !url.password && !url.port && coverHosts.has(url.hostname)) {
      return url.href;
    }
  }

  if (game.platform === "steam" && /^[1-9]\d{0,9}$/.test(game.external_id)) {
    return "https://" + steamCdn + "/steam/apps/" + game.external_id + "/library_600x900.jpg";
  }

  return null;
}

export function GameCover({ game, className }: {
  game: Pick<LibraryEntry, "cover_url" | "platform" | "external_id">;
  className?: string;
}) {
  const source = getCoverUrl(game);

  return (
    <div className={cn("relative grid shrink-0 place-items-center overflow-hidden bg-linear-to-br from-accent to-background", className)}>
      <Gamepad2 className="size-1/4 text-primary/60" aria-hidden="true" />
      {source && <CoverImage key={source} source={source} />}
    </div>
  );
}
