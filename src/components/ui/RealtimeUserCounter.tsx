"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface RealtimeUserCounterProps {
  initialCount: number;
}

export default function RealtimeUserCounter({ initialCount }: RealtimeUserCounterProps) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const supabase = createClient();
    
    // Subscribe to Postgres changes for the 'profiles' table to monitor registration/deletion
    const channel = supabase
      .channel("realtime-profiles")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        async () => {
          // Fetch the latest exact count of profiles
          const { count: freshCount } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true });
          if (freshCount !== null) {
            setCount(freshCount);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return <>{count}</>;
}
