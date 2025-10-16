export const getCRMUrl = (provider: string, externalId: string): string | null => {
  switch (provider) {
    case 'hubspot':
      return `https://app.hubspot.com/contacts/contact/${externalId}`;
    case 'pipedrive':
      return `https://app.pipedrive.com/person/${externalId}`;
    case 'followupboss':
      return `https://app.followupboss.com/people/${externalId}`;
    default:
      return null;
  }
};

export const getCRMStatus = (lead: any, provider: string): { 
  isLinked: boolean; 
  lastSynced: string | null;
  externalId: string | null;
} => {
  let externalId: string | null = null;
  
  switch (provider) {
    case 'hubspot':
      externalId = lead.hubspot_id;
      break;
    case 'pipedrive':
      externalId = lead.pipedrive_id;
      break;
    case 'followupboss':
      externalId = lead.fub_id;
      break;
  }

  const syncData = lead.crm_sync?.[provider];
  const lastSynced = syncData?.ts || null;
  
  return {
    isLinked: !!externalId,
    lastSynced,
    externalId,
  };
};

export const shouldShowEnrichLocation = (lead: any): boolean => {
  return !lead.latitude || !lead.longitude || !lead.city || !lead.postal_code;
};

export const formatRelativeTime = (isoString: string | null): string => {
  if (!isoString) return 'Never';
  
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
};
