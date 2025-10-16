import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UseRealtimeDashboardProps {
  orgId: string;
  onRefresh: () => void;
}

export const useRealtimeDashboard = ({ orgId, onRefresh }: UseRealtimeDashboardProps) => {
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  useEffect(() => {
    if (!orgId) return;

    // Debounced refresh function
    const debouncedRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        onRefresh();
        setLastUpdate(new Date());
      }, 500);
    };

    // Subscribe to leads changes
    const leadsChannel = supabase
      .channel('dashboard-leads')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          console.log('Leads update:', payload);
          debouncedRefresh();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsLive(true);
        }
      });

    // Subscribe to interactions changes
    const interactionsChannel = supabase
      .channel('dashboard-interactions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'interactions',
        },
        (payload) => {
          console.log('Interaction created:', payload);
          debouncedRefresh();
        }
      )
      .subscribe();

    // Subscribe to intent snapshots
    const intentChannel = supabase
      .channel('dashboard-intent')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'intent_snapshots',
        },
        (payload) => {
          console.log('Intent snapshot created:', payload);
          debouncedRefresh();
        }
      )
      .subscribe();

    // Subscribe to campaigns
    const campaignsChannel = supabase
      .channel('dashboard-campaigns')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaigns',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          console.log('Campaign update:', payload);
          debouncedRefresh();
        }
      )
      .subscribe();

    // Safety: full refresh every 60 seconds
    const fullRefreshInterval = setInterval(() => {
      onRefresh();
      setLastUpdate(new Date());
    }, 60000);

    // Cleanup
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      clearInterval(fullRefreshInterval);
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(interactionsChannel);
      supabase.removeChannel(intentChannel);
      supabase.removeChannel(campaignsChannel);
      setIsLive(false);
    };
  }, [orgId, onRefresh]);

  return {
    isLive,
    lastUpdate,
  };
};
