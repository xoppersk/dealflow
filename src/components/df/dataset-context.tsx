"use client";

/** Dataset context: server pages fetch the workspace Dataset (lib/df/db)
 *  and hand it to client components through this provider (props-in at the
 *  page/shell root; deep components read it with useDataset). */
import { createContext, useContext, type ReactNode } from "react";
import type { Dataset } from "@/lib/df/types";

const Ctx = createContext<Dataset | null>(null);

export function DatasetProvider({ dataset, children }: { dataset: Dataset; children: ReactNode }) {
  return <Ctx.Provider value={dataset}>{children}</Ctx.Provider>;
}

export function useDataset(): Dataset {
  const ds = useContext(Ctx);
  if (!ds) throw new Error("useDataset must be used inside a DatasetProvider");
  return ds;
}

export function useDatasetOptional(): Dataset | null {
  return useContext(Ctx);
}
