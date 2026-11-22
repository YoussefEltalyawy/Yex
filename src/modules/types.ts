import type { ComponentType, LazyExoticComponent } from "react";
import type { IconType } from "@/ui/core";

export interface PageProps {
  params: Record<string, string>;
}

export interface NavItem {
  label: string;
  icon: IconType;
  route: string;
  order: number;
  shortcut?: string;
}

export interface Command {
  id: string;
  label: string;
  group: string;
  icon?: IconType;
  emoji?: string;
  hint?: string;
  keywords?: string;
  run: () => void;
}

/**
 * A feature module. New areas of life (gym, library, …) plug in by adding a
 * ModuleDef here plus their entities in yex-core's schema registry.
 */
export interface ModuleDef {
  id: string;
  pages: Record<string, ComponentType<PageProps> | LazyExoticComponent<ComponentType<PageProps>>>;
  nav?: NavItem[];
  commands?: Command[];
}
