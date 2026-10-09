import { avatarHue, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

export type UserAvatarSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASSES: Record<UserAvatarSize, string> = {
  xs: "h-[25px] w-[25px] text-[9px]",
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
};

export interface UserAvatarProps {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  size?: UserAvatarSize;
  className?: string;
}

/** Initials-on-color avatar; deterministic hue per user id. */
export function UserAvatar({
  userId,
  name,
  avatarUrl,
  size = "md",
  className,
}: UserAvatarProps) {
  const hue = avatarHue(userId);
  return (
    <Avatar className={cn(SIZE_CLASSES[size], className)} title={name}>
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt={name} />
      ) : null}
      <AvatarFallback
        style={{
          backgroundColor: `hsl(${hue} 55% 42%)`,
          color: "#ffffff",
        }}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
