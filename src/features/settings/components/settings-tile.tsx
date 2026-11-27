"use client";

import { createContext, useContext } from "react";
import { HeaderAction } from "@/ui/shell-context";
import { Tile, type TileProps } from "@/ui/tile";

/** true inside a settings page: the page header already shows the title (point 21). */
export const SettingsPageContext = createContext(false);

/**
 * Tile of a settings section. On a settings page it has no own title (no duplicate heading
 * under the sticky header), spans the content width, and its action becomes the primary
 * button of the page in the header. Elsewhere it is an ordinary Tile.
 */
export function SettingsTile({ title, action, size, className, children }: TileProps) {
  const embedded = useContext(SettingsPageContext);
  if (!embedded) {
    return (
      <Tile size={size} title={title} action={action} className={className}>
        {children}
      </Tile>
    );
  }
  return (
    <Tile size="XL" className={className}>
      {action && <HeaderAction>{action}</HeaderAction>}
      {children}
    </Tile>
  );
}
