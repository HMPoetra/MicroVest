"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Waktu tidak aktif maksimal sebelum otomatis logout (contoh: 15 menit)
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; 

export default function AutoLogout() {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(async () => {
      // Jika waktu habis (idle), lakukan logout otomatis
      const supabase = createClient();
      await supabase.auth.signOut();
      
      // Arahkan kembali ke halaman login
      router.push("/login?session_expired=true");
      router.refresh();
    }, INACTIVITY_TIMEOUT);
  };

  useEffect(() => {
    // Jalankan timer pertama kali komponen dimuat
    resetTimer();

    // Daftar event yang dianggap sebagai aktivitas user
    const events = ["mousemove", "keydown", "wheel", "DOMMouseScroll", "mouseWheel", "mousedown", "touchstart", "touchmove"];
    
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, []);

  // Komponen ini berjalan di background, tidak menampilkan apa-apa ke layar
  return null;
}
