"use client";

import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/constants";
import { getServiceCatalog } from "@/lib/data";

/** Loads the admin-controlled active service list; falls back to defaults. */
export function useServiceCategories(includeDisabled = false) {
  const [categories, setCategories] = useState(CATEGORIES);
  useEffect(() => {
    let cancelled = false;
    getServiceCatalog(includeDisabled).then((catalog) => {
      if (!cancelled) setCategories(catalog.length ? catalog : CATEGORIES);
    });
    return () => { cancelled = true; };
  }, [includeDisabled]);
  return categories;
}
