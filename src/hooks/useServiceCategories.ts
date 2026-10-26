"use client";

import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/constants";
import { getDisabledServiceIds } from "@/lib/data";

/** Loads the admin-controlled active service list; falls back to defaults. */
export function useServiceCategories() {
  const [categories, setCategories] = useState(CATEGORIES);
  useEffect(() => {
    let cancelled = false;
    getDisabledServiceIds().then((disabled) => {
      if (!cancelled) setCategories(CATEGORIES.filter((category) => !disabled.includes(category.id)));
    });
    return () => { cancelled = true; };
  }, []);
  return categories;
}
